import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/axios';
import { invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  PhoneMissed, Phone, MapPin, MessageCircle, Users,
  CalendarDays, ChevronLeft, ChevronRight, Check, Loader2, Filter, Search,
} from 'lucide-react';

const typeIcons = { CALL: Phone, VISIT: MapPin, WHATSAPP: MessageCircle, MEETING: Users };
const typeColors = { CALL: 'bg-indigo-100 text-indigo-700', VISIT: 'bg-violet-100 text-violet-700', WHATSAPP: 'bg-emerald-100 text-emerald-700', MEETING: 'bg-amber-100 text-amber-700' };

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

const MissedCalls = () => {
  const [followups, setFollowups] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [datePreset, setDatePreset] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (datePreset) {
      case 'today': return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
      case 'week': return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
      case 'month': return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'custom': return { from: customDateFrom ? format(customDateFrom, 'yyyy-MM-dd') : null, to: customDateTo ? format(customDateTo, 'yyyy-MM-dd') : null };
      default: return { from: null, to: null };
    }
  }, [datePreset, customDateFrom, customDateTo]);

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '15');
      const range = getDateRange();
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);
      const { data } = await api.get(`/followups/missed?${params}`);
      if (data.success) { setFollowups(data.followups); setPagination(data.pagination); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [getDateRange]);

  const handleComplete = async (id) => {
    setActionLoading(id);
    try {
      const { data } = await api.put(`/followups/${id}`, { status: 'COMPLETED' });
      if (data.success) { toast.success('Marked as completed'); invalidateCache('/followups'); fetchData(pagination.page); }
    } catch { toast.error('Failed to complete'); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md">
            <PhoneMissed className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Missed Follow-ups</h1>
            <p className="text-xs text-muted-foreground">Overdue follow-ups that need attention</p>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <Card className="card-elevated border-0">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0">
              <Filter className="h-3.5 w-3.5" /> Filters
            </div>
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v)}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <CalendarDays className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((d) => (
                  <SelectItem key={d.value} value={d.value} className="text-sm">{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {customDateFrom ? format(customDateFrom, 'dd MMM') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {customDateTo ? format(customDateTo, 'dd MMM') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <Button size="sm" onClick={() => fetchData(1)} className="h-9 gap-1.5 bg-red-600 hover:bg-red-700 text-xs">
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lead</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Was Scheduled</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</TableHead>
                <TableHead className="text-right pr-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              )) : followups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <PhoneMissed className="h-10 w-10 text-slate-200" />
                      <p className="text-sm text-muted-foreground">No missed follow-ups - great job!</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : followups.map((f) => {
                const TypeIcon = typeIcons[f.followup_type] || Phone;
                return (
                  <TableRow key={f.id} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="text-sm font-medium">{f.lead_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{f.lead_phone || ''}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 font-medium ${typeColors[f.followup_type] || ''}`}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {f.followup_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-red-600">
                        <CalendarDays className="h-3 w-3" />
                        {f.scheduled_at ? format(new Date(f.scheduled_at), 'dd MMM yyyy') : '—'}
                        {f.scheduled_at && <span className="ml-1">{format(new Date(f.scheduled_at), 'hh:mm a')}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{f.notes || '—'}</p>
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-emerald-600 hover:bg-emerald-50"
                        disabled={actionLoading === f.id} onClick={() => handleComplete(f.id)}>
                        {actionLoading === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Complete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="border-t border-border/40 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => fetchData(pagination.page - 1)} disabled={pagination.page <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => fetchData(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MissedCalls;
