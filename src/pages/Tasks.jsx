import { useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday, isPast, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Plus, Search, Filter, CheckCircle2, Circle, Clock, AlertTriangle,
  Trash2, Pencil, X, Calendar, Flag, Loader2, ListTodo,
} from 'lucide-react';
import api from '@/lib/axios';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Drawer, DrawerContent, DrawerClose, DrawerTitle } from '@/components/ui/drawer';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const PRIORITIES = [
  { value: 'LOW',    label: 'Low',    color: 'text-slate-600 bg-slate-100' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-blue-700 bg-blue-100' },
  { value: 'HIGH',   label: 'High',   color: 'text-amber-700 bg-amber-100' },
  { value: 'URGENT', label: 'Urgent', color: 'text-rose-700 bg-rose-100' },
];

const STATUSES = [
  { value: 'TODO',        label: 'To do',       icon: Circle,        ring: 'ring-slate-200' },
  { value: 'IN_PROGRESS', label: 'In progress', icon: Clock,         ring: 'ring-blue-200' },
  { value: 'DONE',        label: 'Done',        icon: CheckCircle2,  ring: 'ring-emerald-200' },
  { value: 'CANCELLED',   label: 'Cancelled',   icon: X,             ring: 'ring-slate-200' },
];

const FILTER_TABS = [
  { key: 'ALL',         label: 'All' },
  { key: 'TODO',        label: 'To do' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'OVERDUE',     label: 'Overdue' },
  { key: 'DONE',        label: 'Done' },
];

const fmtDate = (d) => {
  if (!d) return '';
  try {
    const date = typeof d === 'string' ? parseISO(d) : d;
    return format(date, 'd MMM yyyy');
  } catch { return ''; }
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // task being edited, or null for new
  const [saving, setSaving] = useState(false);
  // Per-task in-flight lock: while a task's PUT is pending we ignore further
  // taps on the same task, so rapid double-taps don't fire racing requests.
  const inFlightRef = useRef(new Set());

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'TODO',
    due_date: todayIso(),
  });

  // Stats are derived from `tasks` — saves a round trip on every status flip.
  // The server's /tasks/stats values are equivalent given the same underlying
  // rows, so computing locally keeps the strip in lock-step with the UI.
  const stats = useMemo(() => {
    const today = new Date();
    let todo = 0, in_progress = 0, done = 0, overdue = 0, completed_this_week = 0;
    for (const t of tasks) {
      if (t.status === 'TODO') todo += 1;
      else if (t.status === 'IN_PROGRESS') in_progress += 1;
      else if (t.status === 'DONE') done += 1;
      if (t.is_overdue && t.status !== 'DONE' && t.status !== 'CANCELLED') overdue += 1;
      if (t.status === 'DONE' && t.completed_at) {
        try {
          const d = parseISO(t.completed_at);
          if (differenceInDays(today, d) <= 7) completed_this_week += 1;
        } catch { /* ignore unparseable timestamps */ }
      }
    }
    return {
      todo_count: todo,
      in_progress_count: in_progress,
      done_count: done,
      overdue_count: overdue,
      completed_this_week,
    };
  }, [tasks]);

  const loadAll = async ({ silent = false } = {}) => {
    try {
      const tasksRes = await cachedGet('/tasks', { staleTime: 15_000, force: true });
      if (tasksRes?.success) setTasks(tasksRes.tasks || []);
    } catch (err) {
      if (!silent) toast.error(err?.response?.data?.message || 'Failed to load tasks');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Silent re-sync — fire-and-forget; never flips the loading flag, so the UI
  // never falls back to skeletons after the optimistic update.
  const syncInBackground = () => { loadAll({ silent: true }).catch(() => {}); };

  useEffect(() => {
    loadAll();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', due_date: todayIso() });
    setDrawerOpen(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'MEDIUM',
      status: task.status || 'TODO',
      due_date: (task.current_due_date || task.original_due_date || todayIso()).slice(0, 10),
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.due_date) {
      toast.error('Due date is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/tasks/${editing.id}`, {
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          status: form.status,
        });
        let updated = data?.task || null;
        // If due date changed, also shift it
        const oldDate = (editing.current_due_date || '').slice(0, 10);
        if (form.due_date !== oldDate) {
          const shiftRes = await api.post(`/tasks/${editing.id}/shift`, {
            new_date: form.due_date,
            reason: 'Edited from agent app',
          });
          if (shiftRes?.data?.task) updated = shiftRes.data.task;
        }
        // Update local state from the server response — no extra GET needed.
        if (updated) {
          setTasks((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...updated } : t)));
        }
        toast.success('Task updated');
      } else {
        const { data } = await api.post('/tasks', {
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          due_date: form.due_date,
        });
        if (data?.task) setTasks((prev) => [data.task, ...prev]);
        toast.success('Task added');
      }
      invalidateCache('/tasks');
      setDrawerOpen(false);
      setEditing(null);
      syncInBackground();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save task');
    } finally {
      setSaving(false);
    }
  };

  // Binary toggle — TODO ↔ DONE. The IN_PROGRESS state is reachable via the
  // edit drawer's status field; the inline tap is a checkbox and nothing else,
  // so it never lands on a "loading-looking" intermediate icon.
  const toggleDone = (task) => {
    if (inFlightRef.current.has(task.id)) return;

    const next = task.status === 'DONE' ? 'TODO' : 'DONE';
    const prevSnapshot = task;

    // Optimistic UI: flip the status now so the tap feels instant.
    setTasks((prev) => prev.map((t) => (
      t.id === task.id
        ? { ...t, status: next, completed_at: next === 'DONE' ? new Date().toISOString() : null }
        : t
    )));

    inFlightRef.current.add(task.id);
    api.put(`/tasks/${task.id}`, { status: next })
      .then((res) => {
        const updated = res?.data?.task;
        if (updated) {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
        }
        invalidateCache('/tasks');
        syncInBackground();
      })
      .catch((err) => {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? prevSnapshot : t)));
        toast.error(err?.response?.data?.message || 'Failed to update status');
      })
      .finally(() => {
        inFlightRef.current.delete(task.id);
      });
  };

  const removeTask = (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    if (inFlightRef.current.has(task.id)) return;

    // Optimistic remove — snap it out immediately, restore on failure.
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    inFlightRef.current.add(task.id);
    api.delete(`/tasks/${task.id}`)
      .then(() => {
        invalidateCache('/tasks');
        toast.success('Task deleted');
        syncInBackground();
      })
      .catch((err) => {
        setTasks(prevTasks);
        toast.error(err?.response?.data?.message || 'Could not delete task');
      })
      .finally(() => {
        inFlightRef.current.delete(task.id);
      });
  };

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (activeTab === 'OVERDUE') {
      list = list.filter((t) => t.is_overdue);
    } else if (activeTab !== 'ALL') {
      list = list.filter((t) => t.status === activeTab);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [tasks, activeTab, search]);

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">My Tasks</h1>
          <p className="text-xs text-slate-500 mt-0.5">Personal to-dos, only visible to you.</p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200/50 h-10 px-3.5 rounded-xl"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2">
        <StatPill label="To do"     value={stats?.todo_count ?? '—'}        color="text-slate-700" />
        <StatPill label="Active"    value={stats?.in_progress_count ?? '—'} color="text-blue-700" />
        <StatPill label="Overdue"   value={stats?.overdue_count ?? '—'}     color="text-rose-700" alert={stats?.overdue_count > 0} />
        <StatPill label="Done 7d"   value={stats?.completed_this_week ?? '—'} color="text-emerald-700" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your tasks…"
          className="pl-9 h-10 rounded-xl bg-white"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {FILTER_TABS.map((tab) => {
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

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-[88px] rounded-2xl bg-white ring-1 ring-slate-100 animate-pulse" />)}
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="space-y-2.5">
          {visibleTasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onToggle={() => toggleDone(t)}
              onEdit={() => openEdit(t)}
              onDelete={() => removeTask(t)}
            />
          ))}
        </div>
      )}

      {/* Drawer for create/edit */}
      <Drawer open={drawerOpen} onOpenChange={(open) => { if (!open) closeDrawer(); }} direction="bottom">
        <DrawerContent className="max-h-[90vh] flex flex-col" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}>
          <DrawerTitle className="sr-only">{editing ? 'Edit task' : 'New task'}</DrawerTitle>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <p className="text-base font-semibold text-slate-800">{editing ? 'Edit task' : 'New task'}</p>
            <DrawerClose asChild>
              <button className="text-slate-400 hover:text-slate-600 p-1.5 -mr-1" disabled={saving}>
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="What needs doing?"
                autoFocus
                className="h-11 text-[14px]"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Description (optional)</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Add details, context, links…"
                rows={3}
                className="text-[14px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Priority</label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-11 text-[14px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Due date</label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="h-11 text-[14px]"
                />
              </div>
            </div>

            {editing && (
              <div>
                <label className="text-[12px] font-semibold text-slate-700 mb-1.5 block">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-11 text-[14px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 shrink-0 flex gap-2">
            <Button variant="outline" onClick={closeDrawer} disabled={saving} className="flex-1 h-11 rounded-xl">
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editing ? 'Save changes' : 'Add task')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function StatPill({ label, value, color, alert }) {
  return (
    <div className={`rounded-2xl bg-white ring-1 ${alert ? 'ring-rose-200' : 'ring-slate-100'} p-2.5`}>
      <p className={`text-[18px] font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function TaskCard({ task, onToggle, onEdit, onDelete }) {
  const status = STATUSES.find((s) => s.value === task.status) || STATUSES[0];
  const priority = PRIORITIES.find((p) => p.value === task.priority) || PRIORITIES[1];
  const Icon = status.icon;
  const isDone = task.status === 'DONE';
  const isInProgress = task.status === 'IN_PROGRESS';
  const isOverdue = task.is_overdue;

  return (
    <div className={`rounded-2xl bg-white ring-1 ${isOverdue && !isDone ? 'ring-rose-200' : 'ring-slate-100'} p-3.5 flex gap-3 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)]`}>
      <button
        onClick={onToggle}
        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ring-1 ${
          isDone
            ? 'bg-emerald-500 text-white ring-emerald-500'
            : isInProgress
              ? 'bg-blue-50 text-blue-600 ring-blue-200'
              : 'bg-white text-slate-400 ring-slate-200 hover:bg-slate-50'
        } active:scale-90 transition-all`}
        title={isDone ? 'Mark as to do' : 'Mark as done'}
      >
        <Icon className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[14px] font-semibold leading-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {task.description && (
          <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`px-2 h-5 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${priority.color}`}>
            <Flag className="h-3 w-3" />
            {priority.label}
          </span>
          <span className={`px-2 h-5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
            isOverdue && !isDone ? 'text-rose-700 bg-rose-50' : 'text-slate-600 bg-slate-50'
          }`}>
            <Calendar className="h-3 w-3" />
            {fmtDate(task.current_due_date)}
            {task.was_shifted && <span className="text-[9px] text-amber-600">·shifted</span>}
          </span>
          {isOverdue && !isDone && (
            <span className="px-2 h-5 rounded-md text-[10px] font-bold text-rose-700 bg-rose-100 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="rounded-3xl bg-white ring-1 ring-slate-100 p-8 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
        <ListTodo className="h-7 w-7 text-indigo-500" />
      </div>
      <p className="text-[15px] font-semibold text-slate-800">Nothing on your list</p>
      <p className="text-[12px] text-slate-500 mt-1">Add a task to keep yourself on track.</p>
      <Button onClick={onAdd} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
        <Plus className="h-4 w-4 mr-1.5" />
        Add your first task
      </Button>
    </div>
  );
}
