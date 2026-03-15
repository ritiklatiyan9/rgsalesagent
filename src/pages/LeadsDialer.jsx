import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { format, startOfDay } from 'date-fns';
import {
    Phone, PhoneCall, PhoneOff, Search, Filter,
    ChevronLeft, ChevronRight, Loader2, CalendarDays,
    PhoneOutgoing, CheckCircle, Eye,
    User, Mail, MapPin, FileText, Clock, Edit3, Save, X, Users,
} from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'All Leads' },
    { value: 'NEW', label: 'New' },
    { value: 'CONTACTED', label: 'Contacted' },
    { value: 'INTERESTED', label: 'Interested' },
    { value: 'SITE_VISIT', label: 'Site Visit' },
    { value: 'NEGOTIATION', label: 'Negotiation' },
    { value: 'BOOKED', label: 'Booked' },
    { value: 'LOST', label: 'Lost' },
];

const LEAD_STATUS_OPTIONS = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];

const statusColors = {
    NEW: 'bg-blue-100 text-blue-700 border-blue-200',
    CONTACTED: 'bg-amber-100 text-amber-700 border-amber-200',
    INTERESTED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    SITE_VISIT: 'bg-violet-100 text-violet-700 border-violet-200',
    NEGOTIATION: 'bg-purple-100 text-purple-700 border-purple-200',
    BOOKED: 'bg-green-100 text-green-700 border-green-200',
    LOST: 'bg-slate-100 text-slate-700 border-slate-200',
};

const LEAD_CATEGORY_OPTIONS = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'PRIME', label: 'Prime' },
    { value: 'HOT', label: 'Hot' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'COLD', label: 'Cold' },
    { value: 'DEAD', label: 'Dead' },
];

const LEAD_CATEGORY_VALUES = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];

