import { useState, useEffect, useMemo, useRef } from 'react';
import { format, parseISO, isPast } from 'date-fns';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Drawer, DrawerContent, DrawerClose, DrawerTitle } from '@/components/ui/drawer';
import ImageUploader, { ImageGallery } from '@/components/ImageUploader';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, Loader2, Flag,
  Calendar, X, Paperclip, Camera, Circle, ListChecks, Play,
  ChevronRight,
} from 'lucide-react';

/* ─── Design tokens ─── */
const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const STATUSES = [
  { value: 'PENDING',     label: 'Pending', icon: Circle,        bg: 'bg-amber-50',   ring: 'ring-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  { value: 'IN_PROGRESS', label: 'Active',  icon: Clock,         bg: 'bg-blue-50',    ring: 'ring-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  { value: 'COMPLETED',   label: 'Done',    icon: CheckCircle2,  bg: 'bg-emerald-50', ring: 'ring-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { value: 'OVERDUE',     label: 'Overdue', icon: AlertTriangle, bg: 'bg-rose-50',    ring: 'ring-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500' },
];

const PRIORITY_CONFIG = {
  LOW:    { label: 'Low',    dot: 'bg-slate-300', text: 'text-slate-600', bg: 'bg-slate-100',   accent: '#94a3b8', drawerGrad: 'from-slate-50 to-white' },
  MEDIUM: { label: 'Medium', dot: 'bg-blue-400',  text: 'text-blue-700',  bg: 'bg-blue-50',     accent: '#3b82f6', drawerGrad: 'from-blue-50 via-indigo-50 to-white' },
  HIGH:   { label: 'High',   dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50',    accent: '#f59e0b', drawerGrad: 'from-amber-50 via-orange-50 to-white' },
  URGENT: { label: 'Urgent', dot: 'bg-rose-500',  text: 'text-rose-700',  bg: 'bg-rose-50',     accent: '#f43f5e', drawerGrad: 'from-rose-50 via-pink-50 to-white' },
};

const STATUS_CARD_BG = {
  PENDING:     'from-amber-50/50 via-white to-white',
  IN_PROGRESS: 'from-blue-50/50 via-white to-white',
  COMPLETED:   'from-emerald-50/60 via-white to-white',
  OVERDUE:     'from-rose-50/60 via-white to-white',
};

const TAB_STYLES = {
  ALL:         'bg-linear-to-r from-violet-600 to-purple-600',
  PENDING:     'bg-linear-to-r from-amber-500 to-orange-500',
  IN_PROGRESS: 'bg-linear-to-r from-blue-600 to-indigo-600',
  OVERDUE:     'bg-linear-to-r from-rose-500 to-red-500',
  COMPLETED:   'bg-linear-to-r from-emerald-500 to-teal-500',
};

const TABS = [
  { key: 'ALL',         label: 'All' },
  { key: 'PENDING',     label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'Active' },
  { key: 'OVERDUE',     label: 'Overdue' },
  { key: 'COMPLETED',   label: 'Done' },
];

const ANALYTICS_BUCKET = { PENDING: 'pending', IN_PROGRESS: 'in_progress', COMPLETED: 'completed', OVERDUE: 'overdue' };

/* ─── Helpers ─── */
const fmtDate = (d) => {
  if (!d) return '';
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy'); }
  catch { return ''; }
};

const isOverdue = (task) => {
  if (task.status === 'COMPLETED') return false;
  if (task.status === 'OVERDUE') return true;
  if (!task.due_date) return false;
  try { return isPast(parseISO(task.due_date)); } catch { return false; }
};

/* ─── Sub-components ─── */
function StatCard({ label, value, grad, ring, textColor, alert }) {
  return (
    <div className={`rounded-2xl bg-linear-to-b ${grad} ring-1 ${alert ? 'ring-rose-200' : ring} p-3`}>
      <p className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${textColor}`} style={serif}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 mt-1.5 leading-none">{label}</p>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const c = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-md text-[10px] font-bold uppercase tracking-wide ${c.text} ${c.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function StatusBadge({ status, overdue }) {
  const s = STATUSES.find(x => x.value === (overdue && status !== 'COMPLETED' ? 'OVERDUE' : status)) || STATUSES[0];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-md text-[10px] font-bold uppercase tracking-wide ${s.text} ${s.bg} ring-1 ${s.ring}`}>
      <Icon className="h-3 w-3" strokeWidth={2.2} />
      {s.label}
    </span>
  );
}

function DateBadge({ date, overdue }) {
  if (!date) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-md text-[10px] font-semibold ${
      overdue ? 'text-rose-700 bg-rose-50 ring-1 ring-rose-100' : 'text-slate-600 bg-slate-50 ring-1 ring-slate-100'
    }`}>
      <Calendar className="h-3 w-3" />
      {fmtDate(date)}
    </span>
  );
}

function TaskCard({ task, onOpen, onStart, onComplete, onReopen }) {
  const overdue = isOverdue(task);
  const isDone = task.status === 'COMPLETED';
  const isPending = task.status === 'PENDING';
  const isActive = task.status === 'IN_PROGRESS';
  const proofCount = Array.isArray(task.proof_attachments) ? task.proof_attachments.length : 0;
  const adminCount = Array.isArray(task.admin_attachments) ? task.admin_attachments.length : 0;

  const stop = (e, fn) => { e.stopPropagation(); fn(); };
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const bgGrad = overdue && !isDone ? 'from-rose-50/60 via-white to-white' : (STATUS_CARD_BG[task.status] || 'from-white to-white');

  return (
    <div
      onClick={onOpen}
      className={`relative overflow-hidden w-full text-left rounded-2xl bg-linear-to-br ${bgGrad} ring-1 ${
        overdue && !isDone ? 'ring-rose-200/70' : isDone ? 'ring-emerald-100' : 'ring-slate-100'
      } cursor-pointer active:scale-[0.99] transition-all duration-150 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.05)]`}
    >
      {/* Priority accent bar — left edge */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        style={{ backgroundColor: pc.accent }}
      />

      <div className="pl-4 pr-3.5 py-3.5">
        <div className="flex items-start gap-3">
          {/* Status toggle */}
          <button
            onClick={(e) => stop(e, isDone ? onReopen : onComplete)}
            className={`shrink-0 mt-0.5 h-6 w-6 rounded-full flex items-center justify-center ring-1 transition-all active:scale-90 ${
              isDone    ? 'bg-emerald-500 text-white ring-emerald-400'
              : isActive ? 'bg-blue-100 text-blue-600 ring-blue-200'
              : overdue  ? 'bg-rose-100 text-rose-500 ring-rose-200'
              :            'bg-white text-slate-400 ring-slate-200'
            }`}
            title={isDone ? 'Reopen task' : 'Mark complete'}
          >
            {isDone    ? <CheckCircle2 className="h-3.5 w-3.5" />
            : isActive  ? <Clock className="h-3.5 w-3.5" />
            :              <Circle className="h-3.5 w-3.5" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-[13.5px] font-semibold leading-snug ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {task.title}
              </p>
              {/* Priority dot label */}
              <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${pc.dot}`} />
                {pc.label}
              </span>
            </div>

            {task.description && (
              <p className="text-[11.5px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
            )}

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <StatusBadge status={task.status} overdue={overdue} />
              <DateBadge date={task.due_date} overdue={overdue} />
              {(adminCount + proofCount) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md ring-1 ring-slate-100">
                  <Paperclip className="h-2.5 w-2.5" />
                  {adminCount + proofCount}
                </span>
              )}
              {task.assigned_by_name && (
                <span className="text-[9.5px] text-slate-400 truncate max-w-[100px]">by {task.assigned_by_name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Inline actions */}
        {!isDone ? (
          <div className="flex gap-1.5 mt-3">
            {isPending && (
              <button onClick={(e) => stop(e, onStart)}
                className="flex-1 h-8 rounded-xl text-[11px] font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-200 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5">
                <Play className="h-3.5 w-3.5 fill-current" />
                Start
              </button>
            )}
            <button onClick={(e) => stop(e, onOpen)}
              className="flex-1 h-8 rounded-xl text-[11px] font-bold bg-white text-slate-600 ring-1 ring-slate-200 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5">
              <Camera className="h-3.5 w-3.5" />
              Proof
            </button>
            <button onClick={(e) => stop(e, onComplete)}
              className="flex-1 h-8 rounded-xl text-[11px] font-bold bg-linear-to-r from-emerald-500 to-teal-500 text-white active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-200/50">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </button>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed {task.completed_at ? fmtDate(task.completed_at) : ''}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-linear-to-br from-violet-50 via-purple-50 to-fuchsia-50 ring-1 ring-violet-100/60 p-8 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-white ring-1 ring-violet-100 flex items-center justify-center mb-3 shadow-sm">
        <ListChecks className="h-7 w-7 text-violet-500" />
      </div>
      <p className="text-[15px] font-semibold text-slate-800">No tasks here</p>
      <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">Tasks assigned by admin<br />will appear in this section.</p>
    </div>
  );
}

/* ─── Main Component ─── */
export default function SupervisionTasks() {
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [drawerTask, setDrawerTask] = useState(null);
  const [proofPhotos, setProofPhotos] = useState([]);

  const queueRef = useRef(new Map());
  const [pending, setPending] = useState(0);

  const loadAll = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [tasksRes, analyticsRes] = await Promise.all([
        api.get('/supervision-tasks'),
        api.get('/supervision-tasks/analytics'),
      ]);
      if (tasksRes.data?.success) setTasks(tasksRes.data.tasks || []);
      if (analyticsRes.data?.success) setAnalytics(analyticsRes.data.analytics || null);
    } catch (err) {
      if (!silent) toast.error(err?.response?.data?.message || 'Failed to load tasks');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (drawerTask) {
      setProofPhotos(Array.isArray(drawerTask.proof_attachments) ? [...drawerTask.proof_attachments] : []);
    } else {
      setProofPhotos([]);
    }
  }, [drawerTask?.id]);

  useEffect(() => {
    if (pending !== 0) return;
    const t = setTimeout(() => {
      api.get('/supervision-tasks/analytics')
        .then(({ data }) => { if (data?.success) setAnalytics(data.analytics || null); })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [pending]);

  const patchAnalytics = (fromStatus, toStatus) => {
    if (fromStatus === toStatus) return;
    setAnalytics((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const from = ANALYTICS_BUCKET[fromStatus];
      const to   = ANALYTICS_BUCKET[toStatus];
      if (from) next[from] = Math.max(0, (Number(next[from]) || 0) - 1);
      if (to)   next[to]   = (Number(next[to]) || 0) + 1;
      return next;
    });
  };

  const applyOptimistic = (task, newStatus, extra = {}) => {
    const completedAt = newStatus === 'COMPLETED'
      ? new Date().toISOString()
      : (newStatus === task.status ? task.completed_at : null);
    const patched = { ...task, status: newStatus, completed_at: completedAt, ...extra };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? patched : t)));
    setDrawerTask((d) => (d && d.id === task.id ? patched : d));
    patchAnalytics(task.status, newStatus);
    return patched;
  };

  const enqueueServerSync = (taskId, payload, rollbackSnapshot) => {
    setPending((n) => n + 1);
    const tail = queueRef.current.get(taskId) || Promise.resolve();
    const next = tail
      .catch(() => {})
      .then(async () => {
        try {
          const { data } = await api.put(`/supervision-tasks/${taskId}`, payload);
          if (data?.success && data.task) {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
            setDrawerTask((d) => (d && d.id === taskId ? data.task : d));
          }
        } catch (err) {
          if (rollbackSnapshot) {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? rollbackSnapshot : t)));
            setDrawerTask((d) => (d && d.id === taskId ? rollbackSnapshot : d));
            patchAnalytics(payload.status, rollbackSnapshot.status);
          }
          toast.error(err?.response?.data?.message || 'Could not update status');
        }
      })
      .finally(() => {
        setPending((n) => Math.max(0, n - 1));
        if (queueRef.current.get(taskId) === next) queueRef.current.delete(taskId);
      });
    queueRef.current.set(taskId, next);
    return next;
  };

  const updateStatus = (task, newStatus, includeProof = false) => {
    const snapshot = task;
    const extra = includeProof ? { proof_attachments: proofPhotos } : {};
    applyOptimistic(task, newStatus, extra);
    toast.success(`Marked ${STATUSES.find((s) => s.value === newStatus)?.label || newStatus}`);
    if (newStatus === 'COMPLETED') setDrawerTask(null);
    const payload = { status: newStatus };
    if (includeProof) payload.proof_attachments = proofPhotos;
    enqueueServerSync(task.id, payload, snapshot);
  };

  const quickStatus = (task, newStatus) => {
    if (task.status === newStatus) return;
    const snapshot = task;
    applyOptimistic(task, newStatus);
    enqueueServerSync(task.id, { status: newStatus }, snapshot);
  };

  const visibleTasks = useMemo(() => {
    if (activeTab === 'ALL') return tasks;
    if (activeTab === 'OVERDUE') return tasks.filter((t) => isOverdue(t) && t.status !== 'COMPLETED');
    return tasks.filter((t) => t.status === activeTab);
  }, [tasks, activeTab]);

  const a = analytics || {};

  const descriptiveLine = (() => {
    if (!analytics) return 'Loading tasks…';
    const parts = [];
    if (Number(a.overdue) > 0)      parts.push(`${a.overdue} overdue`);
    if (Number(a.pending) > 0)      parts.push(`${a.pending} pending`);
    if (Number(a.in_progress) > 0)  parts.push(`${a.in_progress} active`);
    if (Number(a.completed) > 0)    parts.push(`${a.completed} done`);
    if (parts.length === 0) return 'All caught up — great work!';
    return parts.slice(0, 2).join(' · ') + '.';
  })();

  /* ── Drawer derived values ── */
  const drawerPc = drawerTask ? (PRIORITY_CONFIG[drawerTask.priority] || PRIORITY_CONFIG.MEDIUM) : null;
  const drawerOverdue = drawerTask ? isOverdue(drawerTask) : false;

  return (
    <div className="space-y-4 pb-24">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-violet-50 via-purple-50 to-fuchsia-50 px-5 pt-5 pb-4 ring-1 ring-violet-100/60 shadow-[0_4px_24px_-6px_rgba(139,92,246,0.12)]">
        <div className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-purple-300/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-violet-400">Supervision</p>
              <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2 leading-[1.05] tracking-tight">
                <span className="text-[28px] font-bold text-slate-800">Tasks</span>
                <span className="text-[28px] font-normal italic text-violet-600" style={serif}>assigned.</span>
              </h1>
            </div>
            {pending > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-600 bg-white/70 ring-1 ring-violet-100 px-2.5 h-6 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12.5px] italic leading-snug text-slate-500" style={serif}>
            {descriptiveLine}
          </p>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Total"   value={a.total ?? '—'}       grad="from-violet-50 to-purple-50"  ring="ring-violet-100" textColor="text-violet-700" />
        <StatCard label="Pending" value={a.pending ?? '—'}     grad="from-amber-50 to-orange-50"   ring="ring-amber-100"  textColor="text-amber-700" />
        <StatCard label="Active"  value={a.in_progress ?? '—'} grad="from-blue-50 to-indigo-50"    ring="ring-blue-100"   textColor="text-blue-700" />
        <StatCard label="Overdue" value={a.overdue ?? '—'}     grad="from-rose-50 to-pink-50"      ring="ring-rose-100"   textColor="text-rose-700" alert={Number(a.overdue) > 0} />
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 h-8 pl-2.5 pr-3.5 rounded-full text-[11px] font-bold leading-none whitespace-nowrap flex items-center gap-1.5 ring-1 ring-inset active:scale-95 transition-all duration-150 ${
                active
                  ? `${TAB_STYLES[tab.key]} text-white ring-transparent shadow-sm`
                  : 'bg-white text-slate-600 ring-slate-200'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/80' : 'bg-slate-300'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TASK LIST ── */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white ring-1 ring-slate-100 p-3.5 space-y-2.5 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
                <Skeleton className="h-4 w-12 rounded-md shrink-0" />
              </div>
              <div className="flex gap-1.5 pl-9">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
              <div className="flex gap-1.5 pl-9">
                <Skeleton className="h-8 flex-1 rounded-xl" />
                <Skeleton className="h-8 flex-1 rounded-xl" />
                <Skeleton className="h-8 flex-1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2.5">
          {visibleTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onOpen={() => setDrawerTask(t)}
              onStart={() => quickStatus(t, 'IN_PROGRESS')}
              onComplete={() => quickStatus(t, 'COMPLETED')}
              onReopen={() => quickStatus(t, 'IN_PROGRESS')}
            />
          ))}
        </div>
      )}

      {/* ── DETAIL DRAWER ── */}
      <Drawer open={!!drawerTask} onOpenChange={(open) => { if (!open) setDrawerTask(null); }} direction="bottom">
        <DrawerContent
          className="max-h-[92vh] flex flex-col"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
        >
          <DrawerTitle className="sr-only">Task details</DrawerTitle>

          {/* Drawer header — gradient tinted by priority */}
          {drawerTask && (
            <div className={`relative overflow-hidden px-4 pt-4 pb-3 bg-linear-to-br ${drawerPc?.drawerGrad || 'from-white to-white'} border-b border-slate-100/80 shrink-0`}>
              <div
                className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full blur-3xl opacity-40"
                style={{ backgroundColor: drawerPc?.accent }}
              />
              <div className="relative flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <PriorityBadge priority={drawerTask.priority} />
                    <StatusBadge status={drawerTask.status} overdue={drawerOverdue} />
                    <DateBadge date={drawerTask.due_date} overdue={drawerOverdue} />
                  </div>
                  <h2 className="text-[17px] font-bold text-slate-900 leading-snug pr-2">{drawerTask.title}</h2>
                  {drawerTask.assigned_by_name && (
                    <p className="text-[11px] text-slate-500 mt-1">Assigned by {drawerTask.assigned_by_name}</p>
                  )}
                </div>
                <DrawerClose asChild>
                  <button className="shrink-0 h-7 w-7 rounded-full bg-white/80 ring-1 ring-slate-200 flex items-center justify-center text-slate-500 active:scale-90 transition-all">
                    <X className="h-4 w-4" />
                  </button>
                </DrawerClose>
              </div>
            </div>
          )}

          {drawerTask && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

              {drawerTask.description && (
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-100 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Description</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{drawerTask.description}</p>
                </div>
              )}

              {Array.isArray(drawerTask.admin_attachments) && drawerTask.admin_attachments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2 flex items-center gap-1.5">
                    <Paperclip className="h-3 w-3" />
                    Reference from admin
                  </p>
                  <ImageGallery attachments={drawerTask.admin_attachments} title="Reference" />
                </div>
              )}

              {drawerTask.status !== 'COMPLETED' ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2 flex items-center gap-1.5">
                    <Camera className="h-3 w-3" />
                    Proof photos
                    {proofPhotos.length > 0 && (
                      <span className="text-emerald-600 normal-case font-semibold">· {proofPhotos.length} added</span>
                    )}
                  </p>
                  <ImageUploader
                    value={proofPhotos}
                    onChange={setProofPhotos}
                    max={6}
                    label="Proof"
                    accent="green"
                    compact
                    hint="JPG / PNG — auto-compressed before upload"
                  />
                </div>
              ) : (
                Array.isArray(drawerTask.proof_attachments) && drawerTask.proof_attachments.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2 flex items-center gap-1.5">
                      <Camera className="h-3 w-3" />
                      Your proof photos
                    </p>
                    <ImageGallery attachments={drawerTask.proof_attachments} title="Proof" />
                  </div>
                )
              )}

              {drawerTask.completed_at && (
                <div className="rounded-2xl bg-linear-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100 p-3.5 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Completed</p>
                    <p className="text-[12px] text-emerald-700 font-semibold">{fmtDate(drawerTask.completed_at)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drawer footer actions */}
          {drawerTask && (
            <div className="px-4 pt-3 pb-1 border-t border-slate-100 shrink-0 flex flex-col gap-2">
              {drawerTask.status !== 'COMPLETED' && (
                <div className="flex gap-2">
                  {drawerTask.status === 'PENDING' && (
                    <Button
                      onClick={() => updateStatus(drawerTask, 'IN_PROGRESS')}
                      variant="outline"
                      className="flex-1 h-11 rounded-2xl border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <Play className="h-4 w-4 mr-1.5 fill-current" />
                      Start Task
                    </Button>
                  )}
                  <Button
                    onClick={() => updateStatus(drawerTask, 'COMPLETED', true)}
                    className="flex-1 h-11 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-sm shadow-emerald-200/50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Mark Complete
                  </Button>
                </div>
              )}
              {drawerTask.status === 'COMPLETED' && (
                <Button
                  onClick={() => updateStatus(drawerTask, 'IN_PROGRESS')}
                  variant="outline"
                  className="w-full h-11 rounded-2xl"
                >
                  Reopen Task
                </Button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>

    </div>
  );
}
