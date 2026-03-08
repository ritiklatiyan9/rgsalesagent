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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import {
  Phone, PhoneCall, PhoneOff, Search, Filter,
  ChevronLeft, ChevronRight, Loader2, CalendarDays,
  PhoneOutgoing, CheckCircle, Eye,
  User, Mail, MapPin, FileText, Clock, Edit3, Save, X,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Leads' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'SITE_VISIT', label: 'Site Visit' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'LOST', label: 'Lost' },
];

const LEAD_STATUS_OPTIONS = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];

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

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const LeadsDialer = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [outcomes, setOutcomes] = useState([]);
  const [datePreset, setDatePreset] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);

  // Active call state
  const [activeCall, setActiveCall] = useState(null);
  const [callTimer, setCallTimer] = useState(0);

  // End call modal / Lead details modal
  const [endCallModal, setEndCallModal] = useState(false);
  const [leadDetailModal, setLeadDetailModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadCallHistory, setLeadCallHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // End call form
  const [endCallForm, setEndCallForm] = useState({
    outcome_id: '', next_action: 'NONE', customer_notes: '',
    schedule_date: null, schedule_time: '10:00',
  });
  const [endingCall, setEndingCall] = useState(false);

  // Edit lead mode
  const [editingLead, setEditingLead] = useState(false);
  const [editLeadForm, setEditLeadForm] = useState({});
  const [savingLead, setSavingLead] = useState(false);

  // Inline schedule form (inside lead detail modal)
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: null, time: '10:00', notes: '' });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '25');
      if (search) params.set('search', search);
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);

      const { data } = await api.get(`/calls/leads-dialer?${params}`);
      if (data.success) {
        setLeads(data.leads);
        setPagination(data.pagination);
      }
    } catch {
      try {
        const params2 = new URLSearchParams();
        params2.set('page', page);
        params2.set('limit', '25');
        if (search) params2.set('search', search);
        if (statusFilter && statusFilter !== 'ALL') params2.set('status', statusFilter);
        const { data: fallback } = await api.get(`/leads?${params2}`);
        if (fallback.success) {
          setLeads(fallback.leads);
          setPagination(fallback.pagination || { total: fallback.leads.length, page, totalPages: Math.ceil(fallback.total / 25) || 1 });
        }
      } catch {
        toast.error('Failed to load leads');
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchOutcomes = useCallback(async () => {
    try {
      const { data } = await api.get('/calls/outcomes');
      if (data.success) setOutcomes(data.outcomes);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchOutcomes();
  }, [fetchLeads, fetchOutcomes]);

  // Live timer
  useEffect(() => {
    if (!activeCall) { setCallTimer(0); return; }
    const interval = setInterval(() => {
      setCallTimer(Math.floor((Date.now() - activeCall.startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  // Fetch lead details + call history for modal
  const fetchLeadDetails = useCallback(async (lead) => {
    setLoadingHistory(true);
    try {
      const [leadRes, callsRes] = await Promise.all([
        api.get(`/leads/${lead.id}`),
        api.get(`/calls/lead/${lead.id}`),
      ]);
      if (leadRes.data.success) setSelectedLead(leadRes.data.lead);
      else setSelectedLead(lead);
      if (callsRes.data.success) setLeadCallHistory(callsRes.data.calls || []);
    } catch {
      setSelectedLead(lead);
      setLeadCallHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Open lead details modal (from table row)
  const openLeadDetailModal = (lead) => {
    fetchLeadDetails(lead);
    setEditingLead(false);
    setLeadDetailModal(true);
  };

  // Start editing lead details
  const startEditLead = () => {
    if (!selectedLead) return;
    setEditLeadForm({
      name: selectedLead.name || '',
      phone: selectedLead.phone || '',
      email: selectedLead.email || '',
      address: selectedLead.address || '',
      profession: selectedLead.profession || '',
      status: selectedLead.status || 'NEW',
      notes: selectedLead.notes || '',
    });
    setEditingLead(true);
  };

  const cancelEditLead = () => {
    setEditingLead(false);
    setEditLeadForm({});
  };

  const saveLeadDetails = async () => {
    if (!selectedLead) return;
    setSavingLead(true);
    try {
      const { data } = await api.put(`/leads/${selectedLead.id}`, editLeadForm);
      if (data.success) {
        toast.success('Lead details updated');
        setSelectedLead({ ...selectedLead, ...editLeadForm });
        setEditingLead(false);
        fetchLeads(pagination.page);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update lead');
    } finally {
      setSavingLead(false);
    }
  };

  // ── Initiate Call ──
  const handleCall = async (lead) => {
    if (activeCall) { toast.error('Please end the current call first'); return; }
    if (!lead.phone) { toast.error('This lead has no phone number'); return; }

    try {
      const isApp = window.Capacitor?.isNativePlatform?.() || false;
      const { data } = await api.post('/calls/quick-log', {
        lead_id: lead.id,
        call_source: isApp ? 'APP' : 'WEB',
      });

      if (data.success) {
        setActiveCall({
          callId: data.call.id,
          leadId: lead.id,
          leadName: lead.name,
          leadPhone: lead.phone,
          leadEmail: lead.email,
          leadStatus: lead.status,
          startTime: Date.now(),
        });

        if (isApp && window.Capacitor?.Plugins?.CallNumber) {
          try {
            await window.Capacitor.Plugins.CallNumber.callNumber({ number: lead.phone, bypassAppChooser: false });
          } catch {
            window.open(`tel:${lead.phone}`, '_self');
          }
        } else {
          window.open(`tel:${lead.phone}`, '_self');
        }

        toast.success(`Calling ${lead.name}…`, { description: lead.phone });
      }
    } catch {
      toast.error('Failed to initiate call');
    }
  };

  // Open WhatsApp
  const openWhatsApp = (phone) => {
    if (!phone) { toast.error('No phone number available'); return; }
    const cleaned = phone.replace(/[^0-9]/g, '');
    const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    window.open(`https://wa.me/${waNumber}`, '_blank');
  };

  // ── End Call Modal ──
  const handleEndCallClick = () => {
    setEndCallForm({ outcome_id: '', next_action: 'NONE', customer_notes: '', schedule_date: null, schedule_time: '10:00' });
    if (activeCall) {
      fetchLeadDetails({ id: activeCall.leadId, name: activeCall.leadName, phone: activeCall.leadPhone });
    }
    setEndCallModal(true);
  };

  const handleEndCallSubmit = async () => {
    if (!activeCall) return;
    setEndingCall(true);
    try {
      const payload = {
        outcome_id: endCallForm.outcome_id || null,
        next_action: endCallForm.next_action,
        customer_notes: endCallForm.customer_notes || null,
      };

      const { data } = await api.put(`/calls/${activeCall.callId}/end`, payload);

      // If schedule_date is set, create a followup
      if (endCallForm.schedule_date) {
        try {
          await api.post('/followups', {
            lead_id: activeCall.leadId,
            followup_type: 'CALL',
            scheduled_date: endCallForm.schedule_date,
            scheduled_time: endCallForm.schedule_time || '10:00',
            notes: endCallForm.customer_notes || `Scheduled after call on ${format(new Date(), 'dd MMM yyyy')}`,
          });
          toast.success('Next call scheduled', {
            description: `${endCallForm.schedule_date} at ${endCallForm.schedule_time || '10:00'}`,
          });
        } catch {
          toast.error('Failed to schedule next call');
        }
      }

      if (data.success) {
        toast.success('Call ended & saved', {
          description: `Duration: ${formatDuration(callTimer)} with ${activeCall.leadName}`,
        });
        setActiveCall(null);
        setEndCallModal(false);
        fetchLeads(pagination.page);
      }
    } catch {
      toast.error('Failed to end call');
    } finally {
      setEndingCall(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Phone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Leads Dialer</h1>
            <p className="text-xs text-muted-foreground">Click the call button — system tracks everything automatically</p>
          </div>
        </div>
        {activeCall && (
          <Button
            onClick={handleEndCallClick}
            className="h-9 bg-red-500 hover:bg-red-600 text-white gap-2 rounded-xl animate-pulse"
          >
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
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-green-600 font-semibold uppercase">Duration</p>
                  <p className="text-3xl font-mono font-bold text-green-800 tabular-nums">
                    {formatDuration(callTimer)}
                  </p>
                </div>
                <Button
                  onClick={handleEndCallClick}
                  className="h-11 px-6 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md gap-2"
                >
                  <PhoneOff className="h-4 w-4" /> End Call
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLeads(1)}
                className="pl-10 h-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-sm">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={datePreset} onValueChange={setDatePreset}>
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
            <Button size="sm" onClick={() => fetchLeads(1)} className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs">
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="card-elevated border-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider pl-4 w-10">#</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Lead Name</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Phone</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Last Call</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Total Calls</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Last Outcome</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-center pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      {Array(8).fill(0).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      <Phone className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium">No leads found</p>
                      <p className="text-xs mt-1">Try adjusting your filters</p>
                    </TableCell>
                  </TableRow>
                ) : leads.map((lead, idx) => {
                  const isActiveLead = activeCall?.leadId === lead.id;
                  return (
                    <TableRow
                      key={lead.id}
                      className={`group transition-colors ${isActiveLead
                        ? 'bg-green-50 border-l-2 border-l-green-500'
                        : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <TableCell className="text-xs text-muted-foreground tabular-nums pl-4">
                        {(pagination.page - 1) * 25 + idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100 shrink-0">
                            {lead.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate max-w-38">{lead.name}</p>
                            {lead.email && <p className="text-[10px] text-muted-foreground truncate max-w-38">{lead.email}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-mono font-medium">{lead.phone || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${statusColors[lead.status] || 'bg-slate-100 text-slate-700'}`}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.last_call_at ? (
                          <div>
                            <p className="text-xs font-medium">{formatDate(lead.last_call_at)}</p>
                            <p className="text-[10px] text-muted-foreground">{formatTime(lead.last_call_at)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Never called</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold tabular-nums">{lead.total_calls || 0}</span>
                          {lead.total_calls > 0 && <CheckCircle className="h-3 w-3 text-green-400" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.last_outcome ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">{lead.last_outcome}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center pr-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Details Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openLeadDetailModal(lead)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                            title="View lead details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {/* WhatsApp Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openWhatsApp(lead.phone)}
                            disabled={!lead.phone}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full disabled:opacity-30"
                            title={lead.phone ? `WhatsApp ${lead.name}` : 'No phone number'}
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </Button>
                          {/* Call Button */}
                          {isActiveLead ? (
                            <Button
                              size="sm"
                              onClick={handleEndCallClick}
                              className="h-9 w-9 p-0 bg-red-500 hover:bg-red-600 rounded-full shadow-md animate-pulse"
                            >
                              <PhoneOff className="h-4 w-4 text-white" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleCall(lead)}
                              disabled={!!activeCall || !lead.phone}
                              className="h-9 w-9 p-0 bg-green-500 hover:bg-green-600 disabled:bg-slate-200 rounded-full shadow-sm group-hover:shadow-md transition-all"
                              title={!lead.phone ? 'No phone number' : `Call ${lead.name}`}
                            >
                              <PhoneOutgoing className="h-4 w-4 text-white disabled:text-slate-400" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} leads
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLeads(pagination.page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchLeads(pagination.page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* End Call Dialog — Enhanced with lead details + schedule */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={endCallModal} onOpenChange={(v) => !endingCall && setEndCallModal(v)}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneOff className="h-5 w-5 text-red-500" />
                End Call — {activeCall?.leadName}
              </DialogTitle>
              <DialogDescription>
                Duration: {formatDuration(callTimer)} · {activeCall?.leadPhone}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-5 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Lead Details Section */}
          {selectedLead && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 mb-4">
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
                {selectedLead.notes && (
                  <div className="col-span-2 flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="text-slate-600 text-xs leading-relaxed">{selectedLead.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Call Timeline (recent) */}
          {leadCallHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 mb-4">
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Recent Call History
                <Badge variant="secondary" className="text-[10px] ml-auto">{leadCallHistory.length} calls</Badge>
              </h4>
              <div className="space-y-2">
                {leadCallHistory.slice(0, 5).map((call) => (
                  <div key={call.id} className="flex flex-wrap items-center justify-between gap-2 text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      {call.call_type === 'INCOMING'
                        ? <Phone className="h-3.5 w-3.5 text-emerald-500" />
                        : <PhoneOutgoing className="h-3.5 w-3.5 text-indigo-500" />}
                      <span className="font-medium">{formatDate(call.call_start)}</span>
                      <span className="text-muted-foreground">{formatTime(call.call_start)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">{formatDuration(call.duration_seconds)}</span>
                      {call.outcome_label && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{call.outcome_label}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Call Outcome</Label>
              <Select value={endCallForm.outcome_id} onValueChange={(v) => setEndCallForm((f) => ({ ...f, outcome_id: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select outcome…" />
                </SelectTrigger>
                <SelectContent>
                  {outcomes.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-sm">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next Action</Label>
              <Select value={endCallForm.next_action} onValueChange={(v) => setEndCallForm((f) => ({ ...f, next_action: v }))}>
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

            {/* Schedule Next Call — compact with popover instead of inline calendar */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Schedule Next Call
                </h4>
                {endCallForm.schedule_date && (
                  <Badge variant="outline" className="bg-indigo-600 text-white border-indigo-600 text-[10px] px-2 py-0.5">
                    {endCallForm.schedule_date} at {endCallForm.schedule_time || '10:00'}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Date</Label>
                  <Input
                    type="date"
                    value={endCallForm.schedule_date || ''}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setEndCallForm((f) => ({ ...f, schedule_date: e.target.value || null }))}
                    className="h-10 text-sm bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Time</Label>
                  <Input
                    type="time"
                    value={endCallForm.schedule_time}
                    onChange={(e) => setEndCallForm((f) => ({ ...f, schedule_time: e.target.value }))}
                    className="h-10 text-sm bg-white"
                  />
                </div>
              </div>
              {endCallForm.schedule_date && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEndCallForm((f) => ({ ...f, schedule_date: null, schedule_time: '10:00' }))}
                  className="text-xs text-slate-500 border-slate-200 hover:bg-slate-50 h-8"
                >
                  <X className="h-3 w-3 mr-1" /> Clear Schedule
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</Label>
              <Textarea
                placeholder="What did the customer say? Any notes…"
                value={endCallForm.customer_notes}
                onChange={(e) => setEndCallForm((f) => ({ ...f, customer_notes: e.target.value }))}
                className="min-h-20 text-sm resize-none"
              />
            </div>
          </div>
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 z-10 bg-background border-t px-5 py-3">
            <DialogFooter>
              <Button variant="outline" onClick={() => setEndCallModal(false)} disabled={endingCall}>
                Cancel
              </Button>
              <Button onClick={handleEndCallSubmit} disabled={endingCall}
                className="bg-red-500 hover:bg-red-600 text-white gap-2">
                {endingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
                End & Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Lead Detail Modal (view/edit lead details + call history) */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Dialog open={leadDetailModal} onOpenChange={(v) => { if (!savingLead) { setLeadDetailModal(v); setEditingLead(false); setShowScheduleForm(false); setScheduleForm({ date: null, time: '10:00', notes: '' }); } }}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-500" />
                {selectedLead?.name || 'Lead Details'}
              </DialogTitle>
              <DialogDescription>
                View and edit lead information, call history &amp; timeline
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-5 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loadingHistory ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : selectedLead && (
            <div className="space-y-5">
              {/* Lead Info Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">Lead Information</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${statusColors[selectedLead.status] || ''}`}>
                      {selectedLead.status}
                    </Badge>
                    {!editingLead ? (
                      <Button variant="ghost" size="sm" onClick={startEditLead} className="h-7 gap-1 text-xs text-indigo-600 hover:bg-indigo-50">
                        <Edit3 className="h-3 w-3" /> Edit
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={cancelEditLead} className="h-7 gap-1 text-xs text-slate-500">
                          <X className="h-3 w-3" /> Cancel
                        </Button>
                        <Button size="sm" onClick={saveLeadDetails} disabled={savingLead} className="h-7 gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                          {savingLead ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {editingLead ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Name</Label>
                      <Input value={editLeadForm.name} onChange={(e) => setEditLeadForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Phone</Label>
                      <Input value={editLeadForm.phone} onChange={(e) => setEditLeadForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Email</Label>
                      <Input value={editLeadForm.email} onChange={(e) => setEditLeadForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Status</Label>
                      <Select value={editLeadForm.status} onValueChange={(v) => setEditLeadForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Address</Label>
                      <Input value={editLeadForm.address} onChange={(e) => setEditLeadForm(f => ({ ...f, address: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Profession</Label>
                      <Input value={editLeadForm.profession} onChange={(e) => setEditLeadForm(f => ({ ...f, profession: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-500">Notes</Label>
                      <Textarea value={editLeadForm.notes} onChange={(e) => setEditLeadForm(f => ({ ...f, notes: e.target.value }))} className="min-h-16 text-sm resize-none" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Name</p>
                        <p className="font-medium text-slate-700">{selectedLead.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Phone</p>
                        <p className="font-mono text-slate-700">{selectedLead.phone || '—'}</p>
                      </div>
                    </div>
                    {selectedLead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Email</p>
                          <p className="text-slate-700">{selectedLead.email}</p>
                        </div>
                      </div>
                    )}
                    {selectedLead.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Address</p>
                          <p className="text-slate-700">{selectedLead.address}</p>
                        </div>
                      </div>
                    )}
                    {selectedLead.profession && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Profession</p>
                          <p className="text-slate-700">{selectedLead.profession}</p>
                        </div>
                      </div>
                    )}
                    {selectedLead.lead_source && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Source</p>
                          <p className="text-slate-700">{selectedLead.lead_source}</p>
                        </div>
                      </div>
                    )}
                    {selectedLead.notes && (
                      <div className="col-span-2 flex items-start gap-2 pt-1">
                        <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Notes</p>
                          <p className="text-slate-600 text-xs bg-white p-2 rounded-lg border border-slate-100 mt-0.5">{selectedLead.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => { setLeadDetailModal(false); handleCall(selectedLead); }}
                  disabled={!!activeCall || !selectedLead.phone}
                  className="gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs"
                >
                  <PhoneOutgoing className="h-3.5 w-3.5" /> Call Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openWhatsApp(selectedLead.phone)}
                  disabled={!selectedLead.phone}
                  className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50 text-xs"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant={showScheduleForm ? 'default' : 'outline'}
                  onClick={() => {
                    setShowScheduleForm(!showScheduleForm);
                    setScheduleForm({ date: null, time: '10:00', notes: '' });
                  }}
                  className={`gap-1.5 text-xs ${showScheduleForm ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Schedule Call
                </Button>
              </div>

              {/* Inline Schedule Form — compact with popover calendar */}
              {showScheduleForm && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" /> Schedule Next Call for {selectedLead.name}
                    </h4>
                    {scheduleForm.date && (
                      <Badge variant="outline" className="bg-indigo-600 text-white border-indigo-600 text-[10px] px-2 py-0.5">
                        {scheduleForm.date} at {scheduleForm.time}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Date</Label>
                      <Input
                        type="date"
                        value={scheduleForm.date || ''}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value || null }))}
                        className="h-10 text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">Time</Label>
                      <Input
                        type="time"
                        value={scheduleForm.time}
                        onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
                        className="h-10 text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Notes (optional)</Label>
                    <Textarea
                      placeholder="What to discuss…"
                      value={scheduleForm.notes}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))}
                      className="min-h-16 text-sm resize-none bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!scheduleForm.date || savingSchedule}
                      onClick={async () => {
                        if (!scheduleForm.date || !selectedLead) return;
                        setSavingSchedule(true);
                        try {
                          const { data } = await api.post('/followups', {
                            lead_id: selectedLead.id,
                            followup_type: 'CALL',
                            scheduled_date: scheduleForm.date,
                            scheduled_time: scheduleForm.time || '10:00',
                            notes: scheduleForm.notes || `Scheduled call with ${selectedLead.name}`,
                          });
                          if (data.success) {
                            toast.success('Call scheduled!', {
                              description: `${scheduleForm.date} at ${scheduleForm.time}`,
                            });
                            setShowScheduleForm(false);
                            setScheduleForm({ date: null, time: '10:00', notes: '' });
                          }
                        } catch (err) {
                          toast.error(err.response?.data?.message || 'Failed to schedule call');
                        } finally {
                          setSavingSchedule(false);
                        }
                      }}
                      className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex-1"
                    >
                      {savingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
                      Confirm Schedule
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowScheduleForm(false); setScheduleForm({ date: null, time: '10:00', notes: '' }); }}
                      className="text-xs text-slate-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Call History Timeline */}
              <div className="space-y-3 pb-2">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" /> Call Timeline
                  {leadCallHistory.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">{leadCallHistory.length} calls</Badge>
                  )}
                </h4>

                {leadCallHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-xl border border-slate-100">
                    <Phone className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No calls logged yet</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-indigo-200 ml-3 space-y-4 pl-5">
                    {leadCallHistory.map((call) => (
                      <div key={call.id} className="relative">
                        <div className="absolute -left-[1.625rem] top-3.5 h-3 w-3 rounded-full bg-indigo-500 ring-2 ring-white shadow-sm" />
                        <div className="p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm space-y-2 hover:border-slate-200 transition-colors">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              {call.call_type === 'INCOMING'
                                ? <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                : <PhoneOutgoing className="h-3.5 w-3.5 text-indigo-500" />}
                              <span className="font-semibold text-slate-700">{formatDate(call.call_start)}</span>
                              <span className="text-muted-foreground">{formatTime(call.call_start)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-500">{formatDuration(call.duration_seconds)}</span>
                              {call.outcome_label && (
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5">{call.outcome_label}</Badge>
                              )}
                            </div>
                          </div>
                          {call.customer_notes && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg leading-relaxed">{call.customer_notes}</p>
                          )}
                          {call.next_action && call.next_action !== 'NONE' && (
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="text-slate-400">Next:</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">{call.next_action}</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsDialer;
