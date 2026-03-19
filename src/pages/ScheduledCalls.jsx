import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/axios';
import { invalidateCache } from '@/lib/queryCache';
import { useDialer } from '@/hooks/useDialer';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import {
  CalendarClock, Phone, PhoneCall, PhoneOff, PhoneOutgoing, MapPin, MessageCircle,
  Users, Clock, CalendarDays, ChevronLeft, ChevronRight, Check, Pause,
  Loader2, Filter, Search, User, Mail, FileText, X,
} from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

const typeIcons = { CALL: Phone, VISIT: MapPin, WHATSAPP: MessageCircle, MEETING: Users };
const typeColors = { CALL: 'bg-indigo-100 text-indigo-700', VISIT: 'bg-violet-100 text-violet-700', WHATSAPP: 'bg-emerald-100 text-emerald-700', MEETING: 'bg-amber-100 text-amber-700' };
const statusColors = { PENDING: 'bg-amber-100 text-amber-700 border-amber-200', SNOOZED: 'bg-sky-100 text-sky-700 border-sky-200', COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
const formatDuration = (s) => { if (!s && s !== 0) return '0:00'; const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, '0')}`; };

const ScheduledCalls = () => {
  const { onCallConnected, onCallEnded } = useDialer();
  const isNativeApp = window.Capacitor?.isNativePlatform?.() || false;

  // ─── List state ───
  const [followups, setFollowups] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [datePreset, setDatePreset] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);

  // ─── Snooze ───
  const [snoozeModal, setSnoozeModal] = useState({ open: false, id: null });
  const [snoozeDate, setSnoozeDate] = useState(null);
  const [snoozeTime, setSnoozeTime] = useState('10:00');

  // ─── Active call state (like dialer) ───
  const [activeCall, setActiveCall] = useState(null);   // { callId, followupId, leadId, leadName, leadPhone, connectedAt, isConnected }
  const [callTimer, setCallTimer] = useState(0);
  const [capturedDurationSec, setCapturedDurationSec] = useState(null);

  // ─── End-call modal ───
  const [endCallModal, setEndCallModal] = useState(false);
  const [outcomes, setOutcomes] = useState([]);
  const [endCallForm, setEndCallForm] = useState({
    outcome_id: '', next_action: 'NONE', customer_notes: '',
    schedule_date: null, schedule_time: '10:00',
  });
  const [endingCall, setEndingCall] = useState(false);

  // ─── Lead details inside end-call modal ───
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadCallHistory, setLeadCallHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ─── Date range helper ───
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

  // ─── Fetch followups ───
  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '15');
      const range = getDateRange();
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);
      const { data } = await api.get(`/followups/scheduled?${params}`);
      if (data.success) { setFollowups(data.followups); setPagination(data.pagination); }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  // ─── Fetch outcomes (for end-call modal) ───
  const fetchOutcomes = useCallback(async () => {
    try {
      const { data } = await api.get('/calls/outcomes');
      if (data.success) setOutcomes(data.outcomes);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [getDateRange]);
  useEffect(() => { fetchOutcomes(); }, [fetchOutcomes]);

  // ─── Native call events (Capacitor only) ───
  useEffect(() => {
    if (!isNativeApp || !activeCall?.callId) return;

    const subConnected = onCallConnected((evt) => {
      const connectedAt = Number(evt?.connectedAt || Date.now());
      setCapturedDurationSec(null);
      setActiveCall((prev) => {
        if (!prev || prev.callId !== activeCall.callId) return prev;
        return { ...prev, connectedAt, isConnected: true };
      });
    });

    const subEnded = onCallEnded((evt) => {
      const nativeDuration = Number(evt?.duration);
      if (Number.isFinite(nativeDuration) && nativeDuration >= 0) {
        const seconds = Math.floor(nativeDuration);
        setCapturedDurationSec(seconds);
        setCallTimer(seconds);
      }
    });

    return () => {
      try { subConnected?.remove?.(); } catch { /* ignore */ }
      try { subEnded?.remove?.(); } catch { /* ignore */ }
    };
  }, [activeCall?.callId, isNativeApp]);

  // ─── Live timer ───
  useEffect(() => {
    if (!activeCall) { setCallTimer(0); return; }
    if (!isNativeApp || !activeCall.connectedAt) { setCallTimer(0); return; }

    const interval = setInterval(() => {
      setCallTimer(Math.max(0, Math.floor((Date.now() - activeCall.connectedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall?.connectedAt, isNativeApp]);

  // ─── Fetch lead details + call history ───
  const fetchLeadDetails = useCallback(async (leadId) => {
    setLoadingHistory(true);
    try {
      const [leadRes, callsRes] = await Promise.all([
        api.get(`/leads/${leadId}`),
        api.get(`/calls/lead/${leadId}`),
      ]);
      if (leadRes.data.success) setSelectedLead(leadRes.data.lead);
      if (callsRes.data.success) setLeadCallHistory(callsRes.data.calls || []);
    } catch {
      setSelectedLead(null);
      setLeadCallHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // ═══════════════════════════════════════════
  // DONE button → Start call → End call modal
  // ═══════════════════════════════════════════
  const handleStartCall = async (followup) => {
    if (activeCall) { toast.error('Please end the current call first'); return; }
    if (!followup.lead_phone) { toast.error('This lead has no phone number'); return; }

    try {
      const isApp = window.Capacitor?.isNativePlatform?.() || false;
      const { data } = await api.post('/calls/quick-log', {
        lead_id: followup.lead_id,
        call_source: isApp ? 'APP' : 'WEB',
      });

      if (data.success) {
        setCapturedDurationSec(null);

        // Optimistically mark this row as "in-progress" visually
        setFollowups(prev => prev.map(f =>
          f.id === followup.id ? { ...f, _calling: true } : f
        ));

        setActiveCall({
          callId: data.call.id,
          followupId: followup.id,
          leadId: followup.lead_id,
          leadName: followup.lead_name,
          leadPhone: followup.lead_phone,
          connectedAt: null,
          isConnected: false,
        });

        // Open phone
        if (isApp && window.Capacitor?.Plugins?.CallNumber) {
          try {
            await window.Capacitor.Plugins.CallNumber.callNumber({ number: followup.lead_phone, bypassAppChooser: false });
          } catch { window.open(`tel:${followup.lead_phone}`, '_self'); }
        } else {
          window.open(`tel:${followup.lead_phone}`, '_self');
        }

        toast.success(`Calling ${followup.lead_name}…`, { description: followup.lead_phone });
      }
    } catch {
      toast.error('Failed to initiate call');
    }
  };

  // Open end-call modal
  const handleEndCallClick = () => {
    setEndCallForm({ outcome_id: '', next_action: 'NONE', customer_notes: '', schedule_date: null, schedule_time: '10:00' });
    if (activeCall) fetchLeadDetails(activeCall.leadId);
    setEndCallModal(true);
  };

  // Submit end-call → complete followup OR reschedule
  const handleEndCallSubmit = async () => {
    if (!activeCall) return;
    setEndingCall(true);
    try {
      const finalDuration = Number.isFinite(capturedDurationSec) && capturedDurationSec >= 0
        ? capturedDurationSec
        : callTimer;

      // 1. End the call record
      const payload = {
        outcome_id: endCallForm.outcome_id || null,
        next_action: endCallForm.next_action,
        customer_notes: endCallForm.customer_notes || null,
        duration_seconds: finalDuration,
      };
      await api.put(`/calls/${activeCall.callId}/end`, payload);

      // 2. Followup disposition
      if (endCallForm.schedule_date) {
        // SCHEDULE FOR LATER → update followup with new date, keep PENDING
        const scheduledAt = new Date(
          `${format(endCallForm.schedule_date, 'yyyy-MM-dd')}T${endCallForm.schedule_time || '10:00'}:00`
        ).toISOString();
        await api.put(`/followups/${activeCall.followupId}`, {
          scheduled_date: format(endCallForm.schedule_date, 'yyyy-MM-dd'),
          scheduled_time: endCallForm.schedule_time || '10:00',
          notes: endCallForm.customer_notes || `Rescheduled after call on ${format(new Date(), 'dd MMM yyyy')}`,
        });
        toast.success('Call saved — rescheduled for later', {
          description: `${format(endCallForm.schedule_date, 'dd MMM yyyy')} at ${endCallForm.schedule_time || '10:00'}`,
        });
        // Update the row in place with new date
        setFollowups(prev => prev.map(f =>
          f.id === activeCall.followupId
            ? { ...f, scheduled_at: scheduledAt, notes: endCallForm.customer_notes || f.notes, _calling: false }
            : f
        ));
      } else {
        // NO SCHEDULE → mark followup COMPLETED, remove from list
        await api.put(`/followups/${activeCall.followupId}`, { status: 'COMPLETED' });
        toast.success('Call completed & saved', {
          description: `Duration: ${formatDuration(finalDuration)} with ${activeCall.leadName}`,
        });
        // Instantly remove from UI
        setFollowups(prev => prev.filter(f => f.id !== activeCall.followupId));
      }

      invalidateCache('/followups');
      setActiveCall(null);
      setCapturedDurationSec(null);
      setEndCallModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to end call');
    } finally {
      setEndingCall(false);
    }
  };

  // ─── Snooze ───
  const handleSnooze = async () => {
    if (!snoozeDate || !snoozeModal.id) return;
    setActionLoading(snoozeModal.id);
    try {
      const snoozeUntil = new Date(`${format(snoozeDate, 'yyyy-MM-dd')}T${snoozeTime}:00`).toISOString();
      const { data } = await api.put(`/followups/${snoozeModal.id}/snooze`, { snooze_until: snoozeUntil });
      if (data.success) {
        toast.success('Follow-up snoozed');
        invalidateCache('/followups');
        // Update status in place
        setFollowups(prev => prev.map(f =>
          f.id === snoozeModal.id ? { ...f, status: 'SNOOZED', scheduled_at: snoozeUntil } : f
        ));
        setSnoozeModal({ open: false, id: null });
      }
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to snooze'); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
            <CalendarClock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Scheduled Follow-ups</h1>
            <p className="text-xs text-muted-foreground">Your upcoming follow-ups</p>
          </div>
        </div>
        {activeCall && (
          <Button onClick={handleEndCallClick}
            className="h-9 bg-red-500 hover:bg-red-600 text-white gap-2 rounded-xl animate-pulse">
            <PhoneOff className="h-4 w-4" /> End Current Call
          </Button>
        )}
      </div>

      {/* Active Call Banner */}
      {activeCall && (
        <Card className="border-2 border-green-400 bg-green-50/50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                  <PhoneCall className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Active Call</p>
                  <p className="text-lg font-bold text-green-900">{activeCall.leadName}</p>
                  <p className="text-sm text-green-600 font-mono">{activeCall.leadPhone}</p>
                    {isNativeApp && !activeCall.isConnected && (
                      <p className="text-[11px] text-amber-700 font-medium mt-1">Ringing... timer starts on pickup</p>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-green-600 font-semibold uppercase">Duration</p>
                  <p className="text-3xl font-mono font-bold text-green-800 tabular-nums">{formatDuration(callTimer)}</p>
                </div>
                <Button onClick={handleEndCallClick}
                  className="h-11 px-6 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md gap-2">
                  <PhoneOff className="h-4 w-4" /> End Call
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Button size="sm" onClick={() => fetchData(1)} className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs">
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Followups Table */}
      <Card className="card-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lead</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduled</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</TableHead>
                <TableHead className="text-right pr-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              )) : followups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarClock className="h-10 w-10 text-slate-200" />
                      <p className="text-sm text-muted-foreground">No scheduled follow-ups</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : followups.map((f) => {
                const TypeIcon = typeIcons[f.followup_type] || Phone;
                const isCalling = activeCall?.followupId === f.id;
                return (
                  <TableRow key={f.id} className={isCalling ? 'bg-green-50 border-l-2 border-l-green-500' : 'hover:bg-muted/30'}>
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
                      <div className="flex items-center gap-1.5 text-xs">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        {f.scheduled_at ? format(new Date(f.scheduled_at), 'dd MMM yyyy') : '—'}
                        {f.scheduled_at && <span className="text-muted-foreground ml-1">{format(new Date(f.scheduled_at), 'hh:mm a')}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold ${statusColors[f.status] || ''}`}>
                        {isCalling ? '📞 ON CALL' : f.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-48">{f.notes || '—'}</p>
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <div className="flex items-center justify-end gap-1">
                        {isCalling ? (
                          <Button size="sm" onClick={handleEndCallClick}
                            className="h-7 gap-1 text-xs bg-red-500 hover:bg-red-600 text-white animate-pulse">
                            <PhoneOff className="h-3 w-3" /> End Call
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm"
                              className="h-7 gap-1 text-xs text-emerald-600 hover:bg-emerald-50"
                              disabled={!!activeCall || actionLoading === f.id}
                              onClick={() => handleStartCall(f)}>
                              <PhoneOutgoing className="h-3 w-3" /> Call
                            </Button>
                            {f.lead_phone && (
                              <Button variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                                onClick={() => {
                                  const cleaned = f.lead_phone.replace(/[^0-9]/g, '');
                                  const waNum = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
                                  window.open(`https://wa.me/${waNum}`, '_blank');
                                }}>
                                <WhatsAppIcon className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-sky-600 hover:bg-sky-50"
                              onClick={() => setSnoozeModal({ open: true, id: f.id })}>
                              <Pause className="h-3 w-3" /> Snooze
                            </Button>
                          </>
                        )}
                      </div>
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

      {/* ═══════════════════════════════════════════════════════ */}
      {/* End Call Dialog (same as Dialer)                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={endCallModal} onOpenChange={(v) => !endingCall && setEndCallModal(v)}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneOff className="h-5 w-5 text-red-500" />
              End Call — {activeCall?.leadName}
            </DialogTitle>
            <DialogDescription>
              Duration: {formatDuration(callTimer)} · {activeCall?.leadPhone}
            </DialogDescription>
          </DialogHeader>

          {/* Lead Details Section */}
          {loadingHistory ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : selectedLead && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="h-4 w-4" /> Lead Details
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-600">{selectedLead.name}</span></div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-600 font-mono">{selectedLead.phone || '—'}</span></div>
                {selectedLead.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-600">{selectedLead.email}</span></div>}
                {selectedLead.notes && <div className="col-span-2 flex items-start gap-2"><FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5" /><span className="text-slate-600 text-xs">{selectedLead.notes}</span></div>}
              </div>
            </div>
          )}

          {/* Recent Call History (compact) */}
          {leadCallHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Recent Calls
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {leadCallHistory.slice(0, 4).map((call) => (
                  <div key={call.id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      {call.call_type === 'INCOMING'
                        ? <Phone className="h-3 w-3 text-emerald-500" />
                        : <PhoneOutgoing className="h-3 w-3 text-indigo-500" />}
                      <span className="font-medium">{formatDate(call.call_start)}</span>
                      <span className="text-muted-foreground">{formatTime(call.call_start)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{formatDuration(call.duration_seconds)}</span>
                      {call.outcome_label && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{call.outcome_label}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Call Outcome + Notes + Schedule */}
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Call Outcome</Label>
              <Select value={endCallForm.outcome_id} onValueChange={(v) => setEndCallForm(f => ({ ...f, outcome_id: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select outcome…" /></SelectTrigger>
                <SelectContent>
                  {outcomes.map((o) => <SelectItem key={o.id} value={o.id} className="text-sm">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next Action</Label>
              <Select value={endCallForm.next_action} onValueChange={(v) => setEndCallForm(f => ({ ...f, next_action: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                  <SelectItem value="VISIT">Schedule Visit</SelectItem>
                  <SelectItem value="CLOSE">Close Deal</SelectItem>
                  <SelectItem value="NO_RESPONSE">No Response</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Next Call (inline calendar) */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Schedule for Later
                </h4>
                {endCallForm.schedule_date && (
                  <Badge variant="outline" className="bg-indigo-600 text-white border-indigo-600 text-[10px] px-2 py-0.5">
                    {format(endCallForm.schedule_date, 'dd MMM yyyy')} at {endCallForm.schedule_time || '10:00'}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Pick a date to keep this follow-up scheduled. Leave empty to mark as completed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="border rounded-xl bg-white p-1 shadow-sm">
                  <Calendar
                    mode="single"
                    selected={endCallForm.schedule_date}
                    onSelect={(d) => setEndCallForm(f => ({ ...f, schedule_date: d }))}
                    disabled={(d) => d < startOfDay(new Date())}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-3 flex-1 justify-center">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Time</Label>
                    <Input
                      type="time"
                      value={endCallForm.schedule_time}
                      onChange={(e) => setEndCallForm(f => ({ ...f, schedule_time: e.target.value }))}
                      className="h-10 text-sm bg-white"
                    />
                  </div>
                  {endCallForm.schedule_date && (
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setEndCallForm(f => ({ ...f, schedule_date: null, schedule_time: '10:00' }))}
                      className="text-xs text-slate-500 border-slate-200 hover:bg-slate-50">
                      <X className="h-3 w-3 mr-1" /> Clear Schedule
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</Label>
              <Textarea
                placeholder="What did the customer say? Any notes…"
                value={endCallForm.customer_notes}
                onChange={(e) => setEndCallForm(f => ({ ...f, customer_notes: e.target.value }))}
                className="min-h-20 text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEndCallModal(false)} disabled={endingCall}>Cancel</Button>
            <Button onClick={handleEndCallSubmit} disabled={endingCall}
              className={endCallForm.schedule_date
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white gap-2'
                : 'bg-red-500 hover:bg-red-600 text-white gap-2'
              }>
              {endingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : endCallForm.schedule_date ? <CalendarDays className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
              {endCallForm.schedule_date ? 'Save & Reschedule' : 'End & Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snooze Modal */}
      <Dialog open={snoozeModal.open} onOpenChange={(o) => !o && setSnoozeModal({ open: false, id: null })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pause className="h-5 w-5 text-sky-500" /> Snooze Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">New Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {snoozeDate ? format(snoozeDate, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={snoozeDate} onSelect={setSnoozeDate} disabled={(d) => d < new Date()} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Time</Label>
              <Input type="time" value={snoozeTime} onChange={(e) => setSnoozeTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeModal({ open: false, id: null })}>Cancel</Button>
            <Button onClick={handleSnooze} disabled={!snoozeDate || actionLoading} className="bg-sky-600 hover:bg-sky-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduledCalls;