const categoryColors = {
    PRIME: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    HOT: 'bg-red-100 text-red-700 border-red-200',
    NORMAL: 'bg-blue-100 text-blue-700 border-blue-200',
    COLD: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    DEAD: 'bg-gray-100 text-gray-700 border-gray-200',
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
const formatDuration = (s) => { if (!s && s !== 0) return '0:00'; const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, '0')}`; };

const LeadsDialer = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const autoCallRef = useRef(false);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [outcomes, setOutcomes] = useState([]);

    // Lead detail modal
    const [leadDetailModal, setLeadDetailModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [leadCallHistory, setLeadCallHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Edit lead mode
    const [editingLead, setEditingLead] = useState(false);
    const [editLeadForm, setEditLeadForm] = useState({});
    const [savingLead, setSavingLead] = useState(false);

    // Inline schedule form (inside lead detail modal)
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({ date: null, time: '10:00', notes: '' });
    const [savingSchedule, setSavingSchedule] = useState(false);

    // ── Fetch Leads ──
    const fetchLeads = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', '25');
            if (search) params.set('search', search);
            if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
            if (categoryFilter && categoryFilter !== 'ALL') params.set('lead_category', categoryFilter);
            const { data } = await api.get(`/calls/leads-dialer?${params}`);
            if (data.success) { setLeads(data.leads); setPagination(data.pagination); }
        } catch {
            toast.error('Failed to load leads');
        } finally { setLoading(false); }
    }, [search, statusFilter, categoryFilter]);

    const fetchOutcomes = useCallback(async () => {
        try {
            const { data } = await api.get('/calls/outcomes');
            if (data.success) setOutcomes(data.outcomes);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchLeads(); fetchOutcomes(); }, [fetchLeads, fetchOutcomes]);

    // Auto-call logic
    useEffect(() => {
        const paramLeadId = searchParams.get('lead_id');
        if (!paramLeadId || autoCallRef.current || loading || outcomes.length === 0) return;
        autoCallRef.current = true;
        const paramName  = searchParams.get('lead_name')  || 'Lead';
        const paramPhone = searchParams.get('lead_phone') || '';
        handleCall({ id: parseInt(paramLeadId), name: paramName, phone: paramPhone });
    }, [loading, outcomes, searchParams]);

    // ── Lead details + call history ──
    const fetchLeadDetails = useCallback(async (lead) => {
        setLoadingHistory(true);
        try {
            const [leadRes, callsRes] = await Promise.all([
                api.get(`/leads/${lead.id}`),
                api.get(`/calls/lead/${lead.id}`),
            ]);
            if (leadRes.data.success) setSelectedLead(leadRes.data.lead);
            else setSelectedLead(lead);
            if (callsRes.data.success) setLeadCallHistory(callsRes.data.calls || []);
        } catch {
            setSelectedLead(lead);
            setLeadCallHistory([]);
        } finally { setLoadingHistory(false); }
    }, []);

    const openLeadDetailModal = (lead) => {
        fetchLeadDetails(lead);
        setEditingLead(false);
        setShowScheduleForm(false);
        setScheduleForm({ date: null, time: '10:00', notes: '' });
        setLeadDetailModal(true);
    };

    // ── Edit lead ──
    const startEditLead = () => {
        if (!selectedLead) return;
        setEditLeadForm({
            name: selectedLead.name || '', phone: selectedLead.phone || '',
            email: selectedLead.email || '', address: selectedLead.address || '',
            profession: selectedLead.profession || '', status: selectedLead.status || 'NEW',
            lead_category: selectedLead.lead_category || '',
            notes: selectedLead.notes || '',
        });
        setEditingLead(true);
    };

    const cancelEditLead = () => { setEditingLead(false); setEditLeadForm({}); };

    const saveLeadDetails = async () => {
        if (!selectedLead) return;
        setSavingLead(true);
        try {
            const { data } = await api.put(`/leads/${selectedLead.id}`, editLeadForm);
            if (data.success) {
                toast.success('Lead details updated');
                setSelectedLead({ ...selectedLead, ...editLeadForm });
                setEditingLead(false);
                fetchLeads(pagination.page);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update lead');
        } finally { setSavingLead(false); }
    };

    // ── Initiate Call ──
    const handleCall = async (lead) => {
        if (!lead.phone) { toast.error('This lead has no phone number'); return; }
        try {
            const isApp = window.Capacitor?.isNativePlatform?.() || false;
            await api.post('/calls/quick-log', {
                lead_id: lead.id,
                call_source: isApp ? 'APP' : 'WEB',
            });
            if (isApp && window.Capacitor?.Plugins?.CallNumber) {
                try { await window.Capacitor.Plugins.CallNumber.callNumber({ number: lead.phone, bypassAppChooser: false }); }
                catch { window.open(`tel:${lead.phone}`, '_self'); }
            } else { window.open(`tel:${lead.phone}`, '_self'); }
            toast.success(`Calling ${lead.name}…`, { description: lead.phone });
            setTimeout(() => fetchLeads(pagination.page), 4000);
        } catch { toast.error('Failed to initiate call'); }
    };

    // ── WhatsApp ──
    const openWhatsApp = (phone) => {
        if (!phone) { toast.error('No phone number available'); return; }
        const cleaned = phone.replace(/[^0-9]/g, '');
        const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
        window.open(`https://wa.me/${waNumber}`, '_blank');
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <Phone className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800">Leads Dialer</h1>
                        <p className="text-xs text-muted-foreground">Click the call button — system tracks everything automatically</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <Card className="card-elevated border-0">
                <CardContent className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0">
                            <Filter className="h-3.5 w-3.5" /> Filters
                        </div>
                        <div className="relative w-full sm:flex-1 sm:min-w-48">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or phone..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchLeads(1)}
                                className="pl-10 h-9 text-sm"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 flex-1 sm:w-40 text-xs">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-9 flex-1 sm:w-44 text-xs">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {LEAD_CATEGORY_OPTIONS.map((c) => (
                                    <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => fetchLeads(1)} className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs w-full sm:w-auto">
                            <Search className="h-3.5 w-3.5" /> Search
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Leads Table */}
            <Card className="card-elevated border-0">
                <CardContent className="p-0">
                    {/* ── Mobile Card List ── */}
                    <div className="md:hidden p-3 space-y-3">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="rounded-xl border border-slate-200 p-3.5 space-y-3">
                                    <Skeleton className="h-10 w-full rounded" />
                                    <Skeleton className="h-5 w-3/4 rounded" />
                                </div>
                            ))
                        ) : leads.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Phone className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                <p className="text-sm font-medium">No leads found</p>
                                <p className="text-xs mt-1">Try adjusting your filters</p>
                            </div>
                        ) : leads.map((lead) => (
                            <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100 shrink-0">
                                            {lead.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p>
                                            <p className="text-xs font-mono text-slate-500">{lead.phone || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 ${statusColors[lead.status] || ''}`}>{lead.status}</Badge>
                                        {lead.lead_category && (
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 ${categoryColors[lead.lead_category] || ''}`}>{lead.lead_category}</Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                                    <span>{lead.agent_name || 'Unassigned'}</span>
                                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.total_calls || 0} calls</span>
                                    {lead.last_call_at ? <span>{formatDate(lead.last_call_at)}</span> : <span className="italic">Never called</span>}
                                </div>
                                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                                    <Button size="sm" variant="ghost" onClick={() => openLeadDetailModal(lead)}
                                        className="h-9 flex-1 text-xs gap-1 text-slate-600 hover:bg-slate-50">
                                        <Eye className="h-3.5 w-3.5" /> View
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => openWhatsApp(lead.phone)}
                                        disabled={!lead.phone}
                                        className="h-9 flex-1 text-xs gap-1 text-green-600 hover:bg-green-50 disabled:opacity-30">
                                        <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                                    </Button>
                                    <Button size="sm" onClick={() => handleCall(lead)}
                                        disabled={!lead.phone}
                                        className="h-9 flex-1 text-xs gap-1 bg-green-500 hover:bg-green-600 text-white disabled:bg-slate-200">
                                        <PhoneOutgoing className="h-3.5 w-3.5" /> Call
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Desktop Table ── */}
                    <div className="hidden md:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider pl-4 w-10">#</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Lead Name</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Phone</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Category</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider">Last Call</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-center pr-4">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array(8).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array(7).fill(0).map((_, j) => (
                                                <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : leads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                                            <Phone className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                            <p className="text-sm font-medium">No leads found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : leads.map((lead, idx) => (
                                    <TableRow key={lead.id} className="group transition-colors hover:bg-slate-50/60">
                                        <TableCell className="text-xs text-muted-foreground pl-4">{(pagination.page - 1) * 25 + idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100">{lead.name?.charAt(0)?.toUpperCase()}</div>
                                                <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p></div>
                                            </div>
                                        </TableCell>
                                        <TableCell><span className="text-sm font-mono">{lead.phone || '—'}</span></TableCell>
                                        <TableCell><Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${statusColors[lead.status] || ''}`}>{lead.status}</Badge></TableCell>
                                        <TableCell>{lead.lead_category && <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${categoryColors[lead.lead_category] || ''}`}>{lead.lead_category}</Badge>}</TableCell>
                                        <TableCell>{lead.last_call_at ? formatDate(lead.last_call_at) : 'Never'}</TableCell>
                                        <TableCell className="text-center pr-4">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Button size="sm" variant="ghost" onClick={() => openLeadDetailModal(lead)} className="h-8 w-8 p-0"><Eye className="h-4 w-4" /></Button>
                                                <Button size="sm" variant="ghost" onClick={() => openWhatsApp(lead.phone)} className="h-8 w-8 p-0 text-green-600"><WhatsAppIcon className="h-4 w-4" /></Button>
                                                <Button size="sm" onClick={() => handleCall(lead)} className="h-9 w-9 p-0 bg-green-500 text-white rounded-full"><PhoneOutgoing className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {!loading && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                            <p className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchLeads(pagination.page - 1)}>Previous</Button>
                                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchLeads(pagination.page + 1)}>Next</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={leadDetailModal} onOpenChange={setLeadDetailModal}>
                <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>{selectedLead?.name || 'Lead Details'}</DialogTitle>
                    </DialogHeader>
                    {loadingHistory ? (
                        <div className="space-y-4 py-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-16 w-full" /></div>
                    ) : selectedLead && (
                        <div className="space-y-4">
                            <div className="rounded-xl border p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-semibold">Information</h4>
                                    {!editingLead ? (
                                        <Button variant="ghost" size="sm" onClick={startEditLead} className="text-indigo-600"><Edit3 className="h-3 w-3 mr-1" /> Edit</Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={cancelEditLead}>Cancel</Button>
                                            <Button size="sm" onClick={saveLeadDetails} disabled={savingLead}>Save</Button>
                                        </div>
                                    )}
                                </div>
                                {editingLead ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Input placeholder="Name" value={editLeadForm.name} onChange={(e) => setEditLeadForm(f => ({ ...f, name: e.target.value }))} />
                                        <Input placeholder="Phone" value={editLeadForm.phone} onChange={(e) => setEditLeadForm(f => ({ ...f, phone: e.target.value }))} />
                                        <Select value={editLeadForm.status} onValueChange={(v) => setEditLeadForm(f => ({ ...f, status: v }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{LEAD_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Select value={editLeadForm.lead_category || 'NONE'} onValueChange={(v) => setEditLeadForm(f => ({ ...f, lead_category: v === 'NONE' ? '' : v }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="NONE">No Category</SelectItem>{LEAD_CATEGORY_VALUES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                        <p><strong>Phone:</strong> {selectedLead.phone}</p>
                                        <p><strong>Status:</strong> {selectedLead.status}</p>
                                        {selectedLead.lead_category && <p><strong>Category:</strong> {selectedLead.lead_category}</p>}
                                    </div>
                                )}
                            </div>

                            <Button onClick={() => { setLeadDetailModal(false); handleCall(selectedLead); }} className="w-full bg-green-500 text-white">Call Now</Button>

                            <Separator />

                            <div className="space-y-3">
                                <h4 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline</h4>
                                {leadCallHistory.length === 0 ? <p className="text-sm text-center text-muted-foreground py-4">No calls logged</p> : (
                                    <div className="space-y-3 ml-2 border-l-2 pl-4">
                                        {leadCallHistory.map(call => (
                                            <div key={call.id} className="text-xs space-y-1">
                                                <p className="font-semibold">{formatDate(call.call_start)} {formatTime(call.call_start)}</p>
                                                <p className="text-muted-foreground">Duration: {formatDuration(call.duration_seconds)} | {call.outcome_label || 'No outcome'}</p>
                                                {call.customer_notes && <p className="bg-slate-50 p-2 rounded italic text-slate-600">{call.customer_notes}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LeadsDialer;
