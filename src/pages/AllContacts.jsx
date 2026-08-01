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
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from '@/components/ui/drawer';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/lib/axios';
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { broadcastMutation, onMutation } from '@/lib/mutationBus';
import { toast } from 'sonner';
import {
    Search, Users, UserPlus, ChevronLeft, ChevronRight, Trash2,
    Plus, Loader2, X, PhoneOutgoing, Pencil, Smartphone, Eye,
    RefreshCw, AlertTriangle, MoreHorizontal,
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
    { value: 'NOT_ANSWERING',  label: 'Not Answering'  },
    { value: 'NOT_INTERESTED', label: 'Not Interested' },
];
const LEAD_CATEGORY_OPTIONS = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const STATUS_COLOR_MAP = {
    NEW:           'bg-blue-50 text-blue-700 ring-blue-200',
    CONTACTED:     'bg-amber-50 text-amber-700 ring-amber-200',
    INTERESTED:    'bg-indigo-50 text-indigo-700 ring-indigo-200',
    NOT_INTERESTED:'bg-gray-100 text-gray-600 ring-gray-200',
    SITE_VISIT:    'bg-violet-50 text-violet-700 ring-violet-200',
    NEGOTIATION:   'bg-purple-50 text-purple-700 ring-purple-200',
    BOOKED:        'bg-emerald-50 text-emerald-700 ring-emerald-200',
    LOST:          'bg-slate-50 text-slate-600 ring-slate-200',
    INCOMING_OFF:  'bg-orange-50 text-orange-700 ring-orange-200',
    SWITCH_OFF:    'bg-red-50 text-red-700 ring-red-200',
    NOT_ANSWERING: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
};

