import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cachedGet } from '@/lib/queryCache';
import api from '@/lib/axios';
import CallTimeline from '@/components/CallTimeline';
import { format } from 'date-fns';
import {
  BarChart3, Phone, TrendingUp,
  PhoneMissed, PhoneOutgoing,
  CheckCircle2, X, Eye, ChevronLeft, ChevronRight as ChevronRightIcon,
  Filter, RotateCcw, User,
} from 'lucide-react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── helpers ──────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtTime = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return '—'; }
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); } catch { return '—'; }
};

const callStatus = (call) => {
  if (call.duration_seconds > 0) return 'picked';
  const label = (call.outcome_label || '').toLowerCase();
  if (['no answer', 'missed', 'not picked', 'busy', 'rejected', 'failed'].some(k => label.includes(k))) return 'not_picked';
  if (!call.call_end && !call.duration_seconds) return 'not_picked';
  return 'picked';
};

const STATUS_META = {
  picked:     { label: 'Picked',     bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', icon: CheckCircle2, iconColor: 'text-emerald-500' },
  not_picked: { label: 'Not Picked', bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200',    icon: PhoneMissed,   iconColor: 'text-rose-400' },
};

const LEAD_STATUS_LABELS = {
  NEW: 'New Lead', CONTACTED: 'Contacted', INTERESTED: 'Interested',
  SITE_VISIT: 'Site Visit', NEGOTIATION: 'Negotiation', BOOKED: 'Booked', LOST: 'Lost',
  INCOMING_OFF: 'Incoming Off', SWITCH_OFF: 'Switch Off', NOT_ANSWERING: 'Not Answering',
};

// ─── Call Detail Drawer (with full CallTimeline) ───────────────────────────
const CallDetailDrawer = ({ call, open, onClose }) => {
  const [lead, setLead] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);

  useEffect(() => {
    if (!open || !call) return;

    // Seed with the single call immediately so timeline shows instantly
    setCallHistory(call?.id ? [{
      id: call.id,
      call_type: call.call_type || 'OUTGOING',
      call_start: call.call_start,
      call_end: call.call_end,
      duration_seconds: call.duration_seconds || 0,
      customer_notes: call.customer_notes || null,
      outcome_label: call.outcome_label || null,
      next_action: call.next_action || null,
    }] : []);

    setLead({
      id: call.lead_id || null,
      name: call.lead_name || 'Unknown',
      phone: call.lead_phone || '—',
      status: call.lead_status || null,
      lead_category: call.lead_category || null,
    });

    if (!call.lead_id) return;

    const leadId = call.lead_id;

    setLeadLoading(true);
    setCallsLoading(true);

    Promise.all([
      cachedGet(`/leads/${leadId}`, { staleTime: 60_000, cacheTime: 600_000 }).catch(() => null),
      cachedGet(`/calls/lead/${leadId}`, { staleTime: 30_000, cacheTime: 300_000 }).catch(() => null),
    ]).then(([leadData, callsData]) => {
      if (leadData?.success && leadData?.lead) setLead(leadData.lead);
      if (callsData?.success && Array.isArray(callsData.calls)) setCallHistory(callsData.calls);
    }).finally(() => {
      setLeadLoading(false);
      setCallsLoading(false);
    });
  }, [open, call]);

  const statusLabel = lead?.status ? (LEAD_STATUS_LABELS[lead.status] || lead.status) : null;

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="max-h-[92vh] bg-slate-50">
        <DrawerHeader className="shrink-0 px-3 sm:px-4 pt-2.5 pb-2 flex-row items-center gap-2 space-y-0 border-b border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 min-w-0 text-left">
            <DrawerTitle className="text-[13px] font-medium text-slate-900 truncate m-0">Call Details</DrawerTitle>
            <DrawerDescription className="text-[10.5px] text-slate-500 truncate m-0">
              {leadLoading ? 'Loading…' : (lead?.name || 'Contact')}
            </DrawerDescription>
          </div>
        </DrawerHeader>

        {lead && (
          <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 px-3 sm:px-4 pb-4 space-y-2.5 max-w-2xl mx-auto w-full">

            {/* Identity */}
            <div className="rounded-md border border-slate-200 bg-white p-3 flex items-center gap-3 mt-3">
              <div className="h-12 w-12 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 text-base font-medium ring-1 ring-indigo-100">
                {(lead.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-slate-900 truncate leading-tight">{lead.name || '—'}</p>
                <p className="text-[11.5px] font-mono text-slate-500 truncate leading-tight mt-0.5">{lead.phone || '—'}</p>
                {(statusLabel || lead.lead_category) && (
                  <p className="text-[10.5px] text-slate-500 truncate leading-tight mt-1">
                    {[statusLabel, lead.lead_category].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {/* Info grid */}
            <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                {[
                  { label: 'Date',     value: fmtDate(call?.call_start) },
                  { label: 'Time',     value: fmtTime(call?.call_start) },
                  { label: 'Type',     value: call?.call_type || '—' },
                  { label: 'Outcome',  value: call?.outcome_label || '—' },
                  { label: 'Calls',    value: String(callHistory.length || 1) },
                  { label: 'Added',    value: lead.created_at ? (() => { try { return format(new Date(lead.created_at), 'MMM dd, yyyy'); } catch { return '—'; } })() : '—' },
                ].map((row, i) => (
                  <div key={row.label} className={`px-3 py-2 ${i >= 2 ? 'border-t border-slate-100' : ''}`}>
                    <p className="text-[10px] text-slate-500">{row.label}</p>
                    <p className={`text-[12px] truncate mt-0.5 ${row.value && row.value !== '—' ? 'text-slate-800' : 'text-slate-300'}`}>
                      {row.value || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes for this call */}
            {call?.customer_notes && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] text-amber-600 font-semibold mb-1">Notes</p>
                <p className="text-[12px] text-slate-700 leading-relaxed">{call.customer_notes}</p>
              </div>
            )}

            {/* Call Timeline */}
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <CallTimeline calls={callHistory} loading={callsLoading} />
            </div>
          </div>
        )}

        <DrawerFooter className="shrink-0 border-t border-slate-200 px-3 sm:px-4 py-2 bg-white">
          <Button
            type="button"
            onClick={onClose}
            className="w-full h-9 text-[12.5px] font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 shadow-none"
          >
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────
const CallAnalytics = () => {
  const today = todayStr();

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [calls, setCalls] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [callsLoading, setCallsLoading] = useState(true);

  const [filters, setFilters] = useState({ date_from: today, date_to: today, status: 'all' });
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      const data = await cachedGet(`/calls/analytics?${params}`, { staleTime: 60_000, cacheTime: 180_000 });
      if (data?.success) setAnalytics(data);
    } catch {} finally { setAnalyticsLoading(false); }
  }, [filters.date_from, filters.date_to]);

  const fetchCalls = useCallback(async () => {
    setCallsLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      const res = await api.get(`/calls?${params}`);
      if (res.data?.success) {
        setCalls(res.data.calls ?? []);
        setPagination(res.data.pagination ?? { total: 0, page: 1, totalPages: 1 });
      }
    } catch {} finally { setCallsLoading(false); }
  }, [filters.date_from, filters.date_to, page]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const metrics = analytics?.metrics ?? {};
  const totalMade = Number(metrics.total_calls ?? 0);
  const totalPicked = Number(metrics.successful_calls ?? 0);
  const totalMissed = Math.max(0, totalMade - totalPicked);

  const dailyTrend = useMemo(() => (analytics?.dailyTrend ?? []).slice(-30).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    calls: parseInt(d.count) || 0,
  })), [analytics]);

  const visibleCalls = useMemo(() => {
    if (filters.status === 'all') return calls;
    return calls.filter((c) => callStatus(c) === filters.status);
  }, [calls, filters.status]);

  const handleFilterChange = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({ date_from: today, date_to: today, status: 'all' });
    setPage(1);
  };

  const openDetail = (call) => {
    setSelectedCall(call);
    setDrawerOpen(true);
  };

  const kpis = [
    { label: 'Made',       value: totalMade,   icon: PhoneOutgoing, bg: 'bg-orange-50',  iconBg: 'bg-orange-100',  iconColor: 'text-orange-500',  ring: 'ring-orange-100',  val: 'text-slate-900'   },
    { label: 'Picked',     value: totalPicked, icon: CheckCircle2,  bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', ring: 'ring-emerald-100', val: 'text-emerald-700' },
    { label: 'Not Picked', value: totalMissed, icon: PhoneMissed,   bg: 'bg-rose-50',    iconBg: 'bg-rose-100',    iconColor: 'text-rose-500',    ring: 'ring-rose-100',    val: 'text-rose-600'    },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* ── Page Title ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" /> Call Analytics
          </h1>
          <p className="page-subtitle mt-0.5">Track your calls by date and outcome</p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-[11px] font-bold transition-colors ring-1 ${
            showFilters ? 'bg-indigo-600 text-white ring-indigo-500' : 'bg-white text-slate-600 ring-slate-200'
          }`}
        >
          <Filter className="h-3.5 w-3.5" /> Filters
        </button>
      </div>

      {/* ── Filters Panel ── */}
      {showFilters && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">From</label>
              <input
                type="date"
                value={filters.date_from}
                max={filters.date_to || today}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">To</label>
              <input
                type="date"
                value={filters.date_to}
                min={filters.date_from}
                max={today}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Today',      from: today, to: today },
              { label: 'Yesterday',  from: (() => { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })(), to: (() => { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })() },
              { label: 'This Week',  from: (() => { const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toISOString().slice(0,10); })(), to: today },
              { label: 'This Month', from: (() => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`; })(), to: today },
            ].map(({ label, from, to }) => (
              <button
                key={label}
                onClick={() => { handleFilterChange('date_from', from); setTimeout(() => handleFilterChange('date_to', to), 0); }}
                className="px-3 py-1 rounded-lg bg-slate-100 text-[10.5px] font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Status</label>
            <div className="flex items-center gap-2">
              {[
                { key: 'all',        label: 'All' },
                { key: 'picked',     label: 'Picked' },
                { key: 'not_picked', label: 'Not Picked' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange('status', key)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    filters.status === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Reset to today
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map(({ label, value, icon: Icon, bg, iconBg, iconColor, ring, val }) => (
          <div key={label} className={`rounded-2xl ${bg} ring-1 ${ring} p-3.5 flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
              <div className={`h-7 w-7 rounded-xl ${iconBg} flex items-center justify-center`}>
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
              </div>
            </div>
            {analyticsLoading
              ? <Skeleton className="h-7 w-12 rounded" />
              : <p className={`text-[24px] font-bold tabular-nums leading-none ${val}`}>{value.toLocaleString('en-IN')}</p>
            }
          </div>
        ))}
      </div>

      {/* ── Trend Chart ── */}
      {dailyTrend.length > 1 && (
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500 shrink-0" />
              Daily Call Trend
              <span className="text-[10px] font-normal text-muted-foreground">(last 30 days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-3 md:px-5">
            {analyticsLoading
              ? <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
              : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={dailyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.floor(Math.max(0, dailyTrend.length / 5))} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v) => [v, 'Calls']} />
                    <Area type="monotone" dataKey="calls" stroke="#6366f1" strokeWidth={2} fill="url(#cg2)" dot={false} activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>
      )}

      {/* ── Call List ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-indigo-400" />
            Call Log
            {!callsLoading && (
              <span className="text-[11px] font-semibold text-slate-400 ml-1">({pagination.total} total)</span>
            )}
          </h2>
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 w-7 rounded-lg bg-white ring-1 ring-slate-200 flex items-center justify-center disabled:opacity-40 active:bg-slate-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span>{page} / {pagination.totalPages}</span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 rounded-lg bg-white ring-1 ring-slate-200 flex items-center justify-center disabled:opacity-40 active:bg-slate-50"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {callsLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-2xl ring-1 ring-slate-100">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32 rounded" />
                  <Skeleton className="h-2.5 w-24 rounded" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            ))}
          </div>
        ) : visibleCalls.length === 0 ? (
          <div className="bg-white rounded-2xl ring-1 ring-slate-100 py-14 flex flex-col items-center gap-2 text-slate-400">
            <Phone className="h-8 w-8 opacity-30" />
            <p className="text-[13px] font-semibold">No calls found</p>
            <p className="text-[11px]">Try adjusting the date range or filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleCalls.map((call) => {
              const status = callStatus(call);
              const meta = STATUS_META[status];
              const StatusIcon = meta.icon;
              return (
                <div
                  key={call.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-2xl ring-1 ring-slate-100 hover:ring-indigo-100 transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-slate-800 truncate">{call.lead_name || 'Unknown'}</p>
                    <p className="text-[10.5px] text-slate-400 font-medium truncate">{call.lead_phone || '—'}</p>
                    <p className="text-[9.5px] text-slate-300 mt-0.5">{fmtDate(call.call_start)} · {fmtTime(call.call_start)}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9.5px] font-bold ${meta.bg} ${meta.text} ring-1 ${meta.ring}`}>
                    <StatusIcon className={`h-3 w-3 ${meta.iconColor}`} />
                    {meta.label}
                  </span>
                  <button
                    onClick={() => openDetail(call)}
                    className="h-7 w-7 rounded-lg bg-slate-50 ring-1 ring-slate-200 flex items-center justify-center shrink-0 active:bg-indigo-50 active:ring-indigo-200 transition-colors"
                    aria-label="View call details"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Call Detail Drawer ── */}
      <CallDetailDrawer
        call={selectedCall}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default CallAnalytics;
