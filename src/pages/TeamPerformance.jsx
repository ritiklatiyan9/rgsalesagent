import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Users, Phone, Target, DollarSign, Award,
  Activity, Crown, Zap, CheckCircle2, ArrowLeft, RefreshCw,
  BarChart3, PhoneCall, UserCheck, Calendar, AlertCircle,
  TrendingDown, Flame, Star, Trophy,
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

const TeamPerformance = () => {
  const { user, isTeamHead } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(async (showRefresh = false) => {
    if (!user?.team_id) { setLoading(false); return; }
    if (showRefresh) setRefreshing(true);
    try {
      // Fetch both team info and members-performance in parallel
      const [teamRes, perfRes] = await Promise.all([
        api.get(`/teams/${user.team_id}`),
        api.get(`/teams/${user.team_id}/members-performance`),
      ]);
      
      if (teamRes.data.success && perfRes.data.success) {
        setData({
          ...perfRes.data,
          team: teamRes.data.team,
        });
      }
    } catch {
      toast.error('Failed to load team performance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const members = data?.members || [];
  const dailyTrend = data?.dailyTrend || [];
  const pipeline = data?.pipeline || [];
  const team = data?.team || {};

  // Enrich members with team head indicator (supports multiple heads)
  const headIdSet = useMemo(() => new Set((team?.heads || []).map(h => String(h.id))), [team?.heads]);
  const enrichedMembers = useMemo(() =>
    members.map(m => ({
      ...m,
      isTeamHead: headIdSet.has(String(m.id))
    }))
  , [members, headIdSet]);

  // Sort members by revenue for leaderboard
  const sortedByRevenue = useMemo(() =>
    [...enrichedMembers].sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
  , [enrichedMembers]);

  // Sort members by calls for call leader
  const sortedByCallCount = useMemo(() =>
    [...enrichedMembers].sort((a, b) => Number(b.total_calls || 0) - Number(a.total_calls || 0))
  , [enrichedMembers]);

  // Team aggregates
  const totals = useMemo(() => ({
    leads: members.reduce((s, m) => s + Number(m.total_leads || 0), 0),
    calls: members.reduce((s, m) => s + Number(m.total_calls || 0), 0),
    callsToday: members.reduce((s, m) => s + Number(m.calls_today || 0), 0),
    callsWeek: members.reduce((s, m) => s + Number(m.calls_this_week || 0), 0),
    bookings: members.reduce((s, m) => s + Number(m.total_bookings || 0), 0),
    revenue: members.reduce((s, m) => s + Number(m.total_revenue || 0), 0),
    followups: members.reduce((s, m) => s + Number(m.total_followups || 0), 0),
    completedFollowups: members.reduce((s, m) => s + Number(m.completed_followups || 0), 0),
  }), [members]);

  // Per-member chart data for bar charts
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

  // Daily trend formatted
  const trendData = useMemo(() =>
    dailyTrend.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      calls: d.calls,
      leads: d.leads,
    }))
  , [dailyTrend]);

  // Pipeline chart data
  const pipelineData = useMemo(() =>
    pipeline.map(p => ({
      name: STATUS_LABELS[p.status] || p.status,
      value: p.count,
      fill: STATUS_COLORS[p.status] || '#cbd5e1',
    }))
  , [pipeline]);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'members', label: 'Members Table', icon: Users },
  ];

  if (!loading && !user?.team_id) return (
    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
      <Crown className="h-10 w-10 mx-auto mb-3 text-slate-300" />
      <p className="text-slate-500 font-medium">You are not assigned to a team.</p>
    </div>
  );

  if (!loading && !isTeamHead) return (
    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
      <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
      <p className="text-slate-500 font-medium">Access denied.</p>
      <p className="text-sm text-slate-400 mt-1">Only team heads can view this page.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/team/manage')} className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-title text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-600" />
              {loading ? 'Team Performance' : `${data?.team_name || 'Team'} — Performance`}
            </h1>
            <p className="page-subtitle mt-0.5">Detailed analytics, charts & member performance breakdown</p>
          </div>
        </div>
        <Button
          onClick={() => fetchData(true)}
          variant="outline"
          size="sm"
          className="gap-1.5 text-sm"
          disabled={refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Members', value: fmtNum(members.length), icon: Users, accent: 'border-l-indigo-500', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
          { label: 'Total Leads', value: fmtNum(totals.leads), icon: Target, accent: 'border-l-blue-500', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
          { label: 'Total Calls', value: fmtNum(totals.calls), icon: Phone, accent: 'border-l-violet-500', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
          { label: 'Calls Today', value: fmtNum(totals.callsToday), icon: Flame, accent: 'border-l-rose-500', iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
          { label: 'This Week', value: fmtNum(totals.callsWeek), icon: Calendar, accent: 'border-l-cyan-500', iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600' },
          { label: 'Bookings', value: fmtNum(totals.bookings), icon: CheckCircle2, accent: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Revenue', value: fmtINR(totals.revenue), icon: DollarSign, accent: 'border-l-green-500', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
          { label: 'Follow-ups', value: fmtNum(totals.followups), icon: PhoneCall, accent: 'border-l-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
        ].map(({ label, value, icon: Icon, accent, iconBg, iconColor }) => (
          <div key={label} className={`stat-card border-l-4 ${accent} hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
              <div className={`h-7 w-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-3 w-3 ${iconColor}`} />
              </div>
            </div>
            {loading ? <Skeleton className="h-6 w-14 rounded" /> : (
              <p className="text-lg font-bold tabular-nums truncate">{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-muted-foreground hover:text-slate-700'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Calls + Leads Trend */}
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
                      <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
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

          {/* Per-agent bars + Pipeline pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Agent Leads vs Bookings */}
            <Card className="card-elevated border-0">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" /> Leads & Bookings per Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-2 md:px-5">
                {loading ? (
                  <div className="h-52 bg-muted/20 rounded-lg animate-pulse" />
                ) : agentLeadsData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No agent data</div>
                ) : (
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

            {/* Lead Pipeline Pie */}
            <Card className="card-elevated border-0">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" /> Lead Pipeline Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-2 md:px-5">
                {loading ? (
                  <div className="h-52 bg-muted/20 rounded-lg animate-pulse" />
                ) : pipelineData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No lead data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                        paddingAngle={2} dataKey="value" nameKey="name">
                        {pipelineData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Agent Calls Bar */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-violet-500" /> Call Activity per Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? (
                <div className="h-52 bg-muted/20 rounded-lg animate-pulse" />
              ) : agentLeadsData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No call data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={agentLeadsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="calls" name="Total Calls" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {agentLeadsData.map((entry, i) => (
                        <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── LEADERBOARD TAB ── */}
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
                        <div className="flex items-center justify-center w-6 shrink-0">
                          <MemberRankBadge rank={idx} />
                        </div>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {m.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-700 truncate">
                              {m.name}
                              {m.id === user?.id && <span className="text-[10px] ml-1 text-indigo-500">(You)</span>}
                            </span>
                            <span className="text-sm font-bold text-emerald-600 shrink-0">{fmtINR(m.total_revenue)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                              style={{ width: `${pct}%` }} />
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
                        <div className="flex items-center justify-center w-6 shrink-0">
                          <MemberRankBadge rank={idx} />
                        </div>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          idx === 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {m.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-700 truncate">
                              {m.name}
                              {m.id === user?.id && <span className="text-[10px] ml-1 text-indigo-500">(You)</span>}
                            </span>
                            <span className="text-sm font-bold text-rose-600 shrink-0">{fmtNum(m.total_calls)} calls</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-violet-500 transition-all"
                              style={{ width: `${pct}%` }} />
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

      {/* ── TRENDS TAB ── */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {/* Revenue per Agent */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" /> Revenue per Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? (
                <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
              ) : agentLeadsData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={agentLeadsData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }}
                      formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" name="Revenue" radius={[5, 5, 0, 0]} maxBarSize={48}>
                      {agentLeadsData.map((entry, i) => (
                        <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Calls + Leads daily trend */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" /> Daily Call & Lead Trend (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? (
                <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
              ) : trendData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No trend data</div>
              ) : (
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

      {/* ── MEMBERS TABLE TAB ── */}
      {activeTab === 'members' && (
        <Card className="card-elevated border-0 overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" /> Detailed Members Performance
              <Badge variant="secondary" className="ml-auto text-[10px]">{members.length} members</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-4 w-8 font-medium text-xs uppercase tracking-wider">#</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider">Agent</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Leads</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Booked</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Calls</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Today</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">This Week</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Avg Duration</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Bookings</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-right pr-4">Revenue</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Conv %</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Follow-ups</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(13)].map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : members.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={13} className="py-16 text-center">
                        <Users className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No member data yet.</p>
                      </TableCell>
                    </TableRow>
                  ) : members.map((m, idx) => {
                    const followupRate = m.total_followups > 0
                      ? ((m.completed_followups / m.total_followups) * 100).toFixed(0)
                      : 0;
                    return (
                      <TableRow key={m.id} className={`hover:bg-muted/20 transition-colors border-b-border/30 ${m.id === user?.id ? 'bg-violet-50/30' : ''}`}>
                        <TableCell className="pl-4 py-3 text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                              m.isTeamHead ? 'bg-violet-100 text-violet-700' :
                              m.id === user?.id ? 'bg-indigo-100 text-indigo-700' : 'bg-muted text-muted-foreground'
                            }`}>
                              {m.isTeamHead ? <Crown className="h-3.5 w-3.5" /> : m.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium">{m.name}</span>
                                {m.id === user?.id && <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">You</span>}
                              </div>
                              <span className={`text-[10px] font-medium ${m.is_active ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {m.is_active ? '● Active' : '● Inactive'}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center font-medium">{fmtNum(m.total_leads)}</TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className={`font-medium ${m.booked_leads > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {fmtNum(m.booked_leads)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center font-medium">{fmtNum(m.total_calls)}</TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className={`font-medium ${m.calls_today > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                            {fmtNum(m.calls_today)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center">{fmtNum(m.calls_this_week)}</TableCell>
                        <TableCell className="py-3 text-sm text-center text-muted-foreground">{fmtDur(m.avg_call_duration)}</TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className={`font-medium ${m.total_bookings > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {fmtNum(m.total_bookings)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-right pr-4 font-semibold text-emerald-700">
                          {fmtINR(m.total_revenue)}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            Number(m.conversion_rate) >= 10 ? 'bg-emerald-50 text-emerald-700' :
                            Number(m.conversion_rate) >= 5 ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {m.conversion_rate}%
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className="text-muted-foreground">{fmtNum(m.completed_followups)}/{fmtNum(m.total_followups)}</span>
                          <div className="text-[10px] text-muted-foreground/70">{followupRate}% done</div>
                        </TableCell>
                        <TableCell className="py-3 text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs rounded-lg gap-1 text-violet-600 hover:bg-violet-50"
                              onClick={() => navigate(`/team/member/${m.id}/calls`)}
                            >
                              <Phone className="h-3 w-3" />
                              Calls
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs rounded-lg gap-1 text-indigo-600 hover:bg-indigo-50"
                              onClick={() => navigate(`/team/member/${m.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamPerformance;
