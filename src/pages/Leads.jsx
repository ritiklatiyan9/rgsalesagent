import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/lib/axios';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Pencil, Search, Phone, Mail, Users, Filter, UserPlus,
  FileText, ChevronLeft, ChevronRight, AlertCircle, CalendarDays, Eye, List,
  BellPlus, FileSpreadsheet, ArrowRightLeft, History, Camera, X, ImageIcon, PhoneOutgoing,
} from 'lucide-react';

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

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New Lead', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { value: 'INTERESTED', label: 'Interested', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
  { value: 'SITE_VISIT', label: 'Site Visit', color: 'bg-violet-100 text-violet-700 hover:bg-violet-200' },
  { value: 'NEGOTIATION', label: 'Negotiation', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
  { value: 'BOOKED', label: 'Booked', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  { value: 'LOST', label: 'Lost', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
];

const LEAD_CATEGORY_OPTIONS = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];
const LEAD_SOURCE_OPTIONS = ['Direct', 'Referral', 'Website', 'Advertisement', 'Event', 'Other'];

const EMPTY_FORM = {
  name: '', phone: '', email: '', address: '', profession: '', status: 'NEW', lead_category: '', lead_source: 'Other', notes: '',
};

const CALL_NEXT_ACTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'VISIT', label: 'Schedule Visit' },
  { value: 'CLOSE', label: 'Close / Booking' },
  { value: 'NO_RESPONSE', label: 'No Response' },
];

const fmt2 = (n) => String(n).padStart(2, '0');

const DialerDialog = () => null; // Dialer removed

