import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Users, Phone, Target, DollarSign, Award,
  Activity, Crown, CheckCircle2, RefreshCw,
  BarChart3, PhoneCall, Calendar, AlertCircle,
  Flame, Star, Trophy, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, ComposedChart,
} from 'recharts';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
const MEMBER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
const STATUS_LABELS = {
  NEW: 'New', CONTACTED: 'Contacted', INTERESTED: 'Interested',
  SITE_VISIT: 'Site Visit', NEGOTIATION: 'Negotiation', BOOKED: 'Booked', LOST: 'Lost',
};
const STATUS_COLORS = {
  NEW: '#6366f1', CONTACTED: '#06b6d4', INTERESTED: '#f59e0b',
  SITE_VISIT: '#8b5cf6', NEGOTIATION: '#f97316', BOOKED: '#10b981', LOST: '#ef4444',
};

const fmtINR = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0';
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDur = (sec) => sec ? `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s` : '—';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border/40 rounded-xl p-3 shadow-lg text-xs min-w-[120px]">
      <p className="font-medium text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold text-slate-800">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const MemberRankBadge = ({ rank }) => {
  if (rank === 0) return <Trophy className="h-4 w-4 text-amber-500" />;
  if (rank === 1) return <Star className="h-4 w-4 text-slate-400" />;
  if (rank === 2) return <Award className="h-4 w-4 text-amber-700" />;
  return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rank + 1}</span>;
};

