import { useEffect, useState, useRef, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { useCallAction } from '@/hooks/useCallAction';
import {
    Phone, Search, PhoneCall, Clock, Star,
    ChevronLeft, ChevronRight, X,
} from 'lucide-react';

/* ─── WhatsApp Icon ─── */
const WaIcon = ({ cls = 'h-3.5 w-3.5' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

/* ─── Pill maps ─── */
const STATUS_PILL = {
    NEW:          'bg-sky-50 text-sky-700 border-sky-200',
    CONTACTED:    'bg-blue-50 text-blue-700 border-blue-200',
    INTERESTED:   'bg-amber-50 text-amber-700 border-amber-200',
    SITE_VISIT:   'bg-violet-50 text-violet-700 border-violet-200',
    NEGOTIATION:  'bg-indigo-50 text-indigo-700 border-indigo-200',
    BOOKED:       'bg-emerald-50 text-emerald-700 border-emerald-200',
    LOST:         'bg-rose-50 text-rose-700 border-rose-200',
};

const CAT_PILL = {
    PRIME:  'bg-amber-50 text-amber-700 border-amber-200',
    HOT:    'bg-rose-50 text-rose-700 border-rose-200',
    NORMAL: 'bg-sky-50 text-sky-700 border-sky-200',
    COLD:   'bg-cyan-50 text-cyan-700 border-cyan-200',
    DEAD:   'bg-slate-100 text-slate-600 border-slate-200',
};

const relTime = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'Just now';
};

const LIMIT = 20;

/* ─── Skeleton Card ─── */
const LeadSkeleton = () => (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
        <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
            <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
            </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
    </div>
);

export default function MatterLeads() {
    const _init = getCachedSync('/leads/matter?page=1&limit=20');
    const hasDataRef = useRef(!!(_init?.leads?.length));

    const [leads, setLeads] = useState(_init?.leads ?? []);
    const [total, setTotal] = useState(_init?.pagination?.total ?? 0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(_init?.pagination?.totalPages ?? 1);
    const [loading, setLoading] = useState(!hasDataRef.current);
    const [pageLoading, setPageLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const { initiateCall } = useCallAction();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchTimer = useRef(null);
    const listTopRef = useRef(null);

    const fetchLeads = useCallback(async (pg, q) => {
        const isFirstLoad = pg === 1 && !hasDataRef.current;
        if (isFirstLoad) setLoading(true);
        else if (pg === 1) setRefreshing(true);
        else setPageLoading(true);

        try {
            const params = new URLSearchParams({ page: pg, limit: LIMIT });
            if (q) params.set('search', q);
            const data = await cachedGet(`/leads/matter?${params.toString()}`, {
                staleTime: 60_000,
                cacheTime: 180_000,
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

    useEffect(() => { fetchLeads(1, ''); }, [fetchLeads]);

    const handleSearchChange = (e) => {
        const q = e.target.value;
        setSearch(q);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setDebouncedSearch(q);
            hasDataRef.current = false;
            fetchLeads(1, q);
        }, 380);
    };

    const clearSearch = () => {
        setSearch('');
        setDebouncedSearch('');
        hasDataRef.current = false;
        fetchLeads(1, '');
    };

    const goToPage = (pg) => {
        if (pg < 1 || pg > totalPages || pg === page) return;
        listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        fetchLeads(pg, debouncedSearch);
    };

    const pageRange = (() => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (page <= 3) return [1, 2, 3, 4, 5];
        if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [page - 2, page - 1, page, page + 1, page + 2];
    })();

    return (
        <div className="space-y-4 pb-8">
            {/* ── Summary banner ── */}
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 p-4 shadow-md">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                            <Star className="h-5 w-5 text-white" fill="currentColor" />
                        </div>
                        <div>
                            <p className="text-[11px] text-emerald-100/80 font-medium uppercase tracking-widest">Matter Leads</p>
                            <p className="text-[13px] text-white/90 font-medium mt-0.5">Leads you've contacted at least once</p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        {loading ? (
                            <Skeleton className="h-8 w-16 rounded-lg bg-white/20" />
                        ) : (
                            <>
                                <p className="text-2xl font-extrabold text-white leading-none">{total.toLocaleString('en-IN')}</p>
                                <p className="text-[10px] text-emerald-200 font-semibold mt-0.5 uppercase tracking-wide">total</p>
                            </>
                        )}
                    </div>
                </div>
                <svg className="absolute bottom-0 left-0 w-full pointer-events-none" height="28" viewBox="0 0 400 28" preserveAspectRatio="none">
                    <path d="M0,18 C80,4 180,24 280,10 C360,0 400,14 400,14 L400,28 L0,28 Z" fill="#fff" opacity="0.06" />
                </svg>
            </div>

            {/* ── Search ── */}
            <div ref={listTopRef} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                    value={search}
                    onChange={handleSearchChange}
                    placeholder="Search by name or phone…"
                    className="pl-9 pr-9 h-10 rounded-xl border-slate-200 bg-white text-[13px] shadow-sm focus-visible:ring-emerald-400"
                />
                {search ? (
                    <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                ) : refreshing ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                ) : null}
            </div>

            {/* ── Result count ── */}
            {!loading && (
                <div className="flex items-center justify-between px-0.5">
                    <p className="text-[11px] text-slate-500 font-medium">
                        {search
                            ? `${total} result${total !== 1 ? 's' : ''} for "${search}"`
                            : `${total.toLocaleString('en-IN')} leads contacted`}
                    </p>
                    {totalPages > 1 && (
                        <p className="text-[11px] text-slate-400 font-medium">
                            Page {page} of {totalPages}
                        </p>
                    )}
                </div>
            )}

            {/* ── List ── */}
            {loading ? (
                <div className="space-y-2.5">
                    {Array.from({ length: 8 }).map((_, i) => <LeadSkeleton key={i} />)}
                </div>
            ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                        <PhoneCall className="h-8 w-8 text-emerald-300" />
                    </div>
                    <p className="text-[15px] font-bold text-slate-700">
                        {search ? 'No results found' : 'No matter leads yet'}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-1.5 max-w-[260px] leading-relaxed">
                        {search
                            ? 'Try a different name or phone number'
                            : 'Log a call against any lead and it will appear here automatically'}
                    </p>
                    {search && (
                        <button
                            onClick={clearSearch}
                            className="mt-4 text-[12px] font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" /> Clear search
                        </button>
                    )}
                </div>
            ) : (
                <div className={`space-y-2.5 transition-opacity duration-200 ${pageLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    {leads.map((lead) => {
                        const initials = (lead.name || '?').charAt(0).toUpperCase();
                        const statusCls = STATUS_PILL[lead.status] || 'bg-slate-100 text-slate-600 border-slate-200';
                        const catCls = lead.lead_category ? (CAT_PILL[lead.lead_category] || '') : '';
                        const lastCalledStr = relTime(lead.last_called_at);

                        return (
                            <div
                                key={lead.id}
                                className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm transition-all duration-150 hover:shadow-md hover:border-emerald-200 active:scale-[0.99]"
                            >
                                {/* Green left bar */}
                                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-linear-to-b from-emerald-400 to-teal-500" />

                                <div className="flex items-center gap-3 pl-4 pr-3 py-3.5">
                                    {/* Avatar */}
                                    <div className="h-12 w-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center overflow-hidden shrink-0">
                                        {lead.photo_url ? (
                                            <img
                                                src={lead.photo_url}
                                                alt={lead.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span className="text-[15px] font-bold text-emerald-700">{initials}</span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13.5px] font-bold text-slate-900 truncate leading-snug">
                                            {lead.name || 'Unnamed'}
                                        </p>
                                        {lead.phone && (
                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                                                {lead.phone}
                                            </p>
                                        )}

                                        {/* Badges */}
                                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                            {lead.status && (
                                                <span className={`inline-flex items-center text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${statusCls}`}>
                                                    {lead.status.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                            {catCls && lead.lead_category && (
                                                <span className={`inline-flex items-center text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${catCls}`}>
                                                    {lead.lead_category}
                                                </span>
                                            )}
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                                                <PhoneCall className="h-3 w-3" />
                                                {lead.call_count ?? 0} {lead.call_count === 1 ? 'call' : 'calls'}
                                            </span>
                                            {lastCalledStr && (
                                                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                                                    <Clock className="h-3 w-3" />
                                                    {lastCalledStr}
                                                </span>
                                            )}
                                            {lead.assigned_to_name && (
                                                <span className="text-[10px] text-slate-400 font-medium truncate hidden sm:inline">
                                                    {lead.assigned_to_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    {lead.phone && (
                                        <div className="flex flex-col gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); initiateCall(lead.phone, { leadId: lead.id, name: lead.name }); }}
                                                className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 active:scale-90 transition-all shadow-sm shadow-emerald-200"
                                                title={`Call ${lead.name}`}
                                            >
                                                <Phone className="h-4 w-4" />
                                            </button>
                                            <a
                                                href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="h-9 w-9 rounded-xl bg-[#25D366] text-white flex items-center justify-center hover:opacity-90 active:scale-90 transition-all shadow-sm shadow-green-200"
                                                title={`WhatsApp ${lead.name}`}
                                            >
                                                <WaIcon cls="h-4 w-4" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Pagination ── */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(page - 1)}
                        disabled={page === 1 || pageLoading}
                        className="h-9 w-9 p-0 rounded-xl border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {pageRange[0] > 1 && (
                        <>
                            <Button
                                variant="outline" size="sm"
                                onClick={() => goToPage(1)}
                                className="h-9 min-w-9 px-2.5 rounded-xl text-[12px] font-semibold border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                            >1</Button>
                            {pageRange[0] > 2 && <span className="text-slate-400 text-[12px] px-1">…</span>}
                        </>
                    )}

                    {pageRange.map((pg) => (
                        <Button
                            key={pg}
                            variant={pg === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => goToPage(pg)}
                            disabled={pageLoading}
                            className={`h-9 min-w-9 px-2.5 rounded-xl text-[12px] font-semibold transition-all ${
                                pg === page
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                                    : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700'
                            }`}
                        >{pg}</Button>
                    ))}

                    {pageRange[pageRange.length - 1] < totalPages && (
                        <>
                            {pageRange[pageRange.length - 1] < totalPages - 1 && <span className="text-slate-400 text-[12px] px-1">…</span>}
                            <Button
                                variant="outline" size="sm"
                                onClick={() => goToPage(totalPages)}
                                className="h-9 min-w-9 px-2.5 rounded-xl text-[12px] font-semibold border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                            >{totalPages}</Button>
                        </>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(page + 1)}
                        disabled={page === totalPages || pageLoading}
                        className="h-9 w-9 p-0 rounded-xl border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {pageLoading && (
                <div className="flex items-center justify-center gap-1.5 py-1">
                    {[0, 1, 2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                </div>
            )}

            {!loading && leads.length > 0 && (
                <p className="text-center text-[10px] text-slate-400 font-medium">
                    Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString('en-IN')} leads
                </p>
            )}
        </div>
    );
}
