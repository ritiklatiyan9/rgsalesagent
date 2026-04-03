import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft, Phone, Clock, Users, Target, CalendarDays,
  ChevronLeft, ChevronRight, RefreshCw, Timer, CheckCircle,
  PhoneOutgoing, PhoneIncoming, PhoneMissed, Hash, BarChart3,
  Calendar, AlertCircle, Crown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const CallTypeIcon = ({ type }) => {
  if (type === 'INCOMING') return <PhoneIncoming className="h-3.5 w-3.5 text-green-600" />;
  if (type === 'MISSED') return <PhoneMissed className="h-3.5 w-3.5 text-red-500" />;
  return <PhoneOutgoing className="h-3.5 w-3.5 text-blue-600" />;
};

const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

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

const MemberCallAnalytics = () => {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { user, isTeamHead } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [memberInfo, setMemberInfo] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // Guard: only team heads
  if (!isTeamHead) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500 font-medium">Access denied.</p>
        <p className="text-sm text-slate-400 mt-1">Only team heads can view member call analytics.</p>
      </div>
    );
  }

  // Fetch member info
  useEffect(() => {
    const fetchMemberInfo = async () => {
      if (!user?.team_id) return;
      try {
        const { data: res } = await api.get(`/teams/${user.team_id}/members-performance`);
        if (res.success) {
          const member = (res.members || []).find(m => String(m.id) === String(memberId));
          if (member) setMemberInfo(member);
          else {
            toast.error('Member not found in your team');
            navigate('/team/performance');
          }
        }
      } catch { /* ignore */ }
    };
    fetchMemberInfo();
  }, [user, memberId, navigate]);

  const fetchCallDetails = useCallback(async (p = 1, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', p);
      params.set('limit', '25');

      if (selectedDate && !dateFrom && !dateTo) {
        params.set('date_from', `${selectedDate}T00:00:00`);
        params.set('date_to', `${selectedDate}T23:59:59`);
      } else {
        if (dateFrom) params.set('date_from', `${dateFrom}T00:00:00`);
        if (dateTo) params.set('date_to', `${dateTo}T23:59:59`);
      }

      const { data: res } = await api.get(`/calls/agent/${memberId}/details?${params}`);
      if (res.success) {
        setData(res);
        setPage(p);
      }
    } catch {
      toast.error('Failed to load call details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [memberId, selectedDate, dateFrom, dateTo]);

  useEffect(() => {
    fetchCallDetails(1);
  }, [fetchCallDetails]);

  // All-time summary
  const [allTimeSummary, setAllTimeSummary] = useState(null);
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { data: res } = await api.get(`/calls/agent/${memberId}/details?page=1&limit=1`);
        if (res.success) setAllTimeSummary(res.summary);
      } catch { /* ignore */ }
    };
    fetchSummary();
  }, [memberId]);

  // Daily calls chart
  const [dailyChart, setDailyChart] = useState([]);
  useEffect(() => {
    const fetchDaily = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const params = new URLSearchParams();
        params.set('date_from', thirtyDaysAgo.toISOString().split('T')[0]);
        params.set('page', '1');
        params.set('limit', '1000');
        const { data: res } = await api.get(`/calls/agent/${memberId}/details?${params}`);
        if (res.success && res.calls) {
          const grouped = {};
          res.calls.forEach(c => {
            const d = new Date(c.call_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const key = new Date(c.call_start).toISOString().split('T')[0];
            if (!grouped[key]) grouped[key] = { date: d, sortKey: key, calls: 0, duration: 0 };
            grouped[key].calls += 1;
            grouped[key].duration += Number(c.duration_seconds || 0);
          });
          const sorted = Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
          setDailyChart(sorted);
        }
      } catch { /* ignore */ }
    };
    fetchDaily();
  }, [memberId]);

  const summary = data?.summary || allTimeSummary || {};
  const calls = data?.calls || [];
  const pagination = data?.pagination || { total: 0, page: 1, totalPages: 1 };

  const sourceColor = {
    WEB: 'bg-blue-50 text-blue-700 border-blue-200',
    APP: 'bg-green-50 text-green-700 border-green-200',
    MANUAL: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  const handleDateClick = (dateKey) => {
    setDateFrom('');
    setDateTo('');
    setSelectedDate(dateKey);
  };

  const handleRangeApply = () => {
    setSelectedDate('');
    fetchCallDetails(1);
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/team/member/${memberId}`)} className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-title text-xl flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-violet-700">
                  {memberInfo?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              {memberInfo?.name || 'Member'} — Call Analytics
            </h1>
            <p className="page-subtitle mt-0.5">
              {memberInfo?.email} • Detailed call logs & daily breakdown
            </p>
          </div>
        </div>
        <Button onClick={() => fetchCallDetails(page, true)} variant="outline" size="sm"
          className="gap-1.5 text-sm" disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Separator />

      {/* All-time Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard loading={!allTimeSummary} label="Total Calls" value={fmtNum(allTimeSummary?.total_calls)}
          icon={Phone} accent="border-l-indigo-500" iconBg="bg-indigo-50" iconColor="text-indigo-600"
          sub={`Today: ${fmtNum(allTimeSummary?.today_calls)}`} />
        <StatCard loading={!allTimeSummary} label="This Week" value={fmtNum(allTimeSummary?.week_calls)}
          icon={CalendarDays} accent="border-l-emerald-500" iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard loading={!allTimeSummary} label="Avg Duration" value={formatDuration(allTimeSummary?.avg_duration)}
          icon={Clock} accent="border-l-amber-500" iconBg="bg-amber-50" iconColor="text-amber-600"
          sub={`Total: ${formatDuration(allTimeSummary?.total_duration)}`} />
        <StatCard loading={!allTimeSummary} label="Unique Leads" value={fmtNum(allTimeSummary?.unique_leads_called)}
          icon={Users} accent="border-l-violet-500" iconBg="bg-violet-50" iconColor="text-violet-600"
          sub={`Assigned: ${fmtNum(allTimeSummary?.assigned_leads)}`} />
        <StatCard loading={!allTimeSummary} label="Visits Scheduled" value={fmtNum(allTimeSummary?.visits_scheduled)}
          icon={Target} accent="border-l-cyan-500" iconBg="bg-cyan-50" iconColor="text-cyan-600" />
        <StatCard loading={!allTimeSummary} label="Closings" value={fmtNum(allTimeSummary?.closed)}
          icon={CheckCircle} accent="border-l-rose-500" iconBg="bg-rose-50" iconColor="text-rose-600" />
      </div>

      {/* Daily Calls Chart */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Calls Per Day — Last 30 Days
            <span className="text-xs font-normal text-muted-foreground ml-1">(tap a bar to view that day)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 px-2 md:px-5">
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyChart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" opacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  interval={Math.max(0, Math.floor(dailyChart.length / 8))} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls" name="Calls" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={20}
                  cursor="pointer"
                  onClick={(data) => data?.sortKey && handleDateClick(data.sortKey)} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              No daily data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Filter */}
      <Card className="card-elevated border-0">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> Filter by Date
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Select Date</Label>
              <Input type="date" className="h-9 w-[155px] text-xs" value={selectedDate}
                onChange={(e) => { setDateFrom(''); setDateTo(''); setSelectedDate(e.target.value); }} />
            </div>

            <div className="text-xs text-muted-foreground self-center px-1">or</div>

            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground">From</Label>
              <Input type="date" className="h-9 w-[140px] text-xs" value={dateFrom}
                onChange={(e) => { setSelectedDate(''); setDateFrom(e.target.value); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold uppercase text-muted-foreground">To</Label>
              <Input type="date" className="h-9 w-[140px] text-xs" value={dateTo}
                onChange={(e) => { setSelectedDate(''); setDateTo(e.target.value); }} />
            </div>
            <Button size="sm" onClick={handleRangeApply}
              className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs">
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={handleClearFilters} className="h-9 text-xs">
              Today
            </Button>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            {selectedDate ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                <CalendarDays className="h-3 w-3" />
                Showing: {formatDate(selectedDate)}
              </span>
            ) : dateFrom || dateTo ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                <CalendarDays className="h-3 w-3" />
                Range: {dateFrom ? formatDate(dateFrom) : 'Start'} → {dateTo ? formatDate(dateTo) : 'End'}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Call counts */}
      {!loading && (
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1.5">
            <Hash className="h-3 w-3" /> {pagination.total} calls found
          </Badge>
          {calls.length > 0 && (
            <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1.5">
              <Timer className="h-3 w-3" />
              Total: {formatDuration(calls.reduce((s, c) => s + Number(c.duration_seconds || 0), 0))}
            </Badge>
          )}
        </div>
      )}

      {/* Call History Table */}
      <Card className="card-elevated border-0 overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Call Logs
            {!loading && <Badge variant="secondary" className="text-[10px] ml-auto">{pagination.total} total</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider w-10 pl-4">#</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Lead / Contact</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Phone</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Date & Time</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Duration</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Source</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Outcome</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider pr-4">Next Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      {Array(9).fill(0).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : calls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                      <Phone className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium">No calls found for this date</p>
                      <p className="text-xs mt-1">Try a different date from the calendar</p>
                    </TableCell>
                  </TableRow>
                ) : calls.map((call, idx) => (
                  <TableRow key={call.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-xs text-muted-foreground tabular-nums pl-4">
                      {(page - 1) * 25 + idx + 1}
                    </TableCell>
                    <TableCell className="py-3">
                      <p className="text-sm font-medium truncate max-w-[150px]">{call.lead_name || '—'}</p>
                      {call.lead_status && (
                        <Badge variant="outline" className="text-[9px] mt-0.5">{call.lead_status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {call.lead_phone || call.phone_number_dialed || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{formatDate(call.call_start)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatTime(call.call_start)}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-semibold tabular-nums ${
                        Number(call.duration_seconds) > 0 ? 'text-slate-800' : 'text-muted-foreground'
                      }`}>
                        {formatDuration(call.duration_seconds)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <CallTypeIcon type={call.call_type} />
                        <span className="text-xs">{call.call_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${sourceColor[call.call_source] || sourceColor.MANUAL}`}>
                        {call.call_source || 'MANUAL'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{call.outcome_label || '—'}</span>
                    </TableCell>
                    <TableCell className="pr-4">
                      <Badge variant="outline" className={`text-[10px] ${
                        call.next_action === 'VISIT' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                        call.next_action === 'CLOSE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        ''
                      }`}>
                        {call.next_action || 'NONE'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} • {pagination.total} calls
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={page <= 1} onClick={() => fetchCallDetails(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(page - 2, pagination.totalPages - 4));
                  const p = startPage + i;
                  if (p > pagination.totalPages) return null;
                  return (
                    <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                      className="h-8 w-8 p-0 text-xs" onClick={() => fetchCallDetails(p)}>
                      {p}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={page >= pagination.totalPages} onClick={() => fetchCallDetails(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MemberCallAnalytics;
