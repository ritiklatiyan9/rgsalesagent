import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft, Phone, Clock, Users, Target, CalendarDays,
  RefreshCw, CheckCircle2, BarChart3, AlertCircle, TrendingUp,
  Flame,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const formatDuration = (seconds) => {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-indigo-600 font-bold">{payload[0]?.value} calls</p>
    </div>
  );
};

const StatTile = ({ label, value, icon: Icon, bg, iconColor, valueColor, sub, loading }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className={`h-7 w-7 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>
    </div>
    {loading ? (
      <Skeleton className="h-7 w-14 rounded" />
    ) : (
      <div>
        <p className={`text-[22px] font-extrabold tabular-nums leading-none ${valueColor || 'text-slate-800'}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 font-medium mt-1">{sub}</p>}
      </div>
    )}
  </div>
);

const MemberCallAnalytics = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { user, isTeamHead } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [memberInfo, setMemberInfo] = useState(null);
  const [allTimeSummary, setAllTimeSummary] = useState(null);
  const [dailyChart, setDailyChart] = useState([]);

  useEffect(() => {
    if (!isTeamHead || !user?.team_id) { setLoading(false); return; }
    const fetchMemberInfo = async () => {
      try {
        const { data: res } = await api.get(`/teams/${user.team_id}/members-performance`);
        if (res.success) {
          const member = (res.members || []).find(m => String(m.id) === String(memberId));
          if (member) setMemberInfo(member);
          else { toast.error('Member not found in your team'); navigate('/team/performance'); }
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    fetchMemberInfo();
  }, [isTeamHead, user, memberId, navigate]);

  useEffect(() => {
    if (!isTeamHead) return;
    api.get(`/calls/agent/${memberId}/details?page=1&limit=1`)
      .then(({ data: res }) => { if (res.success) setAllTimeSummary(res.summary); })
      .catch(() => {});
  }, [isTeamHead, memberId]);

  useEffect(() => {
    if (!isTeamHead) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    api.get(`/calls/agent/${memberId}/details?date_from=${thirtyDaysAgo.toISOString().split('T')[0]}&page=1&limit=1000`)
      .then(({ data: res }) => {
        if (!res.success || !res.calls) return;
        const grouped = {};
        res.calls.forEach(c => {
          const key = new Date(c.call_start).toISOString().split('T')[0];
          const label = new Date(c.call_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          if (!grouped[key]) grouped[key] = { date: label, sortKey: key, calls: 0 };
          grouped[key].calls += 1;
        });
        setDailyChart(Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey)));
      })
      .catch(() => {});
  }, [isTeamHead, memberId]);

  const handleRefresh = useCallback(async () => {
    if (!isTeamHead) return;
    setRefreshing(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const [sumRes, dailyRes] = await Promise.all([
        api.get(`/calls/agent/${memberId}/details?page=1&limit=1`),
        api.get(`/calls/agent/${memberId}/details?date_from=${thirtyDaysAgo.toISOString().split('T')[0]}&page=1&limit=1000`),
      ]);
      if (sumRes.data.success) setAllTimeSummary(sumRes.data.summary);
      if (dailyRes.data.success && dailyRes.data.calls) {
        const grouped = {};
        dailyRes.data.calls.forEach(c => {
          const key = new Date(c.call_start).toISOString().split('T')[0];
          const label = new Date(c.call_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          if (!grouped[key]) grouped[key] = { date: label, sortKey: key, calls: 0 };
          grouped[key].calls += 1;
        });
        setDailyChart(Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey)));
      }
    } catch { toast.error('Refresh failed'); }
    finally { setRefreshing(false); }
  }, [isTeamHead, memberId]);

  // Guard AFTER all hooks
  if (!isTeamHead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-[15px] font-bold text-slate-700">Access Denied</p>
        <p className="text-[12px] text-slate-400 mt-1.5">Only team heads can view this page.</p>
      </div>
    );
  }

  const s = allTimeSummary || {};
  const initials = (memberInfo?.name || '?').charAt(0).toUpperCase();
  const peakDay = dailyChart.reduce((best, d) => d.calls > (best?.calls || 0) ? d : best, null);

  return (
    <div className="space-y-4 pb-8">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 to-blue-700 p-4 shadow-md">
        {/* Back + Refresh row */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(`/team/member/${memberId}`)}
            className="h-8 w-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center active:bg-white/25 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center active:bg-white/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-white ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Member identity */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-14 w-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
            {memberInfo?.profile_photo ? (
              <img src={memberInfo.profile_photo} alt={memberInfo.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <span className="text-2xl font-extrabold text-white">{loading ? '?' : initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <>
                <Skeleton className="h-5 w-32 rounded bg-white/20 mb-1.5" />
                <Skeleton className="h-3 w-24 rounded bg-white/15" />
              </>
            ) : (
              <>
                <p className="text-[17px] font-extrabold text-white leading-tight truncate">
                  {memberInfo?.name || 'Member'}
                </p>
                <p className="text-[11px] text-blue-100/80 font-medium mt-0.5 truncate">
                  {memberInfo?.email || 'Call Analytics'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Today + Total highlight */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 border border-white/20 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="h-3.5 w-3.5 text-orange-300" />
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Today</p>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-10 rounded mx-auto bg-white/20" />
            ) : (
              <p className="text-[32px] font-extrabold text-white leading-none tabular-nums">{fmtNum(s.today_calls)}</p>
            )}
          </div>
          <div className="bg-white/15 border border-white/20 rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Phone className="h-3.5 w-3.5 text-blue-200" />
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Total</p>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-10 rounded mx-auto bg-white/20" />
            ) : (
              <p className="text-[32px] font-extrabold text-white leading-none tabular-nums">{fmtNum(s.total_calls)}</p>
            )}
          </div>
        </div>

        {/* Decorative wave */}
        <svg className="absolute bottom-0 left-0 w-full pointer-events-none" height="20" viewBox="0 0 400 20" preserveAspectRatio="none">
          <path d="M0,12 C80,2 200,18 320,6 C380,0 400,8 400,8 L400,20 L0,20 Z" fill="#fff" opacity="0.05" />
        </svg>
      </div>

      {/* ── Stat Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile loading={!allTimeSummary} label="This Week" value={fmtNum(s.week_calls)}
          icon={CalendarDays} bg="bg-emerald-50" iconColor="text-emerald-600" valueColor="text-emerald-700"
          sub="calls in last 7 days" />
        <StatTile loading={!allTimeSummary} label="Avg Duration" value={formatDuration(s.avg_duration)}
          icon={Clock} bg="bg-amber-50" iconColor="text-amber-600" valueColor="text-amber-700"
          sub={`Total: ${formatDuration(s.total_duration)}`} />
        <StatTile loading={!allTimeSummary} label="Unique Leads" value={fmtNum(s.unique_leads_called)}
          icon={Users} bg="bg-blue-50" iconColor="text-blue-600" valueColor="text-blue-700"
          sub={`Assigned: ${fmtNum(s.assigned_leads)}`} />
        <StatTile loading={!allTimeSummary} label="Visits Booked" value={fmtNum(s.visits_scheduled)}
          icon={Target} bg="bg-cyan-50" iconColor="text-cyan-600" valueColor="text-cyan-700" />
        <StatTile loading={!allTimeSummary} label="Closings" value={fmtNum(s.closed)}
          icon={CheckCircle2} bg="bg-rose-50" iconColor="text-rose-600" valueColor="text-rose-700" />
        <StatTile loading={!allTimeSummary} label="Peak Day" value={peakDay?.calls ?? '—'}
          icon={TrendingUp} bg="bg-indigo-50" iconColor="text-indigo-600" valueColor="text-indigo-700"
          sub={peakDay?.date || 'no data'} />
      </div>

      {/* ── Daily Chart ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-800 leading-tight">Calls Per Day</p>
            <p className="text-[10px] text-slate-400 font-medium">Last 30 days</p>
          </div>
        </div>
        <div className="px-2 py-4">
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 8, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(dailyChart.length / 7))}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#eef2ff', radius: 4 }} />
                <Bar dataKey="calls" name="Calls" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <BarChart3 className="h-8 w-8 text-slate-200" />
              <p className="text-[12px] text-slate-400 font-medium">No call data in last 30 days</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default MemberCallAnalytics;
