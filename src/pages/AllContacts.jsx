import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';
import {
    Search, Users, UserPlus, ChevronLeft, ChevronRight, Trash2,
    Plus, Loader2, X, PhoneOutgoing, Pencil, Smartphone, Eye,
} from 'lucide-react';
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

const STATUS_COLOR_MAP = {
    NEW: 'bg-blue-100 text-blue-700',
    CONTACTED: 'bg-amber-100 text-amber-700',
    INTERESTED: 'bg-indigo-100 text-indigo-700',
    SITE_VISIT: 'bg-violet-100 text-violet-700',
    NEGOTIATION: 'bg-purple-100 text-purple-700',
    BOOKED: 'bg-emerald-100 text-emerald-700',
    LOST: 'bg-slate-100 text-slate-600',
    INCOMING_OFF: 'bg-orange-100 text-orange-700',
    SWITCH_OFF: 'bg-red-100 text-red-700',
    NOT_ANSWERING: 'bg-yellow-100 text-yellow-700',
};

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// Memoized row — only re-renders when its own data or selection state changes
const ContactRow = memo(({ c, selected, isCalling, onSelect, onCall, onWhatsApp, onView, onEdit, onDelete }) => (
    <TableRow className="hover:bg-slate-50/50 transition-colors">
        <TableCell className="w-8 pl-3 py-3">
            <input type="checkbox" checked={selected} onChange={() => onSelect(c.id)}
                className="h-4 w-4 rounded border-slate-300" aria-label={`Select ${c.name}`} />
        </TableCell>
        <TableCell className="pl-2 py-3">
            <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-indigo-600">{c.name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div>
                    <p className="font-medium text-slate-900 text-sm leading-tight">{c.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                        {c.status && (
                            <span className={`text-[10px] px-1.5 py-0 rounded font-medium ${STATUS_COLOR_MAP[c.status] || 'bg-slate-100 text-slate-600'}`}>
                                {STATUS_OPTIONS.find(s => s.value === c.status)?.label || c.status}
                            </span>
                        )}
                        {c.lead_category && (
                            <span className="text-[10px] text-slate-400 font-medium">{c.lead_category}</span>
                        )}
                        {c.is_converted && !c.status && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-0 font-medium">Converted</Badge>
                        )}
                    </div>
                </div>
            </div>
        </TableCell>
        <TableCell className="py-3">
            <span className="text-sm text-slate-600">{c.phone || '—'}</span>
        </TableCell>
        <TableCell className="text-right pr-3 py-3">
            <div className="flex items-center justify-end gap-0.5">
                <Button size="sm" className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700 rounded-lg px-2.5"
                    onClick={() => onCall(c)} disabled={isCalling}>
                    {isCalling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                    Call
                </Button>
                <Button variant="ghost" size="icon" title="WhatsApp"
                    className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => onWhatsApp(c.phone)}>
                    <WhatsAppIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="View Details"
                    className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => onView(c)}>
                    <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Edit"
                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => onEdit(c)}>
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Delete"
                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(c)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </TableCell>
    </TableRow>
));
ContactRow.displayName = 'ContactRow';

