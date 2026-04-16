import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { cachedGet, getCachedSync, invalidateCache } from '@/lib/queryCache';
import { useCallAction } from '@/hooks/useCallAction';
import { useCallAction } from '@/hooks/useCallAction';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
    Clock, CheckCircle2, Phone, MapPin, Calendar,
    Search, RefreshCw, AlertCircle,
    UserX, BellPlus, PhoneCall, ChevronLeft, ChevronRight, X,
    Timer, Zap, AlarmClock, CircleDot,
} from 'lucide-react';

/* ─── Flow Curve (same as Dashboard) ─── */
const FlowCurve = ({ color = '#0ea5e9', opacity = 0.13 }) => (
    <svg className="absolute bottom-0 left-0 w-full pointer-events-none" height="38" viewBox="0 0 400 38" preserveAspectRatio="none">
        <path d="M0,22 C50,10 110,34 180,18 C250,2 320,30 400,14 L400,38 L0,38 Z" fill={color} opacity={opacity} />
        <path d="M0,28 C70,14 140,36 220,22 C300,8 360,30 400,20 L400,38 L0,38 Z" fill={color} opacity={opacity * 0.6} />
    </svg>
);

/* ─── Design Tokens ─── */
const TYPE_THEME = {
    CALL:       { icon: Phone,       iconCls: 'bg-indigo-100 text-indigo-600', accent: '#6366f1', label: 'Call',       badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    FOLLOWUP:   { icon: Clock,       iconCls: 'bg-sky-100 text-sky-600',       accent: '#0ea5e9', label: 'Follow-up', badgeCls: 'bg-sky-50 text-sky-700 border-sky-200'          },
    SITE_VISIT: { icon: MapPin,      iconCls: 'bg-amber-100 text-amber-600',   accent: '#f59e0b', label: 'Site Visit',badgeCls: 'bg-amber-50 text-amber-700 border-amber-200'    },
    MEETING:    { icon: Calendar,    iconCls: 'bg-emerald-100 text-emerald-600',accent: '#10b981', label: 'Meeting',   badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
    OTHER:      { icon: AlertCircle, iconCls: 'bg-slate-100 text-slate-600',   accent: '#64748b', label: 'Other',     badgeCls: 'bg-slate-100 text-slate-600 border-slate-200'   },
    NEW_LEAD:   { icon: Zap,         iconCls: 'bg-rose-100 text-rose-600',     accent: '#f43f5e', label: 'New Lead',  badgeCls: 'bg-rose-50 text-rose-700 border-rose-200'       },
};

const STATUS_BADGE = {
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    snoozed:   'bg-slate-100 text-slate-600 border-slate-200',
    new_lead:  'bg-rose-50 text-rose-700 border-rose-200',
};

const FOLLOWUP_TYPES = [
    { value: 'CALL',       label: 'Call' },
    { value: 'FOLLOWUP',   label: 'Follow-up' },
    { value: 'SITE_VISIT', label: 'Site Visit' },
    { value: 'MEETING',    label: 'Meeting' },
    { value: 'OTHER',      label: 'Other' },
];

const FILTERS = [
    { value: 'all',         label: 'All',         icon: CircleDot },
    { value: 'uncontacted', label: 'Uncontacted',  icon: UserX },
    { value: 'pending',     label: 'Pending',      icon: Clock },
    { value: 'snoozed',     label: 'Snoozed',      icon: AlarmClock },
    { value: 'completed',   label: 'Completed',    icon: CheckCircle2 },
];

/* ─── Helpers ─── */
const getInitials = (name) => {
    if (!name || name === 'Unknown') return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const formatDueTime = (dateStr, status) => {
    if (status === 'new_lead') {
        const days = Math.floor((Date.now() - new Date(dateStr)) / 86_400_000);
        if (days === 0) return { text: 'Today', overdue: false, urgent: false };
        if (days === 1) return { text: 'Yesterday', overdue: false, urgent: false };
        if (days <= 7) return { text: `${days}d ago`, overdue: days > 3, urgent: days > 5 };
        return { text: `${Math.floor(days / 7)}w ago`, overdue: true, urgent: true };
    }
    const diff = new Date(dateStr) - Date.now();
    if (diff < 0) {
        const h = Math.abs(Math.floor(diff / 3_600_000));
        if (h < 1) return { text: 'Just now', overdue: true, urgent: true };
        if (h < 24) return { text: `${h}h overdue`, overdue: true, urgent: true };
        return { text: `${Math.floor(h / 24)}d overdue`, overdue: true, urgent: true };
    }
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h >= 48) return { text: `${Math.floor(h / 24)}d`, overdue: false, urgent: false };
    if (h >= 24) return { text: 'Tomorrow', overdue: false, urgent: false };
    if (h > 0) return { text: `${h}h ${m}m`, overdue: false, urgent: h < 2 };
    return { text: `${m}m`, overdue: false, urgent: true };
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const fmtTime = (d) => {
    if (!d) return '';
    const t = new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return t === '12:00 am' ? '' : t;
};

/* ─── Schedule Dialog ─── */
const ScheduleDialog = ({ lead, open, onClose, onScheduled }) => {
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({ followup_type: 'CALL', scheduled_date: today, scheduled_time: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) { setForm({ followup_type: 'CALL', scheduled_date: today, scheduled_time: '', notes: '' }); setError(''); }
    }, [open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.scheduled_date) { setError('Please pick a date.'); return; }
        setSaving(true);
        try {
            await api.post('/followups', {
                lead_id: lead.lead_id,
                followup_type: form.followup_type,
                scheduled_date: form.scheduled_date,
                ...(form.scheduled_time ? { scheduled_time: form.scheduled_time } : {}),
                ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
            });
            invalidateCache('/followups');
            toast.success(`Follow-up scheduled for ${lead.client_name}`);
            onScheduled();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to schedule.');
        } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <BellPlus className="h-4 w-4 text-amber-600" />
                        </div>
                        Schedule Follow-up
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-400 pl-10">For <strong className="text-slate-700">{lead?.client_name}</strong></DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3 mt-1">
                    {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</Label>
                        <Select value={form.followup_type} onValueChange={(v) => setForm(p => ({ ...p, followup_type: v }))}>
                            <SelectTrigger className="h-10 text-sm rounded-xl bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                            <SelectContent>{FOLLOWUP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date *</Label>
                            <input type="date" min={today} value={form.scheduled_date}
                                onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</Label>
                            <input type="time" value={form.scheduled_time}
                                onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes</Label>
                        <Textarea rows={2} placeholder="Optional..." className="resize-none text-sm rounded-xl bg-slate-50 border-slate-200"
                            value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                    <DialogFooter className="pt-3 border-t border-slate-100 gap-2 flex-row">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-10 rounded-xl text-sm border-slate-200">Cancel</Button>
                        <Button type="submit" disabled={saving} className="flex-1 h-10 rounded-xl text-sm bg-amber-600 hover:bg-amber-700 text-white">
                            {saving ? 'Scheduling…' : 'Schedule'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

/* ─── Reminder Card ─── */onCall, 
const ReminderCard = ({ r, onComplete, onSnooze, onSchedule, onCall, actionLoading, navigate }) => {
    const theme = TYPE_THEME[r.type] || TYPE_THEME.OTHER;
    const TypeIcon = theme.icon;
    const { text: timeText, overdue, urgent } = formatDueTime(r.due_date, r.status);
    const isLead = r.source === 'lead';
    const isDone = r.status === 'completed';
    const initials = getInitials(r.client_name);
    const statusLabel = r.status === 'new_lead' ? 'UNCONTACTED' : r.raw_status;
    const statusCls = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
    const dateStr = fmtDate(r.due_date);
    const timeStr = fmtTime(r.due_date);

    return (
        <div className={`relative overflow-hidden rounded-xl bg-white border border-slate-100 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-200 ${isDone ? 'opacity-50' : ''}`}>
            {/* Top accent bar (same as Dashboard stat cards) */}
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: theme.accent }} />

            <div className="p-3.5 pt-4">
                {/* ── Header: avatar + name/phone + time ── */}
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${theme.iconCls}`}>
                        <span className="text-sm font-bold">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.client_name || 'Unknown'}</p>
                        <p className="text-[11px] text-slate-400 mt-px">{r.client_phone || '—'}</p>
                    </div>
                    {/* Time chip */}
                    <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 shrink-0 rounded-md ${
                        overdue
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : urgent
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                        {overdue && <AlertCircle className="h-2.5 w-2.5 mr-1 inline" />}
                        {timeText}
                    </Badge>
                </div>

                {/* ── Meta tags ── */}
                <div className="flex items-center gap-1.5 mt-2.5 pl-[52px] flex-wrap">
                    <Badge variant="outline" className={`text-[9px] font-semibold px-1.5 py-0 rounded-md ${theme.badgeCls}`}>
                        <TypeIcon className="h-2.5 w-2.5 mr-0.5 inline" />
                        {theme.label}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] font-semibold px-1.5 py-0 rounded-md ${statusCls}`}>
                        {statusLabel}
                    </Badge>
                    {r.lead_status && (
                        <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 rounded-md bg-slate-50 text-slate-500 border-slate-200">
                            {r.lead_status}
                        </Badge>
                    )}
                </div>

                {/* ── Date + notes ── */}
                <div className="pl-[52px] mt-2 space-y-1">
                    {r.due_date && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span className="font-medium">{dateStr}</span>
                            {timeStr && <><span className="text-slate-300">·</span><span>{timeStr}</span></>}
                        </div>
                    )}
                    {r.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1">{r.description}</p>
                    )}
                </div>

                {/* ── Actions ── */}
                {!isDone && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 pl-[52px]">
                        {isLead ? (
                            <>onCall(r
                                <Button size="sm" onClick={() => onCall(r)}
                                    className="flex-1 h-8 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-white gap-1">
                                    <PhoneCall className="h-3.5 w-3.5" /> Call Now
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => onSchedule(r)}
                                    className="flex-1 h-8 rounded-lg text-xs border-slate-200 text-slate-600 hover:bg-slate-50 gap-1">
                                    <BellPlus className="h-3.5 w-3.5" /> Schedule
                                </Button>
                            </>
                        ) : r.status === 'pending' ? (
                            <>
                                <Button size="sm"
                                    disabled={actionLoading === r.id + '_complete'}
                                    onClick={() => onComplete(r.id)}
                                    className="flex-1 h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {actionLoading === r.id + '_complete' ? 'Saving…' : 'Done'}
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline"
                                            disabled={actionLoading === r.id + '_snooze'}
                                            className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:bg-slate-50 shrink-0">
                                            <Timer className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={() => onSnooze(r.id, 15)}>
                                            <Clock className="h-3.5 w-3.5 text-slate-400" /> Snooze 15 min
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={() => onSnooze(r.id, 60)}>
                                            <Clock className="h-3.5 w-3.5 text-slate-400" /> Snooze 1 hour
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={() => onSnooze(r.id, 1440)}>
                                            <Clock className="h-3.5 w-3.5 text-slate-400" /> Snooze 1 day
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        ) : r.status === 'snoozed' ? (
                            <Button size="sm" variant="outline"
                                disabled={actionLoading === r.id + '_complete'} onClick={() => onComplete(r.id)}
                                className="h-8 rounded-lg text-xs border-slate-200 text-slate-600 hover:bg-slate-50 gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Done
                            </Button>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Flow curve */}
            <FlowCurve color={theme.accent} opacity={0.08} />
        </div>
    );
};

/* ─── Skeleton ─── */
const CardSkeleton = () => (
    <div className="rounded-xl bg-white border border-slate-100 p-3.5 pt-5 overflow-hidden">
        <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
            <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-3 pl-[52px] space-y-2">
            <div className="flex gap-1.5"><Skeleton className="h-4 w-16 rounded-md" /><Skeleton className="h-4 w-20 rounded-md" /></div>
            <Skeleton className="h-3 w-28 rounded" />
            <div className="flex gap-2 pt-2"><Skeleton className="h-8 flex-1 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div>
        </div>
    </div>
);

/* ─── Stat Card (matches Dashboard) ─── */
const StatTile = ({ label, value, icon: Icon, tone, hex, active, onClick }) => (
    <button onClick={onClick}
        className={`relative overflow-hidden rounded-xl bg-white border p-3 pb-10 text-left transition-all duration-200 shadow-sm shrink-0 w-[100px] ${
            active ? 'border-slate-300 shadow-md ring-1 ring-slate-200' : 'border-slate-100 hover:shadow-md hover:border-slate-200'
        }`}>
        <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${tone}`} />
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
            active ? 'scale-110' : ''
        } transition-transform`} style={{ backgroundColor: hex + '18', color: hex }}>
            <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-xl font-bold text-slate-900 mt-2 leading-none">{value}</p>
        <p className="text-[10px] font-semibold text-slate-500 mt-1">{label}</p>
        <FlowCurve color={hex} opacity={0.1} />
    </button>
);

/* ─── Main ─── */
const Reminders = () => {
    const navigate = useNavigate();
    const { initiateCall } = useCallAction();
    const _initCached = getCachedSync('/followups/reminders?page=1&limit=30&filter=all');
    const [reminders, setReminders] = useState(() => _initCached?.reminders ?? []);
    const [counts, setCounts] = useState({ pending: 0, completed: 0, snoozed: 0, uncontacted: 0, dueToday: 0 });
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const hasDataRef = useRef(Boolean(_initCached));
    const [loading, setLoading] = useState(!_initCached);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [scheduleTarget, setScheduleTarget] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const handleCallReminder = useCallback((r) => {
        const phone = r.client_phone;
        if (!phone) { toast.error('No phone number for this reminder'); return; }
        initiateCall(phone, { leadId: r.lead_id, name: r.client_name });
    }, [initiateCall]);

    const fetchReminders = useCallback(async (pg = 1, currentFilter, currentSearch) => {
        if (!hasDataRef.current) setLoading(true);
        else setRefreshing(true);
        try {
            const params = new URLSearchParams({ page: pg, limit: 30, filter: currentFilter });
            if (currentSearch) params.set('search', currentSearch);
            const data = await cachedGet(`/followups/reminders?${params}`, { staleTime: 120_000, cacheTime: 300_000 });
            if (data.success) {
                setReminders(data.reminders || []);
                setCounts(data.counts || {});
                setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
                hasDataRef.current = true;
            }
        } catch {
            toast.error('Failed to load reminders');
        } finally { 
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => fetchReminders(1, filter, search), search ? 300 : 0);
        return () => clearTimeout(t);
    }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

    const goPage = (pg) => fetchReminders(pg, filter, search);

    const handleComplete = async (id) => {
        setActionLoading(id + '_complete');
        try {
            await api.put(`/followups/${id}`, { status: 'COMPLETED' });
            setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'completed', raw_status: 'COMPLETED' } : r));
            setCounts(p => ({ ...p, pending: Math.max(0, p.pending - 1), completed: p.completed + 1 }));
            toast.success('Marked as completed');
        } catch { toast.error('Failed to update'); }
        finally { setActionLoading(null); }
    };

    const handleSnooze = async (id, minutes) => {
        setActionLoading(id + '_snooze');
        try {
            const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
            await api.put(`/followups/${id}/snooze`, { snooze_until: snoozeUntil });
            setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'snoozed', raw_status: 'SNOOZED', due_date: snoozeUntil } : r));
            setCounts(p => ({ ...p, pending: Math.max(0, p.pending - 1), snoozed: p.snoozed + 1 }));
            const label = minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${minutes / 60}h` : '1d';
            toast.success(`Snoozed for ${label}`);
        } catch { toast.error('Failed to snooze'); }
        finally { setActionLoading(null); }
    };

    const filterCountMap = { all: pagination.total, uncontacted: counts.uncontacted, pending: counts.pending, snoozed: counts.snoozed, completed: counts.completed };

    return (
        <div className="space-y-4 pb-6">

            {/* ── Stat tiles (Dashboard-style with flow curves) ── */}
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8">
                <div className="flex gap-2.5 w-max">
                    <StatTile label="Uncontacted" value={counts.uncontacted} icon={UserX}
                        tone="from-rose-400 to-rose-500" hex="#f43f5e"
                        active={filter === 'uncontacted'}
                        onClick={() => setFilter(f => f === 'uncontacted' ? 'all' : 'uncontacted')} />
                    <StatTile label="Pending" value={counts.pending} icon={Clock}
                        tone="from-amber-400 to-amber-500" hex="#f59e0b"
                        active={filter === 'pending'}
                        onClick={() => setFilter(f => f === 'pending' ? 'all' : 'pending')} />
                    <StatTile label="Due Today" value={counts.dueToday} icon={Timer}
                        tone="from-red-400 to-red-500" hex="#ef4444"
                        active={false} onClick={() => {}} />
                    <StatTile label="Done" value={counts.completed} icon={CheckCircle2}
                        tone="from-emerald-400 to-emerald-500" hex="#10b981"
                        active={filter === 'completed'}
                        onClick={() => setFilter(f => f === 'completed' ? 'all' : 'completed')} />
                    <StatTile label="Snoozed" value={counts.snoozed} icon={AlarmClock}
                        tone="from-slate-400 to-slate-500" hex="#64748b"
                        active={filter === 'snoozed'}
                        onClick={() => setFilter(f => f === 'snoozed' ? 'all' : 'snoozed')} />
                </div>
            </div>

            {/* ── Sticky: Search + Filter chips ── */}
            <div className="sticky top-0 z-10 -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 bg-background space-y-2 pb-1">
                {/* Search */}
                <div className="relative overflow-hidden rounded-xl bg-white border border-slate-100 shadow-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                        placeholder="Search name or phone…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-10 h-11 border-0 shadow-none text-sm placeholder:text-slate-300 focus-visible:ring-0"
                        autoComplete="off"
                    />
                    {search ? (
                        <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                            <X className="h-4 w-4" />
                        </button>
                    ) : (
                        <>
                            <button onClick={() => fetchReminders(pagination.page, filter, search)} disabled={loading}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-40" tabIndex={-1}>
                                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            {refreshing && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />}
                        </>
                    )}
                </div>

                {/* Filter chips */}
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex gap-1.5 w-max">
                        {FILTERS.map(f => {
                            const active = filter === f.value;
                            const cnt = filterCountMap[f.value];
                            const FilterIcon = f.icon;
                            return (
                                <button key={f.value} onClick={() => setFilter(f.value)}
                                    className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                                        active
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                                    }`}>
                                    <FilterIcon className={`h-3 w-3 ${active ? 'text-white/70' : 'text-slate-400'}`} />
                                    {f.label}
                                    {cnt > 0 && (
                                        <span className={`text-[10px] font-bold min-w-[18px] text-center px-1 rounded-full leading-4 ${
                                            active ? 'bg-white/20' : 'bg-slate-100 text-slate-400'
                                        }`}>{cnt}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Cards ── */}
            {loading ? (
                <div className="space-y-2.5">
                    {Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            ) : reminders.length === 0 ? (
                <div className="text-center py-16 rounded-2xl bg-white border border-slate-100 shadow-sm">
                    <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">All caught up!</p>
                    <p className="text-xs text-slate-400 mt-1">No reminders match this filter</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {reminders.map(r => (
                        <ReminderCard
                            key={r.id}
                            r={r}
                            onComplete={handleComplete}
                            onSnooze={handleSnooze}
                            onSchedule={setScheduleTarget}
                            onCall={handleCallReminder}
                            actionLoading={actionLoading}
                            navigate={navigate}
                        />
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && !loading && (
                <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-400 font-medium">
                        {pagination.total} results · page {pagination.page}/{pagination.totalPages}
                    </p>
                    <div className="flex gap-1.5">
                        <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-lg border-slate-200"
                            disabled={pagination.page <= 1} onClick={() => goPage(pagination.page - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 rounded-lg border-slate-200"
                            disabled={pagination.page >= pagination.totalPages} onClick={() => goPage(pagination.page + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Schedule dialog ── */}
            {scheduleTarget && (
                <ScheduleDialog
                    lead={scheduleTarget}
                    open={!!scheduleTarget}
                    onClose={() => setScheduleTarget(null)}
                    onScheduled={() => fetchReminders(pagination.page, filter, search)}
                />
            )}
        </div>
    );
};

export default Reminders;
