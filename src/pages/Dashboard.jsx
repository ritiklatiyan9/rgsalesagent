import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
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

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeamHead = String(user?.role || '').toUpperCase() === 'TEAM_HEAD';
  const roleLabel = isTeamHead ? 'Team Head' : 'Agent';

  const [leadTotal, setLeadTotal] = useState(null);
  const [pipeline, setPipeline] = useState(Object.fromEntries(LEAD_STATUSES.map(s => [s, 0])));
  const [matterLeadsTotal, setMatterLeadsTotal] = useState(null);
  const [freshLeadsTotal, setFreshLeadsTotal] = useState(null);
  const [freshLeads, setFreshLeads] = useState([]);
  const [freshLoading, setFreshLoading] = useState(true);
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [followupCounts, setFollowupCounts] = useState({ scheduled: 0, today: 0, missed: 0 });
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [allFollowups, setAllFollowups] = useState([]);
  const [fupActionLoading, setFupActionLoading] = useState(null);
  const [loading, setLoading] = useState(true);
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
    if (refreshing) return;
    setRefreshing(true);
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
    setRefreshing(false);
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const callMetrics = callAnalytics?.metrics ?? {};
  const todayCalls = callMetrics?.today_calls ?? 0;
  const weekCalls = callMetrics?.week_calls ?? 0;
  const maxPipeline = Math.max(...Object.values(pipeline), 1);

  /* ── Stat card configs ── */
  const statCards = [
    {
      label: 'Total Leads',
      value: leadTotal,
      hint: 'In your pipeline',
      icon: Target,
      nav: '/leads',
      gradient: 'from-blue-50 via-indigo-50 to-violet-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      ring: 'ring-blue-100',
      ribbon: 'from-blue-500 via-indigo-500 to-violet-500',
      flow: '#4f46e5',
    },
    {
      label: 'Today Calls',
      value: todayCalls,
      hint: `${fmtNum(weekCalls)} this week`,
      icon: PhoneCall,
      nav: '/calls/analytics',
      gradient: 'from-orange-50 via-amber-50 to-yellow-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      ring: 'ring-orange-100',
      ribbon: 'from-orange-500 via-amber-500 to-yellow-500',
      flow: '#f59e0b',
    },
    {
      label: 'Reminders',
      value: followupCounts?.scheduled ?? 0,
      hint: `${fmtNum(followupCounts?.today ?? 0)} due today`,
      icon: Clock,
      nav: '/reminders',
      gradient: 'from-emerald-50 via-teal-50 to-cyan-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      ring: 'ring-emerald-100',
      ribbon: 'from-emerald-500 via-teal-500 to-cyan-500',
      flow: '#10b981',
    },
    {
      label: 'Fresh Leads',
      value: freshLeadsTotal,
      hint: 'New enquiries',
      icon: Sparkles,
      nav: '/leads?status=NEW',
      gradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      ring: 'ring-violet-100',
      ribbon: 'from-violet-500 via-purple-500 to-fuchsia-500',
      flow: '#8b5cf6',
    },
    {
      label: 'Matter Leads',
      value: matterLeadsTotal,
      hint: 'Leads you\'ve called',
      icon: Star,
      nav: '/matter-leads',
      gradient: 'from-rose-50 via-pink-50 to-fuchsia-50',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      ring: 'ring-rose-100',
      ribbon: 'from-rose-500 via-pink-500 to-fuchsia-500',
      flow: '#e11d48',
    },
  ];

  /* ── Quick nav ── */
  const quickNav = [
    { icon: Plus,          label: 'Add Lead',  nav: '/leads/add',       gradient: 'from-indigo-500 to-violet-500', text: 'text-white' },
     { icon: Clock1, label: 'Reminder',      nav: '/reminders',            gradient: 'from-sky-50 to-blue-50',        text: 'text-sky-700' },
    { icon: MessageSquare, label: 'Chat',      nav: '/chat',            gradient: 'from-sky-50 to-blue-50',        text: 'text-sky-700' },
    { icon: Calendar,      label: 'Scheduled', nav: '/calls/scheduled', gradient: 'from-amber-50 to-orange-50',    text: 'text-amber-700' },
    { icon: RefreshCw,     label: refreshing ? 'Syncing' : 'Refresh', action: refreshDashboard, gradient: 'from-emerald-50 to-teal-50', text: 'text-emerald-700', spin: refreshing },
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

      {/* ══════ GREETING HEADER ══════ */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-900 via-blue-500/80 to-blue-600 p-5 text-white shadow-lg shadow-indigo-200/50">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-sm" />
        <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/10 blur-sm" />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            <h1 className="text-xl font-bold mt-0.5 leading-tight">
              {greeting}, {user?.name?.split(' ')[0] || roleLabel}
            </h1>
            <p className="text-white/60 text-[11px] mt-1 font-medium">{roleLabel} Dashboard</p>
          </div>
          <div
            onClick={() => navigate('/attendance')}
            className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-base font-bold cursor-pointer active:scale-95 transition-transform ring-2 ring-white/30"
          >
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>

      {/* ══════ QUICK FIND ══════ */}
      <div className="rounded-3xl bg-linear-to-br from-slate-50 via-white to-indigo-50/40 border border-slate-100 shadow-sm ring-1 ring-slate-100 p-3.5">
        {/* Category pills */}
        <div className="flex gap-2.5 mb-2.5 overflow-x-auto pt-0.5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {CATS.map((cat) => {
            const isActive = browseCat === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setBrowseCat(cat.key)}
                className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-bold leading-none whitespace-nowrap ring-1 ring-inset active:scale-95 transition-all duration-150 ${
                  isActive
                    ? `bg-linear-to-r ${cat.bg} ${cat.active} shadow-sm ring-transparent`
                    : cat.inactive
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        {/* Search input */}
        <LeadSearchWidget category={browseCat === 'ALL' ? undefined : browseCat} />
        <button
          onClick={() => navigate(browseCat === 'ALL' ? '/leads' : `/leads?lead_category=${browseCat}`)}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-600 py-1.5 rounded-xl bg-indigo-50 active:bg-indigo-100 transition-colors"
        >
          Browse {browseCat === 'ALL' ? 'all' : browseCat.toLowerCase()} leads <ArrowRight className="h-3 w-3" />
        </button>
      </div>
       <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {quickNav.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (item.action) {
                item.action();
              } else if (item.nav) {
                navigate(item.nav);
              }
            }}
            className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
          >
            <div className={`h-13 w-13 rounded-2xl bg-linear-to-br ${item.gradient} flex items-center justify-center shadow-sm`}>
              <item.icon className={`h-5.5 w-5.5 ${item.text} ${item.spin ? 'animate-spin' : ''}`} strokeWidth={1.8} />
            </div>
            <span className="text-[10px] font-semibold text-slate-500">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ══════ STAT CARDS ══════ */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.slice(0, 4).map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.nav)}
              className={`relative overflow-hidden rounded-3xl bg-linear-to-br ${card.gradient} p-4 text-left active:scale-[0.97] transition-all duration-200 shadow-sm ring-1 ${card.ring}`}
            >
              <div className={`absolute top-0 left-2.5 right-2.5 h-1.5 rounded-b-md bg-linear-to-r ${card.ribbon}`} />
              {/* Soft decorative blob */}
              <div className="absolute -top-3 -right-3 h-14 w-14 rounded-full bg-white/40 blur-md" />

              <div className={`relative h-10 w-10 rounded-2xl ${card.iconBg} flex items-center justify-center shadow-sm`}>
                <Icon className={`h-5 w-5 ${card.iconColor}`} strokeWidth={1.8} />
              </div>
              <div className="relative mt-3">
                <p className="text-2xl font-extrabold text-slate-800 leading-none tracking-tight">
                  {loading ? <Skeleton className="h-7 w-14 rounded-lg" /> : fmtNum(card.value)}
                </p>
                <p className="text-[12px] font-semibold text-slate-600 mt-1">{card.label}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{card.hint}</p>
              </div>
              <FlowCurve color={card.flow} opacity={0.09} />
            </button>
          );
        })}
      </div>

      {/* Matter Leads — wide card */}
      {statCards[4] && (() => {
        const card = statCards[4];
        const Icon = card.icon;
        return (
          <button
            onClick={() => navigate(card.nav)}
            className={`relative w-full overflow-hidden rounded-3xl bg-linear-to-r ${card.gradient} p-4 text-left active:scale-[0.98] transition-all duration-200 shadow-sm ring-1 ${card.ring} flex items-center gap-4`}
          >
            <div className={`absolute top-0 left-2.5 right-2.5 h-1.5 rounded-b-md bg-linear-to-r ${card.ribbon}`} />
            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/40 blur-md" />
            <div className={`relative h-12 w-12 rounded-2xl ${card.iconBg} flex items-center justify-center shadow-sm shrink-0`}>
              <Icon className={`h-6 w-6 ${card.iconColor}`} strokeWidth={1.8} fill="currentColor" />
            </div>
            <div className="relative flex-1 min-w-0">
              <p className="text-2xl font-extrabold text-slate-800 leading-none tracking-tight">
                {loading ? <Skeleton className="h-7 w-14 rounded-lg" /> : fmtNum(card.value)}
              </p>
              <p className="text-[12px] font-semibold text-slate-600 mt-0.5">{card.label}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 relative shrink-0" />
            <FlowCurve color={card.flow} opacity={0.09} />
          </button>
        );
      })()}

      {/* ══════ QUICK ACTIONS ══════ */}
     

      {/* ══════ TODAY'S AGENDA ══════ */}
      <section className="relative rounded-3xl bg-linear-to-br from-white via-white to-amber-50/30 border border-slate-100 shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-linear-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-sm">
              <Clock className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-slate-800">Today's Agenda</h2>
              <p className="text-[10px] text-slate-400 font-medium">{todayFollowups.length} follow-ups pending</p>
            </div>
          </div>
          {todayFollowups.length > 0 && (
            <button onClick={() => navigate('/reminders')} className="text-[11px] font-semibold text-indigo-600 flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-indigo-50 active:bg-indigo-100 transition-colors">
              See all <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="px-3 pb-4">
          {loading ? (
            <div className="space-y-2">
              {[0,1,2].map(i => <Skeleton key={i} className="h-18 w-full rounded-2xl" />)}
            </div>
          ) : todayFollowups.length === 0 ? (
            <div className="rounded-2xl bg-linear-to-br from-emerald-50 to-teal-50 py-10 flex flex-col items-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2 shadow-sm">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <p className="text-sm font-bold text-slate-700">All clear!</p>
              <p className="text-[11px] text-slate-400 mt-0.5">No follow-ups due today.</p>
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
                    className={`flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 ${
                      isOverdue
                        ? 'bg-linear-to-r from-rose-50 to-red-50/50 ring-1 ring-rose-200/60'
                        : 'bg-slate-50/80 ring-1 ring-slate-100'
                    }`}
                  >
                    {/* Date pill */}
                    <div className={`shrink-0 h-11 w-11 rounded-2xl flex flex-col items-center justify-center shadow-sm ${
                      isOverdue ? 'bg-linear-to-b from-rose-100 to-rose-200/70' : 'bg-white'
                    }`}>
                      <span className={`text-[15px] font-extrabold leading-none ${isOverdue ? 'text-rose-700' : 'text-slate-700'}`}>
                        {scheduledDate ? format(scheduledDate, 'dd') : '--'}
                      </span>
                      <span className={`text-[8px] font-bold uppercase mt-0.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                        {scheduledDate ? format(scheduledDate, 'MMM') : ''}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{f.lead_name || 'Unknown'}</p>
                        {isOverdue && <span className="text-[8px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">LATE</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {timeStr && <span className="text-[10px] text-slate-400 font-medium">{timeStr}</span>}
                        {f.followup_type && (
                          <span className="text-[9px] font-medium text-slate-400">· {f.followup_type.replace('_', ' ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      {f.lead_phone && (
                        <a
                          href={`tel:${f.lead_phone}`}
                          className="h-9 w-9 rounded-xl bg-linear-to-br from-emerald-50 to-teal-100 text-emerald-600 flex items-center justify-center active:scale-95 transition-transform shadow-sm ring-1 ring-emerald-200/50"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        className="h-9 w-9 rounded-xl bg-linear-to-br from-indigo-50 to-violet-100 text-indigo-600 flex items-center justify-center active:scale-95 transition-transform shadow-sm ring-1 ring-indigo-200/50 disabled:opacity-40"
                        onClick={() => completeFollowup(f.id)}
                        disabled={isActioning}
                      >
                        {fupActionLoading === `${f.id}_complete`
                          ? <span className="h-3.5 w-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                          : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        className="h-9 w-9 rounded-xl bg-linear-to-br from-amber-50 to-orange-100 text-amber-600 flex items-center justify-center active:scale-95 transition-transform shadow-sm ring-1 ring-amber-200/50 disabled:opacity-40"
                        onClick={() => snoozeFollowup(f.id)}
                        disabled={isActioning}
                      >
                        {fupActionLoading === `${f.id}_snooze`
                          ? <span className="h-3.5 w-3.5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                          : <AlarmClock className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <FlowCurve color="#f59e0b" opacity={0.08} />
      </section>

      {/* ══════ FRESH LEADS CAROUSEL ══════ */}
      <section className="relative rounded-3xl bg-linear-to-br from-white via-white to-violet-50/40 border border-slate-100 shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-linear-to-br from-violet-100 to-purple-100 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-slate-800">Fresh Leads</h2>
              <p className="text-[10px] text-slate-400 font-medium">New enquiries awaiting contact</p>
            </div>
            {!freshLoading && freshLeads.length > 0 && (
              <span className="ml-1 h-5 min-w-5 inline-flex items-center justify-center rounded-full bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/60">
                {freshLeadsTotal ?? freshLeads.length}
              </span>
            )}
          </div>
          <button onClick={() => navigate('/leads?status=NEW')} className="text-[11px] font-semibold text-violet-600 flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-violet-50 active:bg-violet-100 transition-colors">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {freshLoading ? (
          <div className="flex gap-3 px-4 pb-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {[0,1,2,3].map(i => (
              <div key={i} className="shrink-0 w-40 rounded-2xl border border-slate-100 p-3 space-y-2">
                <Skeleton className="h-10 w-10 rounded-2xl" />
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
        ) : freshLeads.length === 0 ? (
          <div className="px-4 pb-4">
            <div className="rounded-2xl bg-linear-to-br from-violet-50 to-purple-50 py-8 flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center mb-2 shadow-sm">
                <CheckCircle2 className="h-6 w-6 text-violet-400" />
              </div>
              <p className="text-sm font-bold text-slate-700">No fresh leads</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All enquiries contacted.</p>
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
                  className="shrink-0 w-40 rounded-2xl bg-linear-to-br from-violet-50/80 to-purple-50/60 ring-1 ring-violet-100 p-3 flex flex-col gap-2 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
                >
                  <div className="h-10 w-10 rounded-2xl bg-linear-to-br from-violet-100 to-purple-200/50 flex items-center justify-center shadow-sm ring-1 ring-violet-200/50">
                    {lead.photo_url ? (
                      <img src={lead.photo_url} alt={lead.name} className="w-full h-full rounded-2xl object-cover" loading="lazy" />
                    ) : (
                      <span className="text-sm font-bold text-violet-600">{lead.name?.charAt(0)?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{lead.name || 'Unnamed'}</p>
                    {lead.phone && <p className="text-[10px] text-slate-500 truncate mt-0.5">{lead.phone}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lead.lead_category && (
                      <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/70 ring-1 ring-violet-200/50 text-violet-700">{lead.lead_category}</span>
                    )}
                    {ago && <span className="text-[9px] text-slate-400 font-medium">{ago}</span>}
                  </div>
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-1 h-8 rounded-xl bg-linear-to-r from-violet-500 to-purple-600 text-white text-[10px] font-semibold active:scale-95 transition-transform shadow-sm mt-auto"
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <FlowCurve color="#8b5cf6" opacity={0.08} />
      </section>

      {/* ══════ PIPELINE ══════ */}
      <section className="relative rounded-3xl bg-linear-to-br from-white via-white to-emerald-50/30 border border-slate-100 shadow-sm ring-1 ring-slate-100 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-linear-to-br from-emerald-100 to-teal-100 flex items-center justify-center shadow-sm">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-slate-800">Pipeline</h2>
              <p className="text-[10px] text-slate-400 font-medium">{fmtNum(leadTotal)} total leads</p>
            </div>
          </div>
          <button onClick={() => navigate('/leads')} className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-emerald-50 active:bg-emerald-100 transition-colors">
            All leads <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0,1,2].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : (
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
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <span className={`h-2 w-2 rounded-full ${item.dotColor}`} />
                      {item.label}
                    </span>
                    <span className="text-[12px] font-bold text-slate-800">{fmtNum(count)}</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-linear-to-r ${item.barGrad} transition-all duration-700 shadow-sm`}
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <FlowCurve color="#10b981" opacity={0.08} />
      </section>
    </div>
  );
};

export default Dashboard;
