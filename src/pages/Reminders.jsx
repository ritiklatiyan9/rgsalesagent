import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { cachedGet, getCachedSync } from '@/lib/queryCache';
import { broadcastMutation, onMutation } from '@/lib/mutationBus';
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

/* ─── Editorial serif ─── */
const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

/* ─── Mini sparkline (editorial stat cards) ─── */
const SPARK_PATTERNS = {
    line: [3, 5, 4, 6, 5, 8, 7, 9],
    bars: [3, 6, 4, 7, 5, 8, 6, 9],
    down: [9, 7, 8, 5, 6, 3, 4, 2],
    rise: [2, 4, 3, 5, 6, 7, 8, 9],
};
const MiniSpark = ({ color = '#6366f1', pattern = 'line', variant = 'line', uid = 'x' }) => {
    const data = SPARK_PATTERNS[pattern] || SPARK_PATTERNS.line;
    const w = 56, h = 24, max = 10, step = w / (data.length - 1);
    if (variant === 'bars') {
        const bw = (w - (data.length * 2)) / data.length;
        return (
            <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-6 shrink-0 opacity-85" preserveAspectRatio="none">
                {data.map((v, i) => {
                    const bh = (v / max) * h;
                    return <rect key={i} x={i * (bw + 2)} y={h - bh} width={bw} height={bh} rx="1" fill={color} opacity={0.55 + (v / max) * 0.45} />;
                })}
            </svg>
        );
    }
    const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
    const area = `0,${h} ${pts} ${w},${h}`;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-6 shrink-0" preserveAspectRatio="none">
            <defs>
                <linearGradient id={`rm-${uid}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline points={area} fill={`url(#rm-${uid})`} stroke="none" />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

/* ─── Design Tokens ─── */
const TYPE_THEME = {
    CALL:       { icon: Phone,       iconCls: 'bg-indigo-100 text-indigo-600', accent: '#6366f1', ribbon: 'from-indigo-500 via-indigo-500 to-violet-500', label: 'Call',       badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    FOLLOWUP:   { icon: Clock,       iconCls: 'bg-sky-100 text-sky-600',       accent: '#0ea5e9', ribbon: 'from-sky-500 via-sky-500 to-cyan-500',         label: 'Follow-up', badgeCls: 'bg-sky-50 text-sky-700 border-sky-200'          },
    SITE_VISIT: { icon: MapPin,      iconCls: 'bg-amber-100 text-amber-600',   accent: '#f59e0b', ribbon: 'from-amber-500 via-amber-500 to-orange-500',   label: 'Site Visit',badgeCls: 'bg-amber-50 text-amber-700 border-amber-200'    },
    MEETING:    { icon: Calendar,    iconCls: 'bg-emerald-100 text-emerald-600',accent: '#10b981', ribbon: 'from-emerald-500 via-emerald-500 to-teal-500',label: 'Meeting',   badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
    OTHER:      { icon: AlertCircle, iconCls: 'bg-slate-100 text-slate-600',   accent: '#64748b', ribbon: 'from-slate-500 via-slate-500 to-slate-600',   label: 'Other',     badgeCls: 'bg-slate-100 text-slate-600 border-slate-200'   },
    NEW_LEAD:   { icon: Zap,         iconCls: 'bg-rose-100 text-rose-600',     accent: '#f43f5e', ribbon: 'from-rose-500 via-rose-500 to-red-500',       label: 'New Lead',  badgeCls: 'bg-rose-50 text-rose-700 border-rose-200'       },
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

const CardRibbon = ({ ribbon }) => (
    <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${ribbon}`} />
);

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
            broadcastMutation(['followups']);
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

/* ─── Reminder Card ─── */
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
        <div className={`relative overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] hover:ring-slate-200 hover:shadow-[0_10px_26px_-12px_rgba(15,23,42,0.14)] transition-all duration-200 ${isDone ? 'opacity-55' : ''}`}>
            <CardRibbon ribbon={theme.ribbon} />

            <div className="p-3.5 pt-4">
                {/* ── Header: avatar + name/phone + time ── */}
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-black/5 ${theme.iconCls}`}>
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
                <div className="flex items-center gap-1.5 mt-2.5 pl-13 flex-wrap">
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
                <div className="pl-13 mt-2 space-y-1">
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
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/70 pl-13">
                        {isLead ? (
                            <>
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
        </div>
    );
};

/* ─── Skeleton ─── */
const CardSkeleton = () => (
    <div className="rounded-[22px] bg-white ring-1 ring-slate-100 p-3.5 pt-4 overflow-hidden">
        <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
            <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-3 pl-13 space-y-2">
            <div className="flex gap-1.5"><Skeleton className="h-4 w-16 rounded-md" /><Skeleton className="h-4 w-20 rounded-md" /></div>
            <Skeleton className="h-3 w-28 rounded" />
            <div className="flex gap-2 pt-2"><Skeleton className="h-8 flex-1 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div>
        </div>
    </div>
);

/* ─── Stat Tile — editorial ─── */
const StatTile = ({ label, short, value, icon: Icon, tone, hex, spark = 'line', variant = 'line', uid = 'x', active, onClick }) => (
    <button onClick={onClick}
        className={`group relative overflow-hidden rounded-[22px] bg-white p-3.5 pt-4 text-left transition-all duration-150 active:scale-[0.97] ${
            active
                ? 'ring-2 ring-offset-0 shadow-[0_10px_26px_-12px_rgba(15,23,42,0.2)]'
                : 'ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] hover:ring-slate-200 hover:shadow-[0_10px_26px_-12px_rgba(15,23,42,0.14)]'
        }`}
        style={active ? { '--tw-ring-color': hex + '4d' } : undefined}>
        <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${tone}`} />
        <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: hex }}>{short}</p>
            <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: hex + '1a', color: hex }}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
            <p className="text-[30px] font-bold text-slate-900 leading-none tabular-nums tracking-tight" style={serif}>{value ?? 0}</p>
            <MiniSpark color={hex} pattern={spark} variant={variant} uid={uid} />
        </div>
        <p className="text-[12px] font-semibold text-slate-800 mt-2.5">{label}</p>
    </button>
);

/* ─── Wide Stat Tile — editorial (Matter Leads pattern) ─── */
const WideStatTile = ({ label, short, hint, value, icon: Icon, tone, hex, spark = 'rise', variant = 'line', uid = 'w', active, onClick }) => (
    <button onClick={onClick}
        className={`relative w-full overflow-hidden rounded-[22px] bg-white p-4 pt-5 text-left transition-all duration-150 active:scale-[0.98] flex items-center gap-3.5 ${
            active
                ? 'ring-2 shadow-[0_10px_26px_-12px_rgba(15,23,42,0.2)]'
                : 'ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] hover:ring-slate-200 hover:shadow-[0_10px_26px_-12px_rgba(15,23,42,0.14)]'
        }`}
        style={active ? { '--tw-ring-color': hex + '4d' } : undefined}>
        <div className={`absolute top-0 left-0 right-0 h-1 bg-linear-to-r ${tone}`} />
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-slate-100" style={{ backgroundColor: hex + '1a', color: hex }}>
            <Icon className="h-5.5 w-5.5" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: hex }}>{short}</p>
            <p className="text-[28px] font-bold text-slate-900 leading-none tabular-nums tracking-tight mt-1" style={serif}>{value ?? 0}</p>
            <p className="text-[11px] font-semibold text-slate-700 mt-1">{label} <span className="font-medium text-slate-400">· {hint}</span></p>
        </div>
        <MiniSpark color={hex} pattern={spark} variant={variant} uid={uid} />
        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
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

    const fetchReminders = useCallback(async (pg = 1, currentFilter, currentSearch, force = false) => {
        if (!hasDataRef.current) setLoading(true);
        else setRefreshing(true);
        try {
            const params = new URLSearchParams({ page: pg, limit: 30, filter: currentFilter });
            if (currentSearch) params.set('search', currentSearch);
            const data = await cachedGet(`/followups/reminders?${params}`, { staleTime: 120_000, cacheTime: 300_000, force });
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

    const fetchRemindersRef = useRef(fetchReminders);
    fetchRemindersRef.current = fetchReminders;
    const reminderFiltersRef = useRef({ filter, search, page: pagination.page });
    reminderFiltersRef.current = { filter, search, page: pagination.page };

    useEffect(() => onMutation((entities) => {
        if (entities.includes('followups')) {
            const f = reminderFiltersRef.current;
            fetchRemindersRef.current(f.page, f.filter, f.search, true);
        }
    }), []);

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
            broadcastMutation(['followups']);
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
            broadcastMutation(['followups']);
        } catch { toast.error('Failed to snooze'); }
        finally { setActionLoading(null); }
    };

    const filterCountMap = { all: pagination.total, uncontacted: counts.uncontacted, pending: counts.pending, snoozed: counts.snoozed, completed: counts.completed };

    const descriptiveLine = (() => {
        const parts = [];
        if (counts.uncontacted > 0) parts.push(`${counts.uncontacted} uncontacted`);
        if (counts.pending > 0) parts.push(`${counts.pending} pending`);
        if (counts.dueToday > 0) parts.push(`${counts.dueToday} due today`);
        if (parts.length === 0) return 'Inbox zero — everything handled.';
        return parts.slice(0, 2).join(' · ') + '.';
    })();

    return (
        <div className="space-y-5 pb-6">

            {/* ══════ HEADER — editorial ══════ */}
            <header className="space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Inbox</p>
                <h1 className="leading-[1.05] tracking-tight flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[28px] font-bold text-slate-900">Your</span>
                    <span className="text-[28px] font-normal italic text-indigo-600" style={serif}>reminders.</span>
                </h1>
                <p className="text-[13px] text-slate-500 italic leading-snug max-w-70" style={serif}>
                    {descriptiveLine}
                </p>
            </header>

            {/* ══════ STATS — editorial 2×2 + wide ══════ */}
            <div className="grid grid-cols-2 gap-3">
                <StatTile label="Uncontacted" short="NEW LEADS" value={counts.uncontacted} icon={UserX}
                    tone="from-rose-500 via-pink-500 to-fuchsia-500" hex="#f43f5e"
                    spark="rise" variant="line" uid="r1"
                    active={filter === 'uncontacted'}
                    onClick={() => setFilter(f => f === 'uncontacted' ? 'all' : 'uncontacted')} />
                <StatTile label="Pending" short="OPEN" value={counts.pending} icon={Clock}
                    tone="from-orange-500 via-amber-500 to-yellow-500" hex="#f59e0b"
                    spark="bars" variant="bars" uid="r2"
                    active={filter === 'pending'}
                    onClick={() => setFilter(f => f === 'pending' ? 'all' : 'pending')} />
                <StatTile label="Due Today" short="URGENT" value={counts.dueToday} icon={Timer}
                    tone="from-red-500 via-rose-500 to-pink-500" hex="#ef4444"
                    spark="rise" variant="line" uid="r3"
                    active={false} onClick={() => {}} />
                <StatTile label="Done" short="COMPLETED" value={counts.completed} icon={CheckCircle2}
                    tone="from-emerald-500 via-teal-500 to-cyan-500" hex="#10b981"
                    spark="rise" variant="line" uid="r4"
                    active={filter === 'completed'}
                    onClick={() => setFilter(f => f === 'completed' ? 'all' : 'completed')} />
            </div>

            <WideStatTile label="Snoozed" short="PAUSED" hint="Resume later"
                value={counts.snoozed} icon={AlarmClock}
                tone="from-sky-500 via-cyan-500 to-blue-500" hex="#0ea5e9"
                spark="line" variant="line" uid="r5"
                active={filter === 'snoozed'}
                onClick={() => setFilter(f => f === 'snoozed' ? 'all' : 'snoozed')} />

            {/* ══════ SEARCH ══════ */}
            <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)]">
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

            {/* ══════ FILTERS — editorial pills ══════ */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {FILTERS.map(f => {
                    const active = filter === f.value;
                    const cnt = filterCountMap[f.value];
                    const FilterIcon = f.icon;
                    return (
                        <button key={f.value} onClick={() => setFilter(f.value)}
                            className={`shrink-0 h-9 pl-2.5 pr-3 rounded-full text-[11px] font-bold leading-none whitespace-nowrap flex items-center gap-1.5 ring-1 ring-inset active:scale-95 transition-all duration-150 ${
                                active
                                    ? 'bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-300/40 ring-transparent'
                                    : 'bg-white text-slate-600 ring-slate-200'
                            }`}>
                            <FilterIcon className={`h-3 w-3 ${active ? 'text-white/80' : 'text-slate-400'}`} />
                            {f.label}
                            {cnt > 0 && (
                                <span className={`text-[10px] font-bold min-w-4.5 text-center px-1 rounded-full leading-4 ${
                                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>{cnt}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ══════ List header ══════ */}
            <div className="flex items-end justify-between pt-1">
                <h2 className="text-[18px] font-bold text-slate-900 tracking-tight" style={serif}>
                    Reminder
                    <span className="italic text-slate-500 ml-1.5 font-normal">queue</span>
                </h2>
                {!loading && reminders.length > 0 && (
                    <span className="text-[10px] font-bold tracking-[0.22em] text-slate-400 uppercase tabular-nums pb-1">
                        {pagination.total} total
                    </span>
                )}
            </div>

            {/* ── Cards ── */}
            {loading ? (
                <div className="space-y-3">
                    {Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            ) : reminders.length === 0 ? (
                <div className="rounded-[22px] bg-linear-to-br from-emerald-50/80 to-teal-50/60 py-14 flex flex-col items-center ring-1 ring-emerald-100/60">
                    <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center mb-3 shadow-sm ring-1 ring-emerald-100">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" strokeWidth={2} />
                    </div>
                    <p className="text-sm font-bold text-slate-800" style={serif}>All caught up!</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">No reminders match this filter.</p>
                </div>
            ) : (
                <div className="space-y-3">
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
