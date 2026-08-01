import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useOffline } from '@/context/OfflineContext';
import LeadSearchWidget from '@/components/LeadSearchWidget';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import { onMutation } from '@/lib/mutationBus';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock1,
  ContactRound,
  CreditCard,
  MessageSquare,
  PhoneCall,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  Zap,
} from 'lucide-react';

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));
const fmtCompact = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 10_000)  return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000)   return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
};

const CATS = [
  { key: 'ALL',    label: 'All',    active: 'bg-slate-900 text-white shadow-sm',  inactive: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white' },
  { key: 'PRIME',  label: 'Prime',  active: 'bg-amber-500 text-white shadow-sm',  inactive: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white' },
  { key: 'HOT',    label: 'Hot',    active: 'bg-rose-500 text-white shadow-sm',   inactive: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white' },
  { key: 'NORMAL', label: 'Normal', active: 'bg-sky-500 text-white shadow-sm',    inactive: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white' },
  { key: 'COLD',   label: 'Cold',   active: 'bg-teal-500 text-white shadow-sm',   inactive: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white' },
  { key: 'DEAD',   label: 'Dead',   active: 'bg-slate-500 text-white shadow-sm',  inactive: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white' },
];

const PERIODS = [
  { key: 'today',  label: 'Today' },
  { key: 'week',   label: 'Week'  },
  { key: 'month',  label: 'Month' },
  { key: 'custom', label: 'Date'  },
];

const getCallPeriodRange = (period, customDate = '') => {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === 'today')  { const t = fmt(today); return { date_from: t, date_to: t }; }
  if (period === 'week')   { const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7)); return { date_from: fmt(mon), date_to: fmt(today) }; }
  if (period === 'custom' && customDate) return { date_from: customDate, date_to: customDate };
  return { date_from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), date_to: fmt(today) };
};

const Dashboard = () => {
  const { user }                               = useAuth();
  const { flushNow, isSyncing: queueSyncing }  = useOffline();
  const navigate                               = useNavigate();
  const isTeamHead = String(user?.role || '').toUpperCase() === 'TEAM_HEAD';
  const roleLabel  = isTeamHead ? 'Team Head' : 'Agent';

  const [matterLeadsTotal,  setMatterLeadsTotal]  = useState(null);
  const [freshLeadsTotal,   setFreshLeadsTotal]   = useState(null);
  const [callAnalytics,     setCallAnalytics]     = useState(null);
  const [callPeriod,        setCallPeriod]        = useState('today');
  const [callPeriodData,    setCallPeriodData]    = useState(null);
  const [callPeriodLoading, setCallPeriodLoading] = useState(false);
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [contactsTotal, setContactsTotal] = useState(null);
  const [followupCount, setFollowupCount] = useState(0);
  const [browseCat,     setBrowseCat]     = useState('ALL');
  const [refreshing,    setRefreshing]    = useState(false);

  const loadFollowupCount = useCallback(async ({ force = false } = {}) => {
    try {
      const res = await cachedGet('/followups?limit=200', { staleTime: 30_000, cacheTime: 120_000, force });
      if (res?.success) {
        const allFups    = res.followups || res.data || [];
        const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
        const count = allFups.filter((f) => {
          if (!f.scheduled_at || (f.status !== 'PENDING' && f.status !== 'SNOOZED')) return false;
          try { return parseISO(f.scheduled_at) <= endOfToday; } catch { return false; }
        }).length;
        setFollowupCount(count);
      }
    } catch {}
  }, []);

  const loadDashboardStats = useCallback(async ({ force = false } = {}) => {
    try {
      const [calls, pipelineRes, contactsRes] = await Promise.allSettled([
        cachedGet('/calls/analytics',         { staleTime: 60_000, cacheTime: 180_000, force }),
        cachedGet('/leads/counts',            { staleTime: 60_000, cacheTime: 180_000, force }),
        cachedGet('/contacts?page=1&limit=1', { staleTime: 60_000, cacheTime: 180_000, force }),
      ]);
      if (calls.status === 'fulfilled' && calls.value?.success)
        setCallAnalytics(calls.value);
      if (pipelineRes.status === 'fulfilled' && pipelineRes.value?.success)
        if (pipelineRes.value.matterCount != null) setMatterLeadsTotal(pipelineRes.value.matterCount);
      if (contactsRes.status === 'fulfilled' && contactsRes.value?.success)
        setContactsTotal(contactsRes.value.pagination?.total ?? null);
    } catch {}
  }, []);

  const loadFreshCount = useCallback(async ({ force = false } = {}) => {
    try {
      const data = await cachedGet('/leads?status=NEW&page=1&limit=1', { staleTime: 60_000, cacheTime: 180_000, force });
      if (data?.success) setFreshLeadsTotal(data.pagination?.total ?? 0);
    } catch {}
  }, []);

  const loadCallPeriodData = useCallback(async (period, { force = false, date } = {}) => {
    const { date_from, date_to } = getCallPeriodRange(period, date ?? customDate);
    if (!date_from) return;
    setCallPeriodLoading(true);
    try {
      const data = await cachedGet(`/calls/analytics?date_from=${date_from}&date_to=${date_to}`, { staleTime: 60_000, cacheTime: 180_000, force });
      if (data?.success) setCallPeriodData(data);
    } catch {}
    setCallPeriodLoading(false);
  }, [customDate]);

  const refreshDashboard = async () => {
    if (refreshing || queueSyncing) return;
    setRefreshing(true);
    try {
      await flushNow();
      invalidateCache('/calls/analytics');
      invalidateCache('/leads/counts');
      invalidateCache('/followups?limit=200');
      invalidateCache('/leads?status=NEW&page=1&limit=1');
      invalidateCache('/contacts?page=1&limit=1');
      await Promise.allSettled([
        loadDashboardStats({ force: true }),
        loadFollowupCount({ force: true }),
        loadFreshCount({ force: true }),
        loadCallPeriodData(callPeriod, { force: true }),
      ]);
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    loadDashboardStats();
    loadFollowupCount();
    loadFreshCount();
  }, [loadDashboardStats, loadFollowupCount, loadFreshCount]);

  useEffect(() => { loadCallPeriodData(callPeriod, { date: customDate }); }, [callPeriod, customDate, loadCallPeriodData]);

  const loadersRef = useRef({ loadDashboardStats, loadFollowupCount, loadFreshCount });
  loadersRef.current = { loadDashboardStats, loadFollowupCount, loadFreshCount };

  useEffect(() => onMutation((entities) => {
    const { loadDashboardStats: lds, loadFollowupCount: lfc, loadFreshCount: lfl } = loadersRef.current;
    if (entities.some((e) => ['leads', 'followups', 'calls'].includes(e))) lds({ force: true });
    if (entities.includes('followups')) lfc({ force: true });
    if (entities.includes('leads'))     lfl({ force: true });
  }), []);

  /* ── Derived ── */
  const now         = new Date();
  const hour        = now.getHours();
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName   = user?.name?.split(' ')[0] || roleLabel;
  const currentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const todayCalls   = callAnalytics?.metrics?.today_calls ?? 0;
  const periodTotal  = callPeriodData?.metrics?.total_calls ?? 0;
  const periodPicked = callPeriodData?.metrics?.successful_calls ?? 0;
  const periodMissed = Math.max(0, periodTotal - periodPicked);
  const connectRate  = periodTotal > 0 ? Math.round((periodPicked / periodTotal) * 100) : 0;

  const shortcuts = [
    { icon: Clock1,        label: 'Reminder',  nav: '/reminders',                               cls: 'text-sky-600     bg-sky-50     ring-sky-100'      },
    { icon: MessageSquare, label: 'Chat',       nav: '/chat',                                    cls: 'text-rose-600    bg-rose-50    ring-rose-100'     },
    { icon: Calendar,      label: 'Scheduled',  nav: '/calls/scheduled',                         cls: 'text-amber-600   bg-amber-50   ring-amber-100'    },
    { icon: UsersRound,    label: 'Team',        nav: isTeamHead ? '/team/performance' : '/team', cls: 'text-violet-600  bg-violet-50  ring-violet-100'   },
    { icon: ShieldCheck,   label: 'Tasks',       nav: '/supervision-tasks',                       cls: 'text-fuchsia-600 bg-fuchsia-50 ring-fuchsia-100' },
    { icon: BookOpen,      label: 'Bookings',    nav: '/bookings',                                cls: 'text-blue-600    bg-blue-50    ring-blue-100'     },
    { icon: CreditCard,    label: 'Sales',       nav: '/sales',                                   cls: 'text-emerald-600 bg-emerald-50 ring-emerald-100' },
    { icon: CalendarCheck, label: 'Attendance',  nav: '/attendance/history',                      cls: 'text-teal-600    bg-teal-50    ring-teal-100'     },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3">

      {/* ── Header card ── */}
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1 bg-linear-to-r from-teal-500 via-sky-400 to-emerald-400" />
        <div className="px-3.5 pt-3.5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-500 shadow-sm shadow-teal-200" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {roleLabel} · {currentTime}
                </p>
              </div>
              <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-slate-950">
                {greeting}, <span className="text-teal-600">{firstName}</span>
              </h1>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
               
              </div>
            </div>
            <button
              onClick={refreshDashboard}
              disabled={refreshing || queueSyncing}
              className="h-9 w-9 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${(refreshing || queueSyncing) ? 'animate-spin' : ''}`} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Stats row — gap-px hairline separators */}
        <div className="grid grid-cols-3 gap-px border-t border-slate-100 bg-slate-100">
          {[
            { label: 'Matter Leads', value: matterLeadsTotal, icon: Zap,          nav: '/matter-leads',    iconCls: 'bg-teal-50 text-teal-600'    },
            { label: 'Today Calls',  value: todayCalls,        icon: PhoneCall,    nav: '/calls/analytics', iconCls: 'bg-orange-50 text-orange-500' },
            { label: 'Contacts',     value: contactsTotal,     icon: ContactRound, nav: '/all-contacts',    iconCls: 'bg-sky-50 text-sky-500'       },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.nav)}
                className="bg-white px-2 py-2.5 text-center hover:bg-slate-50/80 transition active:scale-[0.98]"
              >
                <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg ${item.iconCls}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                </div>
                <p className="mt-1 text-lg font-semibold leading-none text-slate-950 tabular-nums">{fmtCompact(item.value)}</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{item.label}</p>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Lead search & browse ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
        <div className="flex gap-2 mb-2.5">
          <div className="flex-1 min-w-0">
            <LeadSearchWidget category={browseCat === 'ALL' ? undefined : browseCat} />
          </div>
          <button
            onClick={() => navigate(browseCat === 'ALL' ? '/leads' : `/leads?lead_category=${browseCat}`)}
            className="h-10 shrink-0 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 ring-1 ring-slate-200 transition active:scale-95"
          >
            Browse <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {CATS.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setBrowseCat(cat.key)}
              className={`h-7 shrink-0 rounded-full px-3 text-[11px] font-semibold transition active:scale-95 ${browseCat === cat.key ? cat.active : cat.inactive}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Quick access shortcuts ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 px-1 pb-2">Quick Access</p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => navigate(s.nav)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 py-3 px-2 transition active:scale-95 ring-1 ring-inset ring-slate-200/80"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${s.cls}`}>
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="text-[10px] font-semibold text-slate-600 truncate max-w-full leading-none">{s.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Call analytics ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1 bg-linear-to-r from-orange-400 via-amber-400 to-yellow-300" />
        <div className="p-3.5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-orange-50 ring-1 ring-orange-100 flex items-center justify-center shrink-0">
                <PhoneCall className="h-4 w-4 text-orange-500" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-slate-950 leading-tight tracking-tight">Call Analytics</p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                  {callPeriodLoading ? 'Loading…' : `${fmtNum(periodTotal)} made · ${fmtNum(periodPicked)} picked`}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/calls/analytics')}
              className="h-8 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-semibold flex items-center gap-1 transition active:scale-95 shadow-sm"
            >
              Full view <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Period tabs */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCallPeriod(key)}
                className={`h-9 rounded-xl text-[11px] font-semibold transition active:scale-95 ${
                  callPeriod === key
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {callPeriod === 'custom' && (
            <input
              type="date"
              value={customDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mb-3 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
            />
          )}

          {/* 3 metric tiles */}
          <div className="grid grid-cols-3 gap-2">
            {callPeriodLoading ? (
              [0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />)
            ) : (
              [
                { label: 'Made',   sub: 'Total dialed',  value: periodTotal,  Icon: PhoneOutgoing, bg: 'bg-orange-50',  ring: 'ring-orange-100',  numCls: 'text-orange-700',  iconBg: 'bg-orange-100',  ico: 'text-orange-500'  },
                { label: 'Picked', sub: 'Connected',      value: periodPicked, Icon: CheckCircle2,  bg: 'bg-emerald-50', ring: 'ring-emerald-100', numCls: 'text-emerald-700', iconBg: 'bg-emerald-100', ico: 'text-emerald-500' },
                { label: 'Missed', sub: 'No answer',      value: periodMissed, Icon: PhoneMissed,   bg: 'bg-rose-50',    ring: 'ring-rose-100',    numCls: 'text-rose-700',    iconBg: 'bg-rose-100',    ico: 'text-rose-500'    },
              ].map(({ label, sub, value, Icon, bg, ring, numCls, iconBg, ico }) => (
                <div key={label} className={`rounded-xl ${bg} ring-1 ${ring} p-3`}>
                  <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
                    <Icon className={`h-4 w-4 ${ico}`} strokeWidth={2.2} />
                  </div>
                  <p className={`text-[28px] font-semibold leading-none tabular-nums ${numCls}`}>{fmtCompact(value)}</p>
                  <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${numCls} opacity-70`}>{label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>
                </div>
              ))
            )}
          </div>

          {/* Connect rate strip */}
          {!callPeriodLoading && periodTotal > 0 && (
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                  style={{ width: `${connectRate}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 shrink-0 tabular-nums">{connectRate}% connect rate</span>
            </div>
          )}
        </div>
      </section>

    </div>
  );
};

export default Dashboard;
