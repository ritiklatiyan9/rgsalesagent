import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from '@/components/ui/drawer';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/lib/axios';
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { toast } from 'sonner';
import {
    Search, Users, UserPlus, ChevronLeft, ChevronRight, Trash2,
    Plus, Loader2, X, PhoneOutgoing, Pencil, Smartphone, Eye,
} from 'lucide-react';
import CallTimeline from '@/components/CallTimeline';
import { useDeviceContacts } from '@/hooks/useDeviceContacts';

const STATUS_OPTIONS = [
    { value: 'NEW', label: 'New Lead' },
    { value: 'CONTACTED', label: 'Contacted' },
    { value: 'INTERESTED', label: 'Interested' },
    { value: 'SITE_VISIT', label: 'Site Visit' },
    { value: 'NEGOTIATION', label: 'Negotiation' },
    { value: 'BOOKED', label: 'Booked' },
    { value: 'LOST', label: 'Lost' },
    { value: 'INCOMING_OFF', label: 'Incoming Off' },
    { value: 'SWITCH_OFF', label: 'Switch Off' },
    { value: 'NOT_ANSWERING', label: 'Not Answering' },
];
const LEAD_CATEGORY_OPTIONS = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const STATUS_COLOR_MAP = {
    NEW: 'bg-blue-50 text-blue-700 ring-blue-200',
    CONTACTED: 'bg-amber-50 text-amber-700 ring-amber-200',
    INTERESTED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    SITE_VISIT: 'bg-violet-50 text-violet-700 ring-violet-200',
    NEGOTIATION: 'bg-purple-50 text-purple-700 ring-purple-200',
    BOOKED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    LOST: 'bg-slate-50 text-slate-600 ring-slate-200',
    INCOMING_OFF: 'bg-orange-50 text-orange-700 ring-orange-200',
    SWITCH_OFF: 'bg-red-50 text-red-700 ring-red-200',
    NOT_ANSWERING: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
};

const STATUS_ACCENT_MAP = {
    NEW: '#3b82f6',
    CONTACTED: '#f59e0b',
    INTERESTED: '#6366f1',
    SITE_VISIT: '#8b5cf6',
    NEGOTIATION: '#a855f7',
    BOOKED: '#10b981',
    LOST: '#64748b',
    INCOMING_OFF: '#f97316',
    SWITCH_OFF: '#ef4444',
    NOT_ANSWERING: '#eab308',
};

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// Memoised mobile card — only re-renders when its own data or selection changes
const ContactCard = memo(({ c, selected, isCalling, onSelect, onCall, onWhatsApp, onView, onEdit, onDelete }) => {
    const statusCls = STATUS_COLOR_MAP[c.status] || 'bg-slate-50 text-slate-600 ring-slate-200';
    const statusLabel = STATUS_OPTIONS.find(s => s.value === c.status)?.label;
    const accent = STATUS_ACCENT_MAP[c.status] || '#6366f1';
    return (
        <div className={`relative overflow-hidden rounded-[22px] bg-white transition-all duration-150 ${
            selected
                ? 'ring-2 ring-indigo-300 shadow-[0_10px_26px_-12px_rgba(99,102,241,0.35)]'
                : 'ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] hover:ring-slate-200 hover:shadow-[0_10px_26px_-12px_rgba(15,23,42,0.14)]'
        }`}>
            {/* Top accent strip */}
            <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} />

            {/* Top: avatar + info + checkbox */}
            <div className="flex items-start gap-3 px-3.5 pt-4 pb-2.5">
                <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-indigo-50 to-violet-100 ring-1 ring-indigo-100 flex items-center justify-center shrink-0">
                    <span className="text-base font-bold text-indigo-600" style={serif}>{c.name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-[14px] leading-snug truncate" style={serif}>{c.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {c.status && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ring-1 ring-inset ${statusCls}`}>
                                {statusLabel || c.status}
                            </span>
                        )}
                        {c.lead_category && (
                            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 ring-1 ring-inset ring-slate-200 px-1.5 py-0.5 rounded-full">{c.lead_category}</span>
                        )}
                        {c.is_converted && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">Converted</span>
                        )}
                    </div>
                    {c.phone && (
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">{c.phone}</p>
                    )}
                </div>
                {/* Checkbox far right */}
                <div className="shrink-0 pt-0.5">
                    <input
                        type="checkbox" checked={selected} onChange={() => onSelect(c.id)}
                        className="h-5 w-5 rounded-md border-slate-300 accent-indigo-600 cursor-pointer"
                        aria-label={`Select ${c.name}`}
                    />
                </div>
            </div>
            {/* Action row */}
            <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1 border-t border-slate-100">
                <Button
                    size="sm"
                    className="flex-1 h-9 text-[11px] font-bold bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl gap-1.5 shadow-sm shadow-emerald-200/40"
                    onClick={() => onCall(c)} disabled={isCalling}>
                    {isCalling
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <PhoneOutgoing className="h-3.5 w-3.5" />}
                    Call
                </Button>
                <Button
                    variant="ghost" size="sm"
                    className="h-9 w-9 p-0 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl"
                    onClick={() => onWhatsApp(c.phone)}>
                    <WhatsAppIcon className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost" size="sm"
                    className="h-9 w-9 p-0 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl"
                    onClick={() => onView(c)}>
                    <Eye className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost" size="sm"
                    className="h-9 w-9 p-0 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-xl"
                    onClick={() => onEdit(c)}>
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost" size="sm"
                    className="h-9 w-9 p-0 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
                    onClick={() => onDelete(c)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
});
ContactCard.displayName = 'ContactCard';

