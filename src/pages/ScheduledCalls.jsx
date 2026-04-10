import { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
    Users, Clock, CalendarDays, ChevronLeft, ChevronRight,
    Loader2, Search, User, Mail, FileText, X, Pencil, Timer,
    CheckCircle2, AlarmClock, CircleDot, RefreshCw,
} from 'lucide-react';

/* ─── WhatsApp Icon ─── */
const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

/* ─── FlowCurve (same as Dashboard + Reminders) ─── */
const FlowCurve = ({ color = '#0ea5e9', opacity = 0.1 }) => (
    <svg className="absolute bottom-0 left-0 w-full pointer-events-none" height="38" viewBox="0 0 400 38" preserveAspectRatio="none">
        <path d="M0,22 C50,10 110,34 180,18 C250,2 320,30 400,14 L400,38 L0,38 Z" fill={color} opacity={opacity} />
        <path d="M0,28 C70,14 140,36 220,22 C300,8 360,30 400,20 L400,38 L0,38 Z" fill={color} opacity={opacity * 0.6} />
    </svg>
);

/* ─── Design tokens ─── */
const TYPE_THEME = {
    CALL:     { icon: Phone,          iconCls: 'bg-indigo-100 text-indigo-600', accent: '#6366f1', badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Call'     },
    VISIT:    { icon: MapPin,         iconCls: 'bg-violet-100 text-violet-600', accent: '#8b5cf6', badgeCls: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Visit'    },
    WHATSAPP: { icon: MessageCircle,  iconCls: 'bg-emerald-100 text-emerald-600', accent: '#10b981', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'WhatsApp' },
    MEETING:  { icon: Users,          iconCls: 'bg-amber-100 text-amber-600',   accent: '#f59e0b', badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',   label: 'Meeting'  },
    DEFAULT:  { icon: Phone,          iconCls: 'bg-slate-100 text-slate-600',   accent: '#64748b', badgeCls: 'bg-slate-100 text-slate-600 border-slate-200',   label: 'Task'     },
};

const STATUS_BADGE = {
    PENDING:   'bg-amber-50 text-amber-700 border-amber-200',
    SNOOZED:   'bg-sky-50 text-sky-700 border-sky-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const DATE_PRESETS = [
    { value: 'all', label: 'All Time', icon: CircleDot },
    { value: 'today', label: 'Today', icon: Clock },
    { value: 'week', label: 'This Week', icon: CalendarDays },
    { value: 'month', label: 'Month', icon: CalendarClock },
];

/* ─── Helpers ─── */
const getInitials = (name) => {
    if (!name || name === 'Unknown') return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const formatDuration = (s) => {
    if (!s && s !== 0) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const isOverdue = (dateStr) => dateStr && new Date(dateStr) < new Date();

/* ─── Stat Tile (Dashboard pattern) ─── */
const StatTile = ({ label, value, icon: Icon, tone, hex }) => (
    <div className="relative overflow-hidden rounded-xl bg-white border border-slate-100 p-3 pb-10 shadow-sm shrink-0 w-25">
        <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${tone}`} />
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: hex + '18', color: hex }}>
            <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-xl font-bold text-slate-900 mt-2 leading-none">{value}</p>
        <p className="text-[10px] font-semibold text-slate-500 mt-1">{label}</p>
        <FlowCurve color={hex} opacity={0.1} />
    </div>
);

/* ─── Card Skeleton ─── */
const CardSkeleton = () => (
    <div className="rounded-xl bg-white border border-slate-100 p-3.5 pt-5 overflow-hidden">
        <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
            <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-3 pl-13 space-y-2">
            <div className="flex gap-1.5"><Skeleton className="h-4 w-16 rounded-md" /><Skeleton className="h-4 w-20 rounded-md" /></div>
            <Skeleton className="h-3 w-28 rounded" />
            <div className="flex gap-2 pt-2"><Skeleton className="h-8 flex-1 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div>
        </div>
    </div>
);

/* ─── Main Component ─── */
const ScheduledCalls = () => {
    const { onCallConnected, onCallEnded } = useDialer();
    const isNativeApp = window.Capacitor?.isNativePlatform?.() || false;

    // ─── List state ───
    const [followups, setFollowups] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [counts, setCounts] = useState({ pending: 0, snoozed: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [datePreset, setDatePreset] = useState('all');
    const [customDateFrom, setCustomDateFrom] = useState(null);
    const [customDateTo, setCustomDateTo] = useState(null);

    // ─── Snooze ───
    const [snoozeModal, setSnoozeModal] = useState({ open: false, id: null });
    const [snoozeDate, setSnoozeDate] = useState(null);
    const [snoozeTime, setSnoozeTime] = useState('10:00');

    // ─── Active call state ───
    const [activeCall, setActiveCall] = useState(null);
    const [callTimer, setCallTimer] = useState(0);
    const [capturedDurationSec, setCapturedDurationSec] = useState(null);

    // ─── End-call modal ───
    const [endCallModal, setEndCallModal] = useState(false);
    const [outcomes, setOutcomes] = useState([]);
    const outcomesLoaded = useRef(false);
    const [endCallForm, setEndCallForm] = useState({
        outcome_id: '', next_action: 'NONE', customer_notes: '',
        schedule_date: null, schedule_time: '10:00',
    });
    const [endingCall, setEndingCall] = useState(false);

    // ─── Lead details ───
    const [selectedLead, setSelectedLead] = useState(null);
    const [leadCallHistory, setLeadCallHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // ─── Date range ───
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
    const fetchData = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', '20');
            const range = getDateRange();
            if (range.from) params.set('date_from', range.from);
            if (range.to) params.set('date_to', range.to);
            const { data } = await api.get(`/followups/scheduled?${params}`);
            if (data.success) {
                setFollowups(data.followups);
                setPagination(data.pagination || { page: 1, totalPages: 1, total: data.followups?.length || 0 });
                // Derive quick counts
                const all = data.followups || [];
                setCounts({
                    total: data.pagination?.total || all.length,
                    pending: all.filter(f => f.status === 'PENDING').length,
                    snoozed: all.filter(f => f.status === 'SNOOZED').length,
                });
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [getDateRange]);

    // ─── Fetch outcomes — once ───
    const fetchOutcomes = useCallback(async () => {
        if (outcomesLoaded.current) return;
        try {
            const { data } = await api.get('/calls/outcomes');
            if (data.success) { setOutcomes(data.outcomes); outcomesLoaded.current = true; }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchData(1); fetchOutcomes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Native call events ───
    useEffect(() => {
        if (!isNativeApp || !activeCall?.callId) return;
        const subConnected = onCallConnected((evt) => {
            const connectedAt = Number(evt?.connectedAt || Date.now());
            setCapturedDurationSec(null);
            setActiveCall((prev) => prev?.callId === activeCall.callId ? { ...prev, connectedAt, isConnected: true } : prev);
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
        if (!activeCall || !isNativeApp || !activeCall.connectedAt) { setCallTimer(0); return; }
        const interval = setInterval(() => {
            setCallTimer(Math.max(0, Math.floor((Date.now() - activeCall.connectedAt) / 1000)));
        }, 1000);
        return () => clearInterval(interval);
    }, [activeCall?.connectedAt, isNativeApp]);

    // ─── Lead details ───
    const fetchLeadDetails = useCallback(async (leadId) => {
        setLoadingHistory(true);
        try {
            const [leadRes, callsRes] = await Promise.all([
                api.get(`/leads/${leadId}`),
                api.get(`/calls/lead/${leadId}`),
            ]);
            if (leadRes.data.success) setSelectedLead(leadRes.data.lead);
            if (callsRes.data.success) setLeadCallHistory(callsRes.data.calls || []);
        } catch { setSelectedLead(null); setLeadCallHistory([]); }
        finally { setLoadingHistory(false); }
    }, []);

    // ─── Inline name edit ───
    const [editingLeadId, setEditingLeadId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const startEditName = (leadId, currentName) => {
        setEditingLeadId(leadId);
        setEditingName(currentName || '');
    };

    const saveLeadName = async (leadId) => {
        const trimmed = editingName.trim();
        if (!trimmed) { setEditingLeadId(null); return; }
        try {
            await api.put(`/leads/${leadId}`, { name: trimmed });
            setFollowups(prev => prev.map(f => f.lead_id === leadId ? { ...f, lead_name: trimmed } : f));
            toast.success('Name updated');
        } catch { toast.error('Failed to update name'); }
        setEditingLeadId(null);
    };

    // ─── Start call ───
    const handleStartCall = async (followup) => {
        if (activeCall) { toast.error('Please end the current call first'); return; }
        if (!followup.lead_phone) { toast.error('This lead has no phone number'); return; }
        try {
            const isApp = window.Capacitor?.isNativePlatform?.() || false;
            const { data } = await api.post('/calls/quick-log', { lead_id: followup.lead_id, call_source: isApp ? 'APP' : 'WEB' });
            if (data.success) {
                setCapturedDurationSec(null);
                setFollowups(prev => prev.map(f => f.id === followup.id ? { ...f, _calling: true } : f));
                setActiveCall({ callId: data.call.id, followupId: followup.id, leadId: followup.lead_id, leadName: followup.lead_name, leadPhone: followup.lead_phone, connectedAt: null, isConnected: false });
                if (isApp && window.Capacitor?.Plugins?.CallNumber) {
                    try { await window.Capacitor.Plugins.CallNumber.callNumber({ number: followup.lead_phone, bypassAppChooser: false }); }
                    catch { window.open(`tel:${followup.lead_phone}`, '_self'); }
                } else { window.open(`tel:${followup.lead_phone}`, '_self'); }
                toast.success(`Calling ${followup.lead_name}…`, { description: followup.lead_phone });
            }
        } catch { toast.error('Failed to initiate call'); }
    };

    // ─── End call click ───
    const handleEndCallClick = () => {
        setEndCallForm({ outcome_id: '', next_action: 'NONE', customer_notes: '', schedule_date: null, schedule_time: '10:00' });
        if (activeCall) fetchLeadDetails(activeCall.leadId);
        setEndCallModal(true);
    };

    // ─── Submit end call ───
    const handleEndCallSubmit = async () => {
        if (!activeCall) return;
        setEndingCall(true);
        try {
            const finalDuration = Number.isFinite(capturedDurationSec) && capturedDurationSec >= 0 ? capturedDurationSec : callTimer;
            await api.put(`/calls/${activeCall.callId}/end`, {
                outcome_id: endCallForm.outcome_id || null,
                next_action: endCallForm.next_action,
                customer_notes: endCallForm.customer_notes || null,
                duration_seconds: finalDuration,
            });
            if (endCallForm.schedule_date) {
                const scheduledAt = new Date(`${format(endCallForm.schedule_date, 'yyyy-MM-dd')}T${endCallForm.schedule_time || '10:00'}:00`).toISOString();
                await api.put(`/followups/${activeCall.followupId}`, {
                    scheduled_date: format(endCallForm.schedule_date, 'yyyy-MM-dd'),
                    scheduled_time: endCallForm.schedule_time || '10:00',
                    notes: endCallForm.customer_notes || `Rescheduled after call on ${format(new Date(), 'dd MMM yyyy')}`,
                });
                toast.success('Call saved — rescheduled', {
                    description: `${format(endCallForm.schedule_date, 'dd MMM yyyy')} at ${endCallForm.schedule_time || '10:00'}`,
                });
                setFollowups(prev => prev.map(f => f.id === activeCall.followupId ? { ...f, scheduled_at: scheduledAt, notes: endCallForm.customer_notes || f.notes, _calling: false } : f));
            } else {
                await api.put(`/followups/${activeCall.followupId}`, { status: 'COMPLETED' });
                toast.success('Call completed & saved', { description: `${formatDuration(finalDuration)} with ${activeCall.leadName}` });
                setFollowups(prev => prev.filter(f => f.id !== activeCall.followupId));
            }
            invalidateCache('/followups');
            setActiveCall(null);
            setCapturedDurationSec(null);
            setEndCallModal(false);
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to end call'); }
        finally { setEndingCall(false); }
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
                setFollowups(prev => prev.map(f => f.id === snoozeModal.id ? { ...f, status: 'SNOOZED', scheduled_at: snoozeUntil } : f));
                setSnoozeModal({ open: false, id: null });
            }
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to snooze'); }
        finally { setActionLoading(null); }
    };

    /* ═══════════════════════════ JSX ═══════════════════════════ */
    return (
        <div className="space-y-4 pb-6">

            {/* ── Stat tiles ── */}
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8">
                <div className="flex gap-2.5 w-max">
                    <StatTile label="Total" value={counts.total} icon={CalendarClock} tone="from-indigo-400 to-indigo-500" hex="#6366f1" />
                    <StatTile label="Pending" value={counts.pending} icon={Clock} tone="from-amber-400 to-amber-500" hex="#f59e0b" />
                    <StatTile label="Snoozed" value={counts.snoozed} icon={AlarmClock} tone="from-sky-400 to-sky-500" hex="#0ea5e9" />
                    <StatTile label="Done Today" value={0} icon={CheckCircle2} tone="from-emerald-400 to-emerald-500" hex="#10b981" />
                </div>
            </div>

            {/* ── Sticky: filter bar ── */}
            <div className="sticky top-0 z-10 -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 bg-background space-y-2 pb-1">
                {/* Date filter chips */}
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex gap-1.5 w-max items-center">
                        {DATE_PRESETS.map(p => {
                            const PresetIcon = p.icon;
                            const active = datePreset === p.value;
                            return (
                                <button key={p.value} onClick={() => setDatePreset(p.value)}
                                    className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                        active
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                                    }`}>
                                    <PresetIcon className={`h-3 w-3 ${active ? 'text-white/70' : 'text-slate-400'}`} />
                                    {p.label}
                                </button>
                            );
                        })}

                        {/* Custom from/to pickers */}
                        {datePreset === 'custom' && (
                            <>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-slate-300 whitespace-nowrap">
                                            <CalendarDays className="h-3 w-3 text-slate-400" />
                                            {customDateFrom ? format(customDateFrom, 'dd MMM') : 'From'}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} />
                                    </PopoverContent>
                                </Popover>
                                <span className="text-slate-300 text-xs">→</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-slate-300 whitespace-nowrap">
                                            <CalendarDays className="h-3 w-3 text-slate-400" />
                                            {customDateTo ? format(customDateTo, 'dd MMM') : 'To'}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} />
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}

                        {/* Add custom option */}
                        <button onClick={() => setDatePreset('custom')}
                            className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                datePreset === 'custom'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}>
                            <CalendarDays className={`h-3 w-3 ${datePreset === 'custom' ? 'text-white/70' : 'text-slate-400'}`} />
                            Custom
                        </button>

                        {/* Search/Refresh */}
                        <Button size="sm" onClick={() => fetchData(1)} disabled={loading}
                            className="h-8 px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-semibold shrink-0">
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Search
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Active Call Banner ── */}
            {activeCall && (
                <div className="relative overflow-hidden rounded-xl bg-white border-2 border-emerald-400 shadow-md shadow-emerald-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-400 to-green-500" />
                    <div className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 animate-pulse">
                                <PhoneCall className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active Call</p>
                                <p className="text-sm font-bold text-slate-900 truncate">{activeCall.leadName}</p>
                                <p className="text-xs text-slate-500 font-mono">{activeCall.leadPhone}</p>
                                {isNativeApp && !activeCall.isConnected && (
                                    <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Ringing…</p>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-emerald-600 font-semibold uppercase">Duration</p>
                                <p className="text-2xl font-mono font-bold text-slate-900 tabular-nums">{formatDuration(callTimer)}</p>
                            </div>
                        </div>
                        <Button onClick={handleEndCallClick}
                            className="w-full h-10 mt-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-sm gap-2 font-semibold text-sm">
                            <PhoneOff className="h-4 w-4" /> End Call
                        </Button>
                    </div>
                    <FlowCurve color="#10b981" opacity={0.08} />
                </div>
            )}

            {/* ── Follow-up Cards ── */}
            {loading ? (
                <div className="space-y-2.5">
                    {Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            ) : followups.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-white border border-slate-100 shadow-sm">
                    <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                        <CalendarClock className="h-7 w-7 text-indigo-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No follow-ups found</p>
                    <p className="text-xs text-slate-400 mt-1">Try a different date range</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {followups.map((f) => {
                        const theme = TYPE_THEME[f.followup_type] || TYPE_THEME.DEFAULT;
                        const TypeIcon = theme.icon;
                        const isCalling = activeCall?.followupId === f.id;
                        const overdue = !isCalling && isOverdue(f.scheduled_at) && f.status === 'PENDING';
                        const initials = getInitials(f.lead_name);

                        return (
                            <div key={f.id}
                                className={`relative overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200 ${
                                    isCalling
                                        ? 'border-2 border-emerald-400 shadow-emerald-100 shadow-md'
                                        : overdue
                                        ? 'border border-rose-200 shadow-rose-100'
                                        : 'border border-slate-100 hover:shadow-md hover:border-slate-200'
                                }`}>
                                {/* Top accent bar */}
                                <div className="absolute top-0 left-0 right-0 h-0.75"
                                    style={{ backgroundColor: isCalling ? '#10b981' : overdue ? '#f43f5e' : theme.accent }} />

                                <div className="p-3.5 pt-4">
                                    {/* Header: avatar + name/phone + date-time */}
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            isCalling ? 'bg-emerald-100 text-emerald-600' : theme.iconCls
                                        }`}>
                                            {isCalling
                                                ? <PhoneCall className="h-4.5 w-4.5" />
                                                : <span className="text-sm font-bold">{initials}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {editingLeadId === f.lead_id ? (
                                                <input
                                                    autoFocus
                                                    className="text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5 w-full outline-none focus:border-indigo-400"
                                                    value={editingName}
                                                    onChange={e => setEditingName(e.target.value)}
                                                    onBlur={() => saveLeadName(f.lead_id)}
                                                    onKeyDown={e => { if (e.key === 'Enter') saveLeadName(f.lead_id); if (e.key === 'Escape') setEditingLeadId(null); }}
                                                />
                                            ) : (
                                                <button
                                                    className="text-sm font-semibold text-slate-800 truncate group flex items-center gap-1 hover:text-indigo-600 max-w-full"
                                                    onClick={() => startEditName(f.lead_id, f.lead_name)}>
                                                    <span className="truncate">{f.lead_name || 'Unknown'}</span>
                                                    <Pencil className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 shrink-0" />
                                                </button>
                                            )}
                                            <p className="text-[11px] text-slate-400 font-mono mt-px">{f.lead_phone || '—'}</p>
                                        </div>
                                        {/* Date chip */}
                                        {f.scheduled_at && (
                                            <div className={`text-right shrink-0 px-2 py-1 rounded-lg border ${
                                                overdue
                                                    ? 'bg-rose-50 border-rose-200'
                                                    : isCalling
                                                    ? 'bg-emerald-50 border-emerald-200'
                                                    : 'bg-slate-50 border-slate-200'
                                            }`}>
                                                <p className={`text-[11px] font-bold leading-tight ${overdue ? 'text-rose-700' : isCalling ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                    {fmtDate(f.scheduled_at)}
                                                </p>
                                                <p className={`text-[10px] ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {fmtTime(f.scheduled_at)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Meta badges */}
                                    <div className="flex items-center gap-1.5 mt-2.5 pl-13 flex-wrap">
                                        <Badge variant="outline" className={`text-[9px] font-semibold px-1.5 py-0 rounded-md ${theme.badgeCls}`}>
                                            <TypeIcon className="h-2.5 w-2.5 mr-0.5 inline" />
                                            {theme.label}
                                        </Badge>
                                        <Badge variant="outline" className={`text-[9px] font-semibold px-1.5 py-0 rounded-md ${
                                            isCalling ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : STATUS_BADGE[f.status] || 'bg-slate-50 text-slate-500 border-slate-200'
                                        }`}>
                                            {isCalling ? 'ON CALL' : f.status}
                                        </Badge>
                                        {overdue && (
                                            <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 rounded-md bg-rose-50 text-rose-700 border-rose-200">
                                                OVERDUE
                                            </Badge>
                                        )}
                                        {f.notes && (
                                            <span className="text-[10px] text-slate-400 italic truncate flex-1 pl-1">{f.notes}</span>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 pl-13">
                                        {isCalling ? (
                                            <Button onClick={handleEndCallClick}
                                                className="flex-1 h-8 rounded-lg text-xs bg-red-500 hover:bg-red-600 text-white gap-1 font-semibold animate-pulse">
                                                <PhoneOff className="h-3.5 w-3.5" /> End Call
                                            </Button>
                                        ) : (
                                            <>
                                                <Button size="sm"
                                                    className="flex-1 h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                                    disabled={!!activeCall || actionLoading === f.id}
                                                    onClick={() => handleStartCall(f)}>
                                                    {actionLoading === f.id
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        : <PhoneCall className="h-3.5 w-3.5" />}
                                                    Call
                                                </Button>
                                                {f.lead_phone && (
                                                    <Button size="sm" variant="outline"
                                                        className="h-8 w-8 p-0 rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 shrink-0"
                                                        onClick={() => {
                                                            const cleaned = f.lead_phone.replace(/[^0-9]/g, '');
                                                            const waNum = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
                                                            window.open(`https://wa.me/${waNum}`, '_blank');
                                                        }}>
                                                        <WhatsAppIcon className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="outline"
                                                    className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:bg-slate-50 shrink-0"
                                                    onClick={() => setSnoozeModal({ open: true, id: f.id })}>
                                                    <Timer className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <FlowCurve color={isCalling ? '#10b981' : overdue ? '#f43f5e' : theme.accent} opacity={0.07} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && !loading && (
                <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-400 font-medium">
                        {pagination.total} total · page {pagination.page}/{pagination.totalPages}
                    </p>
                    <div className="flex gap-1.5">
                        <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-lg border-slate-200"
                            disabled={pagination.page <= 1 || loading} onClick={() => fetchData(pagination.page - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-lg border-slate-200"
                            disabled={pagination.page >= pagination.totalPages || loading} onClick={() => fetchData(pagination.page + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ── End Call Dialog ── */}
            <Dialog open={endCallModal} onOpenChange={(v) => !endingCall && setEndCallModal(v)}>
                <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                            <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                                <PhoneOff className="h-4 w-4 text-red-600" />
                            </div>
                            End Call — {activeCall?.leadName}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400 pl-10">
                            Duration: {formatDuration(callTimer)} · {activeCall?.leadPhone}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Lead Details */}
                    {loadingHistory ? (
                        <div className="space-y-3 py-2">
                            <Skeleton className="h-20 w-full rounded-xl" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    ) : selectedLead && (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <User className="h-3.5 w-3.5 text-indigo-600" />
                                </div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Lead Details</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5 text-xs">
                                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-700 font-medium">{selectedLead.name}</span></div>
                                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-600 font-mono">{selectedLead.phone || '—'}</span></div>
                                {selectedLead.email && <div className="flex items-center gap-2 col-span-2"><Mail className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-600">{selectedLead.email}</span></div>}
                                {selectedLead.notes && <div className="col-span-2 flex items-start gap-2"><FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5" /><span className="text-slate-500">{selectedLead.notes}</span></div>}
                            </div>
                        </div>
                    )}

                    {/* Recent Calls */}
                    {leadCallHistory.length > 0 && (
                        <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-2">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-7 w-7 rounded-lg bg-sky-100 flex items-center justify-center">
                                    <Clock className="h-3.5 w-3.5 text-sky-600" />
                                </div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Recent Calls</h4>
                            </div>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {leadCallHistory.slice(0, 4).map((call) => (
                                    <div key={call.id} className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2">
                                            {call.call_type === 'INCOMING'
                                                ? <Phone className="h-3 w-3 text-emerald-500" />
                                                : <PhoneOutgoing className="h-3 w-3 text-indigo-500" />}
                                            <span className="font-medium">{fmtDate(call.call_start)}</span>
                                            <span className="text-slate-400">{fmtTime(call.call_start)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono">{formatDuration(call.duration_seconds)}</span>
                                            {call.outcome_label && <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-md">{call.outcome_label}</Badge>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Form */}
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Call Outcome</Label>
                            <Select value={endCallForm.outcome_id} onValueChange={(v) => setEndCallForm(f => ({ ...f, outcome_id: v }))}>
                                <SelectTrigger className="h-10 text-sm rounded-xl border-slate-200 bg-slate-50"><SelectValue placeholder="Select outcome…" /></SelectTrigger>
                                <SelectContent>{outcomes.map((o) => <SelectItem key={o.id} value={o.id} className="text-sm">{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Action</Label>
                            <Select value={endCallForm.next_action} onValueChange={(v) => setEndCallForm(f => ({ ...f, next_action: v }))}>
                                <SelectTrigger className="h-10 text-sm rounded-xl border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">None</SelectItem>
                                    <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                                    <SelectItem value="VISIT">Schedule Visit</SelectItem>
                                    <SelectItem value="CLOSE">Close Deal</SelectItem>
                                    <SelectItem value="NO_RESPONSE">No Response</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Schedule next */}
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                                        <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
                                    </div>
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600">Schedule for Later</h4>
                                </div>
                                {endCallForm.schedule_date && (
                                    <Badge variant="outline" className="bg-indigo-600 text-white border-indigo-600 text-[10px] px-2 py-0.5 rounded-full">
                                        {format(endCallForm.schedule_date, 'dd MMM')} · {endCallForm.schedule_time || '10:00'}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400">Pick a date to reschedule. Leave empty to mark completed.</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="border border-slate-100 rounded-xl bg-white p-1 shadow-sm">
                                    <Calendar mode="single" selected={endCallForm.schedule_date}
                                        onSelect={(d) => setEndCallForm(f => ({ ...f, schedule_date: d }))}
                                        disabled={(d) => d < startOfDay(new Date())}
                                        className="rounded-xl" />
                                </div>
                                <div className="flex flex-col gap-3 flex-1 justify-center">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</Label>
                                        <Input type="time" value={endCallForm.schedule_time}
                                            onChange={(e) => setEndCallForm(f => ({ ...f, schedule_time: e.target.value }))}
                                            className="h-10 text-sm bg-white rounded-xl border-slate-200" />
                                    </div>
                                    {endCallForm.schedule_date && (
                                        <Button type="button" variant="outline" size="sm"
                                            onClick={() => setEndCallForm(f => ({ ...f, schedule_date: null, schedule_time: '10:00' }))}
                                            className="text-xs text-slate-500 border-slate-200 hover:bg-slate-50 rounded-xl h-9">
                                            <X className="h-3 w-3 mr-1" /> Clear Schedule
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes</Label>
                            <Textarea placeholder="What did the customer say?"
                                value={endCallForm.customer_notes}
                                onChange={(e) => setEndCallForm(f => ({ ...f, customer_notes: e.target.value }))}
                                className="min-h-20 text-sm resize-none rounded-xl border-slate-200 bg-slate-50" />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 flex-row border-t border-slate-100 pt-4">
                        <Button variant="outline" onClick={() => setEndCallModal(false)} disabled={endingCall}
                            className="flex-1 h-10 rounded-xl border-slate-200 text-sm">Cancel</Button>
                        <Button onClick={handleEndCallSubmit} disabled={endingCall}
                            className={`flex-1 h-10 rounded-xl text-sm gap-2 ${endCallForm.schedule_date ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                            {endingCall ? <Loader2 className="h-4 w-4 animate-spin" /> : endCallForm.schedule_date ? <CalendarDays className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
                            {endCallForm.schedule_date ? 'Save & Reschedule' : 'End & Complete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Snooze Dialog ── */}
            <Dialog open={snoozeModal.open} onOpenChange={(o) => !o && setSnoozeModal({ open: false, id: null })}>
                <DialogContent className="max-w-sm rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                            <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center">
                                <Timer className="h-4 w-4 text-sky-600" />
                            </div>
                            Snooze Follow-up
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">New Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full h-11 justify-start gap-2 text-sm rounded-xl border-slate-200">
                                        <CalendarDays className="h-4 w-4 text-slate-400" />
                                        {snoozeDate ? format(snoozeDate, 'dd MMM yyyy') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={snoozeDate} onSelect={setSnoozeDate} disabled={(d) => d < new Date()} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</Label>
                            <Input type="time" value={snoozeTime}
                                onChange={(e) => setSnoozeTime(e.target.value)}
                                className="h-11 text-sm rounded-xl border-slate-200" />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-4 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setSnoozeModal({ open: false, id: null })}
                            className="flex-1 h-10 rounded-xl border-slate-200 text-sm">Cancel</Button>
                        <Button onClick={handleSnooze} disabled={!snoozeDate || !!actionLoading}
                            className="flex-1 h-10 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm gap-2">
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />}
                            Snooze
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ScheduledCalls;
