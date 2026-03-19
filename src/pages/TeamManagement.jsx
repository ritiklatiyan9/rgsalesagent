import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Users, UserCheck, Shield, Crown, TrendingUp, Phone,
  Target, DollarSign, Activity, Calendar, ArrowUpRight,
  BarChart3, Award, Zap, Clock, CheckCircle2, AlertCircle, UserPlus,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from 'recharts';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const ROLE_BADGE = { TEAM_HEAD: 'bg-violet-100 text-violet-700', AGENT: 'bg-blue-100 text-blue-700' };
const STATUS_COLORS = {
  NEW: '#6366f1', CONTACTED: '#06b6d4', INTERESTED: '#f59e0b',
  SITE_VISIT: '#8b5cf6', NEGOTIATION: '#f97316', BOOKED: '#10b981', LOST: '#ef4444',
};

const fmtINR = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '₹0';

const TeamManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [targets, setTargets] = useState([]);

  // Redirect non-team-heads
  useEffect(() => {
    if (user && user.role !== 'TEAM_HEAD') {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.team_id) { setLoading(false); return; }
      try {
        const [teamRes, perfRes, targetsRes] = await Promise.allSettled([
          api.get(`/teams/${user.team_id}`),
          api.get(`/teams/${user.team_id}/performance`),
          api.get(`/teams/${user.team_id}/targets`),
        ]);
        if (teamRes.status === 'fulfilled' && teamRes.value.data.success) {
          setTeam(teamRes.value.data.team);
          setMembers(teamRes.value.data.members || []);
        }
        if (perfRes.status === 'fulfilled' && perfRes.value.data.success) {
          setPerformance(perfRes.value.data.performance);
        }
        if (targetsRes.status === 'fulfilled' && targetsRes.value.data.success) {
          setTargets(targetsRes.value.data.targets || []);
        }
      } catch { toast.error('Failed to load team data'); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user]);

  // Use team.head_id to determine team head — role column is NOT updated by assignTeamHead
  const isHeadId = (memberId) => team?.head_id && String(team.head_id) === String(memberId);
  const teamHeadMember = members.find(m => isHeadId(m.id));
  const agentCount = members.filter(m => m.role === 'AGENT').length;
  const headCount = teamHeadMember ? 1 : 0;
  const activeCount = members.filter(m => m.is_active).length;

  // Current month target
  const now = new Date();
  const currentTarget = targets.find(t => t.month === now.getMonth() + 1 && t.year === now.getFullYear());

  const targetProgress = useMemo(() => {
    if (!currentTarget || !performance) return [];
    return [
      {
        name: 'Leads',
        target: Number(currentTarget.lead_target) || 0,
        actual: Number(currentTarget.actual_leads ?? performance.total_leads) || 0,
        fill: '#6366f1',
      },
      {
        name: 'Bookings',
        target: Number(currentTarget.booking_target) || 0,
        actual: Number(currentTarget.actual_bookings ?? performance.total_bookings) || 0,
        fill: '#10b981',
      },
      {
        name: 'Revenue',
        target: Number(currentTarget.revenue_target) || 0,
        actual: Number(currentTarget.actual_revenue ?? performance.total_revenue) || 0,
        fill: '#f59e0b',
      },
    ];
  }, [currentTarget, performance]);

  if (!loading && !user?.team_id) return (
    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
      <Crown className="h-10 w-10 mx-auto mb-3 text-slate-300" />
      <p className="text-slate-500 font-medium">You are not assigned to a team yet.</p>
      <p className="text-sm text-slate-400 mt-1">Contact your admin to be assigned.</p>
    </div>
  );

  if (!loading && user?.role !== 'TEAM_HEAD') return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title text-xl flex items-center gap-2">
            <Crown className="h-5 w-5 text-violet-600" />
            {loading ? 'Team Management' : `${team?.name || 'My Team'} — Management`}
          </h1>
          <p className="page-subtitle mt-1">
            Oversee your team, track targets & manage members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/team/manage/register-agent')}
            variant="outline"
            size="sm"
            className="gap-1.5 text-sm"
          >
            <UserPlus className="h-4 w-4" /> Agent Register
          </Button>
          <Button
            onClick={() => navigate('/team/performance')}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white gap-1.5 text-sm shadow-sm hover:shadow-md transition-shadow"
            size="sm"
          >
            <TrendingUp className="h-4 w-4" /> View Performance
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Members', value: loading ? '…' : members.length, icon: Users, accent: 'border-l-indigo-500', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
          { label: 'Agents', value: loading ? '…' : agentCount, icon: UserCheck, accent: 'border-l-blue-500', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
          { label: 'Active', value: loading ? '…' : activeCount, icon: Activity, accent: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Total Leads', value: loading ? '…' : (performance?.total_leads ?? '—'), icon: Target, accent: 'border-l-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
          { label: 'Bookings', value: loading ? '…' : (performance?.total_bookings ?? '—'), icon: CheckCircle2, accent: 'border-l-violet-500', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
          { label: 'Revenue', value: loading ? '…' : fmtINR(performance?.total_revenue), icon: DollarSign, accent: 'border-l-green-500', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
        ].map(({ label, value, icon: Icon, accent, iconBg, iconColor }) => (
          <div key={label} className={`stat-card border-l-4 ${accent} hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              <div className={`h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
              </div>
            </div>
            {loading ? <Skeleton className="h-7 w-16 rounded" /> : (
              <p className="text-xl font-bold tabular-nums truncate">{value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Target Progress + Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Target Progress */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              Monthly Target Progress
              <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : targetProgress.length === 0 || !currentTarget ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No targets set for this month.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Ask your admin to set monthly targets.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {targetProgress.map((item) => {
                  const pct = item.target > 0 ? Math.min((item.actual / item.target) * 100, 100) : 0;
                  const isRevenue = item.name === 'Revenue';
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {isRevenue ? fmtINR(item.actual) : item.actual} / {isRevenue ? fmtINR(item.target) : item.target}
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: item.fill }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">{pct.toFixed(1)}% achieved</span>
                        {item.target > 0 && item.actual < item.target && (
                          <span className="text-[10px] text-rose-500">
                            {isRevenue ? fmtINR(item.target - item.actual) : (item.target - item.actual)} remaining
                          </span>
                        )}
                        {item.actual >= item.target && item.target > 0 && (
                          <span className="text-[10px] text-emerald-600 font-medium">✓ Target achieved!</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Metrics */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Team Conversion Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'Lead → Booking Rate', value: `${performance?.conversion_rate ?? 0}%`, pct: Number(performance?.conversion_rate) || 0, color: '#6366f1' },
                  { label: 'Active Members Rate', value: `${members.length > 0 ? ((activeCount / members.length) * 100).toFixed(1) : 0}%`, pct: members.length > 0 ? (activeCount / members.length) * 100 : 0, color: '#10b981' },
                  { label: 'Avg Leads / Agent', value: agentCount > 0 ? Math.round((performance?.total_leads || 0) / agentCount) : '—', pct: Math.min((((performance?.total_leads || 0) / Math.max(agentCount, 1)) / 50) * 100, 100), color: '#f59e0b' },
                  { label: 'Avg Revenue / Agent', value: agentCount > 0 ? fmtINR(Math.round((performance?.total_revenue || 0) / agentCount)) : '—', pct: 75, color: '#8b5cf6' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600">{item.label}</span>
                      <span className="text-sm font-semibold">{item.value}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card className="card-elevated border-0 overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" />
            Team Members
            <Badge variant="secondary" className="ml-auto text-[10px]">{members.length} members</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b-border/40">
                  <TableHead className="pl-5 font-medium text-xs uppercase tracking-wider w-10">#</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Member</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Contact</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Role</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-5"><Skeleton className="h-4 w-5" /></TableCell>
                      <TableCell><div className="flex items-center gap-2.5"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-4 w-28" /></div></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-center">
                      <Users className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No members in this team yet.</p>
                    </TableCell>
                  </TableRow>
                ) : members.map((m, idx) => {
                  const mIsHead = isHeadId(m.id);
                  return (
                  <TableRow key={m.id} className={`hover:bg-muted/20 transition-colors border-b-border/30 ${mIsHead ? 'bg-violet-50/30' : m.id === user?.id ? 'bg-indigo-50/30' : ''}`}>
                    <TableCell className="pl-5 py-3 text-sm text-muted-foreground font-mono">{idx + 1}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                          mIsHead ? 'bg-violet-100' : m.id === user?.id ? 'bg-indigo-100' : 'bg-muted'
                        }`}>
                          {mIsHead ? (
                            <Crown className="h-4 w-4 text-violet-600" />
                          ) : (
                            <span className={`text-xs font-semibold ${m.id === user?.id ? 'text-indigo-700' : 'text-muted-foreground'}`}>
                              {m.name?.charAt(0)?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                          {m.id === user?.id && (
                            <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 ml-1.5">You</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground truncate max-w-[180px]">{m.email}</span>
                        {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {mIsHead ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-violet-100 text-violet-700">
                          <Crown className="h-3 w-3" /> Team Head
                        </span>
                      ) : (
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${ROLE_BADGE[m.role] || 'bg-muted text-muted-foreground'}`}>
                          {m.role}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md ${
                        m.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Targets History */}
      {targets.length > 0 && (
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" /> Targets History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-5 font-medium text-xs uppercase tracking-wider">Month</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Leads Target</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Leads Actual</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Bookings Target</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Bookings Actual</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Revenue Target</TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wider text-center">Revenue Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((t, idx) => {
                    const monthName = new Date(t.year, t.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                    return (
                      <TableRow key={idx} className="hover:bg-muted/20 transition-colors border-b-border/30">
                        <TableCell className="pl-5 py-3 text-sm font-medium">{monthName}</TableCell>
                        <TableCell className="py-3 text-sm text-center">{t.lead_target ?? 0}</TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className={Number(t.actual_leads) >= Number(t.lead_target) ? 'text-emerald-600 font-semibold' : 'text-rose-500'}>
                            {t.actual_leads ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center">{t.booking_target ?? 0}</TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className={Number(t.actual_bookings) >= Number(t.booking_target) ? 'text-emerald-600 font-semibold' : 'text-rose-500'}>
                            {t.actual_bookings ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-center">{fmtINR(t.revenue_target)}</TableCell>
                        <TableCell className="py-3 text-sm text-center">
                          <span className={Number(t.actual_revenue) >= Number(t.revenue_target) ? 'text-emerald-600 font-semibold' : 'text-rose-500'}>
                            {fmtINR(t.actual_revenue)}
                          </span>
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

export default TeamManagement;