const Leads = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialCategory = searchParams.get('lead_category') || searchParams.get('category') || 'ALL';

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);

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

  const fetchLeads = useCallback(async (page = currentPage, search = searchQuery, status = statusFilter, fresh = false, category = categoryFilter) => {
    try {
      setLoading(true);
      let url = `/leads?page=${page}&limit=15`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (status !== 'ALL') url += `&status=${status}`;
      if (category !== 'ALL') url += `&lead_category=${encodeURIComponent(category)}`;
      if (fresh) url += `&_t=${Date.now()}`;

      const { data } = await api.get(url);
      if (data.success) {
        setLeads(data.leads);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch leads', err);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    const nextSearch = searchParams.get('search') || '';
    const nextStatus = searchParams.get('status') || 'ALL';
    const nextCategory = searchParams.get('lead_category') || searchParams.get('category') || 'ALL';

    setSearchQuery((prev) => (prev === nextSearch ? prev : nextSearch));
    setStatusFilter((prev) => (prev === nextStatus ? prev : nextStatus));
    setCategoryFilter((prev) => (prev === nextCategory ? prev : nextCategory));
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads(1, searchQuery, statusFilter, false, categoryFilter);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, categoryFilter, fetchLeads]);

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
      let url = `/leads?page=${currentPage + 1}&limit=15`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
      if (categoryFilter !== 'ALL') url += `&lead_category=${encodeURIComponent(categoryFilter)}`;
      cachedGet(url);
    }
  }, [currentPage, totalPages, searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    const currentIds = new Set(leads.map((l) => l.id));
    setSelectedLeadIds((prev) => prev.filter((id) => currentIds.has(id)));
  }, [leads]);

  const openEdit = (lead) => {
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
  };

  const openView = async (lead) => {
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
  };

  const openSchedule = (lead) => {
    setScheduleLead(lead);
    setScheduleOpen(true);
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds((prev) => (
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    ));
  };

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
      fetchLeads(currentPage, searchQuery, statusFilter, true);
      setDialogOpen(false);
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save lead.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCallLead = (lead) => {
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
  };

  const handleOpenWhatsApp = (phone) => {
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    window.open(`https://wa.me/${waNumber}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">My Leads</h1>
            <p className="text-xs text-muted-foreground">Leads assigned to you</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs rounded-xl flex-1 sm:flex-none"
            disabled={shiftLoading || selectedLeadIds.length === 0}
            onClick={() => handleShiftToCall()}
          >
            {shiftLoading ? (
              <span className="inline-flex items-center">
                <span className="h-3.5 w-3.5 mr-1.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Shifting...
              </span>
            ) : (
              <>
                <PhoneOutgoing className="h-3.5 w-3.5 mr-1.5" />
                Shift Selected ({selectedLeadIds.length})
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs rounded-xl flex-1 sm:flex-none"
            disabled={shiftLoading || leads.length === 0}
            onClick={() => handleShiftToCall({ selectAllFiltered: true })}
          >
            {shiftLoading ? (
              <span className="inline-flex items-center">
                <span className="h-3.5 w-3.5 mr-1.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Shifting...
              </span>
            ) : (
              <>
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Shift All Filtered
              </>
            )}
          </Button>
          <Link to="/leads/add">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-sm h-9 text-xs gap-1.5 rounded-xl w-full sm:w-auto">
              <UserPlus className="h-3.5 w-3.5" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Sub-page tabs */}
      <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1 border-b border-border/50 pb-0 min-w-max">
          <div className="flex items-center gap-1 px-1 py-1 bg-muted/40 rounded-xl">
            <Link
              to="/leads"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60 whitespace-nowrap"
            >
              <List className="h-3.5 w-3.5" />
              My Leads
            </Link>
            <Link
              to="/leads/add"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add</span> Lead
            </Link>
            <Link
              to="/leads/bulk"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bulk</span> Import
            </Link>
            <Link
              to="/leads/assign"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Assign
            </Link>
            <Link
              to="/leads/assignment-history"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap"
            >
              <History className="h-3.5 w-3.5" />
              History
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-elevated border-0">
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <div className="relative flex-1 min-w-40 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name, phone, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 min-w-[110px] sm:w-40 h-9 text-xs rounded-lg font-medium">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs font-medium">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="flex-1 min-w-[110px] sm:w-40 h-9 text-xs rounded-lg font-medium">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs font-medium">All Categories</SelectItem>
                  {LEAD_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads — Desktop Table */}
      <Card className="card-elevated border-0 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-12 pl-4">
                  <Checkbox
                    checked={leads.length > 0 && leads.every((l) => selectedLeadIds.includes(l.id))}
                    indeterminate={leads.some((l) => selectedLeadIds.includes(l.id)) && !leads.every((l) => selectedLeadIds.includes(l.id))}
                    onCheckedChange={toggleSelectAllOnPage}
                    className="rounded"
                  />
                </TableHead>
                <TableHead className="pl-3 font-semibold text-xs uppercase tracking-wider text-slate-500">Lead Details</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Contact</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Category</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 text-center">Calls Dialed</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Added On</TableHead>
                <TableHead className="text-right pr-5 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="w-12 pl-4 py-4"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    <TableCell className="pl-3 py-4"><Skeleton className="h-5 w-32 mb-1.5" /><Skeleton className="h-3 w-24" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-28 mb-1.5" /><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="pr-5 py-4 text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Users className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 max-w-sm">No leads found. Add a new lead or adjust your search.</p>
                      <Link to="/leads/add">
                        <Button variant="outline" size="sm" className="mt-2 text-xs">
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Lead
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => {
                  const statusObj = STATUS_OPTIONS.find((s) => s.value === lead.status) || STATUS_OPTIONS[0];
                  return (
                    <TableRow key={lead.id} className="hover:bg-slate-50/50 transition-colors group">
                      <TableCell className="w-12 pl-4 py-3.5">
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="pl-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            {lead.photo_url ? (
                              <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">{lead.name?.charAt(0)?.toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm">{lead.name}</p>
                            {lead.notes && (
                              <div className="flex items-center gap-1 mt-0.5 text-slate-400">
                                <FileText className="h-3 w-3" />
                                <span className="text-xs truncate max-w-38">{lead.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          {lead.phone || '—'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-38">{lead.email || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 border-0 font-medium ${statusObj.color}`}>
                          {statusObj.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {lead.lead_category ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium">
                            {lead.lead_category}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 text-center">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
                          {lead.calls_dialed ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          {format(new Date(lead.created_at), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Call"
                            className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50"
                            onClick={() => handleCallLead(lead)}
                          >
                            <PhoneOutgoing className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="WhatsApp"
                            className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50"
                            onClick={() => handleOpenWhatsApp(lead.phone)}
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="View Details"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            onClick={() => openView(lead)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Edit Lead"
                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEdit(lead)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Schedule Follow-up"
                            className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                            onClick={() => openSchedule(lead)}
                          >
                            <BellPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-border/40 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-2"
                onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); fetchLeads(currentPage - 1); }}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2"
                onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); fetchLeads(currentPage + 1); }}
                disabled={currentPage === totalPages || loading}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Leads — Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1"><Skeleton className="h-4 w-28 mb-1.5" /><Skeleton className="h-3 w-20" /></div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
            </Card>
          ))
        ) : leads.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">No leads found.</p>
              <Link to="/leads/add">
                <Button variant="outline" size="sm" className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Lead
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          leads.map((lead) => {
            const statusObj = STATUS_OPTIONS.find((s) => s.value === lead.status) || STATUS_OPTIONS[0];
            return (
              <Card key={lead.id} className="p-3.5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {lead.photo_url ? (
                      <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">{lead.name?.charAt(0)?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900 text-sm truncate">{lead.name}</p>
                      <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 border-0 font-medium shrink-0 ${statusObj.color}`}>
                        {statusObj.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="h-3 w-3" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-35">{lead.email}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {format(new Date(lead.created_at), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Calls Dialed: <span className="font-semibold text-slate-700">{lead.calls_dialed ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:text-green-600 hover:bg-green-50" onClick={() => handleCallLead(lead)}>
                    <PhoneOutgoing className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:text-green-600 hover:bg-green-50" onClick={() => handleOpenWhatsApp(lead.phone)}>
                    <WhatsAppIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => openView(lead)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => openEdit(lead)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-500 hover:text-amber-600 hover:bg-amber-50" onClick={() => openSchedule(lead)}>
                    <BellPlus className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1 py-2">
            <p className="text-xs text-muted-foreground font-medium">Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
                onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); fetchLeads(currentPage - 1); }}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs"
                onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); fetchLeads(currentPage + 1); }}
                disabled={currentPage === totalPages || loading}
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Lead Dialog (no delete, no reassign) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Pencil className="h-4 w-4 text-blue-600" />
              </div>
              Edit Lead
            </DialogTitle>
            <DialogDescription>Update lead status and details.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-2 space-y-4 overflow-y-auto flex-1 pr-1">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Profession</Label>
                <Input value={form.profession} onChange={(e) => setForm((p) => ({ ...p, profession: e.target.value }))} className="h-9" />
              </div>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Address</Label>
              <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className="resize-none" />
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-9 px-4 text-sm">Cancel</Button>
              <Button type="submit" disabled={formLoading} className="h-9 px-4 text-sm bg-indigo-600 hover:bg-indigo-700">
                {formLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      {scheduleLead && (
        <ScheduleFollowupDialog
          lead={scheduleLead}
          open={scheduleOpen}
          onClose={() => { setScheduleOpen(false); setScheduleLead(null); }}
        />
      )}

      {/* View Details Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Eye className="h-4 w-4 text-indigo-600" />
              </div>
              Lead Details
            </DialogTitle>
            <DialogDescription>All information for {viewTarget?.name}</DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1">
              {/* Lead Photo */}
              {viewTarget.photo_url && (
                <div className="flex justify-center pb-3 border-b border-border/40">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                    <img src={viewTarget.photo_url} alt={viewTarget.name} className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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

              {/* Call Timeline */}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-muted-foreground text-xs uppercase font-semibold mb-3">Call Timeline</p>
                {viewCallLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-5 w-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                  </div>
                ) : viewCallHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No call history found.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {viewCallHistory.map((call, idx) => {
                      const callType = call.call_type || call.callType || 'UNKNOWN';
                      const callTypeColor = callType === 'INCOMING' ? 'text-emerald-600 bg-emerald-50' : callType === 'OUTGOING' ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50';
                      
                      return (
                        <div key={call.id || idx} className={`p-2.5 rounded-lg border border-slate-200 ${callTypeColor.split(' ')[1]}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-slate-700">
                                {call.call_start ? format(new Date(call.call_start), 'MMM dd, yyyy HH:mm') : 'Unknown Date'}
                              </p>
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                <span className={`font-semibold ${callTypeColor.split(' ')[0]}`}>{callType}</span>
                                {call.duration_seconds && ` • ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`}
                              </p>
                            </div>
                            {call.outcome_label && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                                {call.outcome_label}
                              </Badge>
                            )}
                          </div>
                          {call.customer_notes && (
                            <p className="text-[10px] text-slate-600 mt-1.5 line-clamp-2">{call.customer_notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 pt-3 border-t border-border/40">
            <Button type="button" onClick={() => setViewOpen(false)} className="h-9 px-4 text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-none">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
