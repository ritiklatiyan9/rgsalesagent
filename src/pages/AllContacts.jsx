import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
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
import {
    Search, Users, UserPlus, ChevronLeft, ChevronRight, Trash2,
    Plus, Loader2, X, PhoneOutgoing, Pencil, RefreshCw, Smartphone,
} from 'lucide-react';
import { useDeviceContacts } from '@/hooks/useDeviceContacts';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const AllContacts = () => {
    const navigate = useNavigate();
    const { synced, syncing, syncContacts, searchDeviceContacts, count: deviceCount } = useDeviceContacts();
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

    // Edit
    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', phone: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    const openEdit = (contact) => {
        setEditTarget(contact);
        setEditForm({ name: contact.name || '', phone: contact.phone || '' });
        setEditError('');
        setEditOpen(true);
    };

    const handleEditContact = async () => {
        if (!editForm.name.trim() || !editForm.phone.trim()) {
            setEditError('Name and phone are required');
            return;
        }
        setEditLoading(true);
        setEditError('');
        try {
            await api.put(`/contacts/${editTarget.id}`, editForm);
            toast.success('Contact updated');
            setEditOpen(false);
            fetchContacts(currentPage, searchQuery);
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

            {/* Search + Sync + Add */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder={synced ? `Search DB + ${deviceCount} device contacts...` : 'Search by name or phone...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-8 h-8 text-xs rounded-lg"
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
                <Button size="sm" variant={synced ? 'outline' : 'secondary'}
                    className={`h-8 text-xs gap-1 rounded-lg px-2.5 shrink-0 ${synced ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : ''}`}
                    onClick={syncContacts} disabled={syncing}>
                    {syncing
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : synced ? <RefreshCw className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />
                    }
                    {synced ? 'Synced' : 'Sync'}
                </Button>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs gap-1 rounded-lg px-3 shrink-0"
                    onClick={() => { setAddOpen(true); setAddForm({ name: '', phone: '' }); setAddError(''); }}>
                    <Plus className="h-3.5 w-3.5" />Add
                </Button>
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
                                <TableHead className="pl-2 font-semibold text-[10px] uppercase tracking-wider text-slate-500">Name</TableHead>
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
                                    <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="w-8 pl-3 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedContactIds.includes(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                                className="h-4 w-4 rounded border-slate-300"
                                                aria-label={`Select ${c.name}`}
                                            />
                                        </TableCell>
                                        <TableCell className="pl-2 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-semibold text-indigo-600">{c.name?.charAt(0)?.toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900 text-sm leading-tight">{c.name}</p>
                                                    {c.is_converted && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-0 font-medium">
                                                            Converted
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <span className="text-sm text-slate-600">{c.phone || '—'}</span>
                                        </TableCell>
                                        <TableCell className="text-right pr-3 py-3">
                                            <div className="flex items-center justify-end gap-0.5">
                                                <Button size="sm"
                                                    className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700 rounded-lg px-2.5"
                                                    onClick={() => handleCallAndConvert(c)}
                                                    disabled={callingId === c.id}
                                                >
                                                    {callingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                                                    Call
                                                </Button>
                                                <Button variant="ghost" size="icon" title="WhatsApp"
                                                    className="h-8 w-8 text-green-600 hover:bg-green-50"
                                                    onClick={() => handleOpenWhatsApp(c.phone)}>
                                                    <WhatsAppIcon className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" title="Edit"
                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => openEdit(c)}>
                                                    <Pencil className="h-4 w-4" />
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

                {/* Device contacts matching search - shown inline */}
                {synced && searchQuery.trim().length >= 2 && (() => {
                    const dbPhones = new Set(contacts.map(c => (c.phone || '').replace(/[^0-9]/g, '')));
                    const deviceMatches = searchDeviceContacts(searchQuery)
                        .filter(dc => !dbPhones.has((dc.phone || '').replace(/[^0-9]/g, '')))
                        .slice(0, 15);
                    if (!deviceMatches.length) return null;
                    return (
                        <>
                            <TableRow className="bg-amber-50/60 hover:bg-amber-50/60">
                                <TableCell colSpan={4} className="py-1.5 px-3">
                                    <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                        <Smartphone className="h-3 w-3" /> Device Contacts ({deviceMatches.length})
                                    </span>
                                </TableCell>
                            </TableRow>
                            {deviceMatches.map((dc) => (
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
                    );
                })()}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="border-t border-border/40 bg-slate-50/50 px-3 py-2 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                                disabled={currentPage <= 1 || loading}
                                onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); fetchContacts(p, searchQuery); }}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs"
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => { const p = Math.min(totalPages, currentPage + 1); setCurrentPage(p); fetchContacts(p, searchQuery); }}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Edit Contact Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Pencil className="h-5 w-5 text-blue-600" />
                            Edit Contact
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {editError && (
                            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>
                        )}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Name *</Label>
                            <Input
                                placeholder="Contact name"
                                value={editForm.name}
                                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Phone *</Label>
                            <Input
                                placeholder="Phone number"
                                value={editForm.phone}
                                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleEditContact} disabled={editLoading} className="bg-blue-600 hover:bg-blue-700">
                            {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
