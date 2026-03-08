import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    Clock, CheckCircle2, Phone, MapPin, User, Calendar,
    MoreVertical, Search, Filter, RefreshCw, AlertCircle,
    UserX, BellPlus, PhoneCall,
} from 'lucide-react';

const TYPE_META = {
    CALL:       { label: 'Call',       icon: Phone,       color: 'bg-purple-500' },
    FOLLOWUP:   { label: 'Follow-up',  icon: Clock,       color: 'bg-blue-500'   },
    SITE_VISIT: { label: 'Site Visit', icon: MapPin,      color: 'bg-amber-500'  },
    MEETING:    { label: 'Meeting',    icon: Calendar,    color: 'bg-green-500'  },
    OTHER:      { label: 'Other',      icon: AlertCircle, color: 'bg-slate-500'  },
    NEW_LEAD:   { label: 'New Lead',   icon: UserX,       color: 'bg-rose-500'   },
};

const toDisplayStatus = (status) => {
    if (status === 'COMPLETED') return 'completed';
    if (status === 'SNOOZED')   return 'snoozed';
    return 'pending';
};

const STATUS_STYLES = {
    pending:   { bg: 'bg-yellow-50',  border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800'  },
    completed: { bg: 'bg-green-50',   border: 'border-green-200',  badge: 'bg-green-100  text-green-800'   },
    snoozed:   { bg: 'bg-gray-50',    border: 'border-gray-200',   badge: 'bg-gray-100   text-gray-800'    },
    new_lead:  { bg: 'bg-rose-50',    border: 'border-rose-200',   badge: 'bg-rose-100   text-rose-800'    },
};

const FOLLOWUP_TYPES = [
    { value: 'CALL',       label: 'Call' },
    { value: 'FOLLOWUP',   label: 'Follow-up' },
    { value: 'SITE_VISIT', label: 'Site Visit' },
    { value: 'MEETING',    label: 'Meeting' },
    { value: 'OTHER',      label: 'Other' },
];

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
            invalidateCache('/followups/counts');
            toast.success(`Follow-up scheduled for ${lead.client_name}`);
            onScheduled();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to schedule.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BellPlus className="h-4 w-4 text-amber-600" /> Schedule Follow-up
                    </DialogTitle>
                    <DialogDescription>Set a reminder for <strong>{lead?.client_name}</strong></DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Type</Label>
                        <Select value={form.followup_type} onValueChange={(v) => setForm(p => ({ ...p, followup_type: v }))}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {FOLLOWUP_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date *</Label>
                            <input type="date" className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                min={today} value={form.scheduled_date}
                                onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time</Label>
                            <input type="time" className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                value={form.scheduled_time}
                                onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</Label>
                        <Textarea rows={3} placeholder="Optional notes..." className="resize-none text-sm"
                            value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                    <DialogFooter className="pt-2 border-t">
                        <Button type="button" variant="outline" onClick={onClose} className="h-9">Cancel</Button>
                        <Button type="submit" disabled={saving} className="h-9 bg-amber-600 hover:bg-amber-700">
                            {saving ? 'Scheduling...' : 'Schedule'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const Reminders = () => {
    const navigate = useNavigate();
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [scheduleTarget, setScheduleTarget] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const buildTitle = (f) => {
        const type = f.followup_type || 'CALL';
        const lead = f.lead_name || 'client';
        const titles = {
            CALL:       `Call ${lead}`,
            FOLLOWUP:   `Follow-up with ${lead}`,
            SITE_VISIT: `Site visit with ${lead}`,
            MEETING:    `Meeting with ${lead}`,
            OTHER:      `Reminder for ${lead}`,
        };
        return titles[type] || `Reminder for ${lead}`;
    };

    const fetchReminders = useCallback(async () => {
        try {
            setLoading(true);
            const [followupsRes, leadsRes] = await Promise.allSettled([
                api.get('/followups?limit=200'),
                api.get('/leads?limit=all'),
            ]);

            const followups = followupsRes.status === 'fulfilled' && followupsRes.value.data?.success
                ? (followupsRes.value.data.followups || [])
                : [];

            const leads = leadsRes.status === 'fulfilled' && leadsRes.value.data?.success
                ? (leadsRes.value.data.leads || [])
                : [];

            const activeFollowupLeadIds = new Set(
                followups
                    .filter(f => f.status === 'PENDING' || f.status === 'SNOOZED')
                    .map(f => f.lead_id)
            );

            const followupReminders = followups.map(f => ({
                id: f.id,
                source: 'followup',
                type: f.followup_type || 'CALL',
                client_name: f.lead_name || 'Unknown Client',
                client_phone: f.lead_phone || '-',
                lead_id: f.lead_id,
                title: buildTitle(f),
                description: f.notes || '',
                due_date: f.scheduled_at,
                status: toDisplayStatus(f.status),
                raw_status: f.status,
                agent_name: f.agent_name,
            }));

            const uncontactedReminders = leads
                .filter(l => !activeFollowupLeadIds.has(l.id) && l.status !== 'BOOKED' && l.status !== 'LOST')
                .map(l => ({
                    id: `lead_${l.id}`,
                    source: 'lead',
                    type: 'NEW_LEAD',
                    client_name: l.name || 'Unknown',
                    client_phone: l.phone || '-',
                    lead_id: l.id,
                    title: `Call ${l.name || 'lead'}`,
                    description: l.notes || '',
                    due_date: l.created_at,
                    status: 'new_lead',
                    raw_status: 'UNCONTACTED',
                    lead_status: l.status,
                }));

            const merged = [
                ...uncontactedReminders.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)),
                ...followupReminders.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)),
            ];

            setReminders(merged);
        } catch (err) {
            console.error('Failed to load reminders:', err);
            toast.error('Could not load reminders');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchReminders(); }, [fetchReminders]);

    const handleComplete = async (id) => {
        setActionLoading(id + '_complete');
        try {
            await api.put(`/followups/${id}`, { status: 'COMPLETED' });
            setReminders(prev => prev.map(r => r.id === id ? { ...r, status: 'completed', raw_status: 'COMPLETED' } : r));
            toast.success('Marked as completed');
        } catch {
            toast.error('Failed to update reminder');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSnooze = async (id, minutes) => {
        setActionLoading(id + '_snooze');
        try {
            const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
            await api.put(`/followups/${id}/snooze`, { snooze_until: snoozeUntil });
            setReminders(prev => prev.map(r => r.id === id
                ? { ...r, status: 'snoozed', raw_status: 'SNOOZED', due_date: snoozeUntil }
                : r
            ));
            const label = minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${minutes / 60} hr` : '1 day';
            toast.success(`Snoozed for ${label}`);
        } catch {
            toast.error('Failed to snooze reminder');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredReminders = reminders.filter(r => {
        if (filter === 'uncontacted') return r.status === 'new_lead';
        if (filter !== 'all') return r.status === filter;
        return true;
    }).filter(r => {
        if (!search) return true;
        return r.client_name.toLowerCase().includes(search.toLowerCase()) ||
               r.title.toLowerCase().includes(search.toLowerCase());
    });

    const pendingCount     = reminders.filter(r => r.status === 'pending').length;
    const completedCount   = reminders.filter(r => r.status === 'completed').length;
    const snoozedCount     = reminders.filter(r => r.status === 'snoozed').length;
    const uncontactedCount = reminders.filter(r => r.status === 'new_lead').length;
    const todayCount       = reminders.filter(r => {
        if (r.status !== 'pending') return false;
        return new Date(r.due_date).toDateString() === new Date().toDateString();
    }).length;

    const formatDueTime = (dueDateStr, status) => {
        if (status === 'new_lead') {
            const days = Math.floor((Date.now() - new Date(dueDateStr)) / 86_400_000);
            if (days === 0) return { label: 'Added today', overdue: false };
            if (days === 1) return { label: 'Added 1 day ago', overdue: false };
            return { label: `Added ${days}d ago`, overdue: days > 3 };
        }
        const diffMs = new Date(dueDateStr) - Date.now();
        if (diffMs < 0) return { label: 'Overdue', overdue: true };
        const h = Math.floor(diffMs / 3_600_000);
        const m = Math.floor((diffMs % 3_600_000) / 60_000);
        if (h > 24) return { label: `Due in ${Math.floor(h / 24)}d`, overdue: false };
        if (h > 0)  return { label: `Due in ${h}h ${m}m`, overdue: false };
        return { label: `Due in ${m}m`, overdue: false };
    };

    if (loading) {
        return (
            <div className="space-y-4 max-w-6xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard label="Uncontacted" value={uncontactedCount} icon={UserX}        bg="from-rose-50 to-pink-50"      border="border-rose-200"  text="text-rose-700"   iconColor="text-rose-400"  />
                <StatCard label="Pending"     value={pendingCount}     icon={Clock}        bg="from-amber-50 to-orange-50"  border="border-amber-200" text="text-amber-700"  iconColor="text-amber-400" />
                <StatCard label="Due Today"   value={todayCount}       icon={Calendar}     bg="from-red-50 to-rose-50"      border="border-red-200"   text="text-red-700"    iconColor="text-red-400"   />
                <StatCard label="Completed"   value={completedCount}   icon={CheckCircle2} bg="from-green-50 to-emerald-50" border="border-green-200" text="text-green-700"  iconColor="text-green-400" />
                <StatCard label="Snoozed"     value={snoozedCount}     icon={Clock}        bg="from-slate-50 to-gray-50"    border="border-slate-200" text="text-slate-700"  iconColor="text-slate-400" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Search by client or title..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl border-slate-200" />
                </div>
                <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-full sm:w-44 rounded-xl border-slate-200">
                        <Filter className="w-4 h-4 mr-2 shrink-0" /><SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="uncontacted">Uncontacted</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="snoozed">Snoozed</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={fetchReminders} title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>

            <div className="space-y-3">
                {filteredReminders.length === 0 ? (
                    <div className="text-center py-16">
                        <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No reminders found</p>
                        <p className="text-slate-400 text-sm mt-1">
                            {reminders.length === 0
                                ? 'Leads assigned to you will appear here automatically.'
                                : 'Try a different filter.'}
                        </p>
                    </div>
                ) : (
                    filteredReminders.map(reminder => {
                        const meta = TYPE_META[reminder.type] || TYPE_META.OTHER;
                        const TypeIcon = meta.icon;
                        const styles = STATUS_STYLES[reminder.status] || STATUS_STYLES.pending;
                        const { label: timeLabel, overdue } = formatDueTime(reminder.due_date, reminder.status);
                        const isNewLead = reminder.source === 'lead';

                        return (
                            <div
                                key={reminder.id}
                                className={`rounded-2xl border transition-all ${styles.bg} ${styles.border} p-4 cursor-pointer hover:shadow-md`}
                                onClick={() => { setSelectedReminder(reminder); setShowDetailModal(true); }}
                            >
                                <div className="flex items-start gap-3 md:gap-4">
                                    <div className={`rounded-xl ${meta.color} p-2.5 shrink-0 mt-0.5`}>
                                        <TypeIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 mb-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-slate-900 text-sm md:text-base">{reminder.title}</h3>
                                                <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 border-0 ${styles.badge}`}>
                                                    {reminder.raw_status}
                                                </Badge>
                                                {reminder.lead_status && (
                                                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 border-0 bg-slate-100 text-slate-600">
                                                        {reminder.lead_status}
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className={`text-xs font-semibold whitespace-nowrap ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
                                                {timeLabel}
                                            </span>
                                        </div>
                                        {reminder.description && (
                                            <p className="text-xs text-slate-500 mb-2 line-clamp-1">{reminder.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                <User className="w-3.5 h-3.5 shrink-0" /><span>{reminder.client_name}</span>
                                            </div>
                                            {reminder.client_phone !== '-' && (
                                                <a href={`tel:${reminder.client_phone}`} onClick={e => e.stopPropagation()}
                                                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                                                    <Phone className="w-3.5 h-3.5 shrink-0" /><span>{reminder.client_phone}</span>
                                                </a>
                                            )}
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                <span>
                                                    {reminder.due_date
                                                        ? new Date(reminder.due_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                                                        : '-'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            {isNewLead ? (
                                                <>
                                                    <Button size="sm" className="rounded-lg text-xs h-8 bg-rose-600 hover:bg-rose-700"
                                                        onClick={() => navigate('/leads')}>
                                                        <PhoneCall className="w-3.5 h-3.5 mr-1" /> Call Now
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="rounded-lg text-xs h-8"
                                                        onClick={() => setScheduleTarget(reminder)}>
                                                        <BellPlus className="w-3.5 h-3.5 mr-1" /> Schedule
                                                    </Button>
                                                </>
                                            ) : reminder.status === 'pending' ? (
                                                <>
                                                    <Button size="sm" className="rounded-lg text-xs h-8"
                                                        disabled={actionLoading === reminder.id + '_complete'}
                                                        onClick={() => handleComplete(reminder.id)}>
                                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                        {actionLoading === reminder.id + '_complete' ? 'Saving...' : 'Complete'}
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="sm" variant="outline" className="rounded-lg h-8"
                                                                disabled={actionLoading === reminder.id + '_snooze'}>
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleSnooze(reminder.id, 15)}>Snooze 15 min</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleSnooze(reminder.id, 60)}>Snooze 1 hour</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleSnooze(reminder.id, 1440)}>Snooze 1 day</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </>
                                            ) : reminder.status === 'snoozed' ? (
                                                <Button size="sm" variant="outline" className="rounded-lg text-xs h-8"
                                                    disabled={actionLoading === reminder.id + '_complete'}
                                                    onClick={() => handleComplete(reminder.id)}>
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Done
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedReminder && (
                <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                    <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-base">{selectedReminder.title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 text-sm">
                            <InfoRow label="Type"    value={(TYPE_META[selectedReminder.type] || TYPE_META.OTHER).label} />
                            <InfoRow label="Status"  value={selectedReminder.raw_status} />
                            <InfoRow label="Client"  value={selectedReminder.client_name} />
                            <InfoRow label="Phone"   value={
                                <a href={`tel:${selectedReminder.client_phone}`} className="text-blue-600 hover:underline">
                                    {selectedReminder.client_phone}
                                </a>
                            } />
                            {selectedReminder.description && <InfoRow label="Notes" value={selectedReminder.description} />}
                            <InfoRow label={selectedReminder.source === 'lead' ? 'Added' : 'Scheduled'} value={
                                selectedReminder.due_date
                                    ? new Date(selectedReminder.due_date).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })
                                    : '-'
                            } />
                        </div>
                        <DialogFooter className="gap-2 pt-4">
                            {selectedReminder.source === 'lead' ? (
                                <>
                                    <Button variant="outline" className="rounded-lg" onClick={() => { setShowDetailModal(false); navigate('/leads'); }}>
                                        Go to Leads
                                    </Button>
                                    <Button className="rounded-lg bg-amber-600 hover:bg-amber-700" onClick={() => { setShowDetailModal(false); setScheduleTarget(selectedReminder); }}>
                                        <BellPlus className="w-3.5 h-3.5 mr-1" /> Schedule Follow-up
                                    </Button>
                                </>
                            ) : selectedReminder.status === 'pending' ? (
                                <>
                                    <Button variant="outline" className="rounded-lg" onClick={() => { handleSnooze(selectedReminder.id, 60); setShowDetailModal(false); }}>Snooze 1 hr</Button>
                                    <Button className="rounded-lg" onClick={() => { handleComplete(selectedReminder.id); setShowDetailModal(false); }}>Mark Complete</Button>
                                </>
                            ) : null}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {scheduleTarget && (
                <ScheduleDialog
                    lead={scheduleTarget}
                    open={!!scheduleTarget}
                    onClose={() => setScheduleTarget(null)}
                    onScheduled={fetchReminders}
                />
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon: Icon, bg, border, text, iconColor }) => (
    <div className={`bg-linear-to-br ${bg} rounded-2xl border ${border} p-3 md:p-4`}>
        <div className="flex items-center justify-between">
            <div>
                <p className={`text-[11px] md:text-xs font-medium ${text}`}>{label}</p>
                <p className={`text-xl md:text-2xl font-bold ${text} mt-0.5`}>{value}</p>
            </div>
            <Icon className={`w-8 h-8 md:w-10 md:h-10 ${iconColor} opacity-60`} />
        </div>
    </div>
);

const InfoRow = ({ label, value }) => (
    <div className="flex items-start gap-3">
        <span className="text-xs font-semibold text-slate-400 w-20 shrink-0 pt-0.5">{label}</span>
        <div className="flex-1 text-slate-700">{value}</div>
    </div>
);

export default Reminders;
