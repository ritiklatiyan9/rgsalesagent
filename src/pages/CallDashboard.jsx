import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cachedGet } from '@/lib/queryCache';
import {
  Phone, PhoneOutgoing, PhoneIncoming, CalendarClock, PhoneMissed,
  Clock, Plus, ArrowRight, BarChart3,
} from 'lucide-react';

const statusColors = {
  Interested: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Follow-up Required': 'bg-amber-100 text-amber-700 border-amber-200',
  'Not Reachable': 'bg-red-100 text-red-700 border-red-200',
  'Switched Off': 'bg-gray-100 text-gray-700 border-gray-200',
  'Invalid Number': 'bg-red-100 text-red-700 border-red-200',
  'Call Back Later': 'bg-sky-100 text-sky-700 border-sky-200',
  'Budget Issue': 'bg-orange-100 text-orange-700 border-orange-200',
  'Site Visit Requested': 'bg-violet-100 text-violet-700 border-violet-200',
  'Negotiation Ongoing': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Not Interested': 'bg-slate-100 text-slate-700 border-slate-200',
};

const formatDuration = (s) => {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const StatCard = ({ title, value, icon: Icon, accent, iconBg, iconColor, loading }) => (
  <div className={`stat-card border-l-4 ${accent} hover:shadow-md transition-all duration-200`}>
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
      <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
    </div>
    {loading ? <Skeleton className="h-8 w-16 rounded" /> : (
      <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
    )}
  </div>
);

const CallDashboard = () => {
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [followupCounts, setFollowupCounts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [callsData, countsData] = await Promise.all([
          cachedGet('/calls?limit=10', { staleTime: 15_000 }),
          cachedGet('/followups/counts', { staleTime: 15_000 }),
        ]);
        if (callsData.success) setCalls(callsData.calls);
        if (countsData.success) setFollowupCounts(countsData.counts);
      } catch {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const todayCalls = calls.filter(c => new Date(c.call_start).toDateString() === new Date().toDateString()).length;

  const stats = [
    { title: "Today's Calls", value: todayCalls, icon: Phone, accent: 'border-l-indigo-500', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
    { title: 'Scheduled', value: followupCounts?.scheduled || 0, icon: CalendarClock, accent: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { title: 'Missed Follow-ups', value: followupCounts?.missed || 0, icon: PhoneMissed, accent: 'border-l-red-500', iconBg: 'bg-red-50', iconColor: 'text-red-600' },
    { title: "Today's Follow-ups", value: followupCounts?.today || 0, icon: Clock, accent: 'border-l-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title text-xl">Call Management</h1>
          <p className="page-subtitle mt-1">Track and manage your call activities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/calls/analytics')} className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Analytics
          </Button>
          <Button size="sm" onClick={() => navigate('/calls/log')} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Log Call
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => <StatCard key={s.title} {...s} loading={loading} />)}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => navigate('/calls/scheduled')} className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors group border border-emerald-100">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <CalendarClock className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-emerald-900">Scheduled Calls</p>
            <p className="text-xs text-emerald-600">View upcoming follow-ups</p>
          </div>
          <ArrowRight className="h-4 w-4 text-emerald-400 ml-auto" />
        </button>
        <button onClick={() => navigate('/calls/missed-followups')} className="flex items-center gap-3 p-4 rounded-xl bg-red-50 hover:bg-red-100 transition-colors group border border-red-100">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <PhoneMissed className="h-5 w-5 text-red-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-red-900">Missed Follow-ups</p>
            <p className="text-xs text-red-600">Overdue follow-ups</p>
          </div>
          <ArrowRight className="h-4 w-4 text-red-400 ml-auto" />
        </button>
        <button onClick={() => navigate('/calls/log')} className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors group border border-indigo-100">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
            <PhoneOutgoing className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-indigo-900">Quick Log</p>
            <p className="text-xs text-indigo-600">Log a new call</p>
          </div>
          <ArrowRight className="h-4 w-4 text-indigo-400 ml-auto" />
        </button>
      </div>

      {/* Recent Calls */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" /> Recent Calls
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => navigate('/calls/daily')}>
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3.5 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <Phone className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No calls logged yet</p>
              <Button size="sm" className="mt-2 gap-1.5" onClick={() => navigate('/calls/log')}>
                <Plus className="h-4 w-4" /> Log Call
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Lead</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Outcome</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Duration</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow key={call.id} onClick={() => navigate(`/calls/lead/${call.lead_id}`)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{call.lead_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{call.lead_phone || ''}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {call.call_type === 'INCOMING' ? <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500" /> : <PhoneOutgoing className="h-3.5 w-3.5 text-indigo-500" />}
                        <span className="text-xs font-medium capitalize">{call.call_type?.toLowerCase()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {call.outcome_label ? (
                        <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 ${statusColors[call.outcome_label] || 'bg-muted text-muted-foreground'}`}>
                          {call.outcome_label}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><span className="text-xs font-mono tabular-nums">{formatDuration(call.duration_seconds)}</span></TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{formatDate(call.call_start)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatTime(call.call_start)}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CallDashboard;
