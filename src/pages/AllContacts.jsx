import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    Search, Phone, Users, UserPlus, ChevronLeft, ChevronRight, Trash2,
    Plus, Loader2, X, CalendarDays, FileSpreadsheet, PhoneOutgoing, Contact, History,
} from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const AllContacts = () => {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Add contact modal
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', phone: '' });
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');

    // Delete
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Call / convert
    const [callingId, setCallingId] = useState(null);

    // Shift-to-call selection
    const [selectedContactIds, setSelectedContactIds] = useState([]);
    const [shiftLoading, setShiftLoading] = useState(false);

    const fetchContacts = useCallback(async (page = currentPage, search = searchQuery) => {
        try {
            setLoading(true);
            if (search) setIsSearching(true);
            let url = `/contacts?page=${page}&limit=25`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
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
    }, [currentPage, searchQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchContacts(1, searchQuery);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, fetchContacts]);

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
            fetchContacts(currentPage, searchQuery);
        } catch (err) {
            setAddError(err?.response?.data?.message || 'Failed to add contact');
        } finally {
            setAddLoading(false);
        }
    };

    const handleDelete = async () => {
        setDeleteLoading(true);
        try {
            await api.delete(`/contacts/${deleteTarget.id}`);
            toast.success('Contact deleted');
            setDeleteOpen(false);
            fetchContacts(currentPage, searchQuery);
        } catch {
            toast.error('Failed to delete contact');
        } finally {
            setDeleteLoading(false);
        }
    };

    const openDialerForContact = (contact, leadId) => {
        const params = new URLSearchParams({
            lead_id: String(leadId),
            lead_name: contact.name || 'Lead',
            lead_phone: contact.phone || '',
            autoCall: 'true',
            source: 'contacts',
        });
        navigate(`/calls/dialer?${params.toString()}`);
    };

    const handleCallAndConvert = async (contact) => {
        setCallingId(contact.id);
        try {
            if (contact.is_converted && contact.converted_lead_id) {
                openDialerForContact(contact, contact.converted_lead_id);
                toast.success('Opening dialer');
                return;
            }

            // 1. Convert contact to lead
            const { data } = await api.post(`/contacts/${contact.id}/convert`);
            if (!data.success) {
                toast.error(data.message || 'Failed to convert');
                return;
            }

            // 2. Open app dialer route with prefilled details and auto-call
            const leadId = data.lead_id;
            if (!leadId) {
                toast.error('Lead conversion succeeded but lead id is missing');
                return;
            }

            openDialerForContact(contact, leadId);

            toast.success('Contact converted to lead — opening dialer');
            // Refresh to reflect converted flag and latest counts
            fetchContacts(currentPage, searchQuery);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to call');
        } finally {
            setCallingId(null);
        }
    };

    const handleOpenWhatsApp = (phone) => {
        if (!phone) {
            toast.error('Phone number not available');
            return;
        }
        const cleaned = String(phone).replace(/[^0-9]/g, '');
        const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
        window.open(`https://wa.me/${waNumber}`, '_blank');
    };

    const toggleSelect = (contactId) => {
        setSelectedContactIds((prev) => (
            prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
        ));
    };

    const toggleSelectAllOnPage = () => {
        const pageIds = contacts.map((c) => c.id);
        const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedContactIds.includes(id));
        if (allSelected) {
            setSelectedContactIds((prev) => prev.filter((id) => !pageIds.includes(id)));
        } else {
            setSelectedContactIds((prev) => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const handleShiftToCall = async ({ selectAllFiltered = false } = {}) => {
        setShiftLoading(true);
        try {
            const payload = selectAllFiltered
                ? { select_all: true, search: searchQuery }
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

    const allSelectedOnPage = contacts.length > 0 && contacts.every((c) => selectedContactIds.includes(c.id));

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <Contact className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">All Contacts</h1>
                        <p className="text-xs text-muted-foreground">Raw contacts — call to convert to leads</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs rounded-xl flex-1 sm:flex-none"
                        disabled={shiftLoading || selectedContactIds.length === 0}
                        onClick={() => handleShiftToCall()}
                    >
                        {shiftLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PhoneOutgoing className="h-3.5 w-3.5 mr-1.5" />}
                        Shift Selected ({selectedContactIds.length})
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs rounded-xl flex-1 sm:flex-none"
                        disabled={shiftLoading || totalCount === 0}
                        onClick={() => handleShiftToCall({ selectAllFiltered: true })}
                    >
                        {shiftLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-1.5" />}
                        Shift All Filtered
                    </Button>
                    <Link to="/all-contacts/bulk">
                        <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs rounded-xl w-full sm:w-auto">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
                            Bulk Import
                        </Button>
                    </Link>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-sm h-9 text-xs gap-1.5 rounded-xl flex-1 sm:flex-none"
                        onClick={() => { setAddOpen(true); setAddForm({ name: '', phone: '' }); setAddError(''); }}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Contact
                    </Button>
                </div>
            </div>

            {/* Sub-page tabs */}
            <div className="flex items-center gap-1 border-b border-border/50 pb-0 overflow-x-auto">
                <div className="flex items-center gap-1 px-1 py-1 bg-muted/40 rounded-xl min-w-max">
                    <Link to="/all-contacts" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60">
                        <Users className="h-3.5 w-3.5" />
                        All Contacts
                    </Link>
                    <Link to="/calls/dialer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors">
                        <PhoneOutgoing className="h-3.5 w-3.5" />
                        Dialer
                    </Link>
                    <Link to="/contacts/shift-to-call" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors">
                        <PhoneOutgoing className="h-3.5 w-3.5" />
                        Shift to Call
                    </Link>
                    <Link to="/calls/history" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors">
                        <History className="h-3.5 w-3.5" />
                        Call History
                    </Link>
                    <Link to="/all-contacts/bulk" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Bulk Import
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <Card className="card-elevated border-0">
                <CardContent className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-full sm:min-w-55 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search by name or phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-9 h-9 text-sm rounded-xl border-border/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50"
                                autoComplete="off"
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                                </div>
                            )}
                            {!isSearching && searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {searchQuery && !loading && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full border border-primary/15">
                                    {totalCount} result{totalCount !== 1 ? 's' : ''}
                                </span>
                                <button onClick={() => setSearchQuery('')}
                                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2">
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Contacts Table */}
            <Card className="card-elevated border-0 overflow-hidden">
                <div className="md:hidden px-3 py-3 space-y-2.5">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-border/50 p-3 space-y-2.5 bg-white">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-32" />
                                <Skeleton className="h-3 w-20" />
                                <div className="flex gap-2 pt-1">
                                    <Skeleton className="h-8 flex-1" />
                                    <Skeleton className="h-8 w-8" />
                                </div>
                            </div>
                        ))
                    ) : contacts.length === 0 ? (
                        <div className="py-10 text-center">
                            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                <Users className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="text-sm text-slate-500">No contacts found</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-slate-50/70 px-3 py-2">
                                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={allSelectedOnPage}
                                        onChange={toggleSelectAllOnPage}
                                        className="h-4 w-4 rounded border-slate-300"
                                        aria-label="Select all on page"
                                    />
                                    Select all on this page
                                </label>
                                <span className="text-xs text-slate-500">{contacts.length} items</span>
                            </div>

                            {contacts.map((c) => (
                                <div key={c.id} className="rounded-xl border border-border/60 bg-white p-3 space-y-2.5 shadow-sm">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedContactIds.includes(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                                className="h-4 w-4 rounded border-slate-300 shrink-0"
                                                aria-label={`Select ${c.name}`}
                                            />
                                            <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-semibold text-indigo-600">{c.name?.charAt(0)?.toUpperCase()}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900 text-sm truncate">{c.name}</p>
                                                <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {c.phone}
                                                </p>
                                            </div>
                                        </div>
                                        {c.is_converted && (
                                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border-0 shrink-0">
                                                Converted
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50/70 rounded-lg px-2.5 py-1.5">
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" />
                                            {format(new Date(c.created_at), 'MMM dd, yyyy')}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <PhoneOutgoing className="h-3 w-3" />
                                            Calls: {c.calls_dialed ?? 0}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            className="h-8 flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700"
                                            onClick={() => handleCallAndConvert(c)}
                                            disabled={callingId === c.id}
                                        >
                                            {callingId === c.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <PhoneOutgoing className="h-3.5 w-3.5" />
                                            )}
                                            Call
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="WhatsApp"
                                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                                            onClick={() => handleOpenWhatsApp(c.phone)}
                                        >
                                            <WhatsAppIcon className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Delete"
                                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => { setDeleteTarget(c); setDeleteOpen(true); }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                <TableHead className="pl-5 w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelectedOnPage}
                                        onChange={toggleSelectAllOnPage}
                                        className="h-4 w-4 rounded border-slate-300"
                                        aria-label="Select all on page"
                                    />
                                </TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Name</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Phone</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 text-center">Added On</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 text-center">Calls Dialed</TableHead>
                                <TableHead className="text-right pr-5 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-5 py-4"><Skeleton className="h-4 w-4" /></TableCell>
                                        <TableCell className="py-4"><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="py-4"><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell className="py-4"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                                        <TableCell className="py-4"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                        <TableCell className="pr-5 py-4 text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Users className="h-6 w-6 text-slate-300" />
                                            </div>
                                            <p className="text-sm text-slate-500 max-w-sm">No contacts found. Import contacts or add one manually.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                contacts.map((c) => (
                                    <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <TableCell className="pl-5 py-3.5">
                                            <input
                                                type="checkbox"
                                                checked={selectedContactIds.includes(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                                className="h-4 w-4 rounded border-slate-300"
                                                aria-label={`Select ${c.name}`}
                                            />
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-semibold text-indigo-600">{c.name?.charAt(0)?.toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900 text-sm">{c.name}</p>
                                                    {c.is_converted && (
                                                        <Badge variant="secondary" className="mt-1 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border-0">
                                                            Converted to lead
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                                {c.phone}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3.5 text-center">
                                            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                                <CalendarDays className="h-3 w-3 shrink-0" />
                                                {format(new Date(c.created_at), 'MMM dd, yyyy')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3.5 text-center">
                                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
                                                {c.calls_dialed ?? 0}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-5 py-3.5">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button
                                                    size="sm"
                                                    className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700"
                                                    onClick={() => handleCallAndConvert(c)}
                                                    disabled={callingId === c.id}
                                                >
                                                    {callingId === c.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <PhoneOutgoing className="h-3.5 w-3.5" />
                                                    )}
                                                    Call
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="WhatsApp"
                                                    className="h-8 w-8 text-green-600 hover:bg-green-50"
                                                    onClick={() => handleOpenWhatsApp(c.phone)}>
                                                    <WhatsAppIcon className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Delete"
                                                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => { setDeleteTarget(c); setDeleteOpen(true); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 border-t border-border/40">
                        <p className="text-xs text-muted-foreground text-center sm:text-left">
                            Page {currentPage} of {totalPages} · {totalCount} contacts
                        </p>
                        <div className="flex items-center justify-center sm:justify-end gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8"
                                disabled={currentPage <= 1}
                                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); fetchContacts(currentPage - 1); }}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8"
                                disabled={currentPage >= totalPages}
                                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); fetchContacts(currentPage + 1); }}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

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
        </div>
    );
};

export default AllContacts;
