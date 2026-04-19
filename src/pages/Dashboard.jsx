import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOffline } from '@/context/OfflineContext';
import { useNavigate } from 'react-router-dom';
import LeadSearchWidget from '@/components/LeadSearchWidget';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import api from '@/lib/axios';
import { format, isToday, parseISO } from 'date-fns';
import {
  Target, PhoneCall, Plus, ArrowRight,
  CheckCircle2, Clock,
  Check, AlarmClock, Phone,
  MessageSquare, UsersRound, Sparkles, Star,
  Search, ChevronRight, Calendar, TrendingUp,
  Clock1, RefreshCw,
} from 'lucide-react';

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));
const LEAD_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];

const FlowCurve = ({ color = '#0ea5e9', opacity = 0.1 }) => (
  <svg className="absolute bottom-0 left-0 w-full pointer-events-none" height="34" viewBox="0 0 400 34" preserveAspectRatio="none">
    <path d="M0,22 C50,10 110,34 180,18 C250,2 320,30 400,14 L400,38 L0,38 Z" fill={color} opacity={opacity} />
    <path d="M0,28 C70,14 140,36 220,22 C300,8 360,30 400,20 L400,38 L0,38 Z" fill={color} opacity={opacity * 0.6} />
  </svg>
);

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

/* ── Mini trend sparkline for stat cards ── */
const SPARK_PATTERNS = {
  line:    [3, 5, 4, 6, 5, 8, 7, 9],
  bars:    [3, 6, 4, 7, 5, 8, 6, 9],
  down:    [9, 7, 8, 5, 6, 3, 4, 2],
  rise:    [2, 4, 3, 5, 6, 7, 8, 9],
};
const MiniSpark = ({ color = '#6366f1', pattern = 'line', variant = 'line', uid = 'x' }) => {
  const data = SPARK_PATTERNS[pattern] || SPARK_PATTERNS.line;
  const w = 56, h = 28, max = 10, step = w / (data.length - 1);
  if (variant === 'bars') {
    const bw = (w - (data.length * 2)) / data.length;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-7 shrink-0 opacity-85" preserveAspectRatio="none">
        {data.map((v, i) => {
          const bh = (v / max) * h;
          return <rect key={i} x={i * (bw + 2)} y={h - bh} width={bw} height={bh} rx="1" fill={color} opacity={0.55 + (v / max) * 0.45} />;
        })}
      </svg>
    );
  }
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-7 shrink-0" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sf-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={area} fill={`url(#sf-${uid})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const { flushNow, isSyncing: queueSyncing } = useOffline();
  const navigate = useNavigate();
  const isTeamHead = String(user?.role || '').toUpperCase() === 'TEAM_HEAD';
  const roleLabel = isTeamHead ? 'Team Head' : 'Agent';

  const [leadTotal, setLeadTotal] = useState(null);
  const [pipeline, setPipeline] = useState(Object.fromEntries(LEAD_STATUSES.map(s => [s, 0])));
  const [matterLeadsTotal, setMatterLeadsTotal] = useState(null);
  const [freshLeadsTotal, setFreshLeadsTotal] = useState(null);
  const [freshLeads, setFreshLeads] = useState([]);
  const [freshLoading, setFreshLoading] = useState(false);
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [followupCounts, setFollowupCounts] = useState({ scheduled: 0, today: 0, missed: 0 });
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [allFollowups, setAllFollowups] = useState([]);
  const [fupActionLoading, setFupActionLoading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [browseCat, setBrowseCat] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const CATS = [
   
    { key: 'PRIME',  label: 'Prime',  bg: 'from-amber-400 to-orange-500',      active: 'text-white',    inactive: 'bg-amber-50 text-amber-700 ring-amber-200' },
    { key: 'HOT',    label: 'Hot',    bg: 'from-rose-500 to-red-500',          active: 'text-white',    inactive: 'bg-rose-50 text-rose-700 ring-rose-200' },
    { key: 'NORMAL', label: 'Normal', bg: 'from-sky-400 to-blue-500',          active: 'text-white',    inactive: 'bg-sky-50 text-sky-700 ring-sky-200' },
    { key: 'COLD',   label: 'Cold',   bg: 'from-cyan-400 to-teal-500',         active: 'text-white',    inactive: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
    { key: 'DEAD',   label: 'Dead',   bg: 'from-slate-400 to-slate-500',       active: 'text-white',    inactive: 'bg-slate-100 text-slate-500 ring-slate-200' },
  ];

  const loadFollowupsSections = async ({ force = false } = {}) => {
    try {
      const res = await cachedGet('/followups?limit=200', { staleTime: 30_000, cacheTime: 120_000, force });
      if (res?.success) {
        const allFups = res.followups || res.data || [];
        setAllFollowups(allFups);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const todayItems = allFups.filter((f) => {
          if (!f.scheduled_at || (f.status !== 'PENDING' && f.status !== 'SNOOZED')) return false;
          try { return parseISO(f.scheduled_at) <= endOfToday; } catch { return false; }
        });
        todayItems.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
        setTodayFollowups(todayItems);
      }
    } catch {}
  };

  const loadDashboardStats = async ({ force = false, showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const [calls, counts, pipelineRes] = await Promise.allSettled([
        cachedGet('/calls/analytics', { staleTime: 60_000, cacheTime: 180_000, force }),
        cachedGet('/followups/counts', { staleTime: 30_000, cacheTime: 120_000, force }),
        cachedGet('/leads/counts', { staleTime: 60_000, cacheTime: 180_000, force }),
      ]);
      if (calls.status === 'fulfilled' && calls.value?.success) setCallAnalytics(calls.value);
      if (counts.status === 'fulfilled' && counts.value?.success) {
        const countsData = counts.value.counts || counts.value.data || {};
        setFollowupCounts({
          scheduled: countsData.scheduled ?? 0,
          today: countsData.today ?? 0,
          missed: countsData.missed ?? 0,
        });
      }
      if (pipelineRes.status === 'fulfilled' && pipelineRes.value?.success) {
        setPipeline(prev => ({ ...prev, ...pipelineRes.value.counts }));
        if (pipelineRes.value.total != null) setLeadTotal(pipelineRes.value.total);
        if (pipelineRes.value.matterCount != null) setMatterLeadsTotal(pipelineRes.value.matterCount);
      }
    } catch {}
    setLoading(false);
  };

  const loadFreshLeads = async ({ force = false, showLoading = false } = {}) => {
    if (showLoading) setFreshLoading(true);
    try {
      const data = await cachedGet('/leads?status=NEW&page=1&limit=20', { staleTime: 60_000, cacheTime: 180_000, force });
      if (data?.success) {
        setFreshLeads(data.leads ?? []);
        setFreshLeadsTotal(data.pagination?.total ?? data.leads?.length ?? 0);
      }
    } catch {} finally {
      if (showLoading || freshLoading) setFreshLoading(false);
    }
  };

  const refreshDashboard = async () => {
    if (refreshing || queueSyncing) return;
    setRefreshing(true);
    try {
      // Push queued offline writes first so refreshed stats reflect latest server state.
      await flushNow();
      invalidateCache('/calls/analytics');
      invalidateCache('/followups/counts');
      invalidateCache('/leads/counts');
      invalidateCache('/followups?limit=200');
      invalidateCache('/leads?status=NEW&page=1&limit=20');
      await Promise.allSettled([
        loadDashboardStats({ force: true }),
        loadFollowupsSections({ force: true }),
        loadFreshLeads({ force: true }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardStats({ showLoading: true });
    loadFollowupsSections();
    loadFreshLeads({ showLoading: true });
  }, []);

  const completeFollowup = async (id) => {
    setFupActionLoading(id + '_complete');
    try {
      await api.put(`/followups/${id}`, { status: 'COMPLETED' });
      invalidateCache('/followups?limit=100');
      invalidateCache('/followups/counts');
      setTodayFollowups((prev) => prev.filter((f) => f.id !== id));
      setFollowupCounts((prev) => ({
        ...prev,
        today: Math.max(0, (prev.today || 0) - 1),
        scheduled: Math.max(0, (prev.scheduled || 0) - 1),
      }));
    } catch {}
    setFupActionLoading(null);
  };

  const snoozeFollowup = async (id) => {
    setFupActionLoading(id + '_snooze');
    try {
      const snooze_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await api.put(`/followups/${id}/snooze`, { status: 'SNOOZED', snooze_until });
      invalidateCache('/followups?limit=100');
      setTodayFollowups((prev) => prev.filter((f) => f.id !== id));
      setFollowupCounts((prev) => ({ ...prev, today: Math.max(0, (prev.today || 0) - 1) }));
    } catch {}
    setFupActionLoading(null);
  };

  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const callMetrics = callAnalytics?.metrics ?? {};
  const todayCalls = callMetrics?.today_calls ?? 0;
  const weekCalls = callMetrics?.week_calls ?? 0;
  const maxPipeline = Math.max(...Object.values(pipeline), 1);

  /* ── Hero derived values ── */
  const firstName = user?.name?.split(' ')[0] || roleLabel;
  const currentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayProgress = Math.min(100, Math.max(0, Math.round(((hour + minutes / 60 - 8) / 10) * 100)));
  const descriptiveLine = (() => {
    const parts = [];
    if (todayFollowups.length > 0) parts.push(`${todayFollowups.length} follow-up${todayFollowups.length > 1 ? 's' : ''} ahead`);
    if (todayCalls > 0) parts.push(`${todayCalls} call${todayCalls > 1 ? 's' : ''} today`);
    if ((freshLeadsTotal ?? 0) > 0) parts.push(`${freshLeadsTotal} fresh lead${freshLeadsTotal > 1 ? 's' : ''}`);
    if (parts.length === 0) return 'All caught up — enjoy your day.';
    return parts.slice(0, 2).join(' · ') + '.';
  })();

  /* ── Stat card configs ── */
  const statCards = [
    {
      label: 'Total Leads', short: 'PIPELINE',
      value: leadTotal, hint: 'In your pipeline',
      icon: Target, nav: '/leads',
      gradient: 'from-blue-50 via-indigo-50 to-violet-50',
      iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
      ring: 'ring-blue-100',
      ribbon: 'from-blue-500 via-indigo-500 to-violet-500',
      flow: '#4f46e5', spark: 'rise', variant: 'line',
    },
    {
      label: 'Today Calls', short: 'CALLS',
      value: todayCalls, hint: `${fmtNum(weekCalls)} this week`,
      icon: PhoneCall, nav: '/calls/analytics',
      gradient: 'from-orange-50 via-amber-50 to-yellow-50',
      iconBg: 'bg-orange-100', iconColor: 'text-orange-600',
      ring: 'ring-orange-100',
      ribbon: 'from-orange-500 via-amber-500 to-yellow-500',
      flow: '#f59e0b', spark: 'bars', variant: 'bars',
    },
    {
      label: 'Reminders', short: 'QUEUE',
      value: followupCounts?.scheduled ?? 0,
      hint: `${fmtNum(followupCounts?.today ?? 0)} due today`,
      icon: Clock, nav: '/reminders',
      gradient: 'from-emerald-50 via-teal-50 to-cyan-50',
      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
      ring: 'ring-emerald-100',
      ribbon: 'from-emerald-500 via-teal-500 to-cyan-500',
      flow: '#10b981', spark: 'down', variant: 'line',
    },
    {
      label: 'Fresh Leads', short: 'FRESH · 24H',
      value: freshLeadsTotal, hint: 'New enquiries',
      icon: Sparkles, nav: '/leads?status=NEW',
      gradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
      iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
      ring: 'ring-violet-100',
      ribbon: 'from-violet-500 via-purple-500 to-fuchsia-500',
      flow: '#8b5cf6', spark: 'line', variant: 'line',
    },
    {
      label: 'Matter Leads', short: 'MATTER',
      value: matterLeadsTotal, hint: 'Leads you\'ve called',
      icon: Star, nav: '/matter-leads',
      gradient: 'from-rose-50 via-pink-50 to-fuchsia-50',
      iconBg: 'bg-rose-100', iconColor: 'text-rose-600',
      ring: 'ring-rose-100',
      ribbon: 'from-rose-500 via-pink-500 to-fuchsia-500',
      flow: '#e11d48', spark: 'rise', variant: 'line',
    },
  ];

  /* ── Quick nav ── */
  const quickNav = [
    { icon: Plus,          label: 'Add Lead',  nav: '/leads/add',       gradient: 'from-indigo-500 to-violet-500', text: 'text-white' },
     { icon: Clock1, label: 'Reminder',      nav: '/reminders',            gradient: 'from-sky-50 to-blue-50',        text: 'text-sky-700' },
    { icon: MessageSquare, label: 'Chat',      nav: '/chat',            gradient: 'from-sky-50 to-blue-50',        text: 'text-sky-700' },
    { icon: Calendar,      label: 'Scheduled', nav: '/calls/scheduled', gradient: 'from-amber-50 to-orange-50',    text: 'text-amber-700' },
    { icon: RefreshCw,     label: (refreshing || queueSyncing) ? 'Syncing' : 'Refresh', action: refreshDashboard, gradient: 'from-emerald-50 to-teal-50', text: 'text-emerald-700', spin: (refreshing || queueSyncing) },
    { icon: UsersRound,    label: 'Team',      nav: '/team',            gradient: 'from-violet-50 to-purple-50',   text: 'text-violet-700' },
   
  ];

  /* ── Pipeline config ── */
  const pipelineItems = [
    { key: 'NEW',         label: 'New',         barGrad: 'from-sky-400 to-blue-500',     dotColor: 'bg-sky-400' },
    { key: 'INTERESTED',  label: 'Interested',  barGrad: 'from-amber-400 to-orange-500', dotColor: 'bg-amber-400' },
    { key: 'SITE_VISIT',  label: 'Site Visit',  barGrad: 'from-violet-400 to-purple-500',dotColor: 'bg-violet-400' },
    { key: 'NEGOTIATION', label: 'Negotiation', barGrad: 'from-indigo-400 to-blue-500',  dotColor: 'bg-indigo-400' },
   
    { key: 'LOST',        label: 'Lost',        barGrad: 'from-rose-300 to-rose-400',    dotColor: 'bg-rose-400' },
  ];

  return (
    <div className="space-y-5 pb-6">

      {/* ══════ HEADER — editorial, light ══════ */}
      <header className="space-y-5">
        {/* Editorial greeting */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
            {greeting}
          </p>
          <h1 className="mt-1 leading-[1.05] tracking-tight flex flex-wrap items-baseline gap-x-2">
            <span className="text-[32px] font-bold text-slate-900">Hello,</span>
            <span className="text-[32px] font-normal italic text-indigo-600" style={serif}>
              {firstName}.
            </span>
          </h1>
          <p className="mt-2 text-[13px] text-slate-500 italic leading-snug max-w-70" style={serif}>
            {descriptiveLine}
          </p>
        </div>

        {/* Workday progress */}
        <div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-700"
              style={{ width: `${dayProgress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            <span className="font-bold text-slate-900 tabular-nums">{dayProgress}%</span>
            <span className="font-bold tracking-[0.2em] text-slate-400 uppercase">· Workday</span>
            <span className="ml-auto inline-flex items-center gap-1.5 font-semibold text-slate-500 tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {currentTime}
            </span>
          </div>
        </div>
      </header>

      {/* ══════ CATEGORY PILLS + BROWSE ══════ */}
      <div className="space-y-2.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {CATS.map((cat) => {
            const isActive = browseCat === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setBrowseCat(cat.key)}
                className={`shrink-0 h-9 pl-2.5 pr-3.5 rounded-full text-[11px] font-bold leading-none whitespace-nowrap flex items-center gap-1.5 ring-1 ring-inset active:scale-95 transition-all duration-150 ${
                  isActive
                    ? `bg-linear-to-r ${cat.bg} text-white shadow-sm shadow-slate-300/40 ring-transparent`
                    : `bg-white ${cat.inactive}`
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-white/90' : 'bg-current opacity-70'}`} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Browse button — always visible, updates with selected category */}
        <button
          onClick={() => navigate(browseCat === 'ALL' ? '/leads' : `/leads?lead_category=${browseCat}`)}
          className="w-full h-10 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-[12px] font-bold ring-1 ring-indigo-100"
        >
          Browse {browseCat === 'ALL' ? 'all' : browseCat.toLowerCase()} leads
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ══════ SEARCH ══════ */}
      <LeadSearchWidget category={browseCat === 'ALL' ? undefined : browseCat} />

      {/* ══════ QUICK ACTIONS — 3 big cards ══════ */}
      <div className="grid grid-cols-3 gap-2.5">
        {quickNav.slice(0, 3).map((item, i) => {
          const primary = i === 0;
          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.action) item.action();
                else if (item.nav) navigate(item.nav);
              }}
              className={`relative h-16 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-[0.96] transition-all duration-150 overflow-hidden ${
                primary
                  ? 'bg-linear-to-br from-indigo-600 to-violet-700 text-white shadow-md shadow-indigo-300/40 ring-1 ring-indigo-700/20'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)]'
              }`}
            >
              {primary && (
                <>
                  <div className="pointer-events-none absolute -top-6 -right-4 h-14 w-14 rounded-full bg-white/15 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-8 -left-6 h-12 w-12 rounded-full bg-fuchsia-400/20 blur-2xl" />
                </>
              )}
              <item.icon className={`h-4 w-4 ${item.spin ? 'animate-spin' : ''}`} strokeWidth={primary ? 2.2 : 2} />
              <span className="text-[10.5px] font-bold leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Secondary actions — 3-col grid, stays inside viewport */}
      {quickNav.length > 3 && (
        <div className="grid grid-cols-3 gap-2">
          {quickNav.slice(3).map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.action) item.action();
                else if (item.nav) navigate(item.nav);
              }}
              className="h-11 px-2 rounded-xl bg-white ring-1 ring-slate-200 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-700 active:scale-95 transition-all shadow-[0_2px_6px_-2px_rgba(15,23,42,0.05)] min-w-0"
            >
              <span className={`h-7 w-7 shrink-0 rounded-full bg-linear-to-br ${item.gradient} flex items-center justify-center`}>
                <item.icon className={`h-3.5 w-3.5 ${item.text} ${item.spin ? 'animate-spin' : ''}`} strokeWidth={2.2} />
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ══════ TODAY AT A GLANCE ══════ */}
      <div className="flex items-end justify-between pt-2">
        <h2 className="text-[18px] font-bold text-slate-900 tracking-tight" style={serif}>
          Today
          <span className="italic text-slate-500 ml-1.5 font-normal">at a glance</span>
        </h2>
        <span className="text-[10px] font-bold tracking-[0.22em] text-slate-400 uppercase tabular-nums pb-1">
          {currentTime}
        </span>
      </div>

      {/* ══════ STAT CARDS — editorial ══════ */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.slice(0, 4).map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.nav)}
              className="group relative overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-100 p-3.5 pt-4 text-left shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] active:scale-[0.97] transition-all duration-150 hover:ring-slate-200 hover:shadow-[0_10px_26px_-12px_rgba(15,23,42,0.14)]"
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${card.ribbon}`} />

              {/* Category label */}
              <div className="flex items-center justify-between">
                <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${card.iconColor}`}>
                  {card.short}
                </p>
                <div className={`h-6 w-6 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-3.5 w-3.5 ${card.iconColor}`} strokeWidth={2.2} />
                </div>
              </div>

              {/* Value + sparkline */}
              <div className="mt-3 flex items-end justify-between gap-2">
                <p className="text-[34px] font-bold text-slate-900 leading-none tabular-nums tracking-tight" style={serif}>
                  {fmtNum(card.value)}
                </p>
                <MiniSpark color={card.flow} pattern={card.spark} variant={card.variant} uid={`s${idx}`} />
              </div>

              {/* Label + hint */}
              <p className="text-[12px] font-semibold text-slate-800 mt-3">{card.label}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{card.hint}</p>
            </button>
          );
        })}
      </div>

      {/* ══════ MATTER LEADS — wide editorial card ══════ */}
      {statCards[4] && (() => {
        const card = statCards[4];
        const Icon = card.icon;
        return (
          <button
            onClick={() => navigate(card.nav)}
            className="relative w-full overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-100 p-4 pt-5 text-left shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] active:scale-[0.98] transition-all duration-150 flex items-center gap-3.5 hover:ring-slate-200 hover:shadow-[0_10px_26px_-12px_rgba(15,23,42,0.14)]"
          >
            <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${card.ribbon}`} />
            <div className={`h-12 w-12 rounded-2xl ${card.iconBg} flex items-center justify-center shrink-0 ring-1 ring-slate-100`}>
              <Icon className={`h-5.5 w-5.5 ${card.iconColor}`} strokeWidth={2} fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${card.iconColor}`}>{card.short}</p>
              <p className="text-[28px] font-bold text-slate-900 leading-none tabular-nums tracking-tight mt-1" style={serif}>{fmtNum(card.value)}</p>
              <p className="text-[11px] font-semibold text-slate-700 mt-1">{card.label} · <span className="font-medium text-slate-400">{card.hint}</span></p>
            </div>
            <MiniSpark color={card.flow} pattern="rise" variant="line" uid="s4" />
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        );
      })()}

      {/* ══════ TODAY'S AGENDA ══════ */}
      <section className="rounded-[24px] bg-white border border-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-amber-50 flex items-center justify-center ring-1 ring-amber-100">
              <Clock className="h-4.5 w-4.5 text-amber-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-slate-900 leading-tight tracking-tight" style={serif}>
                Today's <span className="italic font-normal text-slate-500">agenda</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{todayFollowups.length} follow-ups pending</p>
            </div>
          </div>
          {todayFollowups.length > 0 && (
            <button onClick={() => navigate('/reminders')} className="text-[11px] font-semibold text-indigo-600 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full bg-indigo-50 active:bg-indigo-100 transition-colors shrink-0">
              See all <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="px-3 pb-3">
          {todayFollowups.length === 0 ? (
            <div className="rounded-2xl bg-linear-to-br from-emerald-50/80 to-teal-50/60 py-9 flex flex-col items-center ring-1 ring-emerald-100/60">
              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center mb-2 shadow-sm ring-1 ring-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" strokeWidth={2} />
              </div>
              <p className="text-sm font-bold text-slate-800">All clear!</p>
              <p className="text-[11px] text-slate-500 mt-0.5">No follow-ups due today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayFollowups.slice(0, 8).map((f) => {
                const scheduledDate = f.scheduled_at ? new Date(f.scheduled_at) : null;
                const isOverdue = scheduledDate ? scheduledDate < new Date() : false;
                const timeStr = scheduledDate
                  ? (isToday(scheduledDate) ? format(scheduledDate, 'hh:mm a') : format(scheduledDate, 'dd MMM, hh:mm a'))
                  : '';
                const isActioning = fupActionLoading === `${f.id}_complete` || fupActionLoading === `${f.id}_snooze`;

                return (
                  <div
                    key={f.id}
                    className={`flex items-center gap-3 rounded-2xl p-2.5 transition-all duration-200 ${
                      isOverdue
                        ? 'bg-rose-50/70 ring-1 ring-rose-200/60'
                        : 'bg-slate-50/70 ring-1 ring-slate-100'
                    }`}
                  >
                    {/* Date pill */}
                    <div className={`shrink-0 h-11 w-11 rounded-xl flex flex-col items-center justify-center ${
                      isOverdue ? 'bg-white ring-1 ring-rose-200' : 'bg-white ring-1 ring-slate-100'
                    }`}>
                      <span className={`text-[15px] font-extrabold leading-none ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                        {scheduledDate ? format(scheduledDate, 'dd') : '--'}
                      </span>
                      <span className={`text-[8px] font-bold uppercase mt-0.5 tracking-wider ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`}>
                        {scheduledDate ? format(scheduledDate, 'MMM') : ''}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{f.lead_name || 'Unknown'}</p>
                        {isOverdue && <span className="text-[8px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full leading-none tracking-wider">LATE</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {timeStr && <span className="text-[10px] text-slate-500 font-medium">{timeStr}</span>}
                        {f.followup_type && (
                          <span className="text-[9px] font-medium text-slate-400">· {f.followup_type.replace('_', ' ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      {f.lead_phone && (
                        <a
                          href={`tel:${f.lead_phone}`}
                          className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-90 transition-transform ring-1 ring-emerald-100"
                        >
                          <Phone className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </a>
                      )}
                      <button
                        className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center active:scale-90 transition-transform ring-1 ring-indigo-100 disabled:opacity-40"
                        onClick={() => completeFollowup(f.id)}
                        disabled={isActioning}
                      >
                        {fupActionLoading === `${f.id}_complete`
                          ? <span className="h-3.5 w-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                          : <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
                      </button>
                      <button
                        className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center active:scale-90 transition-transform ring-1 ring-amber-100 disabled:opacity-40"
                        onClick={() => snoozeFollowup(f.id)}
                        disabled={isActioning}
                      >
                        {fupActionLoading === `${f.id}_snooze`
                          ? <span className="h-3.5 w-3.5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                          : <AlarmClock className="h-3.5 w-3.5" strokeWidth={2.2} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ══════ FRESH LEADS CAROUSEL ══════ */}
      <section className="rounded-[24px] bg-white border border-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-violet-50 flex items-center justify-center ring-1 ring-violet-100">
              <Sparkles className="h-4.5 w-4.5 text-violet-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[15px] font-bold text-slate-900 leading-tight tracking-tight" style={serif}>
                  Fresh <span className="italic font-normal text-slate-500">leads</span>
                </h2>
                {!freshLoading && freshLeads.length > 0 && (
                  <span className="h-4.5 min-w-4.5 inline-flex items-center justify-center rounded-full bg-violet-600 px-1.5 text-[9px] font-bold text-white">
                    {freshLeadsTotal ?? freshLeads.length}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">New enquiries awaiting contact</p>
            </div>
          </div>
          <button onClick={() => navigate('/leads?status=NEW')} className="text-[11px] font-semibold text-violet-600 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full bg-violet-50 active:bg-violet-100 transition-colors shrink-0">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {freshLeads.length === 0 ? (
          <div className="px-4 pb-4">
            <div className="rounded-2xl bg-violet-50/60 py-8 flex flex-col items-center ring-1 ring-violet-100/60">
              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center mb-2 shadow-sm ring-1 ring-violet-100">
                <CheckCircle2 className="h-6 w-6 text-violet-400" strokeWidth={2} />
              </div>
              <p className="text-sm font-bold text-slate-800">No fresh leads</p>
              <p className="text-[11px] text-slate-500 mt-0.5">All enquiries contacted.</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 px-4 pb-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {freshLeads.slice(0, 10).map((lead) => {
              const ago = (() => {
                if (!lead.created_at) return '';
                const diff = Date.now() - new Date(lead.created_at).getTime();
                const h = Math.floor(diff / 3600000);
                const d = Math.floor(diff / 86400000);
                return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : 'Just now';
              })();
              return (
                <div
                  key={lead.id}
                  onClick={() => navigate('/leads?status=NEW')}
                  className="shrink-0 w-42 rounded-2xl bg-white ring-1 ring-slate-100 p-3 flex flex-col gap-2 active:scale-[0.97] transition-all cursor-pointer shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] hover:ring-violet-200 hover:shadow-[0_6px_18px_-8px_rgba(139,92,246,0.25)]"
                >
                  <div className="h-10 w-10 rounded-2xl bg-linear-to-br from-violet-100 to-purple-200/70 flex items-center justify-center ring-1 ring-violet-200/50 overflow-hidden">
                    {lead.photo_url ? (
                      <img src={lead.photo_url} alt={lead.name} className="w-full h-full rounded-2xl object-cover" loading="lazy" />
                    ) : (
                      <span className="text-sm font-bold text-violet-700">{lead.name?.charAt(0)?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate leading-tight">{lead.name || 'Unnamed'}</p>
                    {lead.phone && <p className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">{lead.phone}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lead.lead_category && (
                      <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-50 ring-1 ring-violet-200/60 text-violet-700">{lead.lead_category}</span>
                    )}
                    {ago && <span className="text-[9px] text-slate-400 font-medium">{ago}</span>}
                  </div>
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-1 h-8 rounded-xl bg-linear-to-r from-violet-600 to-purple-600 text-white text-[10px] font-semibold active:scale-95 transition-transform shadow-sm shadow-violet-300/50 mt-auto"
                    >
                      <Phone className="h-3 w-3" strokeWidth={2.4} /> Call
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════ PIPELINE ══════ */}
      <section className="rounded-[24px] bg-white border border-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.05)] p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-slate-900 leading-tight tracking-tight" style={serif}>
                Your <span className="italic font-normal text-slate-500">pipeline</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{fmtNum(leadTotal)} total leads</p>
            </div>
          </div>
          <button onClick={() => navigate('/leads')} className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full bg-emerald-50 active:bg-emerald-100 transition-colors shrink-0">
            All leads <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <div className="space-y-3">
          {pipelineItems.map((item) => {
              const count = pipeline[item.key] || 0;
              const pct = maxPipeline > 0 ? (count / maxPipeline) * 100 : 0;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(`/leads?status=${item.key}`)}
                  className="w-full text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${item.dotColor}`} />
                      {item.label}
                    </span>
                    <span className="text-[12px] font-bold text-slate-900 tabular-nums">{fmtNum(count)}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-linear-to-r ${item.barGrad} transition-all duration-700`}
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </button>
              );
            })}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
