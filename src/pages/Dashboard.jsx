import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const TONE_HEX = {
  sky: '#0ea5e9', orange: '#f97316', emerald: '#10b981',
  rose: '#f43f5e', amber: '#f59e0b', violet: '#8b5cf6',
};
const TONE_ICON_CLS = {
  sky: 'bg-sky-100 text-sky-600', orange: 'bg-orange-100 text-orange-600',
  emerald: 'bg-emerald-100 text-emerald-600', rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-600', violet: 'bg-violet-100 text-violet-600',
};

const FlowCurve = ({ color = '#0ea5e9', opacity = 0.13 }) => (
  <svg className="absolute bottom-0 left-0 w-full pointer-events-none" height="48" viewBox="0 0 400 48" preserveAspectRatio="none">
    <path d="M0,28 C50,12 110,42 180,24 C250,6 320,38 400,18 L400,48 L0,48 Z" fill={color} opacity={opacity} />
    <path d="M0,34 C70,18 140,44 220,28 C300,12 360,36 400,26 L400,48 L0,48 Z" fill={color} opacity={opacity * 0.6} />
  </svg>
);
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
  const isTeamHead = String(user?.role || '').toUpperCase() === 'TEAM_HEAD';
  const roleLabel = isTeamHead ? 'Team Head' : 'Agent';

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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

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
      key: 'reminders',
      label: 'Reminders',
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
    <div className="space-y-5 pb-6">
      {/* ── Greeting ── */}
      <div>
        <p className="text-[11px] text-slate-400 font-medium tracking-wide">{todayDateStr}</p>
        <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 mt-0.5 leading-snug">
          {greeting},{' '}
          <span className="text-cyan-700">{user?.name?.split(' ')[0] || roleLabel}</span>
        </h1>
        <span className="mt-1.5 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500 font-medium">
          {roleLabel} Dashboard
        </span>
      </div>

      {/* ── Quick Actions ── */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => navigate('/leads/add')} className="h-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-medium shadow-sm">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Lead
        </Button>
        <Button size="sm" onClick={() => navigate('/reminders')} className="h-9 rounded-full bg-white text-amber-700 border border-amber-200 hover:bg-amber-50 text-[11px] font-medium shadow-sm">
          <Clock className="h-3.5 w-3.5 mr-1" /> Reminders
        </Button>
        <Button size="sm" onClick={() => navigate('/all-contacts')} className="h-9 rounded-full bg-white text-cyan-700 border border-cyan-200 hover:bg-cyan-50 text-[11px] font-medium shadow-sm">
          <Users className="h-3.5 w-3.5 mr-1" /> Contacts
        </Button>
      </div>
      
      {/* ── Quick Find ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-800">Quick Find</p>
          <p className="text-[11px] text-slate-400">Search leads or browse by category</p>
        </div>
        <LeadSearchWidget />
        <div className="flex items-center gap-2 mt-3">
          <Select value={browseCat} onValueChange={setBrowseCat}>
            <SelectTrigger className="h-10 w-full rounded-xl bg-slate-50 border-slate-200 text-slate-700 text-sm focus:ring-cyan-200">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {LEAD_CATEGORY_VALUES.map((c) => (
                <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shrink-0"
            onClick={() => navigate(browseCat === 'ALL' ? '/leads' : `/leads?lead_category=${browseCat}`)}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <FlowCurve color="#8b5cf6" opacity={0.07} />
      </div>

      {/* ── Stat Cards with Flow Curves ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {snapshotRows.slice(0, 4).map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.key}
              onClick={() => navigate(row.nav)}
              className="relative overflow-hidden rounded-xl bg-white border border-slate-100 p-3 pb-12 cursor-pointer active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md hover:border-slate-200 group"
            >
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${
                row.tone === 'sky' ? 'from-sky-400 to-sky-500' :
                row.tone === 'orange' ? 'from-orange-400 to-orange-500' :
                row.tone === 'emerald' ? 'from-emerald-400 to-emerald-500' :
                row.tone === 'rose' ? 'from-rose-400 to-rose-500' :
                'from-amber-400 to-amber-500'
              }`} />
              
              {/* Icon */}
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${TONE_ICON_CLS[row.tone]}`}>
                <Icon className="h-4 w-4" />
              </div>
              
              {/* Number */}
              <p className="text-[22px] font-bold text-slate-900 mt-2.5 leading-none">
                {loading ? <Skeleton className="h-6 w-12 rounded" /> : fmtNum(row.value)}
              </p>
              
              {/* Label */}
              <p className="text-xs font-semibold text-slate-700 mt-1">{row.label}</p>
              
              {/* Hint */}
              <p className="text-[9px] text-slate-400 mt-0.5">{row.hint}</p>
              
              {/* Flow Curve */}
              <FlowCurve color={TONE_HEX[row.tone]} opacity={0.1} />
            </div>
          );
        })}
      </div>

      {/* ── Schedule + Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Schedule */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-semibold text-slate-800">Today's Schedule</p>
              {todayFollowups.length > 0 && (
                <Badge className="h-5 px-1.5 text-[10px] bg-violet-100 text-violet-700 border-none">
                  {todayFollowups.length}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/reminders')} className="text-[11px] h-7 text-violet-700 hover:bg-violet-50">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-96">
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
                  <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">All caught up!</p>
                  <p className="text-xs text-slate-400 mt-1">No pending follow-ups today.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
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
                        className={`group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 ${
                          isOverdue ? 'bg-rose-50/40' : ''
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
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {f.lead_name || 'Unnamed Lead'}
                            </p>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-md font-medium ${typeColors[f.followup_type] || typeColors.OTHER}`}>
                              {f.followup_type || 'REMINDER'}
                            </Badge>
                            {isOverdue && (
                              <Badge variant="outline" className="text-[8px] h-4 px-1 py-0 bg-slate-200 text-slate-800 border-slate-300/50">LATE</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {timeStr && (
                              <span className="text-[11px] font-medium flex items-center gap-1 text-slate-500">
                                <Clock className="h-3 w-3" /> {timeStr}
                              </span>
                            )}
                            {f.lead_phone && (
                              <a href={`tel:${f.lead_phone}`} className="text-[11px] font-medium flex items-center gap-1 text-slate-400 hover:text-slate-600">
                                <Phone className="h-3 w-3" /> {f.lead_phone}
                              </a>
                            )}
                          </div>
                          {f.notes && (
                            <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                              {f.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                            onClick={() => completeFollowup(f.id)}
                            disabled={isCompleting}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all"
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
          </div>
          <FlowCurve color="#8b5cf6" opacity={0.08} />
        </div>

        {/* Charts & Pipeline */}
        <div className="flex flex-col gap-4">
          {/* Call Analytics */}
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                <p className="text-sm font-semibold text-slate-800">Call Analytics</p>
              </div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">30 Days</span>
            </div>
            <div className="px-4 pt-4 pb-2">
              {loading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : callTrendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No trend data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={callTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
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
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 8px 20px -8px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 600, background: '#fff' }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="#0284c7" 
                      strokeWidth={2.5} 
                      fill="url(#callsGradient)" 
                      animationDuration={1200}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <FlowCurve color="#0ea5e9" opacity={0.08} />
          </div>

          {/* Pipeline */}
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-800">Pipeline</p>
            </div>
            <div className="space-y-4">
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
                          <span className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-700 transition-colors">
                            <item.icon className="h-3 w-3" /> {item.label}
                          </span>
                          <span className="text-slate-800 font-bold">{count}</span>
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
            </div>
            <FlowCurve color="#10b981" opacity={0.08} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
