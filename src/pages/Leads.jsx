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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from '@/components/ui/drawer';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/lib/axios';
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { broadcastMutation, onMutation } from '@/lib/mutationBus';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Pencil, Search, Users,
  AlertCircle, Eye,
  BellPlus, Camera, X, ImageIcon, PhoneOutgoing, Trash2,
  ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, MoreHorizontal,
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
      broadcastMutation(['followups']);
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
  { value: 'NOT_ANSWERING',  label: 'Not Answering',  color: 'bg-rose-50 text-rose-700 ring-rose-200'  },
  { value: 'NOT_INTERESTED', label: 'Not Interested', color: 'bg-gray-100 text-gray-600 ring-gray-200' },
];

const STATUS_ACCENT_MAP = {
  NEW: '#3b82f6',
  CONTACTED: '#f59e0b',
  INTERESTED: '#6366f1',
  NOT_INTERESTED: '#6b7280',
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

const PAGE_SIZE_OPTIONS = ['15', '25', '50', '100', 'all'];
const DEFAULT_PAGE_SIZE = '15';

// Builds the canonical API URL for a given filter set — used both in fetchLeads and cache probe
function buildLeadsUrl(page, search, status, category, importJobId, limit = DEFAULT_PAGE_SIZE, freshOnly = false) {
  let url = `/leads?page=${page}&limit=${limit}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (status === 'ACTIVE') url += `&exclude_status=NEW`;
  else if (status !== 'ALL') url += `&status=${status}`;
  if (category !== 'ALL') url += `&lead_category=${encodeURIComponent(category)}`;
  if (importJobId && importJobId !== 'ALL') url += `&import_job_id=${encodeURIComponent(importJobId)}`;
  if (freshOnly) url += `&fresh_only=true`;
  return url;
}

// Memoised row — only re-renders when its own data or selection changes
const LeadRow = memo(({ lead, selected, selectionMode, onSelect, onCall, onWhatsApp, onView, onEdit, onSchedule, onDelete, showDelete }) => {
  const statusObj = STATUS_MAP[lead.status] || STATUS_OPTIONS[0];
  const accent = STATUS_ACCENT_MAP[lead.status] || '#94a3b8';
  return (
    <div
      className={`group relative flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 shadow-sm transition-all duration-150 sm:px-4 ${
        selected
          ? 'border-indigo-200 bg-indigo-50/70 shadow-indigo-100'
          : 'border-slate-200 hover:border-indigo-100 hover:bg-slate-50/50 hover:shadow-md'
      }`}
      onClick={selectionMode ? () => onSelect(lead.id) : undefined}
    >
      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ backgroundColor: accent }} />

      {/* Checkbox — only visible in selection mode */}
      {selectionMode && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect(lead.id)}
          className="h-4.5 w-4.5 shrink-0 rounded border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
        />
      )}

      {/* Avatar */}
      <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-50 to-sky-100 ring-1 ring-inset ring-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
        {lead.photo_url ? (
          <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-sm font-semibold text-indigo-700">{lead.name?.charAt(0)?.toUpperCase()}</span>
        )}
      </div>

      {/* Name + phone — flex-1 truncates naturally */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[14px] font-semibold leading-tight text-slate-950 sm:text-[15px]">{lead.name}</p>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ring-1 ring-inset ${statusObj.color}`}>
            {statusObj.label}
          </span>
          {lead.phone && (
            <p className="truncate text-xs font-medium tracking-normal text-slate-500">{lead.phone}</p>
          )}
        </div>
      </div>

      {/* Primary actions: Call + View always visible */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onCall(lead)}
          className="h-9 w-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center active:scale-95 transition-all duration-150 shadow-sm shadow-emerald-200/50"
          title="Call"
        >
          <PhoneOutgoing className="h-4 w-4" />
        </button>
        <button
          onClick={() => onView(lead)}
          className="h-9 w-9 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-indigo-600 hover:bg-indigo-50 hover:ring-indigo-200 flex items-center justify-center active:scale-95 transition-all duration-150"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>

        {/* More actions: WhatsApp, Edit, Schedule */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-9 w-9 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center active:scale-95 transition-all duration-150"
              title="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border-0 ring-1 ring-slate-200 p-1">
            <DropdownMenuItem
              onClick={() => onWhatsApp(lead.phone)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-green-700 hover:bg-green-50 cursor-pointer"
            >
              <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
              WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onEdit(lead)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-blue-700 hover:bg-blue-50 cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              Edit Lead
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSchedule(lead)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-amber-700 hover:bg-amber-50 cursor-pointer"
            >
              <BellPlus className="h-3.5 w-3.5 shrink-0" />
              Schedule Follow-up
            </DropdownMenuItem>
            {showDelete && (
              <DropdownMenuItem
                onClick={() => onDelete?.(lead)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                Delete Lead
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
LeadRow.displayName = 'LeadRow';

const Leads = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get('search') || '';
  // Default to ACTIVE (all statuses except NEW) — NEW leads have their own Fresh Leads section on Dashboard
  const initialStatus = searchParams.get('status') || 'ACTIVE';
  const initialCategory = searchParams.get('lead_category') || searchParams.get('category') || 'ALL';
  const initialImportJobId = searchParams.get('import_job_id') || 'ALL';
  // The fresh-leads entry point from the Dashboard card sets ?from=fresh — this is what
  // reveals the Import Batch (Stage) dropdown. We latch the flag in state so the dropdown
  // stays visible even after the URL is rewritten by the filter-sync effect below.
  const [showBatchStages, setShowBatchStages] = useState(() => searchParams.get('from') === 'fresh');

  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Probe memory cache synchronously so we can skip skeleton on navigation back
  const _initCached = getCachedSync(buildLeadsUrl(1, initialSearch, initialStatus, initialCategory, initialImportJobId, DEFAULT_PAGE_SIZE));

  const [leads, setLeads] = useState(() => _initCached?.leads ?? []);
  const [loading, setLoading] = useState(() => !_initCached);
  const [refreshing, setRefreshing] = useState(false); // silent background sync indicator

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(() => _initCached?.pagination?.totalPages ?? 1);
  const [totalCount, setTotalCount] = useState(() => _initCached?.pagination?.total ?? 0);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [importJobFilter, setImportJobFilter] = useState(initialImportJobId);

  // Import batches for the Fresh Leads stage dropdown
  const [importBatches, setImportBatches] = useState([]);
  const [importBatchesLoading, setImportBatchesLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [shiftLoading, setShiftLoading] = useState(false);

  // Delete lead (only in fresh-leads context)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLeads = useCallback(async (page, search, status, fresh = false, category, importJobId, limit, freshOnly = false) => {
    const hasData = hasDataRef.current;
    if (!hasData) setLoading(true);
    else setRefreshing(true);
    setFetchError(null);
    try {
      const url = buildLeadsUrl(page, search, status, category, importJobId, limit, freshOnly);
      const data = await cachedGet(url, { staleTime: 300_000, cacheTime: 600_000, force: fresh });
      if (data.success) {
        setLeads(data.leads);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total ?? 0);
        hasDataRef.current = true;
      }
    } catch (err) {
      console.error('Failed to fetch leads', err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.message
        || (status === 401 ? 'Session expired — please log in again'
          : status === 403 ? 'You do not have permission to view leads'
          : !err?.response ? 'Network error — check your connection'
          : 'Failed to load leads');
      setFetchError(msg);
      if (!hasDataRef.current) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // stable — all values passed as args, no state deps

  // Keep a ref so the debounce effect always sees the latest fetchLeads without it being a dep
  const fetchLeadsRef = useRef(fetchLeads);
  fetchLeadsRef.current = fetchLeads;
  const filtersRef = useRef({ searchQuery, statusFilter, categoryFilter, importJobFilter, currentPage, pageSize, showBatchStages });
  filtersRef.current = { searchQuery, statusFilter, categoryFilter, importJobFilter, currentPage, pageSize, showBatchStages };

  // Re-fetch when any page on the app mutates leads, calls or followups.
  useEffect(() => onMutation((entities) => {
    if (entities.some(e => e === 'leads' || e === 'followups' || e === 'calls')) {
      const f = filtersRef.current;
      fetchLeadsRef.current(f.currentPage, f.searchQuery, f.statusFilter, true, f.categoryFilter, f.importJobFilter, f.pageSize, f.showBatchStages);
    }
  }), []);

  const handleManualRefresh = useCallback(() => {
    broadcastMutation(['leads']); // invalidates cache + triggers subscription re-fetch
  }, []);

  useEffect(() => {
    const nextSearch = searchParams.get('search') || '';
    const nextStatus = searchParams.get('status') || 'ACTIVE';
    const nextCategory = searchParams.get('lead_category') || searchParams.get('category') || 'ALL';
    const nextImportJob = searchParams.get('import_job_id') || 'ALL';

    setSearchQuery((prev) => (prev === nextSearch ? prev : nextSearch));
    setStatusFilter((prev) => (prev === nextStatus ? prev : nextStatus));
    setCategoryFilter((prev) => (prev === nextCategory ? prev : nextCategory));
    setImportJobFilter((prev) => (prev === nextImportJob ? prev : nextImportJob));
    if (searchParams.get('from') === 'fresh') setShowBatchStages(true);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Use ref so fetchLeads is never a dep (prevents double-fetch on filter change)
      fetchLeadsRef.current(1, searchQuery, statusFilter, false, categoryFilter, importJobFilter, pageSize, showBatchStages);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, categoryFilter, importJobFilter, pageSize, showBatchStages]);

  // Keep URL in sync with active filters so dashboard quick-search works reliably.
  useEffect(() => {
    const next = {};
    if (searchQuery) next.search = searchQuery;
    if (statusFilter !== 'ALL') next.status = statusFilter;
    if (categoryFilter !== 'ALL') next.lead_category = categoryFilter;
    if (importJobFilter && importJobFilter !== 'ALL') next.import_job_id = importJobFilter;
    if (showBatchStages) next.from = 'fresh';
    setSearchParams(next, { replace: true });
  }, [searchQuery, statusFilter, categoryFilter, importJobFilter, showBatchStages, setSearchParams]);

  // Pre-fetch next page so navigation feels instant
  useEffect(() => {
    if (currentPage < totalPages && pageSize !== 'all') {
      cachedGet(buildLeadsUrl(currentPage + 1, searchQuery, statusFilter, categoryFilter, importJobFilter, pageSize, showBatchStages));
    }
  }, [currentPage, totalPages, searchQuery, statusFilter, categoryFilter, importJobFilter, pageSize, showBatchStages]);

  // Fetch import batches only when the Fresh-Leads stage dropdown should be shown.
  useEffect(() => {
    if (!showBatchStages) return;
    let cancelled = false;
    setImportBatchesLoading(true);
    (async () => {
      try {
        const { data } = await api.get('/leads/import-batches');
        if (!cancelled && data?.success) setImportBatches(data.batches || []);
      } catch (err) {
        console.error('Failed to fetch import batches', err);
      } finally {
        if (!cancelled) setImportBatchesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showBatchStages]);

  const selectedBatch = importBatches.find((b) => b.id === importJobFilter) || null;

  const openRenameBatch = () => {
    if (!selectedBatch) return;
    setRenameDraft(selectedBatch.label || '');
    setRenameOpen(true);
  };

  const saveRenameBatch = async () => {
    if (!selectedBatch) return;
    const label = renameDraft.trim();
    if (!label) { toast.error('Name is required'); return; }
    setRenameSaving(true);
    try {
      const { data } = await api.patch(`/leads/import-batches/${selectedBatch.id}`, { label });
      if (data?.success) {
        setImportBatches((prev) => prev.map((b) => b.id === selectedBatch.id ? { ...b, label: data.label } : b));
        toast.success('Batch renamed');
        setRenameOpen(false);
      } else {
        toast.error(data?.message || 'Unable to rename');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to rename');
    } finally {
      setRenameSaving(false);
    }
  };


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

  const confirmDelete = useCallback((lead) => setDeleteTarget(lead), []);

  const handleDeleteLead = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/leads/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      broadcastMutation(['leads']);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  };

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
      setSelectionMode(false);
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
      // Instant optimistic patch so the row updates before the network round-trip.
      setLeads(prev => prev.map(l => l.id === editId ? {
        ...l,
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(),
        status: form.status, lead_category: form.lead_category,
        profession: form.profession, address: form.address, notes: form.notes,
      } : l));
      setDialogOpen(false);
      // Invalidate cache + re-fetch in background (bus notifies this page too).
      broadcastMutation(['leads']);
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
      {/* Shift action bar — shows when in selection mode */}
      {selectionMode && (
        <div className="flex items-center justify-between gap-2 bg-linear-to-r from-indigo-600 to-violet-600 rounded-[18px] px-3.5 py-2 shadow-sm shadow-indigo-300/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectionMode(false); setSelectedLeadIds([]); }}
              className="h-6 w-6 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
              title="Cancel selection"
            >
              <X className="h-3 w-3" />
            </button>
            <span className="text-[11px] text-white font-bold uppercase tracking-wider">
              {selectedLeadIds.length > 0
                ? <>{selectedLeadIds.length} <span className="text-white/75 font-medium normal-case">selected</span></>
                : <span className="text-white/75 font-medium normal-case">Tap rows to select</span>
              }
            </span>
          </div>
          <button
            disabled={shiftLoading || selectedLeadIds.length === 0}
            onClick={() => handleShiftToCall()}
            className="h-7 px-2.5 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 rounded-full flex items-center gap-1.5 active:scale-95 transition-all duration-150 disabled:opacity-50"
          >
            {shiftLoading
              ? <span className="h-3 w-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              : <PhoneOutgoing className="h-3.5 w-3.5" />
            }
            Shift to Queue
          </button>
        </div>
      )}

      {/* Import Batch (Stage) dropdown — appears only when user came from Fresh Leads card */}
      {showBatchStages && (
        <div className="grid grid-cols-[minmax(0,1fr)_44px] items-stretch gap-2 rounded-2xl border border-violet-100 bg-violet-50/40 p-2 shadow-sm shadow-violet-100/40">
          <Select value={importJobFilter} onValueChange={setImportJobFilter}>
            <SelectTrigger
              className="h-11 min-w-0 px-3 text-xs font-semibold rounded-xl bg-white border-0 ring-1 ring-inset ring-violet-200 text-violet-800 shadow-none"
            >
              <SelectValue placeholder={importBatchesLoading ? 'Loading imports…' : 'All imports'} />
            </SelectTrigger>
            <SelectContent className="max-h-[60vh] min-w-[var(--radix-select-trigger-width)]">
              <SelectItem value="ALL" className="text-xs font-semibold text-violet-700">All imports</SelectItem>
              {importBatches.length === 0 && !importBatchesLoading && (
                <div className="px-3 py-2 text-[11px] text-slate-400">No imports yet</div>
              )}
              {importBatches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{batch.label}</span>
                    <span className="text-[10px] text-slate-400">
                      · {batch.created_at ? format(new Date(batch.created_at), 'dd MMM, hh:mm a') : ''}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 ml-auto">
                      {batch.lead_count}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={openRenameBatch}
            disabled={!selectedBatch}
            title={selectedBatch ? `Rename ${selectedBatch.label}` : 'Pick a batch to rename it'}
            className="h-11 w-11 rounded-xl bg-white ring-1 ring-inset ring-violet-200 text-violet-600
                       hover:bg-violet-50 hover:ring-violet-200 disabled:opacity-40 disabled:hover:bg-white disabled:hover:ring-slate-200
                       flex items-center justify-center transition-colors shrink-0"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_136px_112px_44px]">
        <div className="relative col-span-3 sm:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 text-sm rounded-xl bg-slate-50 border-0 ring-1 ring-inset ring-slate-200 focus-visible:bg-white focus-visible:ring-indigo-300"
          />
          {refreshing && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-indigo-400 animate-pulse" title="Syncing…" />
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 min-w-0 text-[11px] font-semibold uppercase tracking-wide rounded-xl shrink-0 bg-slate-50 border-0 ring-1 ring-inset ring-slate-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            <SelectItem value="ACTIVE" className="text-xs font-medium text-emerald-700">All Active</SelectItem>
            <SelectItem value="ALL" className="text-xs font-medium">All (incl. New)</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 min-w-0 text-[11px] font-semibold uppercase tracking-wide rounded-xl shrink-0 bg-slate-50 border-0 ring-1 ring-inset ring-slate-200">
            <SelectValue placeholder="Cat" />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            <SelectItem value="ALL" className="text-xs font-medium">All Cat</SelectItem>
            {LEAD_CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm" variant="outline"
          className="h-11 w-11 p-0 rounded-xl shrink-0 text-slate-600 ring-1 ring-inset ring-slate-200 bg-slate-50 hover:bg-white shadow-none border-0"
          onClick={handleManualRefresh}
          disabled={loading || refreshing}
          title="Refresh leads"
          aria-label="Refresh leads"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
        </Button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-200 px-3.5 py-2.5 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-rose-800">Couldn't load leads</p>
            <p className="text-[11px] text-rose-700 mt-0.5">{fetchError}</p>
          </div>
          <Button
            size="sm"
            className="h-8 px-2.5 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shrink-0"
            onClick={handleManualRefresh}
            disabled={loading || refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      )}

      {/* Count + Select toggle row */}
      {!loading && leads.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
          <div className="flex items-baseline gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Results</p>
            <span className="text-base font-semibold text-slate-900">{totalCount.toLocaleString('en-IN')}</span>
            <span className="text-xs font-medium text-slate-500">
              lead{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectionMode && (
              <button
                className="text-[10px] uppercase tracking-wider text-slate-500 font-bold hover:text-slate-700 transition-colors"
                onClick={toggleSelectAllOnPage}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
            <button
              className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${
                selectionMode ? 'text-indigo-600 hover:text-indigo-800' : 'text-slate-400 hover:text-indigo-600'
              }`}
              onClick={() => { setSelectionMode((v) => !v); if (selectionMode) setSelectedLeadIds([]); }}
            >
              {selectionMode ? 'Done' : 'Select'}
            </button>
          </div>
        </div>
      )}

      {/* Lead List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm sm:px-4">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-9 w-9 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-50 via-white to-violet-50 ring-1 ring-indigo-100 px-6 py-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-white ring-1 ring-indigo-100 flex items-center justify-center shadow-sm">
            <Users className="h-7 w-7 text-indigo-400" />
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-900">
            No leads yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your filters or add a new lead.
          </p>
          <Link to="/leads/add" className="inline-flex mt-4 h-9 px-4 rounded-full text-[11px] font-bold bg-linear-to-r from-indigo-600 to-violet-600 text-white items-center gap-1.5 shadow-sm shadow-indigo-300/40 active:scale-95 transition-all duration-150">
            <Plus className="h-3.5 w-3.5" /> Add Lead
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              selected={selectedSet.has(lead.id)}
              selectionMode={selectionMode}
              onSelect={toggleLeadSelection}
              onCall={handleCallLead}
              onWhatsApp={handleOpenWhatsApp}
              onView={openView}
              onEdit={openEdit}
              onSchedule={openSchedule}
              onDelete={confirmDelete}
              showDelete={showBatchStages}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalCount > 0 && (() => {
        const isAll = pageSize === 'all';
        const numericLimit = isAll ? totalCount : parseInt(pageSize, 10);
        const rangeStart = isAll ? 1 : (currentPage - 1) * numericLimit + 1;
        const rangeEnd = isAll ? totalCount : Math.min(currentPage * numericLimit, totalCount);

        const pages = [];
        if (totalPages <= 7) {
          for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
          pages.push(1);
          if (currentPage > 3) pages.push('…');
          const start = Math.max(2, currentPage - 1);
          const end = Math.min(totalPages - 1, currentPage + 1);
          for (let i = start; i <= end; i++) pages.push(i);
          if (currentPage < totalPages - 2) pages.push('…');
          pages.push(totalPages);
        }

        const goToPage = (p) => {
          const target = Math.min(Math.max(1, p), totalPages);
          setCurrentPage(target);
          fetchLeadsRef.current(target, searchQuery, statusFilter, false, categoryFilter, importJobFilter, pageSize, showBatchStages);
        };

        return (
          <div className="mt-3 rounded-2xl bg-white ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-slate-600 font-medium tabular-nums">
                Showing <span className="font-bold text-slate-900">{rangeStart.toLocaleString('en-IN')}–{rangeEnd.toLocaleString('en-IN')}</span>
                <span className="text-slate-500"> of </span>
                <span className="font-bold text-slate-900">{totalCount.toLocaleString('en-IN')}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Per page</span>
                <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-7 w-[70px] text-[11px] font-bold rounded-lg bg-slate-50 ring-1 ring-slate-200 border-0 shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt === 'all' ? 'All' : opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 flex-wrap">
                <Button
                  variant="ghost" size="sm"
                  className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pages.map((p, idx) => (
                  p === '…' ? (
                    <span key={`gap-${idx}`} className="text-[11px] text-slate-400 px-1 select-none">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === currentPage ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-8 min-w-8 px-2 rounded-lg text-[11px] font-bold tabular-nums ${
                        p === currentPage
                          ? 'bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm shadow-indigo-200/50'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </Button>
                  )
                ))}
                <Button
                  variant="ghost" size="sm"
                  className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        );
      })()}


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

      {/* Delete Lead Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              Delete Lead
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button onClick={handleDeleteLead} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Import Batch Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Rename import batch</DialogTitle>
            <DialogDescription className="text-xs">
              Give this import a recognisable name (e.g. "Facebook Apr 20", "Referral batch").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name</Label>
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              placeholder="Import 1"
              maxLength={80}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRenameBatch(); }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={renameSaving}>Cancel</Button>
            <Button onClick={saveRenameBatch} disabled={renameSaving || !renameDraft.trim()} className="bg-violet-600 hover:bg-violet-700">
              {renameSaving ? 'Saving…' : 'Save name'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <p className="font-medium">{viewTarget.phone || '—'}</p>
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
