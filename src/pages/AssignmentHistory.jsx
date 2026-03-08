import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
    Search, UserPlus, List, ArrowRightLeft,
    ChevronLeft, ChevronRight, History, ArrowRight, FileSpreadsheet,
} from 'lucide-react';

const LEAD_STATUS_COLORS = {
    NEW: 'bg-blue-100 text-blue-700',
    CONTACTED: 'bg-amber-100 text-amber-700',
    INTERESTED: 'bg-indigo-100 text-indigo-700',
    SITE_VISIT: 'bg-violet-100 text-violet-700',
    NEGOTIATION: 'bg-purple-100 text-purple-700',
    BOOKED: 'bg-emerald-100 text-emerald-700',
    LOST: 'bg-slate-100 text-slate-600',
};

const AssignmentHistory = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    // Pagination & search
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchHistory = useCallback(async (page = 1, search = '') => {
        try {
            setLoading(true);
            let url = `/leads/assignment-history?page=${page}&limit=20`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            const { data } = await api.get(url);
            if (data.success) {
                setRecords(data.history);
                setTotalPages(data.pagination.totalPages);
            }
        } catch {
            toast.error('Failed to load assignment history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchHistory(1, searchQuery);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery, fetchHistory]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <History className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">Assignment History</h1>
                        <p className="text-xs text-muted-foreground">Track your lead assignment changes</p>
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
                        <Link to="/leads/assign" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                            <ArrowRightLeft className="h-3.5 w-3.5" /> Assign
                        </Link>
                        <Link to="/leads/assignment-history" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60 whitespace-nowrap">
                            <History className="h-3.5 w-3.5" /> History
                        </Link>
                    </div>
                </div>
            </div>

            {/* Search */}
            <Card className="card-elevated border-0">
                <CardContent className="py-3 px-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by lead name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-sm rounded-lg"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* History Table */}
            <Card className="card-elevated border-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                <TableHead className="pl-5 font-semibold text-xs uppercase tracking-wider text-slate-500">Lead</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">From</TableHead>
                                <TableHead className="w-8"></TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">To</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Assigned By</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Reason</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-5"><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : records.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <History className="h-8 w-8 text-slate-300" />
                                            <p className="text-sm text-slate-500">No assignment history found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                records.map((record) => (
                                    <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="pl-5 py-3">
                                            <p className="font-medium text-slate-900 text-sm">{record.lead_name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {record.lead_phone && <p className="text-[11px] text-slate-400">{record.lead_phone}</p>}
                                                {record.lead_status && (
                                                    <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 border-0 font-medium ${LEAD_STATUS_COLORS[record.lead_status] || 'bg-slate-100 text-slate-600'}`}>
                                                        {record.lead_status.replace('_', ' ')}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600">
                                                    {(record.assigned_from_name || record.assigned_by_name)?.charAt(0).toUpperCase() ?? '—'}
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-600">{record.assigned_from_name || record.assigned_by_name || 'System'}</span>
                                                    {!record.assigned_from_name && record.assigned_by_name
                                                        ? <p className="text-[10px] text-slate-400">assigner</p>
                                                        : record.assigned_from_role && <p className="text-[10px] text-slate-400">{record.assigned_from_role}</p>
                                                    }
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[10px] font-medium text-indigo-600">
                                                    {record.assigned_to_name ? record.assigned_to_name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-700 font-medium">{record.assigned_to_name || '—'}</span>
                                                    {record.assigned_to_role && <p className="text-[10px] text-slate-400">{record.assigned_to_role}</p>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <span className="text-xs text-slate-600">{record.assigned_by_name || '—'}</span>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <span className="text-xs text-slate-500 truncate max-w-[200px] block">{record.reason || '—'}</span>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <span className="text-xs text-slate-500">
                                                {record.created_at ? format(new Date(record.created_at), 'MMM dd, yyyy HH:mm') : '—'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 1 && (
                    <div className="border-t border-border/40 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground font-medium">Page {currentPage} of {totalPages}</p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 px-2"
                                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); fetchHistory(currentPage - 1, searchQuery); }}
                                disabled={currentPage === 1 || loading}>
                                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 px-2"
                                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); fetchHistory(currentPage + 1, searchQuery); }}
                                disabled={currentPage === totalPages || loading}>
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default AssignmentHistory;
