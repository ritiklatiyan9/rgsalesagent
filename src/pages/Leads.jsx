import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from '@/components/ui/drawer';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/lib/axios';
import { cachedGet, getCachedSync, invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Pencil, Search, Users,
  ChevronLeft, ChevronRight, AlertCircle, Eye,
  BellPlus, Camera, X, ImageIcon, PhoneOutgoing,
} from 'lucide-react';
import CallTimeline from '@/components/CallTimeline';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const FOLLOWUP_TYPES = [
  { value: 'CALL',       label: 'Call' },
  { value: 'FOLLOWUP',  label: 'Follow-up' },
  { value: 'SITE_VISIT', label: 'Site Visit' },
  { value: 'MEETING',   label: 'Meeting' },
  { value: 'OTHER',     label: 'Other' },
];

const EMPTY_SCHEDULE_FORM = {
  followup_type: 'CALL',
  scheduled_date: new Date().toISOString().slice(0, 10),
  scheduled_time: '',
  notes: '',
};

const ScheduleFollowupDialog = ({ lead, open, onClose }) => {
  const [form, setForm] = useState(EMPTY_SCHEDULE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_SCHEDULE_FORM, scheduled_date: new Date().toISOString().slice(0, 10) });
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.scheduled_date) { setError('Please pick a date.'); return; }
    setSaving(true);
    try {
      await api.post('/followups', {
        lead_id: lead.id,
        followup_type: form.followup_type,
        scheduled_date: form.scheduled_date,
        ...(form.scheduled_time ? { scheduled_time: form.scheduled_time } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      invalidateCache('/followups?limit=100');
      invalidateCache('/followups/counts');
      toast.success(`Follow-up scheduled for ${lead.name}`);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to schedule follow-up.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <BellPlus className="h-4 w-4 text-amber-600" />
            </div>
            Schedule Follow-up
          </DialogTitle>
          <DialogDescription>Set a reminder follow-up for <strong>{lead?.name}</strong></DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error && (
            <Alert variant="destructive" className="py-2.5 bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-xs text-red-800 font-medium ml-2">{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Type</Label>
            <Select value={form.followup_type} onValueChange={(v) => setForm((p) => ({ ...p, followup_type: v }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FOLLOWUP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input type="date" className="h-9" min={new Date().toISOString().slice(0, 10)}
                value={form.scheduled_date}
                onChange={(e) => setForm((p) => ({ ...p, scheduled_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time (optional)</Label>
              <Input type="time" className="h-9"
                value={form.scheduled_time}
                onChange={(e) => setForm((p) => ({ ...p, scheduled_time: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes (optional)</Label>
            <Textarea rows={3} placeholder="Any notes or reminders..." className="resize-none text-sm"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 px-4 text-sm">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-9 px-4 text-sm bg-amber-600 hover:bg-amber-700">
              {saving ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New Lead', color: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { value: 'INTERESTED', label: 'Interested', color: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  { value: 'SITE_VISIT', label: 'Site Visit', color: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { value: 'NEGOTIATION', label: 'Negotiation', color: 'bg-purple-50 text-purple-700 ring-purple-200' },
  { value: 'BOOKED', label: 'Booked', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'LOST', label: 'Lost', color: 'bg-slate-50 text-slate-700 ring-slate-200' },
  { value: 'INCOMING_OFF', label: 'Incoming Off', color: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { value: 'SWITCH_OFF', label: 'Switch Off', color: 'bg-red-50 text-red-700 ring-red-200' },
  { value: 'NOT_ANSWERING', label: 'Not Answering', color: 'bg-rose-50 text-rose-700 ring-rose-200' },
];

const STATUS_ACCENT_MAP = {
  NEW: '#3b82f6',
  CONTACTED: '#f59e0b',
  INTERESTED: '#6366f1',
  SITE_VISIT: '#8b5cf6',
  NEGOTIATION: '#a855f7',
  BOOKED: '#10b981',
  LOST: '#94a3b8',
  INCOMING_OFF: '#f97316',
  SWITCH_OFF: '#ef4444',
  NOT_ANSWERING: '#f43f5e',
};

const LEAD_CATEGORY_OPTIONS = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];
const LEAD_SOURCE_OPTIONS = ['Direct', 'Referral', 'Website', 'Advertisement', 'Event', 'Direct Visit', 'Calling Visit', 'Site Visit', 'Other'];

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '', profession: '', status: 'NEW', lead_category: '', lead_source: 'Other', notes: '',
};

// O(1) status lookup — avoids .find() on every row render
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s]));

// Builds the canonical API URL for a given filter set — used both in fetchLeads and cache probe
function buildLeadsUrl(page, search, status, category) {
  let url = `/leads?page=${page}&limit=15`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (status === 'ACTIVE') url += `&exclude_status=NEW`;
  else if (status !== 'ALL') url += `&status=${status}`;
  if (category !== 'ALL') url += `&lead_category=${encodeURIComponent(category)}`;
  return url;
}

// Memoised card — only re-renders when its own data or selection changes
const LeadCard = memo(({ lead, selected, onSelect, onCall, onWhatsApp, onView, onEdit, onSchedule }) => {
  const statusObj = STATUS_MAP[lead.status] || STATUS_OPTIONS[0];
  const accent = STATUS_ACCENT_MAP[lead.status] || '#94a3b8';
  return (
    <div
      className={`relative bg-white rounded-[22px] overflow-hidden transition-all duration-200 ring-1 ${
        selected
          ? 'ring-indigo-300 shadow-[0_4px_18px_-4px_rgba(99,102,241,0.25)]'
          : 'ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)]'
      }`}
    >
      {/* Top accent bar */}
      <div className="h-[2px] w-full" style={{ backgroundColor: accent }} />

      {/* Top section: avatar + details + checkbox */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
        {/* Avatar */}
        <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-indigo-50 to-violet-100 ring-1 ring-inset ring-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
          {lead.photo_url ? (
            <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="text-lg font-bold text-indigo-700" style={serif}>{lead.name?.charAt(0)?.toUpperCase()}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900 leading-snug truncate pr-1" style={serif}>{lead.name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex items-center text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold ring-1 ring-inset ${statusObj.color}`}>
              {statusObj.label}
            </span>
            {lead.lead_category && (
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold bg-slate-50 ring-1 ring-inset ring-slate-200 px-1.5 py-0.5 rounded-full">
                {lead.lead_category}
              </span>
            )}
          </div>
          {lead.phone && (
            <p className="text-[11px] text-slate-500 mt-1 font-mono tracking-tight">{lead.phone}</p>
          )}
        </div>

        {/* Checkbox — far right */}
        <div className="shrink-0 pt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(lead.id)}
            className="h-5 w-5 rounded-md border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
          />
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
        <Button
          size="sm"
          className="flex-1 h-8 text-[11px] font-bold text-white bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl gap-1.5 shadow-sm shadow-emerald-200/50"
          onClick={() => onCall(lead)}
        >
          <PhoneOutgoing className="h-3.5 w-3.5" /> Call
        </Button>
        <button
          onClick={() => onWhatsApp(lead.phone)}
          className="h-8 w-8 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-green-600 hover:bg-green-50 hover:text-green-700 flex items-center justify-center active:scale-95 transition-all duration-150"
          title="WhatsApp"
        >
          <WhatsAppIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onView(lead)}
          className="h-8 w-8 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-center active:scale-95 transition-all duration-150"
          title="View"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onEdit(lead)}
          className="h-8 w-8 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-center active:scale-95 transition-all duration-150"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onSchedule(lead)}
          className="h-8 w-8 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 flex items-center justify-center active:scale-95 transition-all duration-150"
          title="Schedule"
        >
          <BellPlus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
LeadCard.displayName = 'LeadCard';

const Leads = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  // Default to ACTIVE (all statuses except NEW) — NEW leads have their own Fresh Leads section on Dashboard
  const initialStatus = searchParams.get('status') || 'ACTIVE';
  const initialCategory = searchParams.get('lead_category') || searchParams.get('category') || 'ALL';

  // Probe memory cache synchronously so we can skip skeleton on navigation back
  const _initCached = getCachedSync(buildLeadsUrl(1, initialSearch, initialStatus, initialCategory));

  const [leads, setLeads] = useState(() => _initCached?.leads ?? []);
  const [loading, setLoading] = useState(() => !_initCached);
  const [refreshing, setRefreshing] = useState(false); // silent background sync indicator

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(() => _initCached?.pagination?.totalPages ?? 1);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);

  // Track whether we already have data so fetchLeads knows to skip skeleton
  const hasDataRef = useRef(Boolean(_initCached));

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  // View dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [viewCallHistory, setViewCallHistory] = useState([]);
  const [viewCallLoading, setViewCallLoading] = useState(false);

  // Schedule Follow-up
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLead, setScheduleLead] = useState(null);

  // Shift to Call selection
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [shiftLoading, setShiftLoading] = useState(false);

  const fetchLeads = useCallback(async (page, search, status, fresh = false, category) => {
    const hasData = hasDataRef.current;
    if (!hasData) setLoading(true);
    else setRefreshing(true);
    try {
      const url = buildLeadsUrl(page, search, status, category) + (fresh ? `&_t=${Date.now()}` : '');
      const data = await cachedGet(url, { staleTime: 300_000, cacheTime: 600_000 });
      if (data.success) {
        setLeads(data.leads);
        setTotalPages(data.pagination.totalPages);
        hasDataRef.current = true;
      }
    } catch (err) {
      console.error('Failed to fetch leads', err);
      if (!hasDataRef.current) toast.error('Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // stable — all values passed as args, no state deps

  // Keep a ref so the debounce effect always sees the latest fetchLeads without it being a dep
  const fetchLeadsRef = useRef(fetchLeads);
  fetchLeadsRef.current = fetchLeads;

  useEffect(() => {
    const nextSearch = searchParams.get('search') || '';
    const nextStatus = searchParams.get('status') || 'ACTIVE';
    const nextCategory = searchParams.get('lead_category') || searchParams.get('category') || 'ALL';

    setSearchQuery((prev) => (prev === nextSearch ? prev : nextSearch));
    setStatusFilter((prev) => (prev === nextStatus ? prev : nextStatus));
    setCategoryFilter((prev) => (prev === nextCategory ? prev : nextCategory));
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Use ref so fetchLeads is never a dep (prevents double-fetch on filter change)
      fetchLeadsRef.current(1, searchQuery, statusFilter, false, categoryFilter);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, categoryFilter]);

  // Keep URL in sync with active filters so dashboard quick-search works reliably.
  useEffect(() => {
    const next = {};
    if (searchQuery) next.search = searchQuery;
    if (statusFilter !== 'ALL') next.status = statusFilter;
    if (categoryFilter !== 'ALL') next.lead_category = categoryFilter;
    setSearchParams(next, { replace: true });
  }, [searchQuery, statusFilter, categoryFilter, setSearchParams]);

  // Pre-fetch next page
  useEffect(() => {
    if (currentPage < totalPages) {
      cachedGet(buildLeadsUrl(currentPage + 1, searchQuery, statusFilter, categoryFilter));
    }
  }, [currentPage, totalPages, searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    const currentIds = new Set(leads.map((l) => l.id));
    setSelectedLeadIds((prev) => prev.filter((id) => currentIds.has(id)));
  }, [leads]);

  const openEdit = useCallback((lead) => {
    console.log('testCallDrawer()');
    setEditId(lead.id);
    setForm({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      address: lead.address || '',
      profession: lead.profession || '',
      status: lead.status || 'NEW',
      lead_category: lead.lead_category || '',
      lead_source: lead.lead_source || 'Other',
      notes: lead.notes || '',
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(lead.photo_url || null);
    setRemovePhoto(false);
    setFormError('');
    setDialogOpen(true);
  }, []);

  const openView = useCallback(async (lead) => {
    setViewTarget(lead);
    setViewCallHistory([]);
    setViewOpen(true);
    
    // Fetch call history
    if (lead.id) {
      setViewCallLoading(true);
      try {
        const { data } = await api.get(`/calls/lead/${lead.id}`);
        if (data?.success && data?.calls) {
          setViewCallHistory(Array.isArray(data.calls) ? data.calls : []);
        }
      } catch (err) {
        console.error('Failed to fetch call history:', err);
        setViewCallHistory([]);
      } finally {
        setViewCallLoading(false);
      }
    }
  }, []);

  const openSchedule = useCallback((lead) => {
    setScheduleLead(lead);
    setScheduleOpen(true);
  }, []);

  const toggleLeadSelection = useCallback((leadId) => {
    setSelectedLeadIds((prev) => (
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    ));
  }, []);

  const toggleSelectAllOnPage = () => {
    const pageIds = leads.map((l) => l.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleShiftToCall = async ({ selectAllFiltered = false } = {}) => {
    if (!selectAllFiltered && selectedLeadIds.length === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    setShiftLoading(true);
    try {
      const payload = selectAllFiltered
        ? {
          select_all: true,
          search: searchQuery,
          status: statusFilter,
          lead_category: categoryFilter,
        }
        : { lead_ids: selectedLeadIds };

      const { data } = await api.post('/leads/shift-to-call', payload);
      if (!data?.success) {
        toast.error(data?.message || 'Failed to shift leads');
        return;
      }

      setSelectedLeadIds([]);
      toast.success(data?.message || 'Leads shifted to call queue');
      navigate('/contacts/shift-to-call');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to shift leads');
    } finally {
      setShiftLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) return setFormError('Name is required.');
    if (!form.phone.trim() && !form.email.trim()) return setFormError('Either phone or email is required.');

    setFormLoading(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        payload.append(key, val);
      });
      if (editPhotoFile) payload.append('photo', editPhotoFile);
      if (removePhoto) payload.append('remove_photo', 'true');
      await api.put(`/leads/${editId}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Lead updated successfully');
      invalidateCache('/leads');
      fetchLeads(currentPage, searchQuery, statusFilter, true, categoryFilter);
      setDialogOpen(false);
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save lead.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCallLead = useCallback((lead) => {
    if (!lead?.phone) {
      toast.error('No phone number available');
      return;
    }
    const params = new URLSearchParams({
      lead_id: String(lead.id),
      lead_name: lead.name || 'Lead',
      lead_phone: lead.phone || '',
      autoCall: 'true',
      source: 'leads',
    });
    navigate(`/calls/dialer?${params.toString()}`);
  }, [navigate]);

  const handleOpenWhatsApp = useCallback((phone) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    window.open(`https://wa.me/${waNumber}`, '_blank');
  }, []);

  // O(1) lookups — avoids .includes() on every row render
  const selectedSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);
  const allSelected = useMemo(() => leads.length > 0 && leads.every((l) => selectedSet.has(l.id)), [leads, selectedSet]);
  const someSelected = useMemo(() => !allSelected && leads.some((l) => selectedSet.has(l.id)), [allSelected, leads, selectedSet]);

  return (
    <>
      {/* Shift action bar — shows when leads are selected */}
      {selectedLeadIds.length > 0 && (
        <div className="flex items-center justify-between gap-2 bg-linear-to-r from-indigo-600 to-violet-600 rounded-[18px] px-3.5 py-2 shadow-sm shadow-indigo-300/40">
          <span className="text-[11px] text-white font-bold uppercase tracking-wider">
            {selectedLeadIds.length} <span className="text-white/70 font-normal italic normal-case" style={serif}>selected</span>
          </span>
          <button
            disabled={shiftLoading}
            onClick={() => handleShiftToCall()}
            className="h-7 px-2.5 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 rounded-full flex items-center gap-1.5 active:scale-95 transition-all duration-150 disabled:opacity-60"
          >
            {shiftLoading
              ? <span className="h-3 w-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              : <PhoneOutgoing className="h-3.5 w-3.5" />
            }
            Shift to Queue
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-[13px] rounded-2xl bg-white border-0 ring-1 ring-inset ring-slate-200 focus-visible:ring-indigo-300"
          />
          {refreshing && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-indigo-400 animate-pulse" title="Syncing…" />
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[104px] h-10 text-[11px] font-bold uppercase tracking-wider rounded-2xl shrink-0 bg-white border-0 ring-1 ring-inset ring-slate-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE" className="text-xs font-medium text-emerald-700">All Active</SelectItem>
            <SelectItem value="ALL" className="text-xs font-medium">All (incl. New)</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[88px] h-10 text-[11px] font-bold uppercase tracking-wider rounded-2xl shrink-0 bg-white border-0 ring-1 ring-inset ring-slate-200">
            <SelectValue placeholder="Cat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs font-medium">All Cat</SelectItem>
            {LEAD_CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count + Select All row */}
      {!loading && leads.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-baseline gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Results</p>
            <span className="text-[15px] font-bold text-slate-900" style={serif}>{leads.length}</span>
            <span className="text-[11px] italic text-slate-500" style={serif}>
              lead{leads.length !== 1 ? 's' : ''}
            </span>
            {selectedLeadIds.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 ml-1">
                · {selectedLeadIds.length} selected
              </span>
            )}
          </div>
          <button
            className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
            onClick={toggleSelectAllOnPage}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}

      {/* Lead Cards */}
      <div className="space-y-2.5">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-[22px] ring-1 ring-slate-100 overflow-hidden shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)]">
              <Skeleton className="h-[2px] w-full" />
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20 rounded-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded-md shrink-0" />
                </div>
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            </div>
          ))
        ) : leads.length === 0 ? (
          <div className="relative overflow-hidden rounded-[22px] bg-linear-to-br from-indigo-50 via-white to-violet-50 ring-1 ring-indigo-100 px-6 py-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-white ring-1 ring-indigo-100 flex items-center justify-center shadow-sm">
              <Users className="h-7 w-7 text-indigo-400" />
            </div>
            <p className="mt-4 text-[18px] font-bold text-slate-900" style={serif}>
              No leads <span className="italic text-indigo-600">yet.</span>
            </p>
            <p className="mt-1 text-[12px] text-slate-500 italic" style={serif}>
              Try adjusting your filters or add a new lead.
            </p>
            <Link to="/leads/add" className="inline-flex mt-4 h-9 px-4 rounded-full text-[11px] font-bold bg-linear-to-r from-indigo-600 to-violet-600 text-white items-center gap-1.5 shadow-sm shadow-indigo-300/40 active:scale-95 transition-all duration-150">
              <Plus className="h-3.5 w-3.5" /> Add Lead
            </Link>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              selected={selectedSet.has(lead.id)}
              onSelect={toggleLeadSelection}
              onCall={handleCallLead}
              onWhatsApp={handleOpenWhatsApp}
              onView={openView}
              onEdit={openEdit}
              onSchedule={openSchedule}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between pt-1 pb-2 px-1">
          <p className="text-[11px] text-slate-500 italic" style={serif}>
            Page <span className="font-bold text-slate-800 not-italic">{currentPage}</span> of <span className="font-bold text-slate-800 not-italic">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); fetchLeads(p, searchQuery, statusFilter, false, categoryFilter); }}
              disabled={currentPage === 1}
              className="h-9 px-3 rounded-full bg-white ring-1 ring-inset ring-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 flex items-center gap-1 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              onClick={() => { const p = Math.min(totalPages, currentPage + 1); setCurrentPage(p); fetchLeads(p, searchQuery, statusFilter, false, categoryFilter); }}
              disabled={currentPage === totalPages}
              className="h-9 px-3 rounded-full bg-white ring-1 ring-inset ring-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 flex items-center gap-1 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}


      {/* Edit Lead Drawer */}
      <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base font-bold text-center">Edit Lead</DrawerTitle>
            <DrawerDescription className="text-center text-xs text-muted-foreground">Update lead status and details.</DrawerDescription>
          </DrawerHeader>

          <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {formError && (
              <Alert variant="destructive" className="py-2.5 bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs text-red-800 font-medium ml-2">{formError}</AlertDescription>
              </Alert>
            )}

            {/* Lead Photo Upload */}
            <div className="flex items-center gap-3 pb-3 border-b border-border/40">
              <div className="relative">
                <div className="h-14 w-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                  {editPhotoPreview ? (
                    <img src={editPhotoPreview} alt="Lead" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                {editPhotoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditPhotoFile(null);
                      setEditPhotoPreview(null);
                      setRemovePhoto(true);
                    }}
                    className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => document.getElementById('edit-lead-photo-agent').click()}
                >
                  <Camera className="h-3 w-3 mr-1" />
                  {editPhotoPreview ? 'Change' : 'Upload'} Photo
                </Button>
                <input
                  id="edit-lead-photo-agent"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditPhotoFile(file);
                      setEditPhotoPreview(URL.createObjectURL(file));
                      setRemovePhoto(false);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="h-9" autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</Label>
                <Select value={form.lead_category || 'NONE'} onValueChange={(v) => setForm((p) => ({ ...p, lead_category: v === 'NONE' ? '' : v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" className="text-sm">No Category</SelectItem>
                    {LEAD_CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Source</Label>
                <Select value={form.lead_source || 'Other'} onValueChange={(v) => setForm((p) => ({ ...p, lead_source: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Profession</Label>
                <Input value={form.profession} onChange={(e) => setForm((p) => ({ ...p, profession: e.target.value }))} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Address</Label>
              <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className="resize-none" />
            </div>

            <DrawerFooter className="pt-4 border-t px-0">
              <div className="flex gap-2 w-full">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 h-9 text-sm">Cancel</Button>
                <Button type="submit" disabled={formLoading} className="flex-1 h-9 text-sm bg-indigo-600 hover:bg-indigo-700">
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Schedule Follow-up Dialog */}
      {scheduleLead && (
        <ScheduleFollowupDialog
          lead={scheduleLead}
          open={scheduleOpen}
          onClose={() => { setScheduleOpen(false); setScheduleLead(null); }}
        />
      )}

      {/* View Details Drawer */}
      <Drawer open={viewOpen} onOpenChange={setViewOpen}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="shrink-0 border-b border-slate-100 pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Eye className="h-4 w-4 text-indigo-600" />
              </div>
              Lead Details
            </DrawerTitle>
            <DrawerDescription>All information for {viewTarget?.name}</DrawerDescription>
          </DrawerHeader>
          {viewTarget && (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 px-4 py-4">
              {/* Lead Photo */}
              {viewTarget.photo_url && (
                <div className="flex justify-center pb-3 border-b border-border/40">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                    <img src={viewTarget.photo_url} alt={viewTarget.name} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Name</p>
                  <p className="font-medium">{viewTarget.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Phone</p>
                  <p className="font-medium font-mono">{viewTarget.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Email</p>
                  <p className="font-medium truncate" title={viewTarget.email}>{viewTarget.email || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Address</p>
                  <p className="font-medium">{viewTarget.address || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Profession</p>
                  <p className="font-medium">{viewTarget.profession || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Status</p>
                  <Badge variant="secondary" className={`mt-1 text-[10px] px-2 py-0.5 border-0 font-medium ${STATUS_OPTIONS.find((s) => s.value === viewTarget.status)?.color || 'bg-slate-100 text-slate-700'}`}>
                    {STATUS_OPTIONS.find((s) => s.value === viewTarget.status)?.label || viewTarget.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Category</p>
                  {viewTarget.lead_category ? (
                    <Badge variant="outline" className="mt-1 text-[10px] px-2 py-0.5 font-medium">
                      {viewTarget.lead_category}
                    </Badge>
                  ) : (
                    <p className="font-medium text-slate-400">—</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Source</p>
                  <p className="font-medium">{viewTarget.lead_source || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Added On</p>
                  <p className="font-medium">{viewTarget.created_at ? format(new Date(viewTarget.created_at), 'MMM dd, yyyy') : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Calls Dialed</p>
                  <p className="font-medium">{viewTarget.calls_dialed ?? 0}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Notes</p>
                <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-700 whitespace-pre-wrap border border-slate-100">
                  {viewTarget.notes && String(viewTarget.notes).replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim() || 'No notes available.'}
                </div>
              </div>

              <CallTimeline calls={viewCallHistory} loading={viewCallLoading} />
            </div>
          )}
          <DrawerFooter className="shrink-0 border-t border-slate-100 pt-3">
            <Button type="button" onClick={() => setViewOpen(false)} className="h-9 w-full text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-none">Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default Leads;
