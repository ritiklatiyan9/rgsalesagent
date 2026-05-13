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
} from 'lucide-react';

const STATUSES = [
  { value: 'PENDING',     label: 'Pending',     icon: Circle,        bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200' },
  { value: 'IN_PROGRESS', label: 'In progress', icon: Clock,         bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  { value: 'COMPLETED',   label: 'Completed',   icon: CheckCircle2,  bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  { value: 'OVERDUE',     label: 'Overdue',     icon: AlertTriangle, bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200' },
];

const PRIORITY_COLORS = {
  LOW:    'text-slate-600 bg-slate-100',
  MEDIUM: 'text-blue-700 bg-blue-100',
  HIGH:   'text-amber-700 bg-amber-100',
  URGENT: 'text-rose-700 bg-rose-100',
};

const TABS = [
  { key: 'ALL',         label: 'All' },
  { key: 'PENDING',     label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'Active' },
  { key: 'OVERDUE',     label: 'Overdue' },
  { key: 'COMPLETED',   label: 'Done' },
];

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

const ANALYTICS_BUCKET = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
};

export default function SupervisionTasks() {
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [drawerTask, setDrawerTask] = useState(null);

  // Photos staged in the drawer before the user taps "Mark Complete".
  // Each is { url, key?, uploaded_at? } from the /upload/many response.
  const [proofPhotos, setProofPhotos] = useState([]);

  // Per-task FIFO queue. Each tap on a task chains onto the previous PUT for
  // that task so server responses can never land out of order, and rapid
  // sequential taps (Start → Done) all register instead of being dropped.
  const queueRef = useRef(new Map()); // taskId -> Promise (queue tail)
  // Outstanding mutation count — drives a tiny "saving…" hint and a debounced
  // analytics refresh once the queue drains.
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

  // Reset the staged photo array whenever the drawer opens on a different task.
  // Pre-fill with whatever proof was already uploaded so the agent can add more
  // photos without losing the existing ones.
  useEffect(() => {
    if (drawerTask) {
      setProofPhotos(Array.isArray(drawerTask.proof_attachments) ? [...drawerTask.proof_attachments] : []);
    } else {
      setProofPhotos([]);
    }
  }, [drawerTask?.id]);

  // Once the mutation queue drains, refresh analytics so the counters reflect
  // server-side derived fields (avg completion time, on-time %, etc). The
  // task list is already authoritative from each PUT response.
  useEffect(() => {
    if (pending !== 0) return;
    const t = setTimeout(() => {
      api.get('/supervision-tasks/analytics')
        .then(({ data }) => { if (data?.success) setAnalytics(data.analytics || null); })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [pending]);

  // Optimistic counter shift so the stats strip moves with the user's tap
  // instead of waiting for the analytics endpoint.
  const patchAnalytics = (fromStatus, toStatus) => {
    if (fromStatus === toStatus) return;
    setAnalytics((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const from = ANALYTICS_BUCKET[fromStatus];
      const to = ANALYTICS_BUCKET[toStatus];
      if (from) next[from] = Math.max(0, (Number(next[from]) || 0) - 1);
      if (to)   next[to]   = (Number(next[to]) || 0) + 1;
      return next;
    });
  };

  // Synchronous local patch — list, drawer, and analytics all flip together
  // so the user sees the result of their action on the very next paint.
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

  // FIFO per-task queue. Chains the new PUT onto whatever was previously
  // queued for this task; on failure, rolls back to the snapshot taken right
  // before the optimistic patch was applied.
  const enqueueServerSync = (taskId, payload, rollbackSnapshot) => {
    setPending((n) => n + 1);
    const tail = queueRef.current.get(taskId) || Promise.resolve();
    const next = tail
      .catch(() => {}) // never let an earlier rejection break the chain
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

  // Drawer "Mark Complete" / "Start" / "Reopen". Closes the drawer immediately
  // on completion so the agent can move on; the PUT rides the per-task queue.
  const updateStatus = (task, newStatus, includeProof = false) => {
    const snapshot = task;
    const extra = includeProof ? { proof_attachments: proofPhotos } : {};
    applyOptimistic(task, newStatus, extra);

    const label = STATUSES.find((s) => s.value === newStatus)?.label || newStatus;
    toast.success(`Marked ${label}`);

    if (newStatus === 'COMPLETED') setDrawerTask(null);

    const payload = { status: newStatus };
    if (includeProof) payload.proof_attachments = proofPhotos;
    enqueueServerSync(task.id, payload, snapshot);
  };

  // Inline quick-action from the card. Same pattern, no toast — the card's
  // visual flip is feedback enough.
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

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-600" />
            Supervision Tasks
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Tasks assigned to you by admin.</p>
        </div>
        {pending > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 ring-1 ring-slate-200 px-2 h-6 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2">
        <Pill label="Total"   value={a.total ?? '—'}        color="text-slate-700" />
        <Pill label="Pending" value={a.pending ?? '—'}      color="text-amber-700" />
        <Pill label="Active"  value={a.in_progress ?? '—'}  color="text-blue-700" />
        <Pill label="Overdue" value={a.overdue ?? '—'}      color="text-rose-700" alert={Number(a.overdue) > 0} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-3 h-8 rounded-full text-[12px] font-semibold transition-all ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
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

      {/* Detail drawer */}
      <Drawer open={!!drawerTask} onOpenChange={(open) => { if (!open) setDrawerTask(null); }} direction="bottom">
        <DrawerContent className="max-h-[92vh] flex flex-col" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}>
          <DrawerTitle className="sr-only">Task details</DrawerTitle>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <p className="text-base font-semibold text-slate-800">Task details</p>
            <DrawerClose asChild>
              <button className="text-slate-400 hover:text-slate-600 p-1.5 -mr-1">
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>

          {drawerTask && (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <h2 className="text-[18px] font-bold text-slate-900 leading-snug">{drawerTask.title}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <PriorityChip priority={drawerTask.priority} />
                  <DateChip date={drawerTask.due_date} overdue={isOverdue(drawerTask)} />
                  <StatusChip status={drawerTask.status} />
                </div>
                {drawerTask.assigned_by_name && (
                  <p className="text-[12px] text-slate-500 mt-2">Assigned by {drawerTask.assigned_by_name}</p>
                )}
              </div>

              {drawerTask.description && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</p>
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{drawerTask.description}</p>
                </div>
              )}

              {Array.isArray(drawerTask.admin_attachments) && drawerTask.admin_attachments.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    Reference photos from admin
                  </p>
                  <ImageGallery attachments={drawerTask.admin_attachments} title="Reference" />
                </div>
              )}

              {/* Photo proof — uploader (when not yet completed) or read-only gallery (when done) */}
              {drawerTask.status !== 'COMPLETED' ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    Add proof photos {proofPhotos.length > 0 && <span className="text-emerald-600">· {proofPhotos.length} added</span>}
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
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      Proof photos you submitted
                    </p>
                    <ImageGallery attachments={drawerTask.proof_attachments} title="Proof" />
                  </div>
                )
              )}

              {drawerTask.completed_at && (
                <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-100 p-3">
                  <p className="text-[12px] font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completed on {fmtDate(drawerTask.completed_at)}
                  </p>
                </div>
              )}
            </div>
          )}

          {drawerTask && (
            <div className="px-4 py-3 border-t border-slate-100 shrink-0 flex flex-col gap-2">
              {drawerTask.status !== 'COMPLETED' && (
                <div className="flex gap-2">
                  {drawerTask.status === 'PENDING' && (
                    <Button
                      onClick={() => updateStatus(drawerTask, 'IN_PROGRESS')}
                      variant="outline"
                      className="flex-1 h-11 rounded-xl"
                    >
                      <Play className="h-4 w-4 mr-1.5 fill-current" />
                      Start
                    </Button>
                  )}
                  <Button
                    onClick={() => updateStatus(drawerTask, 'COMPLETED', true)}
                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700"
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
                  className="w-full h-11 rounded-xl"
                >
                  Reopen task
                </Button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Pill({ label, value, color, alert }) {
  return (
    <div className={`rounded-2xl bg-white ring-1 ${alert ? 'ring-rose-200' : 'ring-slate-100'} p-2.5`}>
      <p className={`text-[18px] font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function PriorityChip({ priority }) {
  const cls = PRIORITY_COLORS[priority] || PRIORITY_COLORS.MEDIUM;
  return (
    <span className={`px-2 h-5 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${cls}`}>
      <Flag className="h-3 w-3" />
      {priority || 'MEDIUM'}
    </span>
  );
}

function DateChip({ date, overdue }) {
  if (!date) return null;
  return (
    <span className={`px-2 h-5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
      overdue ? 'text-rose-700 bg-rose-50' : 'text-slate-600 bg-slate-50'
    }`}>
      <Calendar className="h-3 w-3" />
      {fmtDate(date)}
    </span>
  );
}

function StatusChip({ status }) {
  const s = STATUSES.find((x) => x.value === status) || STATUSES[0];
  const Icon = s.icon;
  return (
    <span className={`px-2 h-5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${s.text} ${s.bg} ring-1 ${s.ring}`}>
      <Icon className="h-3 w-3" />
      {s.label}
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

  return (
    <div
      onClick={onOpen}
      className={`w-full text-left rounded-2xl bg-white ring-1 ${overdue && !isDone ? 'ring-rose-200' : 'ring-slate-100'} p-3.5 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] cursor-pointer hover:ring-slate-300 active:scale-[0.99] transition-all`}
    >
      <div className="flex items-start gap-3">
        {/* Quick toggle: Pending/Active → Completed, Completed → reopen. */}
        <button
          onClick={(e) => stop(e, isDone ? onReopen : onComplete)}
          className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ring-1 ${
            isDone
              ? 'bg-emerald-500 text-white ring-emerald-500'
              : isActive
                ? 'bg-blue-50 text-blue-600 ring-blue-200'
                : 'bg-white text-slate-400 ring-slate-200 hover:bg-slate-50'
          } active:scale-90 transition-all`}
          title={isDone ? 'Reopen task' : 'Mark complete'}
        >
          {isDone
            ? <CheckCircle2 className="h-4 w-4" />
            : isActive
              ? <Clock className="h-4 w-4" />
              : <Circle className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-semibold leading-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <PriorityChip priority={task.priority} />
            <DateChip date={task.due_date} overdue={overdue} />
            <StatusChip status={task.status} />
            {(adminCount > 0 || proofCount > 0) && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {adminCount + proofCount}
              </span>
            )}
            {task.assigned_by_name && (
              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">by {task.assigned_by_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Inline quick actions — instant; tapping the card body still opens the
          drawer for proof photos or full details. */}
      {!isDone && (
        <div className="flex gap-2 mt-3">
          {isPending && (
            <button
              onClick={(e) => stop(e, onStart)}
              className="flex-1 h-9 rounded-xl text-[12px] font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Start
            </button>
          )}
          <button
            onClick={(e) => stop(e, onOpen)}
            className="flex-1 h-9 rounded-xl text-[12px] font-semibold bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" />
            Add proof
          </button>
          <button
            onClick={(e) => stop(e, onComplete)}
            className="flex-1 h-9 rounded-xl text-[12px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-white ring-1 ring-slate-100 p-8 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center mb-3">
        <ListChecks className="h-7 w-7 text-violet-500" />
      </div>
      <p className="text-[15px] font-semibold text-slate-800">No supervision tasks</p>
      <p className="text-[12px] text-slate-500 mt-1">Tasks assigned to you by admin will show up here.</p>
    </div>
  );
}
