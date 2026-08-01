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
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { broadcastMutation, onMutation } from '@/lib/mutationBus';
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

/* ─── Row Skeleton ─── */
const CardSkeleton = () => (
    <div className="rounded-2xl bg-white border border-slate-200 px-3 py-3 shadow-sm">
        <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
    </div>
);

/* ─── Main Component ─── */
const ScheduledCalls = () => {
    const { onCallConnected, onCallEnded } = useDialer();
    const isNativeApp = window.Capacitor?.isNativePlatform?.() || false;

    // ─── List state ───
    const _initCached = getCachedSync('/followups/scheduled?page=1&limit=20');
    const [followups, setFollowups] = useState(() => _initCached?.followups ?? []);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [counts, setCounts] = useState({ pending: 0, snoozed: 0, total: 0, done_today: 0 });
    const abortRef = useRef(null);
    const hasDataRef = useRef(Boolean(_initCached));
    const [loading, setLoading] = useState(!_initCached);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [datePreset, setDatePreset] = useState('all');
    const [customDateFrom, setCustomDateFrom] = useState(null);
    const [customDateTo, setCustomDateTo] = useState(null);

    // ─── Snooze ───
    const [snoozeModal, setSnoozeModal] = useState({ open: false, id: null });
    const [snoozeDate, setSnoozeDate] = useState(null);
    const [snoozeTime, setSnoozeTime] = useState('10:00');

    // ─── Cancel schedule ───
    const [cancelModal, setCancelModal] = useState({ open: false, id: null, name: '' });
    const [cancelling, setCancelling] = useState(false);

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
    const fetchData = useCallback(async (page = 1, force = false) => {
        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (!hasDataRef.current) setLoading(true);
        else setRefreshing(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', '20');
            const range = getDateRange();
            if (range.from) params.set('date_from', range.from);
            if (range.to) params.set('date_to', range.to);
            const data = await cachedGet(`/followups/scheduled?${params}`, { staleTime: 120_000, cacheTime: 300_000, force });
            if (data.success) {
                setFollowups(data.followups);
                setPagination(data.pagination || { page: 1, totalPages: 1, total: data.followups?.length || 0 });
                // Use server-side counts (accurate across all pages)
                if (data.counts) {
                    setCounts(data.counts);
                }
                hasDataRef.current = true;
            }
        } catch (err) { if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') { /* ignore */ } }
        finally { 
            setLoading(false);
            setRefreshing(false);
        }
    }, [getDateRange]);

    // ─── Fetch outcomes — once ───
    const fetchOutcomes = useCallback(async () => {
        if (outcomesLoaded.current) return;
        try {
            const { data } = await api.get('/calls/outcomes');
            if (data.success) { setOutcomes(data.outcomes); outcomesLoaded.current = true; }
        } catch { /* ignore */ }
    }, []);

    const fetchDataRef = useRef(fetchData);
    fetchDataRef.current = fetchData;
    const scPageRef = useRef(pagination.page);
    scPageRef.current = pagination.page;

    useEffect(() => onMutation((entities) => {
        if (entities.some(e => e === 'followups' || e === 'calls')) {
            fetchDataRef.current(scPageRef.current, true);
        }
    }), []);

    // Force-refresh on mount and whenever date filters change so newly-created
    // followups (from other pages) always appear without a stale-cache delay.
    useEffect(() => { fetchData(1, true); }, [datePreset, customDateFrom, customDateTo]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { fetchOutcomes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup abort controller on unmount
    useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

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
                try { localStorage.setItem('rg:lastDialedCall', JSON.stringify({ phone: followup.lead_phone, name: followup.lead_name || '', leadId: followup.lead_id || null, callId: data.call.id, timestamp: Date.now() })); } catch {}
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
            broadcastMutation(['followups', 'calls']);
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
                broadcastMutation(['followups']);
                setFollowups(prev => prev.map(f => f.id === snoozeModal.id ? { ...f, status: 'SNOOZED', scheduled_at: snoozeUntil } : f));
                setSnoozeModal({ open: false, id: null });
            }
        } catch (err) { toast.error(err?.response?.data?.message || 'Failed to snooze'); }
        finally { setActionLoading(null); }
    };

    // ─── Cancel (remove) schedule ───
    const handleCancelSchedule = async () => {
        if (!cancelModal.id) return;
        setCancelling(true);
        try {
            await api.put(`/followups/${cancelModal.id}`, { status: 'CANCELLED' });
            toast.success('Schedule cancelled');
            setFollowups(prev => prev.filter(f => f.id !== cancelModal.id));
            setCounts(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), total: Math.max(0, prev.total - 1) }));
            setCancelModal({ open: false, id: null, name: '' });
            broadcastMutation(['followups']);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to cancel schedule');
        } finally {
            setCancelling(false);
        }
    };

    /* ═══════════════════════════ JSX ═══════════════════════════ */
    const descriptiveLine = (() => {
        const parts = [];
        if (counts.pending > 0) parts.push(`${counts.pending} pending`);
        if (counts.snoozed > 0) parts.push(`${counts.snoozed} snoozed`);
        if (counts.done_today > 0) parts.push(`${counts.done_today} done today`);
        if (parts.length === 0) return 'No follow-ups in this range.';
        return parts.slice(0, 2).join(' · ') + '.';
    })();

    return (
        <div className="space-y-3 pb-6">

            {/* App header */}
            <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="relative px-3.5 py-3.5 sm:px-4">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-indigo-500 via-sky-500 to-emerald-400" />
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Follow-ups</p>
                            </div>
                            <h1 className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-slate-950">
                                Scheduled Calls
                            </h1>
                            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{descriptiveLine}</p>
                        </div>
                        <button
                            onClick={() => fetchData(1, true)}
                            disabled={loading || refreshing}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition hover:bg-white active:scale-95 disabled:opacity-60"
                            aria-label="Refresh scheduled calls"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-px border-t border-slate-100 bg-slate-100">
                    {[
                        { label: 'Total', value: counts.total, icon: CalendarClock, tone: 'text-indigo-700 bg-indigo-50' },
                        { label: 'Pending', value: counts.pending, icon: Clock, tone: 'text-amber-700 bg-amber-50' },
                        { label: 'Snoozed', value: counts.snoozed, icon: AlarmClock, tone: 'text-sky-700 bg-sky-50' },
                        { label: 'Done', value: counts.done_today, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="bg-white px-2 py-2.5 text-center">
                                <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg ${item.tone}`}>
                                    <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                                </div>
                                <p className="mt-1 text-lg font-semibold leading-none text-slate-950 tabular-nums">{item.value}</p>
                                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{item.label}</p>
                            </div>
                        );
                    })}
                </div>
            </header>

            {/* Filters */}
            <section className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 px-1 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Filter range</p>
                    {refreshing && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Syncing
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                    {[...DATE_PRESETS, { value: 'custom', label: 'Custom', icon: CalendarDays }].map(p => {
                        const PresetIcon = p.icon;
                        const active = datePreset === p.value;
                        return (
                            <button key={p.value} onClick={() => setDatePreset(p.value)}
                                className={`h-9 min-w-0 rounded-xl text-[11px] font-semibold leading-none flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-150 ${
                                    active
                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                        : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white'
                                }`}>
                                <PresetIcon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white/85' : 'text-slate-400'}`} />
                                <span className="truncate">{p.label}</span>
                            </button>
                        );
                    })}
                </div>

                {datePreset === 'custom' && (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="h-10 min-w-0 px-3 rounded-xl text-xs font-semibold ring-1 ring-slate-200 bg-slate-50 text-slate-700 flex items-center gap-2">
                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{customDateFrom ? format(customDateFrom, 'dd MMM yyyy') : 'From date'}</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} />
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="h-10 min-w-0 px-3 rounded-xl text-xs font-semibold ring-1 ring-slate-200 bg-slate-50 text-slate-700 flex items-center gap-2">
                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{customDateTo ? format(customDateTo, 'dd MMM yyyy') : 'To date'}</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </section>

            {/* Active call banner */}
            {activeCall && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm shadow-emerald-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shrink-0 ring-1 ring-emerald-100 animate-pulse">
                            <PhoneCall className="h-4.5 w-4.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-[0.16em]">Active Call</p>
                            <p className="text-sm font-semibold text-slate-950 truncate leading-tight mt-0.5">{activeCall.leadName}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{activeCall.leadPhone}</p>
                                {isNativeApp && !activeCall.isConnected && (
                                <p className="text-[11px] text-amber-600 font-semibold mt-1">Ringing…</p>
                                )}
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-[0.16em]">Duration</p>
                            <p className="text-xl font-semibold text-slate-950 tabular-nums leading-none mt-1">{formatDuration(callTimer)}</p>
                        </div>
                        <Button onClick={handleEndCallClick}
                            className="h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white gap-1.5 px-3 text-xs font-semibold">
                            <PhoneOff className="h-4 w-4" /> End
                        </Button>
                    </div>
                </div>
            )}

            {/* List header */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-950 tracking-tight">
                    Follow-up Queue
                </h2>
                {!loading && followups.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        {pagination.total} total
                    </span>
                )}
            </div>

            {/* Follow-up rows */}
            {loading ? (
                <div className="space-y-2">
                    {Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            ) : followups.length === 0 ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 py-12 flex flex-col items-center">
                    <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center mb-3 shadow-sm ring-1 ring-indigo-100">
                        <CalendarClock className="h-6 w-6 text-indigo-400" strokeWidth={2} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No follow-ups found</p>
                    <p className="text-xs text-slate-500 mt-0.5">Try a different date range.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {followups.map((f) => {
                        const theme = TYPE_THEME[f.followup_type] || TYPE_THEME.DEFAULT;
                        const TypeIcon = theme.icon;
                        const isCalling = activeCall?.followupId === f.id;
                        const overdue = !isCalling && isOverdue(f.scheduled_at) && f.status === 'PENDING';
                        const initials = getInitials(f.lead_name);

                        return (
                            <div key={f.id}
                                className={`relative overflow-hidden rounded-2xl border bg-white px-3 py-3 shadow-sm transition-all duration-150 sm:px-4 ${
                                    isCalling
                                        ? 'border-emerald-300 bg-emerald-50/50 shadow-emerald-100'
                                        : overdue
                                        ? 'border-rose-200 bg-rose-50/40 shadow-rose-100/70'
                                        : 'border-slate-200 hover:border-indigo-100 hover:bg-slate-50/50 hover:shadow-md'
                                }`}>
                                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                                    style={{ backgroundColor: isCalling ? '#10b981' : overdue ? '#f43f5e' : theme.accent }} />

                                <div className="flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                        isCalling ? 'bg-emerald-100 text-emerald-600' : theme.iconCls
                                    }`}>
                                        {isCalling
                                            ? <PhoneCall className="h-4.5 w-4.5" />
                                            : <span className="text-sm font-semibold">{initials}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {editingLeadId === f.lead_id ? (
                                            <input
                                                autoFocus
                                                className="text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1 w-full outline-none focus:border-indigo-400"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                onBlur={() => saveLeadName(f.lead_id)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveLeadName(f.lead_id); if (e.key === 'Escape') setEditingLeadId(null); }}
                                            />
                                        ) : (
                                            <button
                                                className="text-sm font-semibold text-slate-950 truncate group flex items-center gap-1 hover:text-indigo-600 max-w-full"
                                                onClick={() => startEditName(f.lead_id, f.lead_name)}>
                                                <span className="truncate">{f.lead_name || 'Unknown'}</span>
                                                <Pencil className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 shrink-0" />
                                            </button>
                                        )}
                                        <p className="text-xs text-slate-500 mt-0.5">{f.lead_phone || '—'}</p>
                                    </div>
                                    {f.scheduled_at && (
                                        <div className={`text-right shrink-0 px-2.5 py-1.5 rounded-xl border ${
                                            overdue
                                                ? 'bg-rose-50 border-rose-200'
                                                : isCalling
                                                ? 'bg-emerald-50 border-emerald-200'
                                                : 'bg-slate-50 border-slate-200'
                                        }`}>
                                            <p className={`text-xs font-semibold leading-tight ${overdue ? 'text-rose-700' : isCalling ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                {fmtDate(f.scheduled_at)}
                                            </p>
                                            <p className={`text-[10px] ${overdue ? 'text-rose-500' : 'text-slate-400'}`}>
                                                {fmtTime(f.scheduled_at)}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap sm:ml-[3.25rem]">
                                    <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${theme.badgeCls}`}>
                                        <TypeIcon className="h-2.5 w-2.5 mr-1 inline" />
                                        {theme.label}
                                    </Badge>
                                    <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${
                                        isCalling ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : STATUS_BADGE[f.status] || 'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}>
                                        {isCalling ? 'ON CALL' : f.status}
                                    </Badge>
                                    {overdue && (
                                        <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border-rose-200">
                                            OVERDUE
                                        </Badge>
                                    )}
                                    {f.notes && (
                                        <span className="text-xs text-slate-500 truncate flex-1 min-w-0">{f.notes}</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-3 sm:ml-[3.25rem]">
                                    {isCalling ? (
                                        <Button onClick={handleEndCallClick}
                                            className="flex-1 h-9 rounded-xl text-xs bg-red-500 hover:bg-red-600 text-white gap-1.5 font-semibold animate-pulse">
                                            <PhoneOff className="h-3.5 w-3.5" /> End Call
                                        </Button>
                                    ) : (
                                        <>
                                            <Button size="sm"
                                                className="flex-1 h-9 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                                                disabled={!!activeCall || actionLoading === f.id}
                                                onClick={() => handleStartCall(f)}>
                                                {actionLoading === f.id
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    : <PhoneCall className="h-3.5 w-3.5" />}
                                                Call
                                            </Button>
                                            {f.lead_phone && (
                                                <Button size="sm" variant="outline"
                                                    className="h-9 w-9 p-0 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 shrink-0"
                                                    onClick={() => {
                                                        const cleaned = f.lead_phone.replace(/[^0-9]/g, '');
                                                        const waNum = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
                                                        window.open(`https://wa.me/${waNum}`, '_blank');
                                                    }}>
                                                    <WhatsAppIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline"
                                                className="h-9 w-9 p-0 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0"
                                                onClick={() => setSnoozeModal({ open: true, id: f.id })}>
                                                <Timer className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="outline"
                                                className="h-9 w-9 p-0 rounded-xl border-rose-200 text-rose-500 hover:bg-rose-50 hover:border-rose-300 shrink-0"
                                                disabled={!!activeCall}
                                                onClick={() => setCancelModal({ open: true, id: f.id, name: f.lead_name || 'this follow-up' })}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
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
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-lg border-slate-200"
                            disabled={pagination.page <= 1 || loading} onClick={() => fetchData(pagination.page - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {(() => {
                            const pages = [];
                            const current = pagination.page;
                            const total = pagination.totalPages;
                            let start = Math.max(1, current - 2);
                            let end = Math.min(total, start + 4);
                            if (end - start < 4) start = Math.max(1, end - 4);
                            for (let i = start; i <= end; i++) pages.push(i);
                            return pages.map(p => (
                                <Button key={p} variant={p === current ? 'default' : 'outline'} size="sm"
                                    className={`h-8 w-8 p-0 rounded-lg text-xs font-semibold ${
                                        p === current ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                                    }`}
                                    onClick={() => fetchData(p)}>{p}</Button>
                            ));
                        })()}
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

            {/* ── Cancel Schedule Dialog ── */}
            <Dialog open={cancelModal.open} onOpenChange={(o) => !cancelling && setCancelModal({ open: o, id: null, name: '' })}>
                <DialogContent className="max-w-sm rounded-2xl p-5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                            <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                                <X className="h-4 w-4 text-rose-600" />
                            </div>
                            Cancel Schedule
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 pl-10">
                            Cancel the follow-up for <span className="font-semibold text-slate-700">{cancelModal.name}</span>? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm"
                            disabled={cancelling}
                            onClick={() => setCancelModal({ open: false, id: null, name: '' })}>
                            Keep it
                        </Button>
                        <Button className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm gap-2"
                            disabled={cancelling}
                            onClick={handleCancelSchedule}>
                            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            Cancel schedule
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ScheduledCalls;