const AllContacts = () => {
    const navigate = useNavigate();
    const { synced, syncing, syncContacts, searchDeviceContacts, clearCache, count: deviceCount } = useDeviceContacts();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

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

    const openEdit = useCallback((contact) => {
        setEditTarget(contact);
        setEditForm({ name: contact.name || '', phone: contact.phone || '', status: contact.status || '', lead_category: contact.lead_category || '' });
        setEditError('');
        setEditOpen(true);
    }, []);

    const openView = useCallback((contact) => {
        setViewTarget(contact);
        setViewOpen(true);
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
        try {
            setLoading(true);
            if (search) setIsSearching(true);
            let url = `/contacts?page=${page}&limit=25`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (status && status !== 'ALL') url += `&status=${encodeURIComponent(status)}`;
            if (category && category !== 'ALL') url += `&lead_category=${encodeURIComponent(category)}`;
            const { data } = await api.get(url);
            if (data.success) {
                setContacts(data.contacts);
                setTotalPages(data.pagination.totalPages);
                setTotalCount(data.pagination.total);
            }
        } catch {
            toast.error('Failed to load contacts');
        } finally {
            setLoading(false);
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
            {/* Selection action bar */}
            {selectedContactIds.length > 0 && (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-indigo-700 font-medium">{selectedContactIds.length} selected</span>
                    <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost"
                            className="h-7 text-xs text-indigo-700 hover:bg-indigo-100 rounded-md px-2.5"
                            disabled={shiftLoading} onClick={() => handleShiftToCall()}>
                            {shiftLoading
                                ? <span className="h-3 w-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mr-1" />
                                : <PhoneOutgoing className="h-3.5 w-3.5 mr-1" />
                            }
                            Shift to Queue
                        </Button>
                        <Button size="sm" variant="ghost"
                            className="h-7 text-xs text-indigo-700 hover:bg-indigo-100 rounded-md px-2.5"
                            disabled={shiftLoading || totalCount === 0}
                            onClick={() => handleShiftToCall({ selectAllFiltered: true })}>
                            Shift All
                        </Button>
                    </div>
                </div>
            )}

            {/* Search + Sync/Unsync + Add — sticky below tabs */}
            <div className="sticky top-13 z-10 bg-background pb-2 pt-0.5 -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder={synced ? `Search DB + ${deviceCount} device contacts...` : 'Search by name or phone...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 pr-8 h-9 text-xs rounded-xl"
                            autoComplete="off"
                        />
                        {isSearching && (
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <div className="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                            </div>
                        )}
                        {!isSearching && searchQuery && (
                            <button onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {synced ? (
                        <Button size="sm" variant="outline"
                            className="h-9 text-xs gap-1 rounded-xl px-2.5 shrink-0 text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                            onClick={() => { clearCache(); toast.info('Device contacts unsynced'); }}
                            disabled={syncing}>
                            <X className="h-3.5 w-3.5" />
                            Unsync
                        </Button>
                    ) : (
                        <Button size="sm" variant="secondary"
                            className="h-9 text-xs gap-1 rounded-xl px-2.5 shrink-0"
                            onClick={syncContacts} disabled={syncing}>
                            {syncing
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Smartphone className="h-3.5 w-3.5" />
                            }
                            Sync
                        </Button>
                    )}
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-9 text-xs gap-1 rounded-xl px-3 shrink-0"
                        onClick={() => { setAddOpen(true); setAddForm({ name: '', phone: '' }); setAddError(''); }}>
                        <Plus className="h-3.5 w-3.5" />Add
                    </Button>
                </div>
                {/* Status + Category filters */}
                <div className="flex items-center gap-2 mt-1.5">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="flex-1 h-8 text-xs rounded-xl font-medium">
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
                        <SelectTrigger className="flex-1 h-8 text-xs rounded-xl font-medium">
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

            {/* Contacts Table */}
            <Card className="card-elevated border-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                <TableHead className="w-8 pl-3">
                                    <input type="checkbox" checked={allSelectedOnPage} onChange={toggleSelectAllOnPage} className="h-4 w-4 rounded border-slate-300" aria-label="Select all" />
                                </TableHead>
                                <TableHead className="pl-2 font-semibold text-[10px] uppercase tracking-wider text-slate-500">Name / Status</TableHead>
                                <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-slate-500">Phone</TableHead>
                                <TableHead className="text-right pr-3 font-semibold text-[10px] uppercase tracking-wider text-slate-500">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(6)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="w-8 pl-3 py-3"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                                        <TableCell className="pl-2 py-3"><Skeleton className="h-5 w-28" /></TableCell>
                                        <TableCell className="py-3"><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="pr-3 py-3 text-right"><Skeleton className="h-8 w-28 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Users className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <p className="text-xs text-slate-500">No contacts found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                contacts.map((c) => (
                                    <ContactRow
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
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Device contacts matching search - shown inline */}
                {deviceContactMatches.length > 0 && (
                        <>
                            <TableRow className="bg-amber-50/60 hover:bg-amber-50/60">
                                <TableCell colSpan={4} className="py-1.5 px-3">
                                    <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                        <Smartphone className="h-3 w-3" /> Device Contacts ({deviceContactMatches.length})
                                    </span>
                                </TableCell>
                            </TableRow>
                            {deviceContactMatches.map((dc) => (
                                <TableRow key={`dev-${dc.phone}`} className="hover:bg-amber-50/30 transition-colors">
                                    <TableCell className="w-8 pl-3 py-2.5" />
                                    <TableCell className="pl-2 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-9 w-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-semibold text-amber-600">{dc.name?.charAt(0)?.toUpperCase() || '?'}</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 text-sm leading-tight">{dc.name || 'Unknown'}</p>
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-0 font-medium">
                                                    Device
                                                </Badge>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2.5">
                                        <span className="text-sm text-slate-600">{dc.phone}</span>
                                    </TableCell>
                                    <TableCell className="text-right pr-3 py-2.5">
                                        <div className="flex items-center justify-end gap-0.5">
                                            <Button size="sm"
                                                className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700 rounded-lg px-2.5"
                                                onClick={() => {
                                                    const params = new URLSearchParams({ number: dc.phone, name: dc.name || 'Unknown', autoCall: 'true' });
                                                    navigate(`/calls/dialer?${params.toString()}`);
                                                }}>
                                                <PhoneOutgoing className="h-3.5 w-3.5" /> Call
                                            </Button>
                                            <Button variant="ghost" size="icon" title="WhatsApp"
                                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                                onClick={() => handleOpenWhatsApp(dc.phone)}>
                                                <WhatsAppIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="border-t border-border/40 bg-slate-50/50 px-3 py-2 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                                disabled={currentPage <= 1 || loading}
                                onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); fetchContacts(p, searchQuery, statusFilter, categoryFilter); }}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => { const p = Math.min(totalPages, currentPage + 1); setCurrentPage(p); fetchContacts(p, searchQuery, statusFilter, categoryFilter); }}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

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