const STATUS_ACCENT_MAP = {
    NEW:           '#3b82f6',
    CONTACTED:     '#f59e0b',
    INTERESTED:    '#6366f1',
    NOT_INTERESTED:'#6b7280',
    SITE_VISIT:    '#8b5cf6',
    NEGOTIATION:   '#a855f7',
    BOOKED:        '#10b981',
    LOST:          '#64748b',
    INCOMING_OFF:  '#f97316',
    SWITCH_OFF:    '#ef4444',
    NOT_ANSWERING: '#eab308',
};

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// Memoised row — only re-renders when its own data or selection changes
const ContactRow = memo(({ c, selected, selectionMode, isCalling, onSelect, onCall, onWhatsApp, onView, onEdit, onDelete }) => {
    const statusCls = STATUS_COLOR_MAP[c.status] || 'bg-slate-50 text-slate-600 ring-slate-200';
    const statusLabel = STATUS_OPTIONS.find(s => s.value === c.status)?.label;
    const accent = STATUS_ACCENT_MAP[c.status] || '#6366f1';
    return (
        <div
            className={`flex items-center gap-2 px-3 py-2.5 transition-colors duration-100 ${
                selected ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60'
            }`}
            onClick={selectionMode ? () => onSelect(c.id) : undefined}
        >
            {/* Checkbox — only in selection mode */}
            {selectionMode && (
                <Checkbox
                    checked={selected}
                    onCheckedChange={() => onSelect(c.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
            )}

            {/* Status dot */}
            <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />

            {/* Avatar */}
            <div className="h-7 w-7 rounded-lg bg-linear-to-br from-indigo-50 to-violet-100 ring-1 ring-inset ring-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-indigo-700">{c.name?.charAt(0)?.toUpperCase()}</span>
            </div>

            {/* Name + phone */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight" style={serif}>{c.name}</p>
                    {c.status && (
                        <span className={`inline-flex shrink-0 items-center text-[8px] uppercase tracking-wider px-1 py-[1px] rounded-full font-bold ring-1 ring-inset ${statusCls}`}>
                            {statusLabel || c.status}
                        </span>
                    )}
                    {c.is_converted && (
                        <span className="hidden sm:inline-flex shrink-0 text-[8px] uppercase tracking-wider px-1 py-[1px] rounded-full font-bold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
                            ✓
                        </span>
                    )}
                </div>
                {c.phone && (
                    <p className="text-[11px] text-slate-400 font-mono tracking-tight leading-tight mt-0.5">{c.phone}</p>
                )}
            </div>

            {/* Primary: Call + View, secondary: ⋯ */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onCall(c); }}
                    disabled={isCalling}
                    className="h-7 w-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white flex items-center justify-center active:scale-95 transition-all duration-150 shadow-sm shadow-emerald-200/50"
                    title="Call"
                >
                    {isCalling
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <PhoneOutgoing className="h-3.5 w-3.5" />}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onView(c); }}
                    className="h-7 w-7 rounded-lg bg-white ring-1 ring-inset ring-slate-200 text-indigo-600 hover:bg-indigo-50 hover:ring-indigo-200 flex items-center justify-center active:scale-95 transition-all duration-150"
                    title="View"
                >
                    <Eye className="h-3.5 w-3.5" />
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 rounded-lg bg-white ring-1 ring-inset ring-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center active:scale-95 transition-all duration-150"
                            title="More actions"
                        >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-lg border-0 ring-1 ring-slate-200 p-1">
                        <DropdownMenuItem
                            onClick={() => onWhatsApp(c.phone)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-green-700 hover:bg-green-50 cursor-pointer"
                        >
                            <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                            WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onEdit(c)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-blue-700 hover:bg-blue-50 cursor-pointer"
                        >
                            <Pencil className="h-3.5 w-3.5 shrink-0" />
                            Edit Contact
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1 bg-slate-100" />
                        <DropdownMenuItem
                            onClick={() => onDelete(c)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
});
ContactRow.displayName = 'ContactRow';

const PAGE_SIZE_OPTIONS = ['15', '25', '50', '100', 'all'];
const DEFAULT_PAGE_SIZE = '25';

const AllContacts = () => {
    const navigate = useNavigate();
    const { synced, syncing, syncContacts, searchDeviceContacts, clearCache, count: deviceCount } = useDeviceContacts();

    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // Probe memory cache synchronously to skip skeleton on navigation back
    const _initCached = getCachedSync(`/contacts?page=1&limit=${DEFAULT_PAGE_SIZE}`);

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
    const [fetchError, setFetchError] = useState(null);

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
            setContacts(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...editForm } : c));
            setEditOpen(false);
            broadcastMutation(['contacts']);
        } catch (err) {
            setEditError(err?.response?.data?.message || 'Failed to update contact');
        } finally {
            setEditLoading(false);
        }
    };

    // Call / convert
    const [callingId, setCallingId] = useState(null);

    // Shift-to-call selection
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedContactIds, setSelectedContactIds] = useState([]);
    const [shiftLoading, setShiftLoading] = useState(false);

    const fetchContacts = useCallback(async (page, search, status, category, limit, { force = false } = {}) => {
        const hasData = hasDataRef.current;
        if (!hasData) setLoading(true);
        else setRefreshing(true);
        if (search) setIsSearching(true);
        setFetchError(null);
        try {
            let url = `/contacts?page=${page}&limit=${limit}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (status && status !== 'ALL') url += `&status=${encodeURIComponent(status)}`;
            if (category && category !== 'ALL') url += `&lead_category=${encodeURIComponent(category)}`;
            const data = await cachedGet(url, { staleTime: 600_000, cacheTime: 900_000, force });
            if (data.success) {
                setContacts(data.contacts);
                setTotalPages(data.pagination.totalPages);
                setTotalCount(data.pagination.total);
                hasDataRef.current = true;
            }
        } catch (err) {
            const status = err?.response?.status;
            const msg = err?.response?.data?.message
                || (status === 401 ? 'Session expired — please log in again'
                    : status === 403 ? 'You do not have permission to view contacts'
                    : err?.message?.includes('Network') || !err?.response ? 'Network error — check your connection'
                    : 'Failed to load contacts');
            setFetchError(msg);
            if (!hasDataRef.current) toast.error(msg);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setIsSearching(false);
        }
    }, []);

    // Keep stable refs so callbacks/effects always see latest values without re-creating
    const fetchContactsRef = useRef(fetchContacts);
    fetchContactsRef.current = fetchContacts;
    const filtersRef = useRef({ searchQuery, statusFilter, categoryFilter, currentPage, pageSize });
    filtersRef.current = { searchQuery, statusFilter, categoryFilter, currentPage, pageSize };

    useEffect(() => onMutation((entities) => {
        if (entities.includes('contacts')) {
            const f = filtersRef.current;
            fetchContactsRef.current(f.currentPage, f.searchQuery, f.statusFilter, f.categoryFilter, f.pageSize, { force: true });
        }
    }), []);

    const handleManualRefresh = useCallback(() => {
        broadcastMutation(['contacts']); // invalidates cache + triggers subscription re-fetch
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchContactsRef.current(1, searchQuery, statusFilter, categoryFilter, pageSize);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, statusFilter, categoryFilter, pageSize]);

    const handleAddContact = async () => {
        if (!addForm.name.trim() || !addForm.phone.trim()) {
            setAddError('Name and phone are required');
            return;
        }
        setAddLoading(true);
        setAddError('');
        try {
            const { data: res } = await api.post('/contacts', addForm);
            toast.success('Contact added');
            const newContact = { id: res?.contact?.id || `temp-${Date.now()}`, ...addForm, status: 'NEW', lead_category: 'NORMAL', is_converted: false, created_at: new Date().toISOString() };
            setContacts(prev => [newContact, ...prev]);
            setTotalCount(prev => prev + 1);
            setAddOpen(false);
            setAddForm({ name: '', phone: '' });
            broadcastMutation(['contacts']);
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
            setContacts(prev => prev.filter(c => c.id !== deleteTarget.id));
            setTotalCount(prev => Math.max(0, prev - 1));
            setDeleteOpen(false);
            broadcastMutation(['contacts']);
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
            setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_converted: true, converted_lead_id: leadId } : c));
            broadcastMutation(['contacts', 'leads']);
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
            setSelectionMode(false);
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
            {/* ══════ Selection action bar ══════ */}
            {selectionMode && (
                <div className="flex items-center justify-between gap-2 bg-linear-to-r from-indigo-600 to-violet-600 rounded-[18px] px-3.5 py-2 shadow-sm shadow-indigo-300/40">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setSelectionMode(false); setSelectedContactIds([]); }}
                            className="h-6 w-6 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                            title="Cancel selection"
                        >
                            <X className="h-3 w-3" />
                        </button>
                        <span className="text-[11px] text-white font-bold uppercase tracking-wider">
                            {selectedContactIds.length > 0
                                ? <>{selectedContactIds.length} <span className="text-white/70 font-normal italic normal-case" style={serif}>selected</span></>
                                : <span className="text-white/70 font-normal italic normal-case" style={serif}>Tap rows to select</span>
                            }
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={shiftLoading || selectedContactIds.length === 0}
                            onClick={() => handleShiftToCall()}
                            className="h-7 px-2.5 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 rounded-full flex items-center gap-1.5 active:scale-95 transition-all duration-150 disabled:opacity-50"
                        >
                            {shiftLoading
                                ? <span className="h-3 w-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                : <PhoneOutgoing className="h-3.5 w-3.5" />}
                            Shift to Queue
                        </button>
                        <button
                            disabled={shiftLoading || totalCount === 0}
                            onClick={() => handleShiftToCall({ selectAllFiltered: true })}
                            className="h-7 px-2.5 text-[11px] font-bold text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-full flex items-center gap-1.5 active:scale-95 transition-all duration-150 disabled:opacity-50"
                        >
                            Shift All
                        </button>
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
                    <Button size="sm" variant="outline"
                        className="h-10 w-10 p-0 rounded-xl shrink-0 text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50 shadow-none"
                        onClick={handleManualRefresh}
                        disabled={loading || refreshing}
                        title="Refresh contacts"
                        aria-label="Refresh contacts">
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
                    </Button>
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

            {/* ══════ Error banner ══════ */}
            {fetchError && (
                <div className="mt-2 rounded-2xl bg-rose-50 ring-1 ring-rose-200 px-3.5 py-2.5 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-rose-800" style={serif}>Couldn't load contacts</p>
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

            {/* ══════ Count + Select toggle row ══════ */}
            {!loading && contacts.length > 0 && (
                <div className="flex items-center justify-between px-1 pt-1">
                    <div className="flex items-baseline gap-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Results</p>
                        <span className="text-[15px] font-bold text-slate-900" style={serif}>{totalCount.toLocaleString('en-IN')}</span>
                        <span className="text-[11px] italic text-slate-500" style={serif}>contact{totalCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectionMode && (
                            <button
                                className="text-[10px] uppercase tracking-wider text-slate-500 font-bold hover:text-slate-700 transition-colors"
                                onClick={toggleSelectAllOnPage}
                            >
                                {allSelectedOnPage ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        <button
                            className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${
                                selectionMode ? 'text-indigo-600 hover:text-indigo-800' : 'text-slate-400 hover:text-indigo-600'
                            }`}
                            onClick={() => { setSelectionMode((v) => !v); if (selectionMode) setSelectedContactIds([]); }}
                        >
                            {selectionMode ? 'Done' : 'Select'}
                        </button>
                    </div>
                </div>
            )}

            {/* ══════ Contact List ══════ */}
            {loading ? (
                <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] overflow-hidden divide-y divide-slate-50">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                            <Skeleton className="h-1.5 w-1.5 rounded-full shrink-0" />
                            <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-1.5 min-w-0">
                                <Skeleton className="h-3.5 w-32" />
                                <Skeleton className="h-2.5 w-20" />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-7 w-7 rounded-lg" />)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : contacts.length === 0 && deviceContactMatches.length === 0 ? (
                <div className="rounded-2xl bg-linear-to-br from-indigo-50/60 to-violet-50/40 py-14 flex flex-col items-center ring-1 ring-indigo-100/60">
                    <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm ring-1 ring-indigo-100">
                        <Users className="h-6 w-6 text-indigo-400" strokeWidth={2} />
                    </div>
                    <p className="text-sm font-bold text-slate-800" style={serif}>No contacts found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Try adjusting your filters.</p>
                </div>
            ) : (
                <>
                    {contacts.length > 0 && (
                        <div className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] overflow-hidden divide-y divide-slate-50">
                            {contacts.map((c) => (
                                <ContactRow
                                    key={c.id}
                                    c={c}
                                    selected={selectedSet.has(c.id)}
                                    selectionMode={selectionMode}
                                    isCalling={callingId === c.id}
                                    onSelect={toggleSelect}
                                    onCall={handleCallAndConvert}
                                    onWhatsApp={handleOpenWhatsApp}
                                    onView={openView}
                                    onEdit={openEdit}
                                    onDelete={openDelete}
                                />
                            ))}
                        </div>
                    )}

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
                            <div className="bg-amber-50/60 rounded-2xl ring-1 ring-amber-100 overflow-hidden divide-y divide-amber-100/60">
                                {deviceContactMatches.map((dc) => (
                                    <div key={`dev-${dc.phone}`} className="flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50/80 transition-colors">
                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                                        <div className="h-7 w-7 rounded-lg bg-white ring-1 ring-amber-200 flex items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-amber-600">{dc.name?.charAt(0)?.toUpperCase() || '?'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight" style={serif}>{dc.name || 'Unknown'}</p>
                                            {dc.phone && <p className="text-[11px] text-slate-400 font-mono tracking-tight leading-tight mt-0.5">{dc.phone}</p>}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                className="h-7 w-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center active:scale-95 transition-all duration-150 shadow-sm shadow-emerald-200/50"
                                                onClick={() => {
                                                    const params = new URLSearchParams({ number: dc.phone, name: dc.name || 'Unknown', autoCall: 'true' });
                                                    navigate(`/calls/dialer?${params.toString()}`);
                                                }}
                                                title="Call"
                                            >
                                                <PhoneOutgoing className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                className="h-7 w-7 rounded-lg bg-white ring-1 ring-inset ring-amber-200 text-green-600 hover:bg-green-50 flex items-center justify-center active:scale-95 transition-all duration-150"
                                                onClick={() => handleOpenWhatsApp(dc.phone)}
                                                title="WhatsApp"
                                            >
                                                <WhatsAppIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ══════ Pagination ══════ */}
            {!loading && totalCount > 0 && (() => {
                const isAll = pageSize === 'all';
                const numericLimit = isAll ? totalCount : parseInt(pageSize, 10);
                const rangeStart = isAll ? 1 : (currentPage - 1) * numericLimit + 1;
                const rangeEnd = isAll ? totalCount : Math.min(currentPage * numericLimit, totalCount);

                // Build a compact page-number window: 1 … (p-1) p (p+1) … N
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
                    fetchContacts(target, searchQuery, statusFilter, categoryFilter, pageSize);
                };

                return (
                    <div className="mt-3 rounded-[20px] bg-white ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] px-3 py-2.5 space-y-2">
                        {/* Range + page size */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-[11px] text-slate-600 font-medium tabular-nums" style={serif}>
                                Showing <span className="font-bold text-slate-900">{rangeStart.toLocaleString('en-IN')}–{rangeEnd.toLocaleString('en-IN')}</span>
                                <span className="italic text-slate-500"> of </span>
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

                        {/* Page number buttons */}
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
