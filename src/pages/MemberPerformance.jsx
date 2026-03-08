import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, RefreshCw, Phone, Target, Users, CheckCircle2,
  Flame, Calendar, Clock, TrendingUp, Crown, Activity,
  PhoneCall, AlertCircle, BarChart3, Award, Zap, List,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadialBarChart, RadialBar, Legend,
} from 'recharts';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const MEMBER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDur = (sec) => {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border/40 rounded-xl p-3 shadow-lg text-xs min-w-[120px]">
      <p className="font-medium text-slate-700 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold text-slate-800">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// Horizontal progress bar with label
const ProgressBar = ({ label, value, max, color = '#6366f1', description }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">{fmtNum(value)}{description && <span className="text-slate-400 ml-1">/ {fmtNum(max)} {description}</span>}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// Big stat card with accent left-border
const StatCard = ({ label, value, icon: Icon, accent, iconBg, iconColor, sub, loading }) => (
  <div className={`stat-card border-l-4 ${accent} hover:shadow-md transition-shadow`}>
    <div className="flex items-start justify-between mb-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
      <div className={`h-7 w-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>
    </div>
    {loading ? (
      <Skeleton className="h-7 w-16 rounded" />
    ) : (
      <>
        <p className="text-xl font-bold tabular-nums truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </>
    )}
  </div>
);

const MemberPerformance = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { user, isTeamHead } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [member, setMember] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [teamName, setTeamName] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user?.team_id) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [teamRes, perfRes] = await Promise.all([
        api.get(`/teams/${user.team_id}`),
        api.get(`/teams/${user.team_id}/members-performance`),
      ]);

      if (teamRes.data.success) setTeamName(teamRes.data.team?.name || '');

      if (perfRes.data.success) {
        const members = perfRes.data.members || [];
        setAllMembers(members);
        const found = members.find((m) => String(m.id) === String(memberId));
        if (!found) {
          toast.error('Member not found in your team');
          navigate('/team/performance');
        } else {
          setMember(found);
        }
      }
    } catch {
      toast.error('Failed to load member performance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, memberId, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Team-wide max values for progress bars
  const teamMaxes = useMemo(() => ({
    leads: Math.max(...allMembers.map((m) => Number(m.total_leads || 0)), 1),
    calls: Math.max(...allMembers.map((m) => Number(m.total_calls || 0)), 1),
    bookings: Math.max(...allMembers.map((m) => Number(m.total_bookings || 0)), 1),
    followups: Math.max(...allMembers.map((m) => Number(m.total_followups || 0)), 1),
  }), [allMembers]);

  // vs-team comparison chart
  const comparisonData = useMemo(() => {
    if (!member || allMembers.length < 2) return [];
    const agents = allMembers.filter((m) => String(m.id) !== String(memberId));
    const teamAvgLeads = agents.reduce((s, m) => s + Number(m.total_leads || 0), 0) / Math.max(agents.length, 1);
    const teamAvgCalls = agents.reduce((s, m) => s + Number(m.total_calls || 0), 0) / Math.max(agents.length, 1);
    const teamAvgBookings = agents.reduce((s, m) => s + Number(m.total_bookings || 0), 0) / Math.max(agents.length, 1);
    return [
      { metric: 'Leads', member: Number(member.total_leads || 0), teamAvg: Math.round(teamAvgLeads) },
      { metric: 'Calls', member: Number(member.total_calls || 0), teamAvg: Math.round(teamAvgCalls) },
      { metric: 'Bookings', member: Number(member.total_bookings || 0), teamAvg: Math.round(teamAvgBookings) },
    ];
  }, [member, allMembers, memberId]);

  // Rank in team
  const rank = useMemo(() => {
    if (!member) return null;
    const sorted = [...allMembers].sort((a, b) => Number(b.total_leads || 0) - Number(a.total_leads || 0));
    const idx = sorted.findIndex((m) => String(m.id) === String(memberId));
    return idx >= 0 ? idx + 1 : null;
  }, [allMembers, member, memberId]);

  // Guard
  if (!loading && !isTeamHead) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500 font-medium">Access denied.</p>
        <p className="text-sm text-slate-400 mt-1">Only team heads can view member performance.</p>
      </div>
    );
  }

  const followupPct = member?.total_followups > 0
    ? ((Number(member.completed_followups) / Number(member.total_followups)) * 100).toFixed(0)
    : 0;

  const convRate = parseFloat(member?.conversion_rate || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/team/performance')}
            className="h-8 w-8 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {loading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-40 rounded" />
                <Skeleton className="h-3.5 w-28 rounded" />
              </div>
            ) : (
              <>
                <h1 className="page-title text-xl flex items-center gap-2">
                  {member?.is_active
                    ? <Activity className="h-5 w-5 text-emerald-500" />
                    : <AlertCircle className="h-5 w-5 text-rose-400" />}
                  {member?.name || 'Member'} — Performance
                </h1>
                <p className="page-subtitle mt-0.5 flex items-center gap-2">
                  {teamName}
                  {rank && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                      <Award className="h-3 w-3" /> #{rank} in team
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!loading && member && (
            <>
              <Badge
                variant="outline"
                className={`text-xs ${member.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}
              >
                {member.is_active ? '● Active' : '● Inactive'}
              </Badge>
              {member.isTeamHead && (
                <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 gap-1">
                  <Crown className="h-2.5 w-2.5" /> Team Head
                </Badge>
              )}
            </>
          )}
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard loading={loading} label="Total Leads" value={fmtNum(member?.total_leads)} icon={Target}
          accent="border-l-blue-500" iconBg="bg-blue-50" iconColor="text-blue-600"
          sub={`${fmtNum(member?.booked_leads)} booked`} />
        <StatCard loading={loading} label="Total Calls" value={fmtNum(member?.total_calls)} icon={Phone}
          accent="border-l-violet-500" iconBg="bg-violet-50" iconColor="text-violet-600"
          sub={fmtDur(member?.avg_call_duration) + ' avg'} />
        <StatCard loading={loading} label="Calls Today" value={fmtNum(member?.calls_today)} icon={Flame}
          accent="border-l-rose-500" iconBg="bg-rose-50" iconColor="text-rose-600"
          sub={`${fmtNum(member?.calls_this_week)} this week`} />
        <StatCard loading={loading} label="Bookings" value={fmtNum(member?.total_bookings)} icon={CheckCircle2}
          accent="border-l-emerald-500" iconBg="bg-emerald-50" iconColor="text-emerald-600"
          sub={`${fmtNum(member?.completed_bookings)} completed`} />
        <StatCard loading={loading} label="Conversion" value={`${convRate}%`} icon={TrendingUp}
          accent="border-l-indigo-500" iconBg="bg-indigo-50" iconColor="text-indigo-600"
          sub="leads → bookings" />
        <StatCard loading={loading} label="Follow-ups" value={fmtNum(member?.total_followups)} icon={PhoneCall}
          accent="border-l-amber-500" iconBg="bg-amber-50" iconColor="text-amber-600"
          sub={`${fmtNum(member?.completed_followups)} done`} />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT — Performance Breakdown */}
        <div className="lg:col-span-1 space-y-4">
          {/* Progress Bars vs Team */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" /> Activity vs Team Best
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {loading ? (
                [...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)
              ) : (
                <>
                  <ProgressBar label="Leads" value={Number(member?.total_leads || 0)} max={teamMaxes.leads} color="#6366f1" description="team best" />
                  <ProgressBar label="Calls" value={Number(member?.total_calls || 0)} max={teamMaxes.calls} color="#8b5cf6" description="team best" />
                  <ProgressBar label="Bookings" value={Number(member?.total_bookings || 0)} max={teamMaxes.bookings} color="#10b981" description="team best" />
                  <ProgressBar label="Follow-ups" value={Number(member?.total_followups || 0)} max={teamMaxes.followups} color="#f59e0b" description="team best" />
                </>
              )}
            </CardContent>
          </Card>

          {/* Conversion Rate Ring */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> Conversion & Follow-up Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="30%"
                    outerRadius="90%"
                    barSize={14}
                    data={[
                      { name: 'Conversion', value: Math.min(convRate, 100), fill: '#6366f1' },
                      { name: 'Follow-up Done', value: Math.min(Number(followupPct), 100), fill: '#10b981' },
                    ]}
                  >
                    <RadialBar minAngle={5} background dataKey="value" cornerRadius={6} />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      formatter={(value, entry) => (
                        <span style={{ color: '#64748b' }}>
                          {value}: <strong style={{ color: entry?.payload?.fill }}>{Number(entry?.payload?.value || 0).toFixed(1)}%</strong>
                        </span>
                      )}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }}
                      formatter={(val) => [`${Number(val).toFixed(1)}%`]}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Summary */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <List className="h-4 w-4 text-slate-500" /> Quick Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-5 w-full rounded" />)}</div>
              ) : (
                <dl className="space-y-3">
                  {[
                    { label: 'Avg Call Duration', value: fmtDur(member?.avg_call_duration) },
                    { label: 'Calls This Week', value: fmtNum(member?.calls_this_week) },
                    { label: 'Booked Leads', value: fmtNum(member?.booked_leads) },
                    { label: 'Completed Bookings', value: fmtNum(member?.completed_bookings) },
                    { label: 'Follow-up Completion', value: `${followupPct}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-semibold text-slate-700 tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* vs Team Average */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" /> {loading ? 'Member vs Team Average' : `${member?.name?.split(' ')[0]} vs Team Average`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? (
                <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
              ) : comparisonData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Not enough data</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={comparisonData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="member" name={member?.name?.split(' ')[0] || 'Member'} fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="teamAvg" name="Team Avg" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* All members comparison */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-500" /> Leads — All Members Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? (
                <div className="h-52 bg-muted/20 rounded-lg animate-pulse" />
              ) : allMembers.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={allMembers.map((m, i) => ({
                      name: m.name?.split(' ')[0] || `M${i + 1}`,
                      leads: Number(m.total_leads || 0),
                      calls: Number(m.total_calls || 0),
                      isThis: String(m.id) === String(memberId),
                    }))}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="leads" name="Leads" radius={[4, 4, 0, 0]} maxBarSize={36}>
                      {allMembers.map((m, i) => (
                        <Cell
                          key={i}
                          fill={String(m.id) === String(memberId) ? '#6366f1' : '#cbd5e1'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Call Activity Comparison */}
          <Card className="card-elevated border-0">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4 text-violet-500" /> Calls — All Members Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-2 md:px-5">
              {loading ? (
                <div className="h-52 bg-muted/20 rounded-lg animate-pulse" />
              ) : allMembers.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={allMembers.map((m, i) => ({
                      name: m.name?.split(' ')[0] || `M${i + 1}`,
                      calls: Number(m.total_calls || 0),
                      today: Number(m.calls_today || 0),
                    }))}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={65} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="calls" name="Total Calls" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {allMembers.map((m, i) => (
                        <Cell
                          key={i}
                          fill={String(m.id) === String(memberId) ? '#8b5cf6' : '#e2e8f0'}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="today" name="Today" radius={[0, 4, 4, 0]} maxBarSize={20} fill="#f59e0b" fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* All members at a glance */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" /> Full Team Overview
            <Badge variant="secondary" className="ml-auto text-[10px]">{allMembers.length} members</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : (
            <div className="space-y-2">
              {[...allMembers]
                .sort((a, b) => Number(b.total_leads || 0) - Number(a.total_leads || 0))
                .map((m, idx) => {
                  const isThis = String(m.id) === String(memberId);
                  const maxLeads = teamMaxes.leads;
                  const pct = maxLeads > 0 ? (Number(m.total_leads || 0) / maxLeads) * 100 : 0;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                        isThis
                          ? 'bg-indigo-50 border border-indigo-200 shadow-sm'
                          : 'bg-muted/20 hover:bg-muted/40 border border-transparent'
                      }`}
                      onClick={() => !isThis && navigate(`/team/member/${m.id}`)}
                    >
                      <span className="text-xs font-mono text-muted-foreground w-5 text-center shrink-0">{idx + 1}</span>
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isThis ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {m.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-sm font-medium truncate ${isThis ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {m.name}
                          </span>
                          {isThis && <Badge className="text-[9px] px-1.5 py-0 bg-indigo-100 text-indigo-700 border-indigo-200">Viewing</Badge>}
                          {String(m.id) === String(user?.id) && !isThis && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-600">(You)</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: isThis ? '#6366f1' : MEMBER_COLORS[idx % MEMBER_COLORS.length] + '80' }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-xs font-semibold tabular-nums text-slate-700">{fmtNum(m.total_leads)} leads</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{fmtNum(m.total_calls)} calls</p>
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

export default MemberPerformance;