/* ── Member Card for the Members tab ── */
const MemberCard = ({ m, user, navigate }) => {
  const convPct = Math.min(100, Number(m.conversion_rate || 0));
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
      {/* Top accent bar */}
      <div className={`h-1 ${m.isTeamHead
        ? 'bg-linear-to-r from-blue-500 to-indigo-600'
        : 'bg-linear-to-r from-indigo-400 to-blue-500'}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            m.isTeamHead ? 'bg-blue-100 border-blue-200' : 'bg-indigo-100 border-indigo-200'
          }`}>
            {m.isTeamHead
              ? <Crown className="h-5 w-5 text-blue-700" />
              : <span className="text-lg font-bold text-indigo-700">{m.name?.charAt(0)?.toUpperCase()}</span>
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[14px] font-bold text-slate-900 truncate leading-snug">{m.name}</p>
              {String(m.id) === String(user?.id) && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">You</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {m.isTeamHead ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Crown className="h-2.5 w-2.5" /> Head
                </span>
              ) : (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Agent</span>
              )}
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                m.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}>
                {m.is_active ? '● Active' : '● Inactive'}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate(`/team/member/${m.id}`)}
            className="h-8 w-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center active:bg-slate-100 transition-colors shrink-0"
          >
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Mini stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Today', value: fmtNum(m.calls_today), color: 'text-rose-600', bg: 'bg-rose-50' },
            { label: 'Calls', value: fmtNum(m.total_calls), color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Leads', value: fmtNum(m.total_leads), color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Booked', value: fmtNum(m.total_bookings), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-xl p-2.5 text-center`}>
              <p className={`text-[16px] font-bold tabular-nums leading-none ${stat.color}`}>{stat.value}</p>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Conversion rate bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1.5">
            <span>Conversion Rate</span>
            <span className="font-bold text-slate-700">{m.conversion_rate}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-indigo-400 to-blue-500 transition-all duration-500"
              style={{ width: `${convPct}%` }}
            />
          </div>
        </div>

        {/* Revenue row */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-[11px] text-slate-500 font-medium">Revenue</span>
          <span className="text-[13px] font-bold text-emerald-700">{fmtINR(m.total_revenue)}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/team/member/${m.id}/calls`)}
            className="flex-1 h-10 rounded-xl bg-blue-50 text-blue-700 text-[12px] font-bold flex items-center justify-center gap-1.5 active:bg-blue-100 transition-colors border border-blue-100"
          >
            <Phone className="h-3.5 w-3.5" /> Call History
          </button>
          <button
            onClick={() => navigate(`/team/member/${m.id}`)}
            className="flex-1 h-10 rounded-xl bg-indigo-50 text-indigo-700 text-[12px] font-bold flex items-center justify-center gap-1.5 active:bg-indigo-100 transition-colors border border-indigo-100"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Performance
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   Main Component
═══════════════════════════════════════════ */
const TeamPerformance = () => {
  const { user, isTeamHead, isTeamHeadLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async (showRefresh = false) => {
    if (!user?.team_id) { setLoading(false); return; }
    if (showRefresh) setRefreshing(true);
    try {
      const [teamRes, perfRes] = await Promise.all([
        api.get(`/teams/${user.team_id}`),
        api.get(`/teams/${user.team_id}/members-performance`),
      ]);
      if (teamRes.data.success && perfRes.data.success) {
        setData({ ...perfRes.data, team: teamRes.data.team });
      }
    } catch {
      toast.error('Failed to load team performance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const members    = data?.members    || [];
  const dailyTrend = data?.dailyTrend || [];
  const pipeline   = data?.pipeline   || [];
  const team       = data?.team       || {};

  const headIdSet = useMemo(() => new Set((team?.heads || []).map(h => String(h.id))), [team?.heads]);
  const enrichedMembers = useMemo(() =>
    members.map(m => ({ ...m, isTeamHead: headIdSet.has(String(m.id)) }))
  , [members, headIdSet]);

  const sortedByRevenue = useMemo(() =>
    [...enrichedMembers].sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
  , [enrichedMembers]);

  const sortedByCallCount = useMemo(() =>
    [...enrichedMembers].sort((a, b) => Number(b.total_calls || 0) - Number(a.total_calls || 0))
  , [enrichedMembers]);

  const totals = useMemo(() => ({
    leads:             members.reduce((s, m) => s + Number(m.total_leads || 0), 0),
    calls:             members.reduce((s, m) => s + Number(m.total_calls || 0), 0),
    callsToday:        members.reduce((s, m) => s + Number(m.calls_today || 0), 0),
    callsWeek:         members.reduce((s, m) => s + Number(m.calls_this_week || 0), 0),
    bookings:          members.reduce((s, m) => s + Number(m.total_bookings || 0), 0),
    revenue:           members.reduce((s, m) => s + Number(m.total_revenue || 0), 0),
    followups:         members.reduce((s, m) => s + Number(m.total_followups || 0), 0),
    completedFollowups:members.reduce((s, m) => s + Number(m.completed_followups || 0), 0),
  }), [members]);

  const agentLeadsData = useMemo(() =>
    enrichedMembers.filter(m => !m.isTeamHead).map((m, i) => ({
      name: m.name?.split(' ')[0] || `Agent ${i+1}`,
      leads: Number(m.total_leads || 0),
      bookings: Number(m.total_bookings || 0),
      calls: Number(m.total_calls || 0),
      revenue: Number(m.total_revenue || 0),
      fill: MEMBER_COLORS[i % MEMBER_COLORS.length],
    }))
  , [enrichedMembers]);

  const trendData = useMemo(() =>
    dailyTrend.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      calls: d.calls,
      leads: d.leads,
    }))
  , [dailyTrend]);

  const pipelineData = useMemo(() =>
    pipeline.map(p => ({
      name: STATUS_LABELS[p.status] || p.status,
      value: p.count,
      fill: STATUS_COLORS[p.status] || '#cbd5e1',
    }))
  , [pipeline]);

  const TABS = [
    { id: 'overview',    label: 'Overview',  icon: Activity  },
    { id: 'members',     label: 'Members',   icon: Users     },
    { id: 'leaderboard', label: 'Leaders',   icon: Trophy    },
    { id: 'trends',      label: 'Trends',    icon: TrendingUp },
    { id: 'stats',       label: 'Stats',     icon: BarChart3 },
  ];

  /* ── Guards ── */
  if (!loading && !user?.team_id) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
        <Crown className="h-8 w-8 text-slate-300" />
      </div>
      <p className="text-[15px] font-bold text-slate-700">Not assigned to a team</p>
      <p className="text-[12px] text-slate-400 mt-1.5 max-w-[260px]">Contact your admin to be added to a team.</p>
    </div>
  );

  if (!loading && !isTeamHead && !isTeamHeadLoading) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-slate-300" />
      </div>
      <p className="text-[15px] font-bold text-slate-700">Access denied</p>
      <p className="text-[12px] text-slate-400 mt-1.5">Only team heads can view this page.</p>
    </div>
  );

  return (
    <div className="space-y-5 pb-8">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 to-blue-700 p-4 shadow-lg">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5.5 w-5.5 text-white" />
            </div>
            <div>
              {loading ? (
                <>
                  <Skeleton className="h-5 w-36 rounded bg-white/20 mb-1.5" />
                  <Skeleton className="h-3 w-24 rounded bg-white/15" />
                </>
              ) : (
                <>
                  <p className="text-[17px] font-extrabold text-white leading-tight">
                    {team?.name || 'Team'} Dashboard
                  </p>
                  <p className="text-[11px] text-indigo-200 font-medium mt-0.5">
                    {members.length} member{members.length !== 1 ? 's' : ''} · Performance overview
                  </p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-9 w-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center active:bg-white/25 transition-colors shrink-0"
          >
            <RefreshCw className={`h-4 w-4 text-white ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* KPI summary row */}
        <div className="relative z-10 grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Calls Today', value: fmtNum(totals.callsToday) },
            { label: 'Total Calls', value: fmtNum(totals.calls) },
            { label: 'Total Leads', value: fmtNum(totals.leads) },
            { label: 'Bookings', value: fmtNum(totals.bookings) },
          ].map(stat => (
            <div key={stat.label} className="bg-white/10 rounded-xl p-2.5 text-center border border-white/10">
              {loading
                ? <Skeleton className="h-5 w-10 mx-auto rounded bg-white/20 mb-1" />
                : <p className="text-[18px] font-extrabold text-white tabular-nums leading-none">{stat.value}</p>
              }
              <p className="text-[9px] text-indigo-200 font-semibold uppercase tracking-wide mt-1 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Revenue badge */}
        {!loading && (
          <div className="relative z-10 mt-3 inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1">
            <DollarSign className="h-3 w-3 text-emerald-300" />
            <span className="text-[11px] font-bold text-white">{fmtINR(totals.revenue)}</span>
            <span className="text-[10px] text-indigo-200">total revenue</span>
          </div>
        )}

        {/* BG blobs */}
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-fuchsia-400/20 blur-2xl pointer-events-none" />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 h-10 pl-3 pr-4 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Team Activity — Last 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-3 md:px-6">
              {loading ? (
                <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
              ) : trendData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No activity data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={trendData} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor(trendData.length / 6))} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="calls" name="Calls" stroke="#6366f1" strokeWidth={2}
                      fill="url(#callsGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="leads" name="New Leads" stroke="#10b981" strokeWidth={2}
                      dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-elevated border-0">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" /> Leads & Bookings per Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-2 md:px-5">
                {loading ? <div className="h-52 bg-muted/20 rounded-lg animate-pulse" /> :
                  agentLeadsData.length === 0 ? <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No agent data</div> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={agentLeadsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="leads" name="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="bookings" name="Bookings" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="card-elevated border-0">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" /> Lead Pipeline Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-2 md:px-5">
                {loading ? <div className="h-52 bg-muted/20 rounded-lg animate-pulse" /> :
                  pipelineData.length === 0 ? <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No lead data</div> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                        paddingAngle={2} dataKey="value" nameKey="name">
                        {pipelineData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-indigo-500" /> Call Activity per Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? <div className="h-52 bg-muted/20 rounded-lg animate-pulse" /> :
                agentLeadsData.length === 0 ? <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No call data</div> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={agentLeadsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="calls" name="Total Calls" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {agentLeadsData.map((entry, i) => <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════
          MEMBERS TAB
      ══════════════════════════════ */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          {/* Team summary row */}
          {!loading && (
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Total Members', value: members.length, icon: Users, bg: 'bg-indigo-50', color: 'text-indigo-600' },
                { label: 'Active', value: members.filter(m => m.is_active).length, icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                { label: 'Calls Today', value: fmtNum(totals.callsToday), icon: Flame, bg: 'bg-rose-50', color: 'text-rose-600' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center gap-1.5">
                  <div className={`h-8 w-8 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <p className="text-[18px] font-extrabold text-slate-800 leading-none tabular-nums">{stat.value}</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Member cards */}
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-100 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-14 rounded-xl" />)}
                </div>
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            ))
          ) : enrichedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-[13px] font-semibold text-slate-500">No members yet</p>
            </div>
          ) : (
            enrichedMembers.map(m => (
              <MemberCard key={m.id} m={m} user={user} navigate={navigate} />
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════
          LEADERBOARD TAB
      ══════════════════════════════ */}
      {activeTab === 'leaderboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Leaderboard */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Revenue Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
              ) : sortedByRevenue.filter(m => m.role !== 'TEAM_HEAD').length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No data</div>
              ) : (
                <div className="space-y-3">
                  {sortedByRevenue.filter(m => m.role !== 'TEAM_HEAD').map((m, idx) => {
                    const maxRev = sortedByRevenue[0]?.total_revenue || 1;
                    const pct = maxRev > 0 ? (Number(m.total_revenue) / Number(maxRev)) * 100 : 0;
                    return (
                      <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${idx === 0 ? 'bg-amber-50 border border-amber-100' : 'bg-muted/20'}`}>
                        <div className="flex items-center justify-center w-6 shrink-0"><MemberRankBadge rank={idx} /></div>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {m.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-700 truncate">
                              {m.name}{m.id === user?.id && <span className="text-[10px] ml-1 text-indigo-500">(You)</span>}
                            </span>
                            <span className="text-sm font-bold text-emerald-600 shrink-0">{fmtINR(m.total_revenue)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-linear-to-r from-amber-400 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[10px] text-muted-foreground">{m.total_bookings} bookings</span>
                            <span className="text-[10px] text-muted-foreground">{m.total_leads} leads</span>
                            <span className="text-[10px] text-muted-foreground">{m.conversion_rate}% conv.</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Volume Leaderboard */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-rose-500" /> Call Activity Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
              ) : sortedByCallCount.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No data</div>
              ) : (
                <div className="space-y-3">
                  {sortedByCallCount.map((m, idx) => {
                    const maxCalls = sortedByCallCount[0]?.total_calls || 1;
                    const pct = maxCalls > 0 ? (Number(m.total_calls) / Number(maxCalls)) * 100 : 0;
                    return (
                      <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${idx === 0 ? 'bg-rose-50 border border-rose-100' : 'bg-muted/20'}`}>
                        <div className="flex items-center justify-center w-6 shrink-0"><MemberRankBadge rank={idx} /></div>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${idx === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                          {m.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-700 truncate">
                              {m.name}{m.id === user?.id && <span className="text-[10px] ml-1 text-indigo-500">(You)</span>}
                            </span>
                            <span className="text-sm font-bold text-rose-600 shrink-0">{fmtNum(m.total_calls)} calls</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-linear-to-r from-rose-400 to-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[10px] text-muted-foreground">{m.calls_today} today</span>
                            <span className="text-[10px] text-muted-foreground">{m.calls_this_week} this week</span>
                            <span className="text-[10px] text-muted-foreground">~{fmtDur(m.avg_call_duration)} avg</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════
          TRENDS TAB
      ══════════════════════════════ */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" /> Revenue per Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? <div className="h-64 bg-muted/20 rounded-lg animate-pulse" /> :
                agentLeadsData.length === 0 ? <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data</div> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={agentLeadsData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDashboard="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }}
                      formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                    <Bar dataKey="revenue" name="Revenue" radius={[5, 5, 0, 0]} maxBarSize={48}>
                      {agentLeadsData.map((entry, i) => <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" /> Daily Call & Lead Trend (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? <div className="h-64 bg-muted/20 rounded-lg animate-pulse" /> :
                trendData.length === 0 ? <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No trend data</div> : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={trendData} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor(trendData.length / 6))} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="calls" name="Calls" stroke="#6366f1" strokeWidth={2}
                      fill="url(#cg2)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Bar dataKey="leads" name="New Leads" fill="#10b981" fillOpacity={0.7} maxBarSize={8} radius={[2, 2, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════
          STATS TAB (detailed table)
      ══════════════════════════════ */}
      {activeTab === 'stats' && (
        <Card className="card-elevated border-0 overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" /> Detailed Members Performance
              <Badge variant="secondary" className="ml-auto text-[10px]">{members.length} members</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    {['#','Agent','Leads','Booked','Calls','Today','This Wk','Avg Dur','Bookings','Revenue','Conv %','Follow-ups','Action'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>{[...Array(13)].map((_, j) => (
                        <td key={j} className="px-3 py-2"><Skeleton className="h-4 w-full rounded" /></td>
                      ))}</tr>
                    ))
                  ) : members.length === 0 ? (
                    <tr><td colSpan={13} className="py-16 text-center">
                      <Users className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No member data yet.</p>
                    </td></tr>
                  ) : members.map((m, idx) => {
                    const followupRate = m.total_followups > 0
                      ? ((m.completed_followups / m.total_followups) * 100).toFixed(0) : 0;
                    return (
                      <tr key={m.id} className={`hover:bg-muted/20 border-b border-border/30 transition-colors ${m.id === user?.id ? 'bg-indigo-50/30' : ''}`}>
                        <td className="px-3 py-3 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                              m.isTeamHead ? 'bg-blue-100 text-blue-700' :
                              m.id === user?.id ? 'bg-indigo-100 text-indigo-700' : 'bg-muted text-muted-foreground'
                            }`}>
                              {m.isTeamHead ? <Crown className="h-3 w-3" /> : m.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[12px]">{m.name}</p>
                              <p className={`text-[9px] font-medium ${m.is_active ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {m.is_active ? '● Active' : '● Inactive'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-center">{fmtNum(m.total_leads)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`font-medium ${m.booked_leads > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{fmtNum(m.booked_leads)}</span>
                        </td>
                        <td className="px-3 py-3 font-medium text-center">{fmtNum(m.total_calls)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`font-medium ${m.calls_today > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>{fmtNum(m.calls_today)}</span>
                        </td>
                        <td className="px-3 py-3 text-center">{fmtNum(m.calls_this_week)}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{fmtDur(m.avg_call_duration)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`font-medium ${m.total_bookings > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{fmtNum(m.total_bookings)}</span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-emerald-700 text-right">{fmtINR(m.total_revenue)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            Number(m.conversion_rate) >= 10 ? 'bg-emerald-50 text-emerald-700' :
                            Number(m.conversion_rate) >= 5 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'
                          }`}>{m.conversion_rate}%</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-muted-foreground">{fmtNum(m.completed_followups)}/{fmtNum(m.total_followups)}</span>
                          <div className="text-[9px] text-muted-foreground/70">{followupRate}% done</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => navigate(`/team/member/${m.id}/calls`)}
                              className="h-7 px-2 rounded-lg text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center gap-1">
                              <Phone className="h-3 w-3" /> Calls
                            </button>
                            <button onClick={() => navigate(`/team/member/${m.id}`)}
                              className="h-7 px-2 rounded-lg text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamPerformance;
