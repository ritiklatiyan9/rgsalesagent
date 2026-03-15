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

    const handleCallAndConvert = async (contact) => {
        setCallingId(contact.id);
        try {
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

            const params = new URLSearchParams({
                lead_id: String(leadId),
                lead_name: contact.name || 'Lead',
                lead_phone: contact.phone || '',
                autoCall: 'true',
                source: 'contacts',
            });
            navigate(`/calls/dialer?${params.toString()}`);

            toast.success('Contact converted to lead — opening dialer');
            // Refresh to remove converted contact
            fetchContacts(currentPage, searchQuery);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to call');
        } finally {
            setCallingId(null);
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <Contact className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">All Contacts</h1>
                        <p className="text-xs text-muted-foreground">Raw contacts — call to convert to leads</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link to="/all-contacts/bulk">
                        <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs rounded-xl">
                            <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
                            Bulk Import
                        </Button>
                    </Link>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-sm h-9 text-xs gap-1.5 rounded-xl"
                        onClick={() => { setAddOpen(true); setAddForm({ name: '', phone: '' }); setAddError(''); }}>
                        <Plus className="h-3.5 w-3.5" />
                        Add Contact
                    </Button>
                </div>
            </div>

            {/* Sub-page tabs */}
            <div className="flex items-center gap-1 border-b border-border/50 pb-0">
                <div className="flex items-center gap-1 px-1 py-1 bg-muted/40 rounded-xl">
                    <Link to="/all-contacts" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60">
                        <Users className="h-3.5 w-3.5" />
                        All Contacts
                    </Link>
                    <Link to="/calls/dialer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors">
                        <PhoneOutgoing className="h-3.5 w-3.5" />
                        Dialer
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
                        <div className="relative flex-1 min-w-55 max-w-md">
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
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                <TableHead className="pl-5 font-semibold text-xs uppercase tracking-wider text-slate-500">Name</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Phone</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 text-center">Added On</TableHead>
                                <TableHead className="text-right pr-5 font-semibold text-xs uppercase tracking-wider text-slate-500">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-5 py-4"><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="py-4"><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell className="py-4"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                                        <TableCell className="pr-5 py-4 text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-16 text-center">
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
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-semibold text-indigo-600">{c.name?.charAt(0)?.toUpperCase()}</span>
                                                </div>
                                                <p className="font-medium text-slate-900 text-sm">{c.name}</p>
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
                    <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
                        <p className="text-xs text-muted-foreground">
                            Page {currentPage} of {totalPages} · {totalCount} contacts
                        </p>
                        <div className="flex items-center gap-1">
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
