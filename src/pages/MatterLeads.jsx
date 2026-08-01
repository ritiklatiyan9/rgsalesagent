import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter,
} from '@/components/ui/drawer';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { onMutation } from '@/lib/mutationBus';
import { useCallAction } from '@/hooks/useCallAction';
import api from '@/lib/axios';
import { format } from 'date-fns';
import CallTimeline from '@/components/CallTimeline';
import {
    Phone, Search, PhoneCall, Clock,
    ChevronLeft, ChevronRight, ChevronDown, X, Eye, Zap, RefreshCw,
} from 'lucide-react';

/* ─── WhatsApp Icon ─── */
const WaIcon = ({ cls = 'h-3.5 w-3.5' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

/* ─── Status config ─── */
const STATUS_CFG = {
    NEW:          { label: 'New',          bg: 'bg-sky-50',    text: 'text-sky-700',    dot: '#0ea5e9' },
    CONTACTED:    { label: 'Contacted',    bg: 'bg-amber-50',  text: 'text-amber-700',  dot: '#f59e0b' },
    INTERESTED:   { label: 'Interested',   bg: 'bg-violet-50', text: 'text-violet-700', dot: '#8b5cf6' },
    SITE_VISIT:   { label: 'Site Visit',   bg: 'bg-purple-50', text: 'text-purple-700', dot: '#a855f7' },
    NEGOTIATION:  { label: 'Negotiation',  bg: 'bg-indigo-50', text: 'text-indigo-700', dot: '#6366f1' },
    BOOKED:       { label: 'Booked',       bg: 'bg-emerald-50',text: 'text-emerald-700',dot: '#10b981' },
    LOST:         { label: 'Lost',         bg: 'bg-slate-100', text: 'text-slate-500',  dot: '#94a3b8' },
    INCOMING_OFF: { label: 'Incoming Off', bg: 'bg-orange-50', text: 'text-orange-700', dot: '#f97316' },
    SWITCH_OFF:   { label: 'Switch Off',   bg: 'bg-red-50',    text: 'text-red-700',    dot: '#ef4444' },
    NOT_ANSWERING:  { label: 'No Answer',      bg: 'bg-rose-50',   text: 'text-rose-700',   dot: '#f43f5e' },
    NOT_INTERESTED: { label: 'Not Interested', bg: 'bg-gray-100',  text: 'text-gray-600',   dot: '#6b7280' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CFG).map(([value, c]) => ({ value, label: c.label }));

/* ─── Category config ─── */
const CAT_CFG = {
    PRIME:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
    HOT:    { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    NORMAL: { bg: 'bg-sky-50',    text: 'text-sky-700',    dot: 'bg-sky-400'    },
    COLD:   { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400'  },
    DEAD:   { bg: 'bg-slate-100', text: 'text-slate-400',  dot: 'bg-slate-300'  },
};

const LEAD_CATEGORY_OPTIONS = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];

const relTime = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return 'now';
};

const LIMIT = 20;

/* ─── Skeleton ─── */
const RowSkeleton = () => (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="flex items-center gap-3 pl-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
        </div>
    </div>
);

/* ─── Lead Card ─── */
const LeadRow = memo(({ lead, onCall, onView }) => {
    const cfg = STATUS_CFG[lead.status] || { label: lead.status?.replace(/_/g, ' ') || '—', bg: 'bg-slate-100', text: 'text-slate-500', dot: '#94a3b8' };
    const catCfg = lead.lead_category ? CAT_CFG[lead.lead_category] : null;
    const lastCalledStr = relTime(lead.last_called_at);

    const handleWa = () => {
        if (!lead.phone) return;
        const cleaned = String(lead.phone).replace(/[^0-9]/g, '');
        const wa = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
        window.open(`https://wa.me/${wa}`, '_blank');
    };

    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md">
            <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ backgroundColor: cfg.dot }} />

            <div className="flex items-center gap-3 pl-3">
                {/* Avatar */}
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${cfg.bg}`}>
                    {lead.photo_url
                        ? <img src={lead.photo_url} alt={lead.name} className="w-full h-full object-cover" loading="lazy" />
                        : <span className={`text-sm font-semibold ${cfg.text}`}>{lead.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-semibold text-slate-950 truncate leading-tight">{lead.name || 'Unnamed'}</p>
                        {catCfg && (
                            <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${catCfg.bg} ${catCfg.text}`}>
                                {lead.lead_category}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                        </span>
                        {lead.phone && (
                            <span className="text-[11px] text-slate-400 font-mono">{lead.phone}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        {lead.call_count > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-teal-600">
                                <PhoneCall className="h-3 w-3" />
                                {lead.call_count} call{lead.call_count !== 1 ? 's' : ''}
                            </span>
                        )}
                        {lastCalledStr && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                {lastCalledStr} ago
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {lead.phone && (
                        <button
                            onClick={() => onCall(lead)}
                            className="h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition active:scale-95 shadow-sm"
                            title="Call"
                        >
                            <Phone className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {lead.phone && (
                        <button
                            onClick={handleWa}
                            className="h-9 w-9 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 flex items-center justify-center ring-1 ring-green-200 transition active:scale-95"
                            title="WhatsApp"
                        >
                            <WaIcon cls="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        onClick={() => onView(lead)}
                        className="h-9 w-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center ring-1 ring-slate-200 transition active:scale-95"
                        title="View"
                    >
                        <Eye className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
});
LeadRow.displayName = 'LeadRow';

export default function MatterLeads() {
    const _init = getCachedSync('/leads/matter?page=1&limit=20');
    const hasDataRef = useRef(!!(_init?.leads?.length));

    const [leads, setLeads]           = useState(_init?.leads ?? []);
    const [total, setTotal]           = useState(_init?.pagination?.total ?? 0);
    const [page, setPage]             = useState(1);
    const [totalPages, setTotalPages] = useState(_init?.pagination?.totalPages ?? 1);
    const [loading, setLoading]       = useState(!hasDataRef.current);
    const [pageLoading, setPageLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const { initiateCall }            = useCallAction();
    const [search, setSearch]         = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter]       = useState('ALL');
    const [categoryFilter, setCategoryFilter]   = useState('ALL');
    const searchTimer = useRef(null);
    const listTopRef  = useRef(null);

    const [viewOpen, setViewOpen]             = useState(false);
    const [viewTarget, setViewTarget]         = useState(null);
    const [viewCallHistory, setViewCallHistory] = useState([]);
    const [viewCallLoading, setViewCallLoading] = useState(false);

    const openView = useCallback(async (lead) => {
        setViewTarget(lead);
        setViewCallHistory([]);
        setViewOpen(true);
        if (lead?.id) {
            setViewCallLoading(true);
            try {
                const { data } = await api.get(`/calls/lead/${lead.id}`);
                if (data?.success && Array.isArray(data.calls)) setViewCallHistory(data.calls);
            } catch { setViewCallHistory([]); } finally { setViewCallLoading(false); }
        }
    }, []);

    const fetchLeads = useCallback(async (pg, q, status, category, force = false) => {
        const isFirstLoad = pg === 1 && !hasDataRef.current;
        if (isFirstLoad) setLoading(true);
        else if (pg === 1) setRefreshing(true);
        else setPageLoading(true);

        try {
            const params = new URLSearchParams({ page: pg, limit: LIMIT });
            if (q) params.set('search', q);
            if (status && status !== 'ALL') params.set('status', status);
            if (category && category !== 'ALL') params.set('lead_category', category);
            const data = await cachedGet(`/leads/matter?${params.toString()}`, {
                staleTime: 60_000, cacheTime: 180_000, force,
            });
            if (data?.success) {
                setLeads(data.leads ?? []);
                setTotal(data.pagination?.total ?? 0);
                setTotalPages(data.pagination?.totalPages ?? 1);
                setPage(pg);
                hasDataRef.current = true;
            }
        } catch { /* silent */ } finally {
            setLoading(false);
            setPageLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchRef = useRef(fetchLeads);
    fetchRef.current = fetchLeads;
    const stateRef = useRef({ page, debouncedSearch, statusFilter, categoryFilter });
    stateRef.current = { page, debouncedSearch, statusFilter, categoryFilter };

    useEffect(() => { fetchLeads(1, '', 'ALL', 'ALL'); }, [fetchLeads]);

    useEffect(() => {
        fetchLeads(1, debouncedSearch, statusFilter, categoryFilter);
        setPage(1);
    }, [statusFilter, categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => onMutation((entities) => {
        if (entities.some(e => e === 'calls' || e === 'leads')) {
            const s = stateRef.current;
            fetchRef.current(s.page, s.debouncedSearch, s.statusFilter, s.categoryFilter, true);
        }
    }), []);

    const handleSearchChange = (e) => {
        const q = e.target.value;
        setSearch(q);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setDebouncedSearch(q);
            hasDataRef.current = false;
            fetchLeads(1, q, statusFilter, categoryFilter);
        }, 380);
    };

    const clearSearch = () => {
        setSearch('');
        setDebouncedSearch('');
        hasDataRef.current = false;
        fetchLeads(1, '', statusFilter, categoryFilter);
    };

    const goToPage = (pg) => {
        if (pg < 1 || pg > totalPages || pg === page) return;
        listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        fetchLeads(pg, debouncedSearch, statusFilter, categoryFilter);
    };

    const handleCall = useCallback((lead) => {
        initiateCall(lead.phone, { leadId: lead.id, name: lead.name });
    }, [initiateCall]);

    const pageRange = useMemo(() => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (page <= 3) return [1, 2, 3, 4, 5];
        if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [page - 2, page - 1, page, page + 1, page + 2];
    }, [page, totalPages]);

    const filtersActive = statusFilter !== 'ALL' || categoryFilter !== 'ALL' || search.length > 0;

    return (
        <div className="space-y-3 pb-8">

            {/* ── Header ── */}
            <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-1 bg-linear-to-r from-teal-500 via-sky-400 to-emerald-400" />
                <div className="px-3.5 pt-3.5 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-teal-500 shadow-sm shadow-teal-200" />
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Leads · Connected Calls
                                </p>
                            </div>
                            <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-slate-950">
                                Matter Leads
                            </h1>
                            <p className="mt-0.5 text-xs font-medium text-slate-500">
                                Leads with at least one real conversation
                            </p>
                        </div>
                        <button
                            onClick={() => { hasDataRef.current = false; fetchLeads(1, debouncedSearch, statusFilter, categoryFilter, true); }}
                            disabled={loading || refreshing}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition hover:bg-white active:scale-95 disabled:opacity-60"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-teal-500' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100">
                    <div className="bg-white px-3 py-2.5 text-center">
                        {loading
                            ? <Skeleton className="h-5 w-14 mx-auto rounded" />
                            : <p className="text-lg font-semibold text-slate-950 tabular-nums">{total.toLocaleString('en-IN')}</p>
                        }
                        <p className="mt-0.5 text-[10px] font-medium text-slate-500">Total leads</p>
                    </div>
                    <div className="bg-white px-3 py-2.5 text-center">
                        <p className="text-lg font-semibold text-slate-950 tabular-nums">{loading ? '—' : `${page}/${totalPages}`}</p>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-500">Page</p>
                    </div>
                </div>
            </header>

            {/* ── Search + filter dropdowns ── */}
            <div ref={listTopRef} className="flex gap-2">
                {/* Search */}
                <div className="flex-1 relative min-w-0">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <Input
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search name or phone…"
                        className="pl-10 pr-10 h-10 rounded-xl bg-white border-0 ring-1 ring-inset ring-slate-200 text-[13px] shadow-sm focus-visible:ring-2 focus-visible:ring-teal-400"
                    />
                    {search && (
                        <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
                            <X className="h-3 w-3 text-slate-500" />
                        </button>
                    )}
                </div>

                {/* Status filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-[12px] font-semibold ring-1 shrink-0 transition active:scale-95 ${
                            statusFilter !== 'ALL'
                                ? 'bg-teal-600 text-white ring-teal-600 shadow-sm'
                                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                        }`}>
                            {statusFilter === 'ALL' ? 'Status' : (STATUS_CFG[statusFilter]?.label || statusFilter)}
                            <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-0 ring-1 ring-slate-200 p-1.5 max-h-72 overflow-y-auto">
                        <DropdownMenuItem
                            onClick={() => setStatusFilter('ALL')}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer ${statusFilter === 'ALL' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            All Status
                        </DropdownMenuItem>
                        {STATUS_OPTIONS.map((s) => (
                            <DropdownMenuItem
                                key={s.value}
                                onClick={() => setStatusFilter(s.value)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer ${statusFilter === s.value ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CFG[s.value]?.dot }} />
                                {s.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Category filter */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-[12px] font-semibold ring-1 shrink-0 transition active:scale-95 ${
                            categoryFilter !== 'ALL'
                                ? 'bg-teal-600 text-white ring-teal-600 shadow-sm'
                                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                        }`}>
                            {categoryFilter === 'ALL' ? 'Category' : categoryFilter}
                            <ChevronDown className="h-3.5 w-3.5 opacity-70 shrink-0" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border-0 ring-1 ring-slate-200 p-1.5">
                        <DropdownMenuItem
                            onClick={() => setCategoryFilter('ALL')}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer ${categoryFilter === 'ALL' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            All Categories
                        </DropdownMenuItem>
                        {LEAD_CATEGORY_OPTIONS.map((c) => (
                            <DropdownMenuItem
                                key={c}
                                onClick={() => setCategoryFilter(c)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer ${categoryFilter === c ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span className={`h-2 w-2 rounded-full shrink-0 ${CAT_CFG[c]?.dot || 'bg-slate-400'}`} />
                                {c.charAt(0) + c.slice(1).toLowerCase()}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Active filter info bar */}
            {filtersActive && !loading && (
                <div className="flex items-center justify-between px-0.5">
                    <p className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-800">{total.toLocaleString('en-IN')}</span>{' '}
                        result{total !== 1 ? 's' : ''}{' '}
                        <span className="text-teal-600 font-medium">· filtered</span>
                    </p>
                    <button
                        onClick={() => { setStatusFilter('ALL'); setCategoryFilter('ALL'); clearSearch(); }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                    >
                        <X className="h-3 w-3" /> Clear all
                    </button>
                </div>
            )}

            {/* ── Lead list ── */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
                </div>
            ) : leads.length === 0 ? (
                <div className="rounded-2xl border border-teal-100 bg-teal-50/40 py-12 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center mb-3 shadow-sm ring-1 ring-teal-100">
                        <PhoneCall className="h-6 w-6 text-teal-400" strokeWidth={2} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No leads found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {filtersActive ? 'Try different filters or clear them.' : 'Leads with connected calls appear here.'}
                    </p>
                    {filtersActive && (
                        <button
                            onClick={() => { setStatusFilter('ALL'); setCategoryFilter('ALL'); clearSearch(); }}
                            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-teal-600 hover:text-teal-800 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className={`space-y-2 transition-opacity duration-200 ${pageLoading ? 'opacity-40 pointer-events-none' : ''}`}>
                    {leads.map((lead) => (
                        <LeadRow key={lead.id} lead={lead} onCall={handleCall} onView={openView} />
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {!loading && totalPages > 1 && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-3 py-2.5 space-y-2">
                    <p className="text-[11px] text-slate-500 tabular-nums text-center">
                        {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)}
                        <span className="text-slate-400"> of </span>
                        {total.toLocaleString('en-IN')}
                    </p>
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                        <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-xl border-slate-200"
                            disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {pageRange[0] > 1 && (
                            <>
                                <Button variant="ghost" size="sm" className="h-8 min-w-8 px-2 rounded-xl text-[11px] font-bold text-slate-600" onClick={() => goToPage(1)}>1</Button>
                                {pageRange[0] > 2 && <span className="text-slate-300 text-[11px] px-0.5">…</span>}
                            </>
                        )}
                        {pageRange.map((pg) => (
                            <Button key={pg} variant="ghost" size="sm"
                                onClick={() => goToPage(pg)} disabled={pageLoading}
                                className={`h-8 min-w-8 px-2 rounded-xl text-[11px] font-bold tabular-nums transition-all ${
                                    pg === page
                                        ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >{pg}</Button>
                        ))}
                        {pageRange[pageRange.length - 1] < totalPages && (
                            <>
                                {pageRange[pageRange.length - 1] < totalPages - 1 && <span className="text-slate-300 text-[11px] px-0.5">…</span>}
                                <Button variant="ghost" size="sm" className="h-8 min-w-8 px-2 rounded-xl text-[11px] font-bold text-slate-600" onClick={() => goToPage(totalPages)}>{totalPages}</Button>
                            </>
                        )}
                        <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-xl border-slate-200"
                            disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {pageLoading && (
                <div className="flex items-center justify-center gap-1.5 py-2">
                    {[0, 1, 2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                </div>
            )}

            {/* ── View Drawer ── */}
            <Drawer open={viewOpen} onOpenChange={setViewOpen}>
                <DrawerContent className="max-h-[92vh]">
                    {viewTarget && (() => {
                        const cfg = STATUS_CFG[viewTarget.status] || STATUS_CFG.NEW;
                        return (
                            <>
                                <div className="h-1 bg-linear-to-r from-teal-500 via-sky-400 to-emerald-400 shrink-0" />

                                <DrawerHeader className="shrink-0 pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${cfg.bg}`}>
                                            {viewTarget.photo_url
                                                ? <img src={viewTarget.photo_url} alt={viewTarget.name} className="w-full h-full object-cover" />
                                                : <span className={`text-lg font-semibold ${cfg.text}`}>{viewTarget.name?.charAt(0)?.toUpperCase()}</span>
                                            }
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <DrawerTitle className="text-[16px] font-semibold text-slate-950 tracking-tight truncate">{viewTarget.name}</DrawerTitle>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                                                <DrawerDescription className="text-[11px] font-medium text-slate-500">{cfg.label}</DrawerDescription>
                                                {viewTarget.lead_category && (
                                                    <span className="text-[10px] font-semibold text-slate-400">· {viewTarget.lead_category}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </DrawerHeader>

                                {/* Quick actions */}
                                {viewTarget.phone && (
                                    <div className="grid grid-cols-2 gap-2 px-4 pb-3 shrink-0">
                                        <button
                                            onClick={() => { handleCall(viewTarget); setViewOpen(false); }}
                                            className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
                                        >
                                            <Phone className="h-4 w-4" /> Call
                                        </button>
                                        <button
                                            onClick={() => {
                                                const cleaned = String(viewTarget.phone).replace(/[^0-9]/g, '');
                                                const wa = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
                                                window.open(`https://wa.me/${wa}`, '_blank');
                                            }}
                                            className="h-10 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 text-[12px] font-semibold flex items-center justify-center gap-2 ring-1 ring-green-200 transition active:scale-95"
                                        >
                                            <WaIcon cls="h-4 w-4" /> WhatsApp
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-4 overflow-y-auto flex-1 min-h-0 px-4 py-2">
                                    {/* Details grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: 'Phone',       value: viewTarget.phone,       mono: true },
                                            { label: 'Email',       value: viewTarget.email,       truncate: true },
                                            { label: 'Address',     value: viewTarget.address },
                                            { label: 'Source',      value: viewTarget.lead_source },
                                            { label: 'Category',    value: viewTarget.lead_category },
                                            { label: 'Added',       value: viewTarget.created_at ? format(new Date(viewTarget.created_at), 'dd MMM yyyy') : null },
                                            { label: 'Calls',       value: viewTarget.call_count ?? 0 },
                                            { label: 'Last Called', value: viewTarget.last_called_at ? format(new Date(viewTarget.last_called_at), 'dd MMM, HH:mm') : null },
                                        ].map(({ label, value, mono, truncate }) => (
                                            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-0.5">{label}</p>
                                                <p className={`text-[12px] font-semibold text-slate-800 ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}>
                                                    {value || '—'}
                                                </p>
                                            </div>
                                        ))}
                                        {viewTarget.assigned_to_name && (
                                            <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                                                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-0.5">Assigned To</p>
                                                <p className="text-[12px] font-semibold text-slate-800">{viewTarget.assigned_to_name}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-1.5">Notes</p>
                                        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600 whitespace-pre-wrap leading-relaxed min-h-12">
                                            {(viewTarget.notes && String(viewTarget.notes).replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim()) || (
                                                <span className="text-slate-300 italic">No notes</span>
                                            )}
                                        </div>
                                    </div>

                                    <CallTimeline calls={viewCallHistory} loading={viewCallLoading} />
                                </div>

                                <DrawerFooter className="shrink-0 border-t border-slate-100 pt-3">
                                    <Button
                                        onClick={() => setViewOpen(false)}
                                        className="h-10 w-full text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-none rounded-xl"
                                    >
                                        Close
                                    </Button>
                                </DrawerFooter>
                            </>
                        );
                    })()}
                </DrawerContent>
            </Drawer>
        </div>
    );
}
