import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import api from '@/lib/axios';
import { invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import {
    Search, Users, UserPlus, List, ArrowRightLeft,
    ChevronLeft, ChevronRight, Loader2, History, CheckCircle2, FileSpreadsheet,
} from 'lucide-react';

const STATUS_OPTIONS = [
    { value: 'NEW', label: 'New Lead', color: 'bg-blue-100 text-blue-700' },
    { value: 'CONTACTED', label: 'Contacted', color: 'bg-amber-100 text-amber-700' },
    { value: 'INTERESTED', label: 'Interested', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'SITE_VISIT', label: 'Site Visit', color: 'bg-violet-100 text-violet-700' },
    { value: 'NEGOTIATION', label: 'Negotiation', color: 'bg-purple-100 text-purple-700' },
    { value: 'BOOKED', label: 'Booked', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'LOST', label: 'Lost', color: 'bg-slate-100 text-slate-700' },
];

const LeadAssignment = () => {
    const [leads, setLeads] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);

    // Selection
    const [selectedLeads, setSelectedLeads] = useState([]);
    const [targetUser, setTargetUser] = useState('');
    const [reason, setReason] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Pagination & search
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLeads = useCallback(async (page = 1, search = '') => {
        try {
            setLoading(true);
            let url = `/leads?page=${page}&limit=20`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            const { data } = await api.get(url);
            if (data.success) {
                setLeads(data.leads);
                setTotalPages(data.pagination.totalPages);
            }
        } catch {
            toast.error('Failed to load leads');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            setUsersLoading(true);
            const { data } = await api.get('/leads/assignable-users');
            if (data.success) {
                setUsers(data.users);
            }
        } catch {
            toast.error('Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLeads(1, searchQuery);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery, fetchLeads]);

    const toggleLead = (leadId) => {
        setSelectedLeads(prev =>
            prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
        );
    };

    const toggleAll = () => {
        if (selectedLeads.length === leads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(leads.map(l => l.id));
        }
    };

    const handleAssign = async () => {
        if (!targetUser) {
            toast.error('Please select a user to assign to');
            return;
        }
        if (selectedLeads.length === 0) {
            toast.error('Please select at least one lead');
            return;
        }

        setAssigning(true);
        try {
            if (selectedLeads.length === 1) {
                const { data } = await api.post(`/leads/${selectedLeads[0]}/assign`, {
                    assigned_to: targetUser,
                    reason: reason.trim() || undefined,
                });
                if (data.success) {
                    toast.success('Lead assigned successfully');
                }
            } else {
                const { data } = await api.post('/leads/bulk-assign', {
                    lead_ids: selectedLeads,
                    assigned_to: targetUser,
                    reason: reason.trim() || undefined,
                });
                if (data.success) {
                    toast.success(`${data.assigned} lead(s) assigned successfully`);
                }
            }
            invalidateCache('/leads');
            setSelectedLeads([]);
            setTargetUser('');
            setReason('');
            fetchLeads(currentPage, searchQuery);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to assign leads');
        } finally {
            setAssigning(false);
        }
    };

    const getRoleBadge = (role) => {
        const map = {
            AGENT: 'bg-blue-100 text-blue-700',
            TEAM_HEAD: 'bg-violet-100 text-violet-700',
            ADMIN: 'bg-emerald-100 text-emerald-700',
            OWNER: 'bg-amber-100 text-amber-700',
        };
        return map[role] || 'bg-slate-100 text-slate-700';
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <ArrowRightLeft className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">Assign My Leads</h1>
                        <p className="text-xs text-muted-foreground">Transfer your leads to other agents, team heads, or admins</p>
                    </div>
                </div>
            </div>

            {/* Sub-page tabs */}
            <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1 border-b border-border/50 pb-0 min-w-max">
                    <div className="flex items-center gap-1 px-1 py-1 bg-muted/40 rounded-xl">
                        <Link to="/leads" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                            <List className="h-3.5 w-3.5" /> My Leads
                        </Link>
                        <Link to="/leads/add" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                            <UserPlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add</span> Lead
                        </Link>
                        <Link to="/leads/bulk" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                            <FileSpreadsheet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Bulk</span> Import
                        </Link>
                        <Link to="/leads/assign" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60 whitespace-nowrap">
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Assign
                        </Link>
                        <Link to="/leads/assignment-history" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                            <History className="h-3.5 w-3.5" /> History
                        </Link>
                    </div>
                </div>
            </div>

            {/* Assignment Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left - Lead Selection */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Search */}
                    <Card className="card-elevated border-0">
                        <CardContent className="py-3 px-4">
                            <div className="relative max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search your leads by name, phone, email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm rounded-lg"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Leads Table */}
                    <Card className="card-elevated border-0 overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                        <TableHead className="pl-5 w-10">
                                            <Checkbox
                                                checked={leads.length > 0 && selectedLeads.length === leads.length}
                                                onCheckedChange={toggleAll}
                                            />
                                        </TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Lead</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Contact</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Status</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Assigned To</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="pl-5"><Skeleton className="h-4 w-4" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : leads.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="h-8 w-8 text-slate-300" />
                                                    <p className="text-sm text-slate-500">No leads found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        leads.map((lead) => {
                                            const statusObj = STATUS_OPTIONS.find(s => s.value === lead.status) || STATUS_OPTIONS[0];
                                            const isSelected = selectedLeads.includes(lead.id);
                                            return (
                                                <TableRow
                                                    key={lead.id}
                                                    className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/40' : ''}`}
                                                    onClick={() => toggleLead(lead.id)}
                                                >
                                                    <TableCell className="pl-5">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleLead(lead.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <p className="font-medium text-slate-900 text-sm">{lead.name}</p>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-xs text-slate-600">
                                                        {lead.phone || lead.email || '—'}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 border-0 font-medium ${statusObj.color}`}>
                                                            {statusObj.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-xs text-slate-600">
                                                        {lead.assigned_to_name || 'Unassigned'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {totalPages > 1 && (
                            <div className="border-t border-border/40 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                                <p className="text-xs text-muted-foreground font-medium">
                                    Page {currentPage} of {totalPages} &middot; {selectedLeads.length} selected
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-8 px-2"
                                        onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); fetchLeads(currentPage - 1, searchQuery); }}
                                        disabled={currentPage === 1 || loading}>
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 px-2"
                                        onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); fetchLeads(currentPage + 1, searchQuery); }}
                                        disabled={currentPage === totalPages || loading}>
                                        Next <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right - Assignment Config */}
                <div className="space-y-4">
                    <Card className="card-elevated border-0 sticky top-4">
                        <CardContent className="p-5 space-y-5">
                            <div className="flex items-center gap-3 pb-3 border-b border-border/50">
                                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                                </div>
                                <h3 className="text-sm font-semibold">Assignment Details</h3>
                            </div>

                            {/* Selected count */}
                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                                <span className="text-sm font-medium text-slate-700">
                                    {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
                                </span>
                            </div>

                            {/* Target User */}
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Assign To <span className="text-red-500">*</span>
                                </Label>
                                {usersLoading ? (
                                    <Skeleton className="h-9 w-full rounded-xl" />
                                ) : (
                                    <Select value={targetUser} onValueChange={setTargetUser}>
                                        <SelectTrigger className="rounded-xl h-9">
                                            <SelectValue placeholder="Select user..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map(u => (
                                                <SelectItem key={u.id} value={String(u.id)} className="text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span>{u.name}</span>
                                                        <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 border-0 ${getRoleBadge(u.role)}`}>
                                                            {u.role}
                                                        </Badge>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Reason */}
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Reason (Optional)
                                </Label>
                                <Textarea
                                    placeholder="e.g. Reassigning for better follow-up..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    className="rounded-xl resize-none text-sm"
                                />
                            </div>

                            {/* Assign Button */}
                            <Button
                                onClick={handleAssign}
                                disabled={assigning || selectedLeads.length === 0 || !targetUser}
                                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2"
                            >
                                {assigning ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Assigning...</>
                                ) : (
                                    <><ArrowRightLeft className="h-4 w-4" /> Assign {selectedLeads.length > 0 ? `${selectedLeads.length} Lead${selectedLeads.length > 1 ? 's' : ''}` : 'Leads'}</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default LeadAssignment;
