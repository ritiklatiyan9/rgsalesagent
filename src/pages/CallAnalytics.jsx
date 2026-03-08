import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cachedGet } from '@/lib/queryCache';
import {
  BarChart3, Phone, TrendingUp, Clock, Target,
  Activity, Zap, Award, UserCheck, PhoneMissed, Calendar,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#64748b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6'];

const CallAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await cachedGet('/calls/analytics', { ttl: 60_000 });
        if (data.success) setAnalytics(data);
      } catch {} finally { setLoading(false); }
    };
    fetch();
  }, []);

  const metrics = analytics?.metrics ?? {};
  const dailyTrend = useMemo(() => {
    return (analytics?.dailyTrend ?? []).slice(-30).map((d) => ({
      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      calls: parseInt(d.count) || 0,
    }));
  }, [analytics]);

  const outcomeDist = useMemo(() => {
    return (analytics?.outcomeDistribution ?? []).map((d) => ({
      name: d.label || 'Unknown',
      value: parseInt(d.count) || 0,
    }));
  }, [analytics]);

  const totalCalls = metrics.total_calls ?? 0;
  const successfulCalls = metrics.successful_calls ?? 0;
  const successRate = totalCalls > 0 ? ((successfulCalls / totalCalls) * 100).toFixed(1) : 0;
  const avgDuration = metrics.avg_duration ? Math.round(metrics.avg_duration / 60) : 0;
  const conversions = metrics.conversions ?? 0;
  const conversionRate = totalCalls > 0 ? ((conversions / totalCalls) * 100).toFixed(1) : 0;

  const kpis = [
    { label: 'Total Calls', value: totalCalls.toLocaleString('en-IN'), icon: Phone, accent: 'border-l-indigo-500', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', subtitle: `${metrics.today_calls ?? 0} today` },
    { label: 'Success Rate', value: `${successRate}%`, icon: Award, accent: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', subtitle: `${successfulCalls} successful` },
    { label: 'Conv. Rate', value: `${conversionRate}%`, icon: Zap, accent: 'border-l-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', subtitle: `${conversions} conversions` },
    { label: 'Avg Duration', value: `${avgDuration}m`, icon: Clock, accent: 'border-l-violet-500', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', subtitle: 'per call' },
    { label: 'This Week', value: (metrics.week_calls ?? 0).toLocaleString('en-IN'), icon: Calendar, accent: 'border-l-rose-500', iconBg: 'bg-rose-50', iconColor: 'text-rose-600', subtitle: `Avg ${Math.round((metrics.week_calls ?? 0) / 7)}/day` },
    { label: 'Missed Calls', value: (metrics.missed_calls ?? 0).toLocaleString('en-IN'), icon: PhoneMissed, accent: 'border-l-red-500', iconBg: 'bg-red-50', iconColor: 'text-red-600', subtitle: `${((metrics.missed_calls ?? 0) / Math.max(totalCalls, 1) * 100).toFixed(1)}% ratio` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-xl flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" /> My Call Analytics
        </h1>
        <p className="page-subtitle mt-1">Detailed calling performance & conversion metrics</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ label, value, icon: Icon, accent, iconBg, iconColor, subtitle }) => (
          <div key={label} className={`stat-card border-l-4 ${accent} hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex-1">{label}</p>
              <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
            </div>
            {loading ? (
              <>
                <Skeleton className="h-8 w-20 rounded mb-2" />
                <Skeleton className="h-3 w-24 rounded" />
              </>
            ) : (
              <>
                <p className="text-2xl md:text-3xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Trend */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              <TrendingUp className="h-4 w-4 text-indigo-500 flex-shrink-0" /> 
              <span>Daily Calls Trend</span>
              <span className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">(last 30 days)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-3 md:px-6">
            {loading ? (
              <div className="h-64 md:h-52 bg-muted/20 rounded-lg animate-pulse" />
            ) : dailyTrend.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No call data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.floor(Math.max(0, dailyTrend.length / 5))} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} formatter={(v) => [v, 'Calls']} />
                  <Area type="monotone" dataKey="calls" stroke="#6366f1" strokeWidth={2} fill="url(#cg)" dot={false} activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Outcome Distribution */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500 flex-shrink-0" /> Outcome Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-3 md:px-6">
            {loading ? (
              <div className="h-64 md:h-52 bg-muted/20 rounded-lg animate-pulse" />
            ) : outcomeDist.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No call data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={outcomeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value" nameKey="name">
                    {outcomeDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Call Quality Metrics */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" /> Call Quality Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-6 flex-1 rounded-full" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <MetricBar label="Call Completion" value={successRate} color="gradient-indigo" />
              <MetricBar label="Lead Conversion" value={conversionRate} color="gradient-green" />
              <MetricBar label="Call Pickup Rate" value={metrics.pickup_rate ? metrics.pickup_rate.toFixed(1) : 0} color="gradient-amber" />
              <MetricBar label="Repeat Contact Rate" value={metrics.repeat_rate ? metrics.repeat_rate.toFixed(1) : 0} color="gradient-violet" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const MetricBar = ({ label, value, color }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="text-sm font-bold text-slate-900">{value}%</span>
    </div>
    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color === 'gradient-indigo' ? 'bg-gradient-to-r from-indigo-400 to-indigo-600' : color === 'gradient-green' ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : color === 'gradient-amber' ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-violet-400 to-violet-600'} transition-all duration-500`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  </div>
);

export default CallAnalytics;
