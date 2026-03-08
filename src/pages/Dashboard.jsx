import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import api from '@/lib/axios';
import { format, isToday, parseISO } from 'date-fns';
import {
  Target, Calendar, PhoneCall,
  Activity, Plus, ArrowRight, Flame,
  BarChart2, CheckCircle2, Clock, AlertCircle,
  BellRing, Check, AlarmClock, Phone,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const fmtNum = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];
const LEAD_STATUS_META = {
  NEW:         { label: 'New',         color: 'bg-sky-500',     light: 'bg-sky-50',     text: 'text-sky-700'     },
  CONTACTED:   { label: 'Contacted',   color: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700'    },
  INTERESTED:  { label: 'Interested',  color: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-700'   },
  SITE_VISIT:  { label: 'Site Visit',  color: 'bg-orange-500',  light: 'bg-orange-50',  text: 'text-orange-700'  },
  NEGOTIATION: { label: 'Negotiation', color: 'bg-purple-500',  light: 'bg-purple-50',  text: 'text-purple-700'  },
  BOOKED:      { label: 'Booked',      color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
  LOST:        { label: 'Lost',        color: 'bg-rose-400',    light: 'bg-rose-50',    text: 'text-rose-700'    },
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
  const [fupActionLoading, setFupActionLoading] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFollowupsSections = async () => {
    try {
      const res = await cachedGet('/followups?limit=200', { ttl: 30_000 });
      if (res?.success) {
        const allFups = res.followups || res.data || [];
        setAllFollowups(allFups);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Today's & Overdue
        const today = allFups.filter((f) => {
          if (!f.scheduled_at || (f.status !== 'PENDING' && f.status !== 'SNOOZED')) return false;
          try { return parseISO(f.scheduled_at) <= endOfToday; } catch { return false; }
        });
        today.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
        setTodayFollowups(today);

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
      const [leadsRes, calls, counts] = await Promise.allSettled([
        cachedGet('/leads?limit=100', { ttl: 60_000 }),
        cachedGet('/calls/analytics', { ttl: 60_000 }),
        cachedGet('/followups/counts', { ttl: 30_000 }),
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
      await api.put(`/followups/${id}/snooze`, { snooze_until });
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

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const callMetrics = callAnalytics?.metrics ?? {};
  const totalCalls = callMetrics?.total_calls ?? 0;
  const todayCalls = callMetrics?.today_calls ?? 0;
  const weekCalls = callMetrics?.week_calls ?? 0;

  // Removed financial info: totalCollected, totalBookings

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
        // Handle both Date objects and ISO strings from database
        const dateObj = d.date instanceof Date ? d.date : new Date(d.date);
        if (isNaN(dateObj.getTime())) {
          console.warn('Invalid date:', d.date);
          return null;
        }
        return {
          date: dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          calls: Number(d.count) || 0,
        };
      } catch (err) {
        console.warn('Error parsing trend data:', d, err);
        return null;
      }
    }).filter(Boolean);
  }, [callAnalytics]);

  return (
    <div className="space-y-4 sm:space-y-6 pt-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title text-xl">Welcome back, {user?.name || 'Agent'} 👋</h1>
          <p className="page-subtitle flex items-center gap-1.5 mt-1">
            <Calendar className="h-3.5 w-3.5" />
            {today}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300"
            onClick={() => navigate('/leads/add')}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Lead
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700"
            onClick={() => navigate('/calls/log')}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Log Call
          </Button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <div className="stat-card border-l-4 border-l-sky-500 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/leads')}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">My Leads</p>
                <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center">
                  <Target className="h-4 w-4 text-sky-600" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{fmtNum(leadTotal)}</p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <span className="inline-flex items-center gap-0.5 text-sky-600 font-medium">
                  <Activity className="h-3 w-3" />
                  {fmtNum(pipeline.NEW)} new · {fmtNum(pipeline.INTERESTED)} interested
                </span>
              </p>
            </div>

            <div className="stat-card border-l-4 border-l-orange-500 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/calls')}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">My Calls</p>
                <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center">
                  <PhoneCall className="h-4 w-4 text-orange-600" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{fmtNum(totalCalls)}</p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="text-orange-600 font-medium">{fmtNum(todayCalls)} today · {fmtNum(weekCalls)} this week</span>
              </p>
            </div>

            <div className="stat-card border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/reminders')}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reminders</p>
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{followupCounts?.scheduled ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <BarChart2 className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 font-medium">{followupCounts?.today ?? 0} due today</span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Follow-up Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: 'Scheduled Follow-ups', value: followupCounts?.scheduled ?? 0, icon: Clock, accent: 'border-l-emerald-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', nav: '/calls/scheduled' },
          { label: 'Missed Follow-ups', value: followupCounts?.missed ?? 0, icon: AlertCircle, accent: 'border-l-red-400', iconBg: 'bg-red-50', iconColor: 'text-red-600', nav: '/calls/missed' },
          { label: "Today's Follow-ups", value: followupCounts?.today ?? 0, icon: Calendar, accent: 'border-l-amber-400', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
          { label: 'Leads Booked', value: pipeline.BOOKED ?? 0, icon: CheckCircle2, accent: 'border-l-teal-400', iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
        ].map(({ label, value, icon: Icon, accent, iconBg, iconColor, nav }) => (
          <div key={label} className={`stat-card border-l-4 ${accent} py-3 ${nav ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={nav ? () => navigate(nav) : undefined}>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-6 w-10 rounded" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
                </div>
                <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Today's Follow-ups */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <BellRing className="h-4 w-4 text-amber-500" />
            Today's & Overdue Follow-ups
            {followupCounts.today > 0 || todayFollowups.length > 0 ? (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                {todayFollowups.length || followupCounts.today}
              </Badge>
            ) : null}
          </CardTitle>
          <button onClick={() => navigate('/reminders')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            All reminders <ArrowRight className="h-3 w-3" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-3 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-36 rounded" />
                    <Skeleton className="h-2.5 w-24 rounded" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : todayFollowups.length === 0 ? (
            <div className="py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground">No pending follow-ups</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {todayFollowups.map((f) => {
                const scheduledDate = f.scheduled_at ? parseISO(f.scheduled_at) : null;
                const isOverdue = scheduledDate && scheduledDate < new Date() && !isToday(scheduledDate);
                const timeStr = scheduledDate ? format(scheduledDate, 'MMM dd, hh:mm a') : null;
                const isCompleting = fupActionLoading === f.id + '_complete';
                const isSnoozingItem = fupActionLoading === f.id + '_snooze';
                const typeColors = {
                  CALL: 'bg-blue-50 text-blue-700',
                  FOLLOWUP: 'bg-indigo-50 text-indigo-700',
                  SITE_VISIT: 'bg-orange-50 text-orange-700',
                  MEETING: 'bg-purple-50 text-purple-700',
                  OTHER: 'bg-slate-100 text-slate-600',
                };
                return (
                  <div key={f.id} className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 hover:bg-muted/20 transition-colors ${isOverdue ? 'bg-red-50/40' : ''}`}>
                    <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-50' : 'bg-amber-50'}`}>
                      <BellRing className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{f.lead_name || 'Unknown'}</p>
                        <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 border-0 ${typeColors[f.followup_type] || typeColors.OTHER}`}>
                          {f.followup_type?.replace('_', ' ')}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 border-0 bg-red-100 text-red-700">Overdue</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {f.lead_phone && (
                          <a href={`tel:${f.lead_phone}`} className="text-[11px] text-muted-foreground hover:text-blue-600 flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />{f.lead_phone}
                          </a>
                        )}
                        {timeStr && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />{timeStr}
                          </span>
                        )}
                      </div>
                      {f.notes && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{f.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <Button size="sm" variant="ghost"
                        className="h-7 px-1.5 sm:px-2 text-[11px] text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        onClick={() => completeFollowup(f.id)}
                        disabled={!!fupActionLoading}
                      >
                        {isCompleting ? <Skeleton className="h-3 w-12" /> : <><Check className="h-3 w-3 mr-0.5 sm:mr-1" /><span className="hidden sm:inline">Done</span></>}
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-7 px-1.5 sm:px-2 text-[11px] text-slate-600 hover:bg-slate-100"
                        onClick={() => snoozeFollowup(f.id)}
                        disabled={!!fupActionLoading}
                      >
                        {isSnoozingItem ? <Skeleton className="h-3 w-14" /> : <><AlarmClock className="h-3 w-3 mr-0.5 sm:mr-1" /><span className="hidden sm:inline">Snooze</span></>}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Missed Reminders */}
      {missedFollowups.length > 0 && (
        <Card className="card-elevated border-0 border-l-4 border-l-red-500">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Missed Reminders
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                {missedFollowups.length}
              </Badge>
            </CardTitle>
            <button onClick={() => navigate('/reminders')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
              {missedFollowups.slice(0, 5).map((f) => {
                const scheduledDate = f.scheduled_at ? parseISO(f.scheduled_at) : null;
                const daysOverdue = scheduledDate ? Math.floor((Date.now() - new Date(scheduledDate)) / (24 * 60 * 60 * 1000)) : 0;
                const typeColors = {
                  CALL: 'bg-blue-50 text-blue-700',
                  FOLLOWUP: 'bg-indigo-50 text-indigo-700',
                  SITE_VISIT: 'bg-orange-50 text-orange-700',
                  MEETING: 'bg-purple-50 text-purple-700',
                  OTHER: 'bg-slate-100 text-slate-600',
                };
                return (
                  <div key={f.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 bg-red-50/30 hover:bg-red-50/60 transition-colors">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{f.lead_name || 'Unknown'}</p>
                        <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 border-0 ${typeColors[f.followup_type] || typeColors.OTHER}`}>
                          {f.followup_type?.replace('_', ' ')}
                        </Badge>
                        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-red-100 text-red-700">{daysOverdue}d overdue</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {f.lead_phone && (
                          <a href={`tel:${f.lead_phone}`} className="text-[11px] text-muted-foreground hover:text-blue-600 flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />{f.lead_phone}
                          </a>
                        )}
                        {scheduledDate && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />{format(scheduledDate, 'MMM dd, hh:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost"
                      className="h-7 px-2 text-[11px] text-red-700 hover:bg-red-100"
                      onClick={() => completeFollowup(f.id)}
                      disabled={!!fupActionLoading}
                    >
                      {fupActionLoading === f.id + '_complete' ? <Skeleton className="h-3 w-12" /> : <><Check className="h-3 w-3 mr-1" />Complete</>}
                    </Button>
                  </div>
                );
              })}
            </div>
            {missedFollowups.length > 5 && (
              <div className="px-5 py-2 text-center text-xs text-muted-foreground border-t">
                +{missedFollowups.length - 5} more missed followups
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Calls Trend */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <PhoneCall className="h-4 w-4 text-orange-500" />
              Calls Trend
              <span className="text-[10px] font-normal text-muted-foreground">(last 30 days)</span>
            </CardTitle>
            <button onClick={() => navigate('/calls/analytics')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Full analytics <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-44 bg-muted/20 rounded-lg animate-pulse" />
            ) : callTrendData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No call data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart data={callTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.floor(callTrendData.length / 6)} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v) => [v, 'Calls']} />
                  <Area type="monotone" dataKey="calls" stroke="#f97316" strokeWidth={2} fill="url(#callsGrad)" dot={false} activeDot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Lead Pipeline */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              My Lead Pipeline
            </CardTitle>
            <button onClick={() => navigate('/leads')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5">
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-5 flex-1 rounded-full" />
                  <Skeleton className="h-3 w-8 rounded" />
                </div>
              ))
            ) : (
              LEAD_STATUSES.map((status) => {
                const meta = LEAD_STATUS_META[status];
                const count = pipeline[status] ?? 0;
                const pct = maxPipelineCount > 0 ? (count / maxPipelineCount) * 100 : 0;
                return (
                  <div key={status} className="flex items-center gap-3 group">
                    <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{meta.label}</span>
                    <div className="flex-1 h-5 rounded-full bg-muted/50 overflow-hidden">
                      <div className={`h-full rounded-full ${meta.color} transition-all duration-500`} style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} />
                    </div>
                    <span className={`text-xs font-bold tabular-nums w-6 text-right ${meta.text}`}>{count}</span>
                  </div>
                );
              })
            )}
            {!loading && (
              <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total: <strong className="text-foreground">{fmtNum(leadTotal)}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reminders Status Chart */}
      {remindersStatusData.length > 0 && (
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              Reminders Status
            </CardTitle>
            <button onClick={() => navigate('/reminders')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View details <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <Skeleton className="h-64 rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={remindersStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {remindersStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Leads */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Target className="h-4 w-4 text-muted-foreground" />
            Recent Leads
          </CardTitle>
          <button onClick={() => navigate('/leads/add')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            <Plus className="h-3 w-3" /> Add Lead
          </button>
        </CardHeader>
        <CardContent className="pt-3 p-0">
          {loading ? (
            <div className="px-6 py-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-2.5 w-20 rounded" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No leads yet — add your first lead!</div>
          ) : (
            <div className="divide-y divide-border/30">
              {recentLeads.map((lead) => {
                const meta = LEAD_STATUS_META[lead.status] ?? { label: lead.status, light: 'bg-muted', text: 'text-muted-foreground' };
                const initials = (lead.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={lead.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-muted/20 transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{lead.phone || lead.email || '—'}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.light} ${meta.text}`}>
                      {meta.label}
                    </span>
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