const AllContacts = () => {
    const navigate = useNavigate();
    const { synced, syncing, syncContacts, searchDeviceContacts, clearCache, count: deviceCount } = useDeviceContacts();

    // Probe memory cache synchronously to skip skeleton on navigation back
    const _initCached = getCachedSync('/contacts?page=1&limit=25');

    const [contacts, setContacts] = useState(() => _initCached?.contacts ?? []);
    const [loading, setLoading] = useState(() => !_initCached);
    const [refreshing, setRefreshing] = useState(false); // silent background sync dot
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(() => _initCached?.pagination?.totalPages ?? 1);
    const [totalCount, setTotalCount] = useState(() => _initCached?.pagination?.total ?? 0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    // Track whether we already have data
    const hasDataRef = useRef(Boolean(_initCached));

    // Add contact modal
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', phone: '' });
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');

    // Delete
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Edit
    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', phone: '', status: '', lead_category: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    // View details
    const [viewOpen, setViewOpen] = useState(false);
    const [viewTarget, setViewTarget] = useState(null);
    const [viewCallHistory, setViewCallHistory] = useState([]);
    const [viewCallLoading, setViewCallLoading] = useState(false);

    const openEdit = useCallback((contact) => {
        setEditTarget(contact);
        setEditForm({ name: contact.name || '', phone: contact.phone || '', status: contact.status || '', lead_category: contact.lead_category || '' });
        setEditError('');
        setEditOpen(true);
    }, []);

    const openView = useCallback(async (contact) => {
        setViewTarget(contact);
        setViewCallHistory([]);
        setViewOpen(true);
        if (contact.id) {
            setViewCallLoading(true);
            try {
                const { data } = await api.get(`/calls/lead/${contact.id}`);
                if (data?.success && data?.calls) setViewCallHistory(Array.isArray(data.calls) ? data.calls : []);
            } catch { setViewCallHistory([]); }
            finally { setViewCallLoading(false); }
        }
    }, []);

    const handleEditContact = async () => {
        if (!editForm.name.trim() || !editForm.phone.trim()) {
            setEditError('Name and phone are required');
            return;
        }
        setEditLoading(true);
        setEditError('');
        try {
            await api.put(`/contacts/${editTarget.id}`, {
                name: editForm.name,
                phone: editForm.phone,
                status: editForm.status || undefined,
                lead_category: editForm.lead_category || undefined,
            });
            toast.success('Contact updated');
            setEditOpen(false);
            fetchContacts(currentPage, searchQuery, statusFilter, categoryFilter);
        } catch (err) {
            setEditError(err?.response?.data?.message || 'Failed to update contact');
        } finally {
            setEditLoading(false);
        }
    };

    // Call / convert
    const [callingId, setCallingId] = useState(null);

    // Shift-to-call selection
    const [selectedContactIds, setSelectedContactIds] = useState([]);
    const [shiftLoading, setShiftLoading] = useState(false);

    const fetchContacts = useCallback(async (page, search, status, category) => {
        const hasData = hasDataRef.current;
        if (!hasData) setLoading(true);
        else setRefreshing(true);
        if (search) setIsSearching(true);
        try {
            let url = `/contacts?page=${page}&limit=25`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (status && status !== 'ALL') url += `&status=${encodeURIComponent(status)}`;
            if (category && category !== 'ALL') url += `&lead_category=${encodeURIComponent(category)}`;
            const data = await cachedGet(url, { staleTime: 600_000, cacheTime: 900_000 });
            if (data.success) {
                setContacts(data.contacts);
                setTotalPages(data.pagination.totalPages);
                setTotalCount(data.pagination.total);
                hasDataRef.current = true;
            }
        } catch {
            if (!hasDataRef.current) toast.error('Failed to load contacts');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setIsSearching(false);
        }
    }, []);

    // Keep stable refs so callbacks/effects always see latest values without re-creating
    const fetchContactsRef = useRef(fetchContacts);
    fetchContactsRef.current = fetchContacts;
    const filtersRef = useRef({ searchQuery, statusFilter, categoryFilter, currentPage });
    filtersRef.current = { searchQuery, statusFilter, categoryFilter, currentPage };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchContactsRef.current(1, searchQuery, statusFilter, categoryFilter);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, statusFilter, categoryFilter]);

    useEffect(() => {
        const currentIds = new Set(contacts.map((c) => c.id));
        setSelectedContactIds((prev) => prev.filter((id) => currentIds.has(id)));
    }, [contacts]);

    const handleAddContact = async () => {
        if (!addForm.name.trim() || !addForm.phone.trim()) {
            setAddError('Name and phone are required');
            return;
        }
        setAddLoading(true);
        setAddError('');
        try {
            await api.post('/contacts', addForm);
            toast.success('Contact added');
            setAddOpen(false);
            setAddForm({ name: '', phone: '' });
            fetchContacts(currentPage, searchQuery, statusFilter, categoryFilter);
        } catch (err) {
            setAddError(err?.response?.data?.message || 'Failed to add contact');
        } finally {
            setAddLoading(false);
        }
    };

    const openDelete = useCallback((c) => { setDeleteTarget(c); setDeleteOpen(true); }, []);

    const handleDelete = async () => {
        setDeleteLoading(true);
        try {
            await api.delete(`/contacts/${deleteTarget.id}`);
            toast.success('Contact deleted');
            setDeleteOpen(false);
            fetchContacts(currentPage, searchQuery, statusFilter, categoryFilter);
        } catch {
            toast.error('Failed to delete contact');
        } finally {
            setDeleteLoading(false);
        }
    };

    const openDialerForContact = useCallback((contact, leadId) => {
        const params = new URLSearchParams({
            lead_id: String(leadId),
            lead_name: contact.name || 'Lead',
            lead_phone: contact.phone || '',
            autoCall: 'true',
            source: 'contacts',
        });
        navigate(`/calls/dialer?${params.toString()}`);
    }, [navigate]);

    const handleCallAndConvert = useCallback(async (contact) => {
        setCallingId(contact.id);
        try {
            if (contact.is_converted && contact.converted_lead_id) {
                openDialerForContact(contact, contact.converted_lead_id);
                toast.success('Opening dialer');
                return;
            }
            const { data } = await api.post(`/contacts/${contact.id}/convert`);
            if (!data.success) { toast.error(data.message || 'Failed to convert'); return; }
            const leadId = data.lead_id;
            if (!leadId) { toast.error('Lead conversion succeeded but lead id is missing'); return; }
            openDialerForContact(contact, leadId);
            toast.success('Contact converted to lead — opening dialer');
            const f = filtersRef.current;
            fetchContactsRef.current(f.currentPage, f.searchQuery, f.statusFilter, f.categoryFilter);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to call');
        } finally {
            setCallingId(null);
        }
    }, [openDialerForContact]);

    const handleOpenWhatsApp = useCallback((phone) => {
        if (!phone) { toast.error('Phone number not available'); return; }
        const cleaned = String(phone).replace(/[^0-9]/g, '');
        const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
        window.open(`https://wa.me/${waNumber}`, '_blank');
    }, []);

    const toggleSelect = useCallback((contactId) => {
        setSelectedContactIds((prev) => (
            prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
        ));
    }, []);

    const toggleSelectAllOnPage = useCallback(() => {
        const pageIds = contacts.map((c) => c.id);
        const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedContactIds.includes(id));
        if (allSelected) {
            setSelectedContactIds((prev) => prev.filter((id) => !pageIds.includes(id)));
        } else {
            setSelectedContactIds((prev) => Array.from(new Set([...prev, ...pageIds])));
        }
    }, [contacts, selectedContactIds]);

    const handleShiftToCall = async ({ selectAllFiltered = false } = {}) => {
        setShiftLoading(true);
        try {
            const payload = selectAllFiltered
                ? { select_all: true, search: searchQuery, status: statusFilter !== 'ALL' ? statusFilter : undefined, lead_category: categoryFilter !== 'ALL' ? categoryFilter : undefined }
                : { contact_ids: selectedContactIds };
            const { data } = await api.post('/contacts/shift-to-call', payload);
            if (!data?.success) {
                toast.error(data?.message || 'Failed to shift contacts');
                return;
            }
            setSelectedContactIds([]);
            toast.success(data?.message || 'Contacts shifted to call queue');
            navigate('/contacts/shift-to-call');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to shift contacts');
        } finally {
            setShiftLoading(false);
        }
    };

    // O(1) set for selection checks — avoids O(n²) .includes() per row per render
    const selectedSet = useMemo(() => new Set(selectedContactIds), [selectedContactIds]);
    const allSelectedOnPage = useMemo(
        () => contacts.length > 0 && contacts.every((c) => selectedSet.has(c.id)),
        [contacts, selectedSet]
    );

    // Memoized device contacts — avoids re-filtering on every render
    const deviceContactMatches = useMemo(() => {
        if (!synced || searchQuery.trim().length < 2) return [];
        const dbPhones = new Set(contacts.map(c => (c.phone || '').replace(/[^0-9]/g, '')));
        return searchDeviceContacts(searchQuery)
            .filter(dc => !dbPhones.has((dc.phone || '').replace(/[^0-9]/g, '')))
            .slice(0, 15);
    }, [synced, searchQuery, contacts, searchDeviceContacts]);

    return (
        <>
            {/* ══════ Selection action bar — editorial pill ══════ */}
            {selectedContactIds.length > 0 && (
                <div className="flex items-center justify-between rounded-[20px] bg-linear-to-r from-indigo-600 to-violet-600 px-3.5 py-2.5 shadow-md shadow-indigo-300/40">
                    <span className="text-[12px] text-white font-bold tabular-nums">{selectedContactIds.length} selected</span>
                    <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost"
                            className="h-8 text-[11px] font-bold text-white bg-white/15 hover:bg-white/25 rounded-lg px-2.5"
                            disabled={shiftLoading} onClick={() => handleShiftToCall()}>
                            {shiftLoading
                                ? <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin mr-1" />
                                : <PhoneOutgoing className="h-3.5 w-3.5 mr-1" />}
                            Shift to Queue
                        </Button>
                        <Button size="sm" variant="ghost"
                            className="h-8 text-[11px] font-bold text-white bg-white/15 hover:bg-white/25 rounded-lg px-2.5"
                            disabled={shiftLoading || totalCount === 0}
                            onClick={() => handleShiftToCall({ selectAllFiltered: true })}>
                            Shift All
                        </Button>
                    </div>
                </div>
            )}

            {/* ══════ Sticky: Search + actions + filters ══════ */}
            <div className="sticky top-22 z-10 bg-background pb-2 pt-0.5 -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder={synced ? `Search DB + ${deviceCount} device…` : 'Search name or phone…'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 pr-8 h-10 text-xs border-0 shadow-none focus-visible:ring-0 placeholder:text-slate-300"
                            autoComplete="off"
                        />
                        {(isSearching || refreshing) && !searchQuery && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-indigo-400 animate-pulse" title="Syncing…" />
                        )}
                        {isSearching && searchQuery && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="h-3 w-3 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                            </div>
                        )}
                        {!isSearching && searchQuery && (
                            <button onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {synced ? (
                        <Button size="sm" variant="outline"
                            className="h-10 text-[11px] font-bold gap-1 rounded-xl px-2.5 shrink-0 text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100"
                            onClick={() => { clearCache(); toast.info('Device contacts unsynced'); }}
                            disabled={syncing}>
                            <X className="h-3.5 w-3.5" />
                            Unsync
                        </Button>
                    ) : (
                        <Button size="sm"
                            className="h-10 text-[11px] font-bold gap-1 rounded-xl px-2.5 shrink-0 bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 shadow-none"
                            onClick={syncContacts} disabled={syncing}>
                            {syncing
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Smartphone className="h-3.5 w-3.5 text-indigo-500" />}
                            Sync
                        </Button>
                    )}
                    <Button size="sm" className="h-10 text-[11px] font-bold gap-1 rounded-xl px-3 shrink-0 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-200/50"
                        onClick={() => { setAddOpen(true); setAddForm({ name: '', phone: '' }); setAddError(''); }}>
                        <Plus className="h-3.5 w-3.5" />Add
                    </Button>
                </div>
                {/* Status + Category filters */}
                <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="flex-1 h-9 text-[11px] rounded-xl font-bold bg-white ring-1 ring-slate-200 border-0 shadow-[0_1px_4px_-1px_rgba(15,23,42,0.04)]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL" className="text-xs font-medium">All Status</SelectItem>
                            {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="flex-1 h-9 text-[11px] rounded-xl font-bold bg-white ring-1 ring-slate-200 border-0 shadow-[0_1px_4px_-1px_rgba(15,23,42,0.04)]">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL" className="text-xs font-medium">All Cat</SelectItem>
                            {LEAD_CATEGORY_OPTIONS.map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ══════ Count + Select All row ══════ */}
            {!loading && contacts.length > 0 && (
                <div className="flex items-end justify-between px-0.5 pt-1">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Results</p>
                        <p className="text-[13px] font-bold text-slate-800 tabular-nums" style={serif}>
                            {totalCount.toLocaleString('en-IN')} <span className="italic font-normal text-slate-500">contact{totalCount !== 1 ? 's' : ''}</span>
                            {selectedContactIds.length > 0 && (
                                <span className="ml-1.5 text-indigo-600 font-bold text-[11px] not-italic">· {selectedContactIds.length} selected</span>
                            )}
                        </p>
                    </div>
                    <button
                        className="text-[11px] text-indigo-600 font-bold hover:text-indigo-800 transition-colors pb-0.5"
                        onClick={toggleSelectAllOnPage}
                    >
                        {allSelectedOnPage ? 'Deselect All' : 'Select All'}
                    </button>
                </div>
            )}

            {/* ══════ Contact Cards ══════ */}
            <div className="space-y-2.5">
                {loading ? (
                    [...Array(5)].map((_, i) => (
                        <div key={i} className="bg-white rounded-[22px] ring-1 ring-slate-100 p-3.5 pt-4 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] space-y-2.5">
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-36" />
                                    <Skeleton className="h-3 w-20 rounded-full" />
                                    <Skeleton className="h-3 w-28" />
                                </div>
                                <Skeleton className="h-5 w-5 rounded-md shrink-0" />
                            </div>
                            <Skeleton className="h-9 w-full rounded-xl" />
                        </div>
                    ))
                ) : contacts.length === 0 && deviceContactMatches.length === 0 ? (
                    <div className="rounded-[22px] bg-linear-to-br from-indigo-50/60 to-violet-50/40 py-14 flex flex-col items-center ring-1 ring-indigo-100/60">
                        <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm ring-1 ring-indigo-100">
                            <Users className="h-6 w-6 text-indigo-400" strokeWidth={2} />
                        </div>
                        <p className="text-sm font-bold text-slate-800" style={serif}>No contacts found</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Try adjusting your filters.</p>
                    </div>
                ) : (
                    <>
                        {contacts.map((c) => (
                            <ContactCard
                                key={c.id}
                                c={c}
                                selected={selectedSet.has(c.id)}
                                isCalling={callingId === c.id}
                                onSelect={toggleSelect}
                                onCall={handleCallAndConvert}
                                onWhatsApp={handleOpenWhatsApp}
                                onView={openView}
                                onEdit={openEdit}
                                onDelete={openDelete}
                            />
                        ))}

                        {/* Device contacts matching search */}
                        {deviceContactMatches.length > 0 && (
                            <>
                                <div className="flex items-center gap-3 pt-3 pb-1">
                                    <div className="flex-1 h-px bg-amber-200/70" />
                                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-[0.22em] flex items-center gap-1.5">
                                        <Smartphone className="h-3 w-3" /> Device · {deviceContactMatches.length}
                                    </span>
                                    <div className="flex-1 h-px bg-amber-200/70" />
                                </div>
                                {deviceContactMatches.map((dc) => (
                                    <div key={`dev-${dc.phone}`} className="relative overflow-hidden rounded-[22px] bg-linear-to-br from-amber-50/80 to-orange-50/50 ring-1 ring-amber-100 shadow-[0_2px_10px_-2px_rgba(245,158,11,0.15)]">
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-500 to-orange-500" />
                                        <div className="flex items-start gap-3 px-3.5 pt-4 pb-2.5">
                                            <div className="h-12 w-12 rounded-2xl bg-white ring-1 ring-amber-200 flex items-center justify-center shrink-0">
                                                <span className="text-base font-bold text-amber-600" style={serif}>{dc.name?.charAt(0)?.toUpperCase() || '?'}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 text-[14px] leading-snug" style={serif}>{dc.name || 'Unknown'}</p>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-white ring-1 ring-inset ring-amber-200 text-amber-700 inline-block mt-1">Device</span>
                                                {dc.phone && <p className="text-[11px] text-slate-500 mt-1 font-mono">{dc.phone}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1 border-t border-amber-100/80">
                                            <Button
                                                size="sm"
                                                className="flex-1 h-9 text-[11px] font-bold bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl gap-1.5 shadow-sm shadow-emerald-200/40"
                                                onClick={() => {
                                                    const params = new URLSearchParams({ number: dc.phone, name: dc.name || 'Unknown', autoCall: 'true' });
                                                    navigate(`/calls/dialer?${params.toString()}`);
                                                }}>
                                                <PhoneOutgoing className="h-3.5 w-3.5" /> Call
                                            </Button>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-9 w-9 p-0 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                                                onClick={() => handleOpenWhatsApp(dc.phone)}>
                                                <WhatsAppIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && !loading && (
                <div className="flex items-center justify-between pt-1 pb-2">
                    <p className="text-xs text-muted-foreground font-medium">Page {currentPage} of {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-9 px-3 text-xs rounded-xl font-semibold"
                            disabled={currentPage <= 1}
                            onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); fetchContacts(p, searchQuery, statusFilter, categoryFilter); }}>
                            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 px-3 text-xs rounded-xl font-semibold"
                            disabled={currentPage >= totalPages}
                            onClick={() => { const p = Math.min(totalPages, currentPage + 1); setCurrentPage(p); fetchContacts(p, searchQuery, statusFilter, categoryFilter); }}>
                            Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Edit Contact Drawer */}
            <Drawer open={editOpen} onOpenChange={setEditOpen}>
                <DrawerContent className="max-h-[92vh]">
                    <DrawerHeader className="pb-2">
                        <DrawerTitle className="text-base font-bold text-center">Edit Contact</DrawerTitle>
                        <DrawerDescription className="text-center text-xs text-muted-foreground">Update contact details.</DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
                        {editError && (
                            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Name *</Label>
                            <Input
                                placeholder="Contact name"
                                value={editForm.name}
                                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone *</Label>
                            <Input
                                placeholder="Phone number"
                                value={editForm.phone}
                                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</Label>
                                <Select value={editForm.status || 'NONE'} onValueChange={(v) => setEditForm(f => ({ ...f, status: v === 'NONE' ? '' : v }))}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE" className="text-sm">No Status</SelectItem>
                                        {STATUS_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</Label>
                                <Select value={editForm.lead_category || 'NONE'} onValueChange={(v) => setEditForm(f => ({ ...f, lead_category: v === 'NONE' ? '' : v }))}>
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
                    </div>
                    <DrawerFooter className="pt-4 border-t px-4">
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" onClick={() => setEditOpen(false)} className="flex-1 h-9 text-sm">Cancel</Button>
                            <Button onClick={handleEditContact} disabled={editLoading} className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700">
                                {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            {/* View Contact Details Drawer */}
            <Drawer open={viewOpen} onOpenChange={setViewOpen}>
                <DrawerContent className="max-h-[92vh]">
                    <DrawerHeader className="pb-2">
                        <DrawerTitle className="text-base font-bold text-center">Contact Details</DrawerTitle>
                        <DrawerDescription className="text-center text-xs text-muted-foreground">View full contact information.</DrawerDescription>
                    </DrawerHeader>
                    {viewTarget && (
                        <div className="px-4 pb-4 space-y-3 overflow-y-auto max-h-[60vh]">
                            <div className="flex items-center gap-3 pb-3 border-b border-border/40">
                                <div className="h-12 w-12 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                                    <span className="text-lg font-bold text-indigo-600">{viewTarget.name?.charAt(0)?.toUpperCase()}</span>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">{viewTarget.name}</p>
                                    <p className="text-sm text-slate-500">{viewTarget.phone || 'No phone'}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                                        {viewTarget.status ? (STATUS_OPTIONS.find(s => s.value === viewTarget.status)?.label || viewTarget.status) : '—'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Category</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">{viewTarget.lead_category || '—'}</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Calls Dialed</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">{viewTarget.calls_dialed ?? '—'}</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Converted</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">{viewTarget.is_converted ? 'Yes' : 'No'}</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Created</p>
                                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                                        {viewTarget.created_at ? new Date(viewTarget.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        {viewTarget.created_by_name ? ` by ${viewTarget.created_by_name}` : ''}
                                    </p>
                                </div>
                            </div>

                            <CallTimeline calls={viewCallHistory} loading={viewCallLoading} />
                        </div>
                    )}
                    <DrawerFooter className="pt-4 border-t px-4">
                        <Button variant="outline" onClick={() => setViewOpen(false)} className="w-full h-9 text-sm">Close</Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            {/* Add Contact Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <UserPlus className="h-5 w-5 text-indigo-600" />
                            Add Contact
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {addError && (
                            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Name *</Label>
                            <Input
                                placeholder="Contact name"
                                value={addForm.name}
                                onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Phone *</Label>
                            <Input
                                placeholder="Phone number"
                                value={addForm.phone}
                                onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddContact} disabled={addLoading} className="bg-indigo-600 hover:bg-indigo-700">
                            {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add Contact
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent className="sm:max-w-sm bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleteLoading}
                            className="bg-red-600 hover:bg-red-700 text-white">
                            {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default AllContacts;
