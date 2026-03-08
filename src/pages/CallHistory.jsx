import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import {
  Phone, PhoneOutgoing, PhoneIncoming, Search, Filter,
  ChevronLeft, ChevronRight, CalendarDays, Clock,
  History, Eye, User, Mail, MapPin, FileText,
} from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const outcomeColors = {
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

const statusColors = {
  NEW: 'bg-blue-100 text-blue-700 border-blue-200',
  CONTACTED: 'bg-amber-100 text-amber-700 border-amber-200',
  INTERESTED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SITE_VISIT: 'bg-violet-100 text-violet-700 border-violet-200',
  NEGOTIATION: 'bg-purple-100 text-purple-700 border-purple-200',
  BOOKED: 'bg-green-100 text-green-700 border-green-200',
  LOST: 'bg-slate-100 text-slate-700 border-slate-200',
};

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
const formatDuration = (s) => {
  if (!s) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

const CallHistory = () => {
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(null);

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadCallHistory, setLeadCallHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Schedule form inside detail modal
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: null, time: '10:00', notes: '' });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
      case 'week':
        return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
      case 'month':
        return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'custom':
        return {
          from: customDateFrom ? format(customDateFrom, 'yyyy-MM-dd') : null,
          to: customDateTo ? format(customDateTo, 'yyyy-MM-dd') : null,
        };
      default:
        return { from: null, to: null };
    }
  }, [datePreset, customDateFrom, customDateTo]);

  const fetchCalls = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '20');
      const range = getDateRange();
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);

      const { data } = await api.get(`/calls?${params}`);
      if (data.success) {
        setCalls(data.calls || []);
        setPagination(data.pagination || { page, totalPages: 1, total: data.calls?.length || 0 });
      }
    } catch {
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const openCallDetail = async (call) => {
    setSelectedCall(call);
    setDetailModal(true);
    setLoadingDetail(true);
    try {
      const [leadRes, callsRes] = await Promise.all([
        call.lead_id ? api.get(`/leads/${call.lead_id}`) : Promise.resolve({ data: { success: false } }),
        call.lead_id ? api.get(`/calls/lead/${call.lead_id}`) : Promise.resolve({ data: { success: false, calls: [] } }),
      ]);
      if (leadRes.data.success) setSelectedLead(leadRes.data.lead);
      else setSelectedLead(null);
      if (callsRes.data.success) setLeadCallHistory(callsRes.data.calls || []);
      else setLeadCallHistory([]);
    } catch {
      setSelectedLead(null);
      setLeadCallHistory([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Filter calls by search locally
  const filteredCalls = search
    ? calls.filter(c =>
        c.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.lead_phone?.includes(search) ||
        c.outcome_label?.toLowerCase().includes(search.toLowerCase())
      )
    : calls;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Call History</h1>
            <p className="text-xs text-muted-foreground">View all recent calls and their details</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-elevated border-0">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0">
              <Filter className="h-3.5 w-3.5" /> Filters
            </div>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by lead name, phone, outcome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
            <Select value={datePreset} onValueChange={(v) => { setDatePreset(v); setShowCalendar(false); setCalendarDate(null); }}>
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
            <Button
              size="sm"
              variant={showCalendar ? 'default' : 'outline'}
              onClick={() => setShowCalendar(!showCalendar)}
              className={`h-9 text-xs gap-1.5 ${showCalendar ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Pick Date
            </Button>
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
            <Button size="sm" onClick={() => fetchCalls(1)} className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs">
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inline Calendar for quick date selection */}
      {showCalendar && (
        <Card className="card-elevated border-0">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="border rounded-xl bg-white p-1 shadow-sm">
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={(d) => {
                    setCalendarDate(d);
                    if (d) {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      setDatePreset('custom');
                      setCustomDateFrom(d);
                      setCustomDateTo(d);
                      // Auto-fetch for the selected date
                      setTimeout(() => fetchCalls(1), 100);
                    }
                  }}
                  className="rounded-xl"
                />
              </div>
              <div className="flex-1 space-y-2">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-indigo-500" />
                  {calendarDate ? `Calls on ${format(calendarDate, 'dd MMMM yyyy')}` : 'Select a date to view calls'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Click any date on the calendar to filter calls for that specific day. You can view past calls, future scheduled calls, and all activity details.
                </p>
                {calendarDate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setCalendarDate(null); setDatePreset('all'); setCustomDateFrom(null); setCustomDateTo(null); }}
                    className="text-xs gap-1"
                  >
                    Clear date filter
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calls Table */}
      <Card className="card-elevated border-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider pl-4 w-10">#</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Lead</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Date &amp; Time</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Duration</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Outcome</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Next Action</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Notes</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-center pr-4">Details</TableHead>
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
                ) : filteredCalls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                      <History className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium">No calls found</p>
                      <p className="text-xs mt-1">Try adjusting your date filters</p>
                    </TableCell>
                  </TableRow>
                ) : filteredCalls.map((call, idx) => (
                  <TableRow
                    key={call.id}
                    className="group hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => openCallDetail(call)}
                  >
                    <TableCell className="text-xs text-muted-foreground tabular-nums pl-4">
                      {(pagination.page - 1) * 20 + idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px] border border-indigo-100 shrink-0">
                          {call.lead_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate max-w-32">{call.lead_name || 'Unknown'}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{call.lead_phone || ''}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {call.call_type === 'INCOMING'
                          ? <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500" />
                          : <PhoneOutgoing className="h-3.5 w-3.5 text-indigo-500" />}
                        <span className="text-xs capitalize">{call.call_type?.toLowerCase()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-xs font-medium">{formatDate(call.call_start)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatTime(call.call_start)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono tabular-nums">{formatDuration(call.duration_seconds)}</span>
                    </TableCell>
                    <TableCell>
                      {call.outcome_label ? (
                        <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 ${outcomeColors[call.outcome_label] || 'bg-slate-100 text-slate-700'}`}>
                          {call.outcome_label}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {call.next_action && call.next_action !== 'NONE' ? (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{call.next_action}</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">{call.customer_notes || '—'}</p>
                    </TableCell>
                    <TableCell className="text-center pr-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); openCallDetail(call); }}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} calls
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchCalls(pagination.page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchCalls(pagination.page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Detail Modal */}
      <Dialog open={detailModal} onOpenChange={(v) => { setDetailModal(v); if (!v) { setShowScheduleForm(false); setScheduleForm({ date: null, time: '10:00', notes: '' }); } }}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-indigo-500" />
                Call Details
              </DialogTitle>
              <DialogDescription>
                {selectedCall?.lead_name} · {formatDate(selectedCall?.call_start)} at {formatTime(selectedCall?.call_start)}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-5 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loadingDetail ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Call Info */}
              {selectedCall && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Call Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Type</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {selectedCall.call_type === 'INCOMING'
                          ? <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500" />
                          : <PhoneOutgoing className="h-3.5 w-3.5 text-indigo-500" />}
                        <span className="capitalize font-medium">{selectedCall.call_type?.toLowerCase()}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Duration</p>
                      <p className="font-mono font-semibold mt-1">{formatDuration(selectedCall.duration_seconds)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Date &amp; Time</p>
                      <p className="font-medium mt-1">{formatDate(selectedCall.call_start)} {formatTime(selectedCall.call_start)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Outcome</p>
                      {selectedCall.outcome_label ? (
                        <Badge variant="outline" className={`text-[10px] mt-1 ${outcomeColors[selectedCall.outcome_label] || ''}`}>
                          {selectedCall.outcome_label}
                        </Badge>
                      ) : <p className="text-muted-foreground mt-1">—</p>}
                    </div>
                    {selectedCall.next_action && selectedCall.next_action !== 'NONE' && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Next Action</p>
                        <Badge variant="secondary" className="text-[10px] mt-1">{selectedCall.next_action}</Badge>
                      </div>
                    )}
                    {selectedCall.customer_notes && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Notes</p>
                        <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 mt-1 leading-relaxed">{selectedCall.customer_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lead Info */}
              {selectedLead && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <User className="h-4 w-4" /> Lead Details
                    </h4>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${statusColors[selectedLead.status] || ''}`}>
                      {selectedLead.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-600 truncate">{selectedLead.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-600 font-mono truncate">{selectedLead.phone || '—'}</span>
                    </div>
                    {selectedLead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-600 truncate">{selectedLead.email}</span>
                      </div>
                    )}
                    {selectedLead.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-600 truncate">{selectedLead.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/calls/lead/${selectedLead.id}`)}
                      className="gap-1.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-8">
                      <History className="h-3.5 w-3.5" /> Full History
                    </Button>
                    {selectedLead.phone && (
                      <Button size="sm" variant="outline"
                        onClick={() => {
                          const cleaned = selectedLead.phone.replace(/[^0-9]/g, '');
                          const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
                          window.open(`https://wa.me/${waNumber}`, '_blank');
                        }}
                        className="gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50 h-8">
                        <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                    )}
                    <Button size="sm" variant="outline"
                      onClick={() => setShowScheduleForm(v => !v)}
                      className="gap-1.5 text-xs text-violet-600 border-violet-200 hover:bg-violet-50 h-8">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {showScheduleForm ? 'Cancel' : 'Schedule Call'}
                    </Button>
                  </div>

                  {/* Inline Schedule Form */}
                  {showScheduleForm && (
                    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
                      <p className="text-xs font-semibold text-violet-700">Schedule a Follow-up Call</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-600 mb-1 block">Select Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-9 text-sm gap-2 justify-start font-normal">
                                <CalendarDays className="h-3.5 w-3.5 text-violet-500" />
                                {scheduleForm.date ? format(scheduleForm.date, 'dd MMM yyyy') : 'Pick a date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={scheduleForm.date}
                                onSelect={(d) => setScheduleForm(f => ({ ...f, date: d }))}
                                disabled={(d) => d < startOfDay(new Date())}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600 mb-1 block">Time</Label>
                          <Input
                            type="time"
                            value={scheduleForm.time}
                            onChange={(e) => setScheduleForm(f => ({ ...f, time: e.target.value }))}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 mb-1 block">Notes (optional)</Label>
                        <Textarea
                          placeholder="Add notes for this follow-up…"
                          value={scheduleForm.notes}
                          onChange={(e) => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!scheduleForm.date || savingSchedule}
                        onClick={async () => {
                          if (!scheduleForm.date) return;
                          setSavingSchedule(true);
                          try {
                            const leadId = selectedCall?.lead_id || selectedLead?.id;
                            const { data } = await api.post('/followups', {
                              lead_id: leadId,
                              followup_type: 'CALL',
                              scheduled_date: format(scheduleForm.date, 'yyyy-MM-dd'),
                              scheduled_time: scheduleForm.time,
                              notes: scheduleForm.notes,
                            });
                            if (data.success) {
                              toast.success('Follow-up scheduled!');
                              setShowScheduleForm(false);
                              setScheduleForm({ date: null, time: '10:00', notes: '' });
                            }
                          } catch {
                            toast.error('Failed to schedule follow-up');
                          } finally {
                            setSavingSchedule(false);
                          }
                        }}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-1.5">
                        {savingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                        Confirm Schedule
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* All Calls for this Lead (Timeline) */}
              {leadCallHistory.length > 0 && (
                <div className="space-y-3 pb-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" /> All Calls with {selectedCall?.lead_name || 'this lead'}
                    <Badge variant="secondary" className="text-[10px] ml-auto">{leadCallHistory.length} calls</Badge>
                  </h4>
                  <div className="relative border-l-2 border-indigo-200 ml-3 space-y-4 pl-5">
                    {leadCallHistory.map((call) => (
                      <div key={call.id} className="relative">
                        <div className={`absolute -left-[1.625rem] top-3 h-3 w-3 rounded-full ring-2 ring-white shadow-sm ${
                          call.id === selectedCall?.id ? 'bg-indigo-600 ring-indigo-100 scale-125' : 'bg-indigo-400'
                        }`} />
                        <div className={`p-3.5 rounded-xl border shadow-sm space-y-2 transition-colors ${
                          call.id === selectedCall?.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100' : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              {call.call_type === 'INCOMING'
                                ? <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500" />
                                : <PhoneOutgoing className="h-3.5 w-3.5 text-indigo-500" />}
                              <span className="font-semibold">{formatDate(call.call_start)}</span>
                              <span className="text-muted-foreground">{formatTime(call.call_start)}</span>
                              {call.id === selectedCall?.id && (
                                <Badge className="text-[9px] px-1.5 py-0.5 bg-indigo-600 text-white">Current</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-500">{formatDuration(call.duration_seconds)}</span>
                              {call.outcome_label && (
                                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${outcomeColors[call.outcome_label] || ''}`}>{call.outcome_label}</Badge>
                              )}
                            </div>
                          </div>
                          {call.customer_notes && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg leading-relaxed">{call.customer_notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallHistory;
