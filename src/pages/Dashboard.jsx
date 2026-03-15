import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import LeadSearchWidget from '@/components/LeadSearchWidget';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import api from '@/lib/axios';
import { format, isToday, parseISO } from 'date-fns';
import {
  Target, Calendar, PhoneCall,
  Activity, Plus, ArrowRight, Flame,
  BarChart2, CheckCircle2, Clock, AlertCircle,
  BellRing, Check, AlarmClock, Phone, Tag, TrendingUp, Users,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));

const LEAD_CATEGORY_VALUES = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];
const CATEGORY_COLORS = {
  PRIME:  'bg-amber-100 text-amber-700 border-amber-200',
  HOT:    'bg-rose-100 text-rose-700 border-rose-200',
  NORMAL: 'bg-blue-100 text-blue-700 border-blue-200',
  COLD:   'bg-sky-100 text-sky-700 border-sky-200',
  DEAD:   'bg-slate-100 text-slate-700 border-slate-200',
};

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];
const LEAD_STATUS_META = {
  NEW:         { label: 'New',         color: 'bg-sky-500',     light: 'bg-sky-50',     text: 'text-sky-700'     },
  CONTACTED:   { label: 'Contacted',   color: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-700'  },
  INTERESTED:  { label: 'Interested',  color: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-700'   },
  SITE_VISIT:  { label: 'Site Visit',  color: 'bg-orange-500',  light: 'bg-orange-50',  text: 'text-orange-700'  },
  NEGOTIATION: { label: 'Negotiation', color: 'bg-purple-500',  light: 'bg-purple-50',  text: 'text-purple-700'  },
  BOOKED:      { label: 'Booked',      color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
  LOST:        { label: 'Lost',        color: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-700'    },
};

const KpiSkeleton = () => (
  <div className="stat-card border-l-4 border-l-muted">
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-16 rounded" />
      <Skeleton className="h-3 w-28 rounded" />
    </div>
  </div>
);

const SECONDARY_CARD_STYLES = {
  orange: {
    hoverBorder: 'hover:border-orange-200',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  teal: {
    hoverBorder: 'hover:border-teal-200',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
  purple: {
    hoverBorder: 'hover:border-purple-200',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  amber: {
    hoverBorder: 'hover:border-amber-200',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
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

  const remindersStatusData = useMemo(() => {
    if (allFollowups.length === 0) return [];
    const counts = { pending: 0, completed: 0, snoozed: 0, escalated: 0 };
    allFollowups.forEach(f => {
      const status = f.status?.toLowerCase() || 'pending';
      if (counts[status] !== undefined) counts[status]++;
    });
    return [
      { name: 'Pending', value: counts.pending, fill: '#f97316' },
      { name: 'Completed', value: counts.completed, fill: '#22c55e' },
      { name: 'Snoozed', value: counts.snoozed, fill: '#6b7280' },
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
    <div className="space-y-6 pt-1">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {user?.name || 'Agent'} 👋
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar className="h-4 w-4 text-primary/70" />
            {todayDateStr}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs font-semibold border-emerald-200 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-300 rounded-xl"
            onClick={() => navigate('/leads/add')}
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 rounded-xl"
            onClick={() => navigate('/calls/log')}
          >
            <PhoneCall className="h-4 w-4" />
            Log Call
          </Button>
        </div>
      </div>

      {/* Advanced Search & Filtering (Glassmorphism) */}
      <div className="rounded-2xl border border-border/40 bg-white/70 backdrop-blur-md shadow-sm px-4 py-4 grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_260px] items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="hidden lg:block">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quick Search</p>
            <p className="text-[10px] text-muted-foreground/60">Find leads instantly</p>
          </div>
        </div>
        <div className="w-full min-w-0">
          <LeadSearchWidget />
        </div>
        <Separator className="hidden lg:block h-8 w-px bg-border/40" />
        <div className="flex items-center gap-2 w-full lg:w-[260px] lg:shrink-0">
          <Select value={browseCat} onValueChange={setBrowseCat}>
            <SelectTrigger className="h-10 text-sm rounded-xl bg-white/50 border-border/60">
              <SelectValue placeholder="Browse Category..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL">All Categories</SelectItem>
              {LEAD_CATEGORY_VALUES.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${CATEGORY_COLORS[c]?.split(' ')[0]}`} />
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            onClick={() => navigate(browseCat === 'ALL' ? '/leads' : `/leads?category=${browseCat}`)}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <div
              className="stat-card border-l-4 border-l-sky-500 bg-white/60 hover:shadow-lg hover:shadow-sky-100/50 transition-all cursor-pointer group"
              onClick={() => navigate('/leads')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Leads</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground group-hover:text-sky-600 transition-colors">
                    {fmtNum(leadTotal)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-sky-100/50 flex items-center justify-center group-hover:bg-sky-500 group-hover:rotate-6 transition-all duration-300">
                  <Target className="h-6 w-6 text-sky-600 group-hover:text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-sky-100/30">
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-100 font-bold px-1.5 py-0">
                  {fmtNum(pipeline.NEW)} New
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-100 font-bold px-1.5 py-0">
                  {fmtNum(pipeline.INTERESTED)} Hot
                </Badge>
              </div>
            </div>

            <div
              className="stat-card border-l-4 border-l-indigo-500 bg-white/60 hover:shadow-lg hover:shadow-indigo-100/50 transition-all cursor-pointer group"
              onClick={() => navigate('/calls/analytics')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Call Performance</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground group-hover:text-indigo-600 transition-colors">
                    {fmtNum(totalCalls)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-indigo-100/50 flex items-center justify-center group-hover:bg-indigo-500 group-hover:-rotate-6 transition-all duration-300">
                  <PhoneCall className="h-6 w-6 text-indigo-600 group-hover:text-white" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                <span className="font-semibold text-indigo-700">{fmtNum(todayCalls)} today</span>
                <span className="opacity-60 text-[10px]">· {fmtNum(weekCalls)} this week</span>
              </p>
            </div>

            <div
              className="stat-card border-l-4 border-l-emerald-500 bg-white/60 hover:shadow-lg hover:shadow-emerald-100/50 transition-all cursor-pointer group"
              onClick={() => navigate('/reminders')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Tasks</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground group-hover:text-emerald-600 transition-colors">
                    {fmtNum(followupCounts?.scheduled ?? 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-100/50 flex items-center justify-center group-hover:bg-emerald-500 group-hover:scale-110 transition-all duration-300">
                  <Clock className="h-6 w-6 text-emerald-600 group-hover:text-white" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-700">
                  {followupCounts?.today ?? 0} due today
                </span>
                {followupCounts?.missed > 0 && (
                  <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1 rounded animate-bounce">
                    {followupCounts.missed} Missed!
                  </span>
                )}
              </div>
            </div>

            <div
              className="stat-card border-l-4 border-l-rose-500 bg-white/60 hover:shadow-lg hover:shadow-rose-100/50 transition-all cursor-pointer group"
              onClick={() => navigate('/calls/missed')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Missed Follow-ups</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground group-hover:text-rose-600 transition-colors">
                    {fmtNum(followupCounts?.missed ?? 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-rose-100/50 flex items-center justify-center group-hover:bg-rose-500 group-hover:rotate-6 transition-all duration-300">
                  <AlertCircle className="h-6 w-6 text-rose-600 group-hover:text-white" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <Flame className="h-3.5 w-3.5 text-rose-500" />
                <span className="font-semibold text-rose-700">Needs attention now</span>
              </p>
            </div>

            <div
              className="stat-card border-l-4 border-l-cyan-500 bg-white/60 hover:shadow-lg hover:shadow-cyan-100/50 transition-all cursor-pointer group"
              onClick={() => navigate('/all-contacts')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">All Contacts</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground group-hover:text-cyan-600 transition-colors">
                    {fmtNum(contactsTotal)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-cyan-100/50 flex items-center justify-center group-hover:bg-cyan-500 group-hover:-rotate-6 transition-all duration-300">
                  <Users className="h-6 w-6 text-cyan-600 group-hover:text-white" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <Tag className="h-3.5 w-3.5 text-cyan-500" />
                <span className="font-semibold text-cyan-700">Direct dialer-ready contacts</span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: 'Today Follow-ups', value: followupCounts?.today ?? 0, icon: BellRing, color: 'orange', nav: '/reminders' },
          { label: 'Booking Requests', value: pipeline.BOOKED ?? 0, icon: CheckCircle2, color: 'teal', nav: '/leads?status=BOOKED' },
          { label: 'Visit Scheduled', value: pipeline.SITE_VISIT ?? 0, icon: Activity, color: 'purple', nav: '/leads?status=SITE_VISIT' },
          { label: 'Negotiations', value: pipeline.NEGOTIATION ?? 0, icon: Target, color: 'amber', nav: '/leads?status=NEGOTIATION' },
        ].map(({ label, value, icon: Icon, color, nav }) => {
          const styles = SECONDARY_CARD_STYLES[color] || SECONDARY_CARD_STYLES.orange;
          return (
          <div
            key={label}
            className={`stat-card bg-white/50 border border-border/30 py-3.5 hover:bg-white ${styles.hoverBorder} hover:shadow-md transition-all cursor-pointer group`}
            onClick={() => navigate(nav)}
          >
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${styles.iconBg} flex items-center justify-center shrink-0 transition-colors group-hover:rotate-12`}>
                <Icon className={`h-5 w-5 ${styles.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{label}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl font-bold text-foreground">{fmtNum(value)}</p>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>

      {/* Today's Follow-ups & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Follow-ups */}
        <Card className="card-elevated border-0 flex flex-col">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between bg-white/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <BellRing className="h-4 w-4 text-orange-500" />
              Today's Schedule
              {todayFollowups.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-orange-100 text-orange-700 border-none">
                  {todayFollowups.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reminders')}
              className="text-[11px] h-7 text-primary hover:bg-indigo-50"
            >
              Manage all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
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
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    No pending follow-ups for today.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {todayFollowups.map((f) => {
                    const scheduledDate = f.scheduled_at ? parseISO(f.scheduled_at) : null;
                    const isOverdue = scheduledDate && scheduledDate < new Date() && !isToday(scheduledDate);
                    const timeStr = scheduledDate ? format(scheduledDate, 'hh:mm a') : null;
                    const isCompleting = fupActionLoading === f.id + '_complete';
                    
                    const typeColors = {
                      CALL: 'bg-blue-50 text-blue-700 border-blue-100',
                      FOLLOWUP: 'bg-indigo-50 text-indigo-700 border-indigo-100',
                      SITE_VISIT: 'bg-orange-50 text-orange-700 border-orange-100',
                      MEETING: 'bg-purple-50 text-purple-700 border-purple-100',
                      OTHER: 'bg-slate-100 text-slate-600 border-slate-200',
                    };

                    return (
                      <div
                        key={f.id}
                        className={`group flex items-start gap-3 px-5 py-4 transition-all hover:bg-indigo-50/20 ${
                          isOverdue ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        <div className={`h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                          isOverdue ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <span className={`text-[10px] font-bold uppercase ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
                            {scheduledDate ? format(scheduledDate, 'MMM') : ''}
                          </span>
                          <span className={`text-sm font-black leading-none ${isOverdue ? 'text-rose-700' : 'text-slate-700'}`}>
                            {scheduledDate ? format(scheduledDate, 'dd') : ''}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {f.lead_name || 'Unnamed Lead'}
                            </p>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-md font-bold ${typeColors[f.followup_type] || typeColors.OTHER}`}>
                              {f.followup_type || 'REMINDER'}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[8px] h-4 px-1 py-0 animate-pulse">LATE</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            {timeStr && (
                              <span className="text-[11px] font-medium flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                <Clock className="h-3 w-3" /> {timeStr}
                              </span>
                            )}
                            {f.lead_phone && (
                              <a href={`tel:${f.lead_phone}`} className="text-[11px] font-medium flex items-center gap-1 hover:text-indigo-600">
                                <Phone className="h-3 w-3" /> {f.lead_phone}
                              </a>
                            )}
                          </div>
                          {f.notes && (
                            <p className="text-[11px] text-muted-foreground/80 mt-1.5 bg-white/50 p-1.5 rounded-lg border border-slate-100">
                              {f.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                            onClick={() => completeFollowup(f.id)}
                            disabled={isCompleting}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all shadow-sm"
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
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between bg-white/40">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Call Analytics Trend
              </CardTitle>
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Last 30 Days</span>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-[200px] w-full rounded-2xl" />
              ) : callTrendData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground bg-slate-50 rounded-2xl border border-dashed">
                  No trend data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={callTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }} 
                      axisLine={false} 
                      tickLine={false}
                      interval={Math.floor(callTrendData.length / 5)} 
                    />
                    <YAxis 
                      tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="#6366f1" 
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
          <Card className="card-elevated border-0">
             <CardHeader className="pb-3 border-b border-border/40 bg-white/40">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
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
                    { status: 'SITE_VISIT', label: 'Viewings Slated', color: 'bg-orange-500', icon: Activity },
                    { status: 'BOOKED', label: 'Closed Deals', color: 'bg-emerald-500', icon: CheckCircle2 },
                  ].map((item) => {
                    const count = pipeline[item.status] || 0;
                    const pct = maxPipelineCount > 0 ? (count / maxPipelineCount) * 100 : 0;
                    return (
                      <div key={item.status} className="space-y-1.5 group cursor-pointer" onClick={() => navigate(`/leads?status=${item.status}`)}>
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground">
                            <item.icon className="h-3 w-3" /> {item.label}
                          </span>
                          <span className="text-foreground">{count}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
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
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between bg-white/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-emerald-500" />
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
              <Skeleton className="h-[220px] w-full rounded-2xl" />
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <ResponsiveContainer width="100%" height={220} className="max-w-[240px]">
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
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{d.name}</p>
                        <p className="text-sm font-bold text-foreground">{d.value}</p>
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
      <Card className="card-elevated border-0 shadow-indigo-100/30">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between bg-white/40">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Users className="h-4 w-4 text-indigo-500" />
            Recent Prospects
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/leads/add')}
            className="text-[11px] h-7 text-indigo-600 hover:bg-indigo-50"
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
                    className="group flex items-center gap-4 px-6 py-3.5 hover:bg-indigo-50/20 transition-all cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-black shadow-sm ring-2 ring-white ring-offset-0 group-hover:scale-110 transition-transform">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-indigo-600 transition-colors">
                        {lead.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" /> {lead.phone || 'No phone'}
                        </span>
                        {lead.category && (
                          <span className={`text-[9px] font-bold px-1.5 rounded uppercase border ${CATEGORY_COLORS[lead.category] || 'bg-slate-50 border-slate-100'}`}>
                            {lead.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[9px] px-2 py-0 border-none font-bold ${meta.light} ${meta.text}`}>
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
