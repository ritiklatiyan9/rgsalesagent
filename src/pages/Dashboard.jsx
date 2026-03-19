import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import LeadSearchWidget from '@/components/LeadSearchWidget';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import api from '@/lib/axios';
import { format, isToday, parseISO } from 'date-fns';
import {
  Target, Calendar, PhoneCall,
  Activity, Plus, ArrowRight, Flame,
  CheckCircle2, Clock, AlertCircle,
  BellRing, Check, AlarmClock, Phone, TrendingUp, Users,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));

const LEAD_CATEGORY_VALUES = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];
const CATEGORY_COLORS = {
  PRIME:  'bg-amber-50 text-amber-700 border-amber-200',
  HOT:    'bg-rose-50 text-rose-700 border-rose-200',
  NORMAL: 'bg-sky-50 text-sky-700 border-sky-200',
  COLD:   'bg-cyan-50 text-cyan-700 border-cyan-200',
  DEAD:   'bg-slate-100 text-slate-700 border-slate-200',
};

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];
const LEAD_STATUS_META = {
  NEW:         { label: 'New',         color: 'bg-sky-500',     light: 'bg-sky-50',     text: 'text-sky-700' },
  CONTACTED:   { label: 'Contacted',   color: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700' },
  INTERESTED:  { label: 'Interested',  color: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-700' },
  SITE_VISIT:  { label: 'Site Visit',  color: 'bg-violet-500',  light: 'bg-violet-50',  text: 'text-violet-700' },
  NEGOTIATION: { label: 'Negotiation', color: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-700' },
  BOOKED:      { label: 'Booked',      color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
  LOST:        { label: 'Lost',        color: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-700' },
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [leadTotal, setLeadTotal] = useState(null);
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [followupCounts, setFollowupCounts] = useState({ scheduled: 0, today: 0, missed: 0 });
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [missedFollowups, setMissedFollowups] = useState([]);
  const [allFollowups, setAllFollowups] = useState([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [fupActionLoading, setFupActionLoading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [browseCat, setBrowseCat] = useState('ALL');

  const loadFollowupsSections = async () => {
    try {
      const res = await cachedGet('/followups?limit=200', { ttl: 30_000 });
      if (res?.success) {
        const allFups = res.followups || res.data || [];
        setAllFollowups(allFups);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Today's & Overdue
        const todayItems = allFups.filter((f) => {
          if (!f.scheduled_at || (f.status !== 'PENDING' && f.status !== 'SNOOZED')) return false;
          try { return parseISO(f.scheduled_at) <= endOfToday; } catch { return false; }
        });
        todayItems.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
        setTodayFollowups(todayItems);

        // Missed (past-due PENDING)
        const missed = allFups.filter((f) => {
          if (f.status !== 'PENDING' || !f.scheduled_at) return false;
          try { return parseISO(f.scheduled_at) < new Date(); } catch { return false; }
        });
        missed.sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
        setMissedFollowups(missed);
      }
    } catch {}
  };

  useEffect(() => {
    const load = async () => {
      const [leadsRes, calls, counts, contactsRes] = await Promise.allSettled([
        cachedGet('/leads?limit=100', { ttl: 60_000 }),
        cachedGet('/calls/analytics', { ttl: 60_000 }),
        cachedGet('/followups/counts', { ttl: 30_000 }),
        cachedGet('/contacts?page=1&limit=5', { ttl: 30_000 }),
      ]);
      if (leadsRes.status === 'fulfilled' && leadsRes.value?.success) {
        setLeads(leadsRes.value.leads ?? []);
        setLeadTotal(leadsRes.value.pagination?.total ?? leadsRes.value.leads?.length ?? 0);
      }
      if (calls.status === 'fulfilled' && calls.value?.success) setCallAnalytics(calls.value);
      if (counts.status === 'fulfilled' && counts.value?.success) {
        const countsData = counts.value.counts || counts.value.data || {};
        setFollowupCounts({
          scheduled: countsData.scheduled ?? 0,
          today: countsData.today ?? 0,
          missed: countsData.missed ?? 0,
        });
      }
      if (contactsRes.status === 'fulfilled' && contactsRes.value?.success) {
        setContactsTotal(contactsRes.value.pagination?.total ?? contactsRes.value.contacts?.length ?? 0);
      }
      setLoading(false);
    };
    load();
    loadFollowupsSections();
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

  const pipeline = useMemo(() => {
    const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
    leads.forEach((l) => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return counts;
  }, [leads]);

  const recentLeads = useMemo(
    () => [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6),
    [leads]
  );

  const todayDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const callMetrics = callAnalytics?.metrics ?? {};
  const totalCalls = callMetrics?.total_calls ?? 0;
  const todayCalls = callMetrics?.today_calls ?? 0;
  const weekCalls = callMetrics?.week_calls ?? 0;

  const maxPipelineCount = Math.max(...Object.values(pipeline), 1);

  const snapshotRows = [
    {
      key: 'leads',
      label: 'Leads',
      hint: 'Total pipeline',
      value: leadTotal,
      nav: '/leads',
      icon: Target,
      tone: 'sky',
    },
    {
      key: 'today_calls',
      label: 'Today Calls',
      hint: `Week ${fmtNum(weekCalls)}`,
      value: todayCalls,
      nav: '/calls/analytics',
      icon: PhoneCall,
      tone: 'orange',
    },
    {
      key: 'tasks',
      label: 'Open Tasks',
      hint: `${fmtNum(followupCounts?.today ?? 0)} due today`,
      value: followupCounts?.scheduled ?? 0,
      nav: '/reminders',
      icon: Clock,
      tone: 'emerald',
    },
    {
      key: 'missed',
      label: 'Missed',
      hint: 'Needs action',
      value: followupCounts?.missed ?? 0,
      nav: '/calls/missed-followups',
      icon: AlertCircle,
      tone: 'rose',
    },
    {
      key: 'bookings',
      label: 'Bookings',
      hint: 'Closed leads',
      value: pipeline.BOOKED ?? 0,
      nav: '/leads?status=BOOKED',
      icon: CheckCircle2,
      tone: 'amber',
    },
    {
      key: 'visits',
      label: 'Visits',
      hint: 'Site visit stage',
      value: pipeline.SITE_VISIT ?? 0,
      nav: '/leads?status=SITE_VISIT',
      icon: Activity,
      tone: 'orange',
    },
    {
      key: 'contacts',
      label: 'Contacts',
      hint: 'Saved in CRM',
      value: contactsTotal ?? 0,
      nav: '/all-contacts',
      icon: Users,
      tone: 'amber',
    },
  ];

  const remindersStatusData = useMemo(() => {
    if (allFollowups.length === 0) return [];
    const counts = { pending: 0, completed: 0, snoozed: 0, escalated: 0 };
    allFollowups.forEach(f => {
      const status = f.status?.toLowerCase() || 'pending';
      if (counts[status] !== undefined) counts[status]++;
    });
    return [
      { name: 'Pending', value: counts.pending, fill: '#0ea5e9' },
      { name: 'Completed', value: counts.completed, fill: '#10b981' },
      { name: 'Snoozed', value: counts.snoozed, fill: '#f59e0b' },
      { name: 'Escalated', value: counts.escalated, fill: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [allFollowups]);

  const callTrendData = useMemo(() => {
    const raw = callAnalytics?.dailyTrend ?? [];
    return raw.slice(-30).map((d) => {
      try {
        const dateObj = d.date instanceof Date ? d.date : new Date(d.date);
        if (isNaN(dateObj.getTime())) return null;
        return {
          date: dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          calls: Number(d.count) || 0,
        };
      } catch { return null; }
    }).filter(Boolean);
  }, [callAnalytics]);

  return (
    <div className="space-y-4 sm:space-y-6 pt-1">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-3 sm:gap-4">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-400 bg-linear-to-br from-cyan-50 via-white to-sky-50/60 p-4 sm:p-5 text-card-foreground shadow-[0_20px_48px_-30px_rgba(8,145,178,0.45)]">
          <div className="pointer-events-none absolute -top-12 -right-14 h-44 w-44 rounded-full bg-cyan-200/45 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-indigo-200/35 blur-3xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center rounded-full border border-cyan-200/70 bg-white/85 px-2.5 py-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-700/85 font-medium">Agent Dashboard</p>
              </div>
              <h1 className="mt-2 text-[22px] sm:text-[26px] leading-tight font-normal text-slate-900">
                Good Morning, <span className="font-medium text-cyan-800">{user?.name?.split(' ')[0] || 'Agent'}</span>
              </h1>
              <p className="mt-1.5 text-xs text-slate-600 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-cyan-600" />
                {todayDateStr}
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-cyan-200/70 bg-white/85 px-2.5 py-2 shadow-sm">
              <div className="min-w-[68px] rounded-xl border border-cyan-100 bg-cyan-50/75 px-2 py-1.5 text-center">
                <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-700/80">New</p>
                <p className="mt-0.5 text-base font-semibold text-slate-800 tabular-nums">{fmtNum(pipeline.NEW)}</p>
              </div>
              <div className="min-w-[68px] rounded-xl border border-amber-100 bg-amber-50/80 px-2 py-1.5 text-center">
                <p className="text-[10px] uppercase tracking-[0.12em] text-amber-700/85">Hot</p>
                <p className="mt-0.5 text-base font-semibold text-slate-800 tabular-nums">{fmtNum(pipeline.INTERESTED)}</p>
              </div>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-2.5">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3.5 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.35)]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Total Leads</p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-[34px] leading-none font-semibold tabular-nums text-slate-900">{fmtNum(leadTotal)}</p>
                <p className="text-[11px] text-slate-500">Across assigned pipeline</p>
              </div>
              <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-linear-to-r from-cyan-400 via-sky-400 to-indigo-400" style={{ width: `${Math.min(100, Math.max(8, leadTotal ? ((pipeline.NEW + pipeline.INTERESTED) / leadTotal) * 100 : 8))}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200/70 bg-linear-to-br from-cyan-50/90 to-white/85 px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-700/85">Focus Today</p>
              <div className="mt-2 flex items-center justify-between text-[12px] text-slate-700">
                <span>New Leads</span>
                <span className="font-semibold tabular-nums text-slate-900">{fmtNum(pipeline.NEW)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-slate-700">
                <span>Hot Leads</span>
                <span className="font-semibold tabular-nums text-slate-900">{fmtNum(pipeline.INTERESTED)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-slate-700 sm:hidden">
                <span>Followups Missed</span>
                <span className="font-semibold tabular-nums text-slate-900">{fmtNum(followupCounts?.missed ?? 0)}</span>
              </div>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <Button size="sm" onClick={() => navigate('/leads/add')} className="h-9 rounded-full bg-slate-900 text-white border border-slate-900 hover:bg-slate-800 text-[11px] font-medium min-w-0 shadow-sm">
              <Plus className="h-3.5 w-3.5 mr-1 shrink-0" /> <span className="truncate">Add Lead</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/reminders')} className="h-9 rounded-full bg-white text-amber-700 border border-amber-200 hover:bg-amber-50 text-[11px] font-medium min-w-0 shadow-sm">
              <Clock className="h-3.5 w-3.5 mr-1 shrink-0" /> <span className="truncate">Tasks</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/all-contacts')} className="h-9 rounded-full bg-white text-cyan-700 border border-cyan-200 hover:bg-cyan-50 text-[11px] font-medium min-w-0 shadow-sm">
              <Users className="h-3.5 w-3.5 mr-1 shrink-0" /> <span className="truncate">Contacts</span>
            </Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-violet-100/55 bg-linear-to-br from-violet-200/70 via-white to-fuchsia-50/55 p-3 sm:p-4 md:p-5 shadow-[0_10px_24px_-18px_rgba(76,29,149,0.26)] sm:shadow-[0_20px_40px_-24px_rgba(76,29,149,0.3)] space-y-3 sm:space-y-4 text-card-foreground">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-violet-200/45 to-transparent" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-violet-700/80">Quick Find</p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">Search leads and jump to category</p>
          </div>

          <LeadSearchWidget />

          <div className="flex items-center gap-2">
            <select
              value={browseCat}
              onChange={(e) => setBrowseCat(e.target.value)}
              className="h-10 sm:h-11 w-full text-sm rounded-xl bg-white border border-violet-200/55 text-slate-700 px-3 outline-none focus:ring-2 focus:ring-violet-300/60"
            >
              <option value="ALL">All Categories</option>
              {LEAD_CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl bg-linear-to-r from-violet-300 to-indigo-200 hover:from-violet-300 hover:to-indigo-300 text-violet-900 border border-violet-300/50"
              onClick={() => navigate(browseCat === 'ALL' ? '/leads' : `/leads?lead_category=${browseCat}`)}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 mt-1 sm:mt-0">
            <button onClick={() => navigate('/calls/analytics')} className="rounded-xl sm:rounded-2xl border border-sky-400/55 bg-sky-50/70 p-2.5 sm:p-3 text-left hover:bg-sky-50 shadow-sm transition-all">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Calls</p>
              <p className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-800">{fmtNum(totalCalls)}</p>
            </button>
            <button onClick={() => navigate('/calls/missed-followups')} className="rounded-xl sm:rounded-2xl border border-rose-400/55 bg-rose-50/70 p-2.5 sm:p-3 text-left hover:bg-rose-50 shadow-sm transition-all">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Missed</p>
              <p className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-800">{fmtNum(followupCounts?.missed ?? 0)}</p>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-first Snapshot */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-sky-200/60 bg-linear-to-br from-sky-50 via-white to-cyan-50 px-3 py-3.5 sm:px-4 sm:py-4.5 shadow-[0_18px_40px_-24px_rgba(14,116,144,0.28)]">
        <div className="pointer-events-none absolute -top-14 -right-16 h-40 w-40 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-indigo-200/35 blur-3xl" />

        <div className="relative flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-sky-800/80 font-semibold">Daily Snapshot</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">Key numbers in one place</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-3 text-[11px] text-sky-700 hover:bg-sky-100 hover:text-sky-900"
            onClick={() => navigate('/calls/analytics')}
          >
            Full analytics <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="relative mt-3.5 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="relative mt-3.5">
            <div className="sm:hidden space-y-2.5">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
                {snapshotRows.slice(0, 3).map(({ key, label, value, nav }) => (
                  <button
                    key={key}
                    className="min-w-[44%] snap-start rounded-xl border border-sky-200/70 bg-white/95 px-3 py-3 text-left hover:bg-white transition-all shadow-[0_10px_22px_-16px_rgba(15,23,42,0.4)]"
                    onClick={() => navigate(nav)}
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 truncate">{label}</p>
                    <p className="mt-2 text-2xl leading-none font-bold tabular-nums text-slate-900">{fmtNum(value)}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {snapshotRows.slice(3).map(({ key, label, value, nav, icon: Icon, tone }) => {
                  const toneStyles = {
                    rose: 'bg-rose-100/90 text-rose-700 border-rose-200/90',
                    teal: 'bg-emerald-100/90 text-emerald-700 border-emerald-200/90',
                    orange: 'bg-orange-100/90 text-orange-700 border-orange-200/90',
                    amber: 'bg-amber-100/90 text-amber-700 border-amber-200/90',
                    sky: 'bg-sky-100/90 text-sky-700 border-sky-200/90',
                    emerald: 'bg-emerald-100/90 text-emerald-700 border-emerald-200/90',
                  };
                  const iconClasses = toneStyles[tone] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <button
                      key={key}
                      className="rounded-xl border border-sky-200/65 bg-white/95 px-2.5 py-2.5 text-left hover:bg-white transition-all shadow-[0_10px_20px_-16px_rgba(15,23,42,0.4)]"
                      onClick={() => navigate(nav)}
                    >
                      <div className={`h-7 w-7 rounded-lg border flex items-center justify-center ${iconClasses}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-slate-800 truncate">{label}</p>
                      <p className="mt-1 text-lg leading-none font-bold tabular-nums text-slate-900">{fmtNum(value)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-1 lg:grid-cols-5 gap-2.5 sm:gap-3">
              <div className="lg:col-span-2 space-y-2.5">
                {snapshotRows.slice(0, 3).map(({ key, label, value, nav }) => (
                  <button
                    key={key}
                    className="w-full rounded-xl border border-sky-200/70 bg-white/90 px-3 py-3 text-left hover:bg-white hover:border-sky-300/80 transition-all shadow-[0_10px_22px_-16px_rgba(15,23,42,0.4)]"
                    onClick={() => navigate(nav)}
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 truncate">{label}</p>
                    <p className="mt-2 text-2xl leading-none font-bold tabular-nums text-slate-900">{fmtNum(value)}</p>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {snapshotRows.slice(3).map(({ key, label, hint, value, nav, icon: Icon, tone }) => {
                  const toneStyles = {
                    rose: 'bg-rose-100/85 text-rose-700 border-rose-200/80',
                    teal: 'bg-emerald-100/85 text-emerald-700 border-emerald-200/80',
                    orange: 'bg-orange-100/85 text-orange-700 border-orange-200/80',
                    amber: 'bg-amber-100/85 text-amber-700 border-amber-200/80',
                    sky: 'bg-sky-100/85 text-sky-700 border-sky-200/80',
                    emerald: 'bg-emerald-100/85 text-emerald-700 border-emerald-200/80',
                  };
                  const iconClasses = toneStyles[tone] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <button
                      key={key}
                      className="rounded-xl border border-sky-200/65 bg-white/92 px-3 py-2.5 text-left hover:bg-white hover:border-sky-300/80 transition-all shadow-[0_10px_20px_-16px_rgba(15,23,42,0.4)]"
                      onClick={() => navigate(nav)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${iconClasses}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-900 truncate">{label}</p>
                            <p className="text-lg font-bold tabular-nums text-slate-900 leading-none">{fmtNum(value)}</p>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 truncate">{hint}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Today's Follow-ups & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Follow-ups */}
        <Card className="card-elevated relative overflow-hidden border border-violet-100/55 bg-linear-to-b from-violet-50/45 to-white shadow-[0_12px_28px_-18px_rgba(109,40,217,0.24)] sm:shadow-[0_16px_34px_-24px_rgba(109,40,217,0.28)] flex flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-violet-200/35 to-transparent" />
          <CardHeader className="relative pb-3 border-b border-border/20 flex flex-row items-center justify-between bg-transparent">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <BellRing className="h-4 w-4 text-violet-600" />
              Today's Schedule
              {todayFollowups.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-violet-100 text-violet-700 border-none">
                  {todayFollowups.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reminders')}
              className="text-[11px] h-7 text-violet-700 hover:bg-violet-100"
            >
              Manage all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="relative p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-100">
              {loading ? (
                <div className="px-5 py-4 space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32 rounded" />
                        <Skeleton className="h-3 w-48 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : todayFollowups.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-50">
                    No pending follow-ups for today.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-violet-100/60">
                  {todayFollowups.slice(0, 10).map((f) => {
                    const scheduledDate = f.scheduled_at ? new Date(f.scheduled_at) : null;
                    const isOverdue = scheduledDate ? scheduledDate < new Date() : false;
                    const timeStr = scheduledDate ? format(scheduledDate, 'hh:mm a') : '';
                    const isCompleting = fupActionLoading === `${f.id}_complete` || fupActionLoading === `${f.id}_snooze`;

                    const typeColors = {
                      CALL: 'bg-sky-50 text-sky-700 border-sky-100',
                      FOLLOWUP: 'bg-violet-50 text-violet-700 border-violet-100',
                      SITE_VISIT: 'bg-amber-50 text-amber-700 border-amber-100',
                      MEETING: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                      OTHER: 'bg-slate-100 text-slate-600 border-slate-200',
                    };

                    return (
                      <div
                        key={f.id}
                        className={`group flex items-start gap-3 px-5 py-4 transition-all hover:bg-slate-100/70 ${
                          isOverdue ? 'bg-slate-100/70' : ''
                        }`}
                      >
                        <div className={`h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                          isOverdue ? 'bg-rose-50 border-rose-200' : 'bg-sky-50 border-sky-200'
                        }`}>
                          <span className={`text-[10px] font-medium uppercase ${isOverdue ? 'text-rose-700' : 'text-sky-700'}`}>
                            {scheduledDate ? format(scheduledDate, 'MMM') : ''}
                          </span>
                          <span className={`text-sm font-semibold leading-none ${isOverdue ? 'text-rose-700' : 'text-sky-700'}`}>
                            {scheduledDate ? format(scheduledDate, 'dd') : ''}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {f.lead_name || 'Unnamed Lead'}
                            </p>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-md font-medium ${typeColors[f.followup_type] || typeColors.OTHER}`}>
                              {f.followup_type || 'REMINDER'}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 bg-slate-200 text-slate-800 border-slate-300/50">LATE</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            {timeStr && (
                              <span className="text-[11px] font-medium flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-700">
                                <Clock className="h-3 w-3" /> {timeStr}
                              </span>
                            )}
                            {f.lead_phone && (
                              <a href={`tel:${f.lead_phone}`} className="text-[11px] font-medium flex items-center gap-1 hover:text-slate-800">
                                <Phone className="h-3 w-3" /> {f.lead_phone}
                              </a>
                            )}
                          </div>
                          {f.notes && (
                            <p className="text-[11px] text-muted-foreground/80 mt-1.5 bg-white/70 p-1.5 rounded-lg border border-indigo-100/55">
                              {f.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-lg bg-emerald-200 text-emerald-800 hover:bg-emerald-300 transition-all shadow-sm"
                            onClick={() => completeFollowup(f.id)}
                            disabled={isCompleting}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-lg bg-amber-200 text-amber-800 hover:bg-amber-300 transition-all shadow-sm"
                            onClick={() => snoozeFollowup(f.id)}
                            disabled={isCompleting}
                          >
                            <AlarmClock className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Analytics & Pipeline */}
        <div className="flex flex-col gap-6">
          {/* Calls Trend Chart */}
          <Card className="card-elevated border border-sky-100/55 bg-linear-to-b from-sky-50/35 to-white shadow-[0_16px_34px_-24px_rgba(14,116,144,0.35)]">
            <CardHeader className="pb-3 border-b border-border/20 flex flex-row items-center justify-between bg-white/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                Call Analytics Trend
              </CardTitle>
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Last 30 Days</span>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-50 w-full rounded-2xl" />
              ) : callTrendData.length === 0 ? (
                <div className="h-50 flex items-center justify-center text-sm text-muted-foreground bg-slate-50 rounded-2xl border border-dashed">
                  No trend data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={callTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} 
                      axisLine={false} 
                      tickLine={false}
                      interval={Math.floor(callTrendData.length / 5)} 
                    />
                    <YAxis 
                      tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #dbeafe', boxShadow: '0 12px 24px -10px rgba(14,116,144,0.25)', fontSize: '11px', fontWeight: 'bold', background: '#f8fafc' }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="#0284c7" 
                      strokeWidth={3} 
                      fill="url(#callsGradient)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Lead Funnel Summary */}
           <Card className="card-elevated border border-emerald-100/55 bg-linear-to-b from-emerald-50/30 to-white shadow-[0_16px_34px_-24px_rgba(5,150,105,0.25)]">
             <CardHeader className="pb-3 border-b border-border/20 bg-white/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                Pipeline Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)
              ) : (
                <>
                  {[
                    { status: 'NEW', label: 'Fresh Enquiries', color: 'bg-sky-500', icon: Plus },
                    { status: 'INTERESTED', label: 'Potential Leads', color: 'bg-amber-500', icon: Flame },
                    { status: 'SITE_VISIT', label: 'Viewings Slated', color: 'bg-violet-500', icon: Activity },
                  ].map((item) => {
                    const count = pipeline[item.status] || 0;
                    const pct = maxPipelineCount > 0 ? (count / maxPipelineCount) * 100 : 0;
                    return (
                      <div key={item.status} className="space-y-1.5 group cursor-pointer" onClick={() => navigate(`/leads?status=${item.status}`)}>
                        <div className="flex items-center justify-between text-[11px] font-medium">
                          <span className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                            <item.icon className="h-3 w-3" /> {item.label}
                          </span>
                          <span className="text-foreground">{count}</span>
                        </div>
                        <div className="h-2 w-full bg-emerald-200/70 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${item.color} rounded-full transition-all duration-700 shadow-sm`} 
                            style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reminders Status Chart */}
      {remindersStatusData.length > 0 && (
        <Card className="card-elevated border border-orange-100/55 bg-linear-to-b from-orange-50/30 to-white shadow-[0_16px_34px_-24px_rgba(194,65,12,0.2)]">
          <CardHeader className="pb-3 border-b border-border/20 flex flex-row items-center justify-between bg-white/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-orange-600" />
              Follow-up Health
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reminders')}
              className="text-[11px] h-7 text-emerald-600 hover:bg-emerald-50"
            >
              Analytics <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <Skeleton className="h-55 w-full rounded-2xl" />
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <ResponsiveContainer width="100%" height={220} className="max-w-60">
                  <PieChart>
                    <Pie
                      data={remindersStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {remindersStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} className="outline-none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 sm:flex sm:flex-col gap-4">
                  {remindersStatusData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.fill }} />
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{d.name}</p>
                        <p className="text-sm font-semibold text-foreground">{d.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Leads */}
      <Card className="card-elevated border border-violet-100/55 bg-linear-to-b from-violet-50/28 to-white shadow-[0_16px_34px_-24px_rgba(109,40,217,0.25)]">
        <CardHeader className="pb-3 border-b border-border/20 flex flex-row items-center justify-between bg-white/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Users className="h-4 w-4 text-violet-600" />
            Recent Prospects
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/leads/add')}
            className="text-[11px] h-7 text-violet-700 hover:bg-violet-50"
          >
            <Plus className="h-3 w-3 mr-1" /> New Lead
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-foreground">No leads yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start by adding your first prospect.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {recentLeads.map((lead) => {
                const meta = LEAD_STATUS_META[lead.status] ?? { label: lead.status, light: 'bg-slate-100', text: 'text-slate-600' };
                const initials = (lead.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                
                return (
                  <div 
                    key={lead.id} 
                    className="group flex items-center gap-4 px-6 py-3.5 hover:bg-indigo-50/70 transition-all cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <div className="h-10 w-10 rounded-full bg-linear-to-br from-violet-300 to-indigo-300 flex items-center justify-center text-indigo-900 text-xs font-semibold shadow-sm ring-2 ring-white ring-offset-0 group-hover:scale-110 transition-transform">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-slate-800 transition-colors">
                        {lead.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" /> {lead.phone || 'No phone'}
                        </span>
                        {lead.category && (
                          <span className={`text-[9px] font-medium px-1.5 rounded uppercase border ${CATEGORY_COLORS[lead.category] || 'bg-slate-50 border-slate-100'}`}>
                            {lead.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[9px] px-2 py-0 border-none font-medium ${meta.light} ${meta.text}`}>
                        {meta.label}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground/60 font-medium">
                        {lead.created_at ? format(new Date(lead.created_at), 'dd MMM') : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
