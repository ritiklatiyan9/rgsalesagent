import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Delete, PhoneCall, PhoneOff, Search, X,
  ArrowDownLeft, ArrowUpRight, PhoneMissed, Smartphone,
  Clock, Keyboard, Loader2, User, Phone, ChevronRight, RefreshCw,
  ChevronDown, Pencil, Save, MessageSquare, ExternalLink,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cachedGet, getCachedSync, invalidateCache } from '@/lib/queryCache';
import { useDialer } from '@/hooks/useDialer';
import { useDeviceContacts } from '@/hooks/useDeviceContacts';

/* ── Constants ──────────────────────────────────────────────────────────── */
const KEYS = [
  ['1', ''],     ['2', 'ABC'],  ['3', 'DEF'],
  ['4', 'GHI'],  ['5', 'JKL'],  ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'],  ['9', 'WXYZ'],
  ['*', ''],     ['0', '+'],    ['#', ''],
];

const TAB_CONFIG = [
  { key: 'keypad', label: 'Keypad', Icon: Keyboard },
  { key: 'recents', label: 'Recents', Icon: Clock },
];

const HISTORY_LIMIT = 30;
const DIALER_HISTORY_SNAPSHOT_KEY = 'rg:dialerHistorySnapshot';

const readDialerHistorySnapshot = () => {
  try {
    const raw = localStorage.getItem(DIALER_HISTORY_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.calls)) return null;
    return {
      calls: parsed.calls,
      nextCursor: parsed.nextCursor || null,
      hasMore: Boolean(parsed.hasMore),
      savedAt: Number(parsed.savedAt || 0),
    };
  } catch {
    return null;
  }
};

const writeDialerHistorySnapshot = ({ calls = [], nextCursor = null, hasMore = false }) => {
  try {
    localStorage.setItem(DIALER_HISTORY_SNAPSHOT_KEY, JSON.stringify({
      calls,
      nextCursor,
      hasMore,
      savedAt: Date.now(),
    }));
  } catch {
    // ignore storage failures
  }
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const fmtDuration = (s = 0) => {
  const sec = Math.max(0, Number(s || 0));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(typeof v === 'number' ? v : v);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = d.toDateString() === new Date(now - 86400000).toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
};

const typeMeta = (type) => {
  const t = String(type || '').toUpperCase();
  if (t === 'INCOMING')                    return { Icon: ArrowDownLeft, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  if (t === 'MISSED' || t === 'REJECTED') return { Icon: PhoneMissed,   color: 'text-rose-500',    bg: 'bg-rose-500/10'    };
  return                                         { Icon: ArrowUpRight,   color: 'text-sky-500',     bg: 'bg-sky-500/10'     };
};

const statusBadge = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'PRIME') return 'bg-amber-100 text-amber-700';
  if (s === 'HOT')   return 'bg-orange-100 text-orange-700';
  if (s === 'COLD')  return 'bg-blue-100 text-blue-700';
  if (s === 'DEAD')  return 'bg-slate-100 text-slate-500';
  return 'bg-emerald-100 text-emerald-700';
};

const cleanNumber = (v) => String(v || '').replace(/[^0-9+*#]/g, '');
const isNativeApp = () => !!window.Capacitor?.isNativePlatform?.();

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/* ── Keypad button with haptic-feel animation ─────────────────────────────── */
const KeyBtn = memo(({ digit, letters, onPress }) => {
  const [pressed, setPressed] = useState(false);
  const handleDown = () => setPressed(true);
  const handleUp = () => { setPressed(false); onPress(digit); };

  return (
    <button
      type="button"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={() => setPressed(false)}
      className={`h-[4.2rem] w-[4.2rem] rounded-full bg-white border border-slate-200/80
        flex flex-col items-center justify-center select-none
        shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-sm
        transition-all duration-100 ease-out
        ${pressed
          ? 'scale-[0.88] shadow-none bg-slate-100 border-slate-300'
          : 'hover:bg-slate-50 active:scale-[0.88]'
        }`}
    >
      <span className="text-[1.35rem] font-semibold text-slate-900 leading-none">{digit}</span>
      {letters && (
        <span className="text-[8px] font-medium text-slate-400 leading-none mt-0.5 tracking-[0.18em]">{letters}</span>
      )}
    </button>
  );
});
KeyBtn.displayName = 'KeyBtn';

/* ── History row — expandable accordion ─────────────────────────────────── */
const HistoryRow = memo(({ call, onCall, outcomes, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', notes: '', outcomeId: '' });
  const [saving, setSaving] = useState(false);

  const { Icon, color, bg } = typeMeta(call.call_type);
  const phone = call.phone_number_dialed || call.lead_phone || '';
  const name = call.lead_name || 'Unknown';
  const isMissed = String(call.call_type).toUpperCase() === 'MISSED';
  const waLink = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null;
  const dur = call.duration_seconds > 0 ? fmtDuration(call.duration_seconds) : null;

  const startEdit = () => {
    setForm({
      name: call.lead_name || '',
      phone: phone,
      notes: call.customer_notes || '',
      outcomeId: call.outcome_id || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update call notes/outcome
      if (call.id) {
        const body = { customer_notes: form.notes };
        if (form.outcomeId) body.outcome_id = form.outcomeId;
        await api.put(`/calls/${call.id}`, body);
      }
      // Update lead name/phone if linked and changed
      if (call.lead_id && (form.name !== (call.lead_name || '') || form.phone !== phone)) {
        await api.put(`/leads/${call.lead_id}`, { name: form.name, phone: form.phone });
      }
      toast.success('Updated');
      setEditing(false);
      if (onUpdate) onUpdate(call.id, {
        customer_notes: form.notes,
        outcome_id: form.outcomeId,
        outcome_label: outcomes?.find(o => String(o.id) === String(form.outcomeId))?.label || call.outcome_label,
        lead_name: form.name || call.lead_name,
        phone_number_dialed: form.phone || phone,
      });
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className={`border-b border-slate-100 last:border-0 ${open ? 'bg-slate-50/60' : ''}`}>
      {/* Summary */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-100/60"
        onClick={() => setOpen(o => !o)}
      >
        <div className={`h-9 w-9 rounded-full ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold truncate leading-tight ${isMissed ? 'text-rose-600' : 'text-slate-900'}`}>{name}</p>
          <p className="text-[11px] text-slate-500 font-mono truncate leading-tight">{phone || '—'}</p>
          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{fmtDate(call.call_start)}{dur ? ` · ${dur}` : ''}</p>
          {call.customer_notes && (
            <p className="text-[10px] text-indigo-500 truncate leading-tight mt-0.5 flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5 shrink-0" />
              {call.customer_notes}
            </p>
          )}
        </div>
        {call.outcome_label && (
          <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 shrink-0">{call.outcome_label}</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-300 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded */}
      {open && (
        <div className="px-4 pb-3 animate-in fade-in duration-150">
          {editing ? (
            /* ── Edit mode ── */
            <div className="space-y-2 bg-white rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2.5 mt-0.5
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2.5 mt-0.5 font-mono
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Call notes…"
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 mt-0.5 resize-none
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {outcomes?.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Outcome</label>
                  <select
                    value={form.outcomeId}
                    onChange={(e) => setForm(f => ({ ...f, outcomeId: e.target.value }))}
                    onClick={e => e.stopPropagation()}
                    className="w-full h-8 text-xs border border-slate-200 rounded-lg px-2.5 mt-0.5 bg-white
                      focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  >
                    <option value="">Select outcome…</option>
                    {outcomes.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSave(); }}
                  disabled={saving}
                  className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-xs font-semibold
                    hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditing(false); }}
                  className="h-9 px-4 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── Details mode ── */
            <div className="space-y-2">
              {/* Info chips */}
              {(call.lead_status || call.lead_category || call.next_action) && (
                <div className="flex flex-wrap gap-1.5">
                  {call.lead_status && <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${statusBadge(call.lead_status)}`}>{call.lead_status}</span>}
                  {call.lead_category && <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${statusBadge(call.lead_category)}`}>{call.lead_category}</span>}
                  {call.next_action && call.next_action !== 'NONE' && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">→ {call.next_action.replace('_', ' ')}</span>
                  )}
                </div>
              )}

              {/* Notes */}
              {call.customer_notes && (
                <p className="text-[11px] text-slate-600 leading-relaxed bg-white rounded-lg border border-slate-100 px-2.5 py-2">
                  {call.customer_notes}
                </p>
              )}

              {/* Actions — 4 compact icon buttons in a row */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCall(phone, { name, leadId: call.lead_id }); }}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-emerald-500 text-white text-[11px] font-semibold
                    shadow-sm shadow-emerald-500/20 active:scale-[0.96] transition-all"
                >
                  <PhoneCall className="h-3.5 w-3.5" /> Call
                </button>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-green-50 text-green-700 text-[11px] font-semibold
                      border border-green-200 active:scale-[0.96] transition-all"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); startEdit(); }}
                  className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold
                    border border-slate-200 active:scale-[0.96] transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
HistoryRow.displayName = 'HistoryRow';

/* ── Loading dots (no skeleton) ───────────────────────────────────────── */
const LoadingDots = () => (
  <div className="flex items-center justify-center py-10 gap-1">
    {[0, 1, 2].map(i => (
      <div key={i} className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
    ))}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
const DialerPage = () => {
  const [searchParams] = useSearchParams();
  const { requestPermissions, makeCall, openDialer, getRecentCalls, getSIMInfo,
          onCallConnected, onCallEnded } = useDialer();
  const { deviceContacts: syncedContacts, syncing: contactsSyncing, synced: contactsSynced,
          syncContacts, clearCache: clearContactsCache, count: deviceContactCount } = useDeviceContacts();

  /* ── Core state ── */
  const [tab, setTab]                   = useState('keypad');
  const [number, setNumber]             = useState('');
  const [sims, setSims]                 = useState([]);
  const [selectedSim, setSelectedSim]   = useState('-1');
  const [activeCall, setActiveCall]     = useState(null);
  const [timerSec, setTimerSec]         = useState(0);
  const [syncingAll, setSyncingAll]     = useState(false);

  /* ── History state (cursor-paginated) ── */
  const [history, setHistory]               = useState(() => readDialerHistorySnapshot()?.calls || []);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyCursor, setHistoryCursor]   = useState(() => readDialerHistorySnapshot()?.nextCursor || null);
  const [historyHasMore, setHistoryHasMore] = useState(() => Boolean(readDialerHistorySnapshot()?.hasMore));
  const [historyFilter, setHistoryFilter]   = useState('ALL');
  /* ── Recents search state ── */
  const [recentsSearch, setRecentsSearch]   = useState('');

  /* ── Call outcomes (for edit dropdown) ── */
  const [outcomes, setOutcomes]             = useState([]);

  const timerRef          = useRef(null);
  const timerSecRef       = useRef(0);
  const activeCallRef     = useRef(null);
  const tabRef            = useRef('keypad');
  const loadHistoryRef    = useRef(null);
  const autoCallTriggered = useRef(false);
  const callIdRef         = useRef(null);
  const historyEndRef     = useRef(null);
  const numberInputRef    = useRef(null);
  const startCallLockRef  = useRef(false);

  /* ── Contact index for instant keypad suggestions ── */
  const [contactIndex, setContactIndex] = useState([]);

  const activeName = useMemo(
    () => activeCall?.name || searchParams.get('name') || 'Unknown',
    [activeCall, searchParams],
  );

  const upsertRecent = useCallback((entry, { replaceId = null } = {}) => {
    if (!entry) return;
    const incomingId = entry.id ? String(entry.id) : null;
    const targetReplaceId = replaceId ? String(replaceId) : null;

    setHistory((prev) => {
      const filtered = prev.filter((item) => {
        const id = item?.id ? String(item.id) : null;
        if (incomingId && id === incomingId) return false;
        if (targetReplaceId && id === targetReplaceId) return false;
        return true;
      });
      return [entry, ...filtered].slice(0, HISTORY_LIMIT);
    });
  }, []);

  const dedupeRecents = useCallback((items = []) => {
    const seen = new Set();
    return items.filter((item) => {
      const phone = cleanNumber(item?.phone_number_dialed || item?.lead_phone || '').slice(-10);
      const ts = item?.call_start ? new Date(item.call_start).getTime() : 0;
      const bucket = ts ? Math.floor(ts / 5000) : 0; // 5s tolerance for duplicate inserts
      const key = `${phone}|${String(item?.call_type || '').toUpperCase()}|${Number(item?.duration_seconds || 0)}|${String(item?.call_source || '').toUpperCase()}|${bucket}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  // Instant recents hydration from local snapshot (sync read, zero-wait render)
  useEffect(() => {
    if (history.length > 0) return;
    const snapshot = readDialerHistorySnapshot();
    if (snapshot?.calls?.length) {
      const deduped = dedupeRecents(snapshot.calls);
      setHistory(deduped);
      setHistoryCursor(snapshot.nextCursor || null);
      setHistoryHasMore(Boolean(snapshot.hasMore));
    }
  }, [history.length, dedupeRecents]);

  useEffect(() => { timerSecRef.current = timerSec; }, [timerSec]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  /* ── Load history from DB (cursor-based) ── */
  const loadHistory = useCallback(async (reset = false) => {
    if (reset) {
      setHistoryCursor(null);
      setHistoryHasMore(false);
      // Keep UI instantly visible; loading state is used for small indicators only
      setHistoryLoading(true);
    } else {
      setHistoryLoadingMore(true);
    }

    const params = new URLSearchParams({ limit: HISTORY_LIMIT });
    if (!reset && historyCursor) params.set('cursor', historyCursor);
    if (historyFilter && historyFilter !== 'ALL') params.set('call_type', historyFilter);
    const url = `/calls/dialer-history?${params}`;

    // Local-first for instant UI (memory/IDB cache)
    if (reset) {
      const local = getCachedSync(url);
      if (local?.success && Array.isArray(local.calls)) {
        const deduped = dedupeRecents(local.calls);
        setHistory(deduped);
        setHistoryCursor(local.nextCursor || null);
        setHistoryHasMore(Boolean(local.hasMore));
        writeDialerHistorySnapshot({ calls: deduped, nextCursor: local.nextCursor || null, hasMore: Boolean(local.hasMore) });
      } else {
        const snapshot = readDialerHistorySnapshot();
        if (snapshot?.calls?.length) {
          const deduped = dedupeRecents(snapshot.calls);
          setHistory(deduped);
          setHistoryCursor(snapshot.nextCursor || null);
          setHistoryHasMore(Boolean(snapshot.hasMore));
        }
      }
    }

    try {
      // Always fetch fresh to avoid stale history after call-end
      const data = await api.get(url).then(r => r.data);
      if (data.success) {
        setHistory(prev => {
          const merged = reset ? data.calls : [...prev, ...data.calls];
          const deduped = dedupeRecents(merged);
          writeDialerHistorySnapshot({ calls: deduped, nextCursor: data.nextCursor, hasMore: data.hasMore });
          return deduped;
        });
        setHistoryCursor(data.nextCursor);
        setHistoryHasMore(data.hasMore);
      }
    } catch { /* silent */ }
    finally {
      setHistoryLoading(false);
      setHistoryLoadingMore(false);
    }
  }, [historyCursor, historyFilter, dedupeRecents]);

  useEffect(() => { loadHistoryRef.current = loadHistory; }, [loadHistory]);

  /* ── Filtered history (local search only) ── */
  const filteredHistory = useMemo(() => {
    if (!recentsSearch.trim()) return history;
    const q = recentsSearch.toLowerCase().trim();
    return history.filter((c) => {
      const name = (c.lead_name || '').toLowerCase();
      const phone = c.phone_number_dialed || c.lead_phone || '';
      return name.includes(q) || phone.includes(q);
    });
  }, [history, recentsSearch]);

  /* ── Filtered device contacts (shown when synced & searching) ── */
  const filteredDeviceContacts = useMemo(() => {
    if (!contactsSynced || !recentsSearch.trim()) return [];
    const q = recentsSearch.toLowerCase().trim();
    const historyPhones = new Set(history.map(c => cleanNumber(c.phone_number_dialed || c.lead_phone || '')));
    return syncedContacts
      .filter((c) => {
        const name = String(c.displayName || c.name || '').toLowerCase();
        const phone = String(c.phoneNumber || c.number || '');
        return name.includes(q) || phone.includes(q);
      })
      .filter(c => !historyPhones.has(cleanNumber(c.phoneNumber || c.number || '')))
      .slice(0, 15);
  }, [syncedContacts, contactsSynced, recentsSearch, history]);

  /* ── Keypad suggestions: instant lookup from history + pre-loaded contacts index ── */
  const suggestions = useMemo(() => {
    const q = cleanNumber(number);
    if (q.length < 3) return [];
    const matches = new Map();
    // From call history (already in memory)
    for (const c of history) {
      const phone = cleanNumber(c.phone_number_dialed || c.lead_phone || '');
      if (phone && phone.includes(q) && !matches.has(phone)) {
        matches.set(phone, { name: c.lead_name || 'Unknown', phone, type: 'history', leadId: c.lead_id });
      }
    }
    // From pre-loaded contact index (leads + contacts)
    for (const c of contactIndex) {
      if (c.phone && c.phone.includes(q) && !matches.has(c.phone)) {
        matches.set(c.phone, c);
      }
    }
    return Array.from(matches.values()).slice(0, 6);
  }, [number, history, contactIndex]);

  /* ── Search debounced (removed — now uses local filteredHistory) ── */

  /* ── Sync contacts + phone recent calls ── */
  const handleSyncAll = useCallback(async () => {
    if (syncingAll) return;
    setSyncingAll(true);
    try {
      // 1. Sync device contacts
      await syncContacts();

      // 2. Fetch phone's native recent call log
      const recentCalls = await getRecentCalls(200);
      if (recentCalls.length > 0) {
        const payload = recentCalls
          .filter(c => {
            const type = String(c.type || '').toUpperCase();
            // Only sync INCOMING and MISSED calls (OUTGOING are already logged by the app)
            return type === 'INCOMING' || type === 'MISSED';
          })
          .map(c => ({
            phone_number: c.number || '',
            call_type: String(c.type || '').toUpperCase(),
            call_start: c.date ? new Date(Number(c.date)).toISOString() : new Date().toISOString(),
            duration_seconds: Number(c.duration) || 0,
          }));

        if (payload.length > 0) {
          const { data } = await api.post('/calls/sync-device-log', { calls: payload });
          if (data.success) {
            toast.success(`Synced ${data.synced} call${data.synced !== 1 ? 's' : ''} from phone${data.skipped ? ` (${data.skipped} duplicates skipped)` : ''}`);
          }
        } else {
          toast.info('No new incoming calls to sync');
        }
      }

      // 3. Reload history
      loadHistory(true);
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncingAll(false);
    }
  }, [syncingAll, syncContacts, getRecentCalls, loadHistory]);

  const handleUnsync = useCallback(() => {
    clearContactsCache();
    toast('Device contacts unsynced');
  }, [clearContactsCache]);

  /* ── Auto-sync recent incoming/missed calls from phone CallLog on native ── */
  const autoSyncDeviceCalls = useCallback(async () => {
    const isNative = window.Capacitor?.isNativePlatform?.() || false;
    if (!isNative) return;
    try {
      const recentCalls = await getRecentCalls(50);
      if (!recentCalls?.length) return;
      const payload = recentCalls
        .filter(c => {
          const type = String(c.type || '').toUpperCase();
          return type === 'INCOMING' || type === 'MISSED';
        })
        .map(c => ({
          phone_number: c.number || '',
          call_type: String(c.type || '').toUpperCase(),
          call_start: c.date ? new Date(Number(c.date)).toISOString() : new Date().toISOString(),
          duration_seconds: Number(c.duration) || 0,
        }));
      if (payload.length > 0) {
        await api.post('/calls/sync-device-log', { calls: payload });
      }
    } catch { /* silent background sync */ }
  }, [getRecentCalls]);

  /* ── Load history on tab switch ── */
  useEffect(() => {
    if (tab === 'recents') {
      // Show local history immediately, then refresh from server; sync device calls in background and refresh again
      loadHistory(true);
      autoSyncDeviceCalls().finally(() => {
        loadHistoryRef.current?.(true);
      });
    }
  }, [tab]);

  /* ── Infinite scroll for history ── */
  useEffect(() => {
    if (tab !== 'recents' || !historyHasMore || historyLoadingMore) return;
    const el = historyEndRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadHistory(false); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tab, historyHasMore, historyLoadingMore, loadHistory]);

  /* ── Re-sync when app returns to foreground while on recents tab ── */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && tab === 'recents') {
        autoSyncDeviceCalls().finally(() => loadHistory(true));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [tab, autoSyncDeviceCalls]);

  /* ── Init: permissions, SIMs, outcomes ── */
  useEffect(() => {
    (async () => {
      try { await requestPermissions(); } catch {}
      try {
        const simList = await getSIMInfo();
        setSims(simList || []);
        if (simList?.length) setSelectedSim(String(simList[0].slotIndex));
      } catch { setSims([]); }
      // Fetch outcomes (cached)
      try {
        const data = await cachedGet('/calls/outcomes', { staleTime: 600_000, cacheTime: 1800_000 });
        if (data?.outcomes) setOutcomes(data.outcomes);
      } catch {}
    })();
  }, []);

  /* ── Pre-load leads + contacts for instant keypad suggestions ── */
  useEffect(() => {
    const buildIndex = (data, type) => {
      const items = data?.leads || data?.contacts || (Array.isArray(data) ? data : []);
      return items.map(item => ({
        name: item.name || item.contact_name || item.lead_name || '',
        phone: cleanNumber(item.phone || item.phone_number || ''),
        type,
        id: item.id,
      })).filter(item => item.phone.length >= 5);
    };
    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter(i => { if (seen.has(i.phone)) return false; seen.add(i.phone); return true; });
    };
    // Apply cached data instantly (no wait)
    const cachedL = getCachedSync('/leads?limit=500');
    const cachedC = getCachedSync('/contacts?limit=500');
    if (cachedL || cachedC) {
      setContactIndex(dedup([...buildIndex(cachedL, 'lead'), ...buildIndex(cachedC, 'contact')]));
    }
    // Background refresh
    Promise.all([
      cachedGet('/leads?limit=500', { staleTime: 300_000, cacheTime: 900_000 }),
      cachedGet('/contacts?limit=500', { staleTime: 300_000, cacheTime: 900_000 }),
    ]).then(([l, c]) => {
      setContactIndex(dedup([...buildIndex(l, 'lead'), ...buildIndex(c, 'contact')]));
    }).catch(() => {});
  }, []);

  /* ── Update a call record in local history ── */
  const handleCallUpdate = useCallback((callId, updatedCall) => {
    setHistory(prev => prev.map(c => c.id === callId ? { ...c, ...updatedCall } : c));
  }, []);

  /* ── Call events ── */
  useEffect(() => {
    const subConn = onCallConnected((evt) => {
      const at = Number(evt?.connectedAt || Date.now());
      setActiveCall((p) => ({ ...(p || {}), connectedAt: at, isConnected: true }));
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimerSec(Math.max(0, Math.floor((Date.now() - at) / 1000)));
      }, 1000);
    });

    const subEnd = onCallEnded(async (evt) => {
      if (timerRef.current) clearInterval(timerRef.current);
      const currentActiveCall = activeCallRef.current;
      const dur = (evt && typeof evt.duration === 'number') ? evt.duration : timerSecRef.current;
      const cid = callIdRef.current || currentActiveCall?.callId;
      if (cid) {
        api.put(`/calls/${cid}/end`, {
          next_action: 'NONE', duration_seconds: dur, customer_notes: null,
        }).catch(() => {});

        upsertRecent({
          id: cid,
          call_type: 'OUTGOING',
          call_start: currentActiveCall?.startedAt ? new Date(currentActiveCall.startedAt).toISOString() : new Date().toISOString(),
          duration_seconds: dur,
          call_status: dur > 0 ? 'COMPLETED' : 'MISSED',
          call_source: 'APP',
          phone_number_dialed: currentActiveCall?.phone,
          lead_id: currentActiveCall?.leadId || null,
          lead_name: currentActiveCall?.name || 'Manual Call',
        }, { replaceId: currentActiveCall?.localTempId || null });

        invalidateCache('/calls/dialer-history');
      }
      setTimerSec(0);
      setActiveCall(null);
      callIdRef.current = null;
      // Refresh history if on that tab
      if (tabRef.current === 'recents') loadHistoryRef.current?.(true);
    });

    return () => {
      try { subConn?.remove?.(); } catch {}
      try { subEnd?.remove?.(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onCallConnected, onCallEnded, upsertRecent]);

  /* ── INSTANT call — fire native first, log to API in background ── */
  const startCall = useCallback((rawNumber, opts = {}) => {
    if (activeCall || startCallLockRef.current) return;

    startCallLockRef.current = true;
    setTimeout(() => { startCallLockRef.current = false; }, 1200);

    const phone = cleanNumber(rawNumber);
    if (!phone) { toast.error('Enter a phone number'); return; }

    const nowIso = new Date().toISOString();
    const localTempId = `local-${Date.now()}-${phone}`;

    callIdRef.current = null;
    setActiveCall({
      callId: null, leadId: opts.leadId || null,
      name: opts.name || 'Manual Call',
      phone, startedAt: Date.now(), connectedAt: null, isConnected: false,
      localTempId,
    });

    // Show immediately in recents (local-first)
    upsertRecent({
      id: localTempId,
      call_type: 'OUTGOING',
      call_start: nowIso,
      duration_seconds: 0,
      call_status: 'ACTIVE',
      call_source: 'APP',
      phone_number_dialed: phone,
      lead_id: opts.leadId || null,
      lead_name: opts.name || 'Manual Call',
    });

    makeCall(phone, Number(selectedSim)).catch(() => {
      openDialer(phone).catch(() => {});
      toast.message('Opened system dialer');
    });

    const isApp = window.Capacitor?.isNativePlatform?.() || false;
    try {
      localStorage.setItem('rg:lastDialedCall', JSON.stringify({
        phone, name: opts.name || 'Manual Call',
        leadId: opts.leadId ? Number(opts.leadId) : null, timestamp: Date.now(),
      }));
    } catch {}

    api.post('/calls/quick-log', {
      lead_id: opts.leadId ? Number(opts.leadId) : null,
      phone_number: phone,
      call_source: isApp ? 'APP' : 'WEB',
      call_start: nowIso,
    }).then(({ data }) => {
      const cid = data?.call?.id || null;
      callIdRef.current = cid;
      setActiveCall((p) => p ? { ...p, callId: cid } : p);

      if (data?.call) {
        upsertRecent({
          ...data.call,
          lead_name: opts.name || data.call.lead_name || 'Manual Call',
          phone_number_dialed: data.call.phone_number_dialed || phone,
        }, { replaceId: localTempId });
      }

      invalidateCache('/calls/dialer-history');

      if (cid) {
        try {
          const stored = JSON.parse(localStorage.getItem('rg:lastDialedCall') || '{}');
          stored.callId = cid;
          localStorage.setItem('rg:lastDialedCall', JSON.stringify(stored));
        } catch {}
      }
    }).catch(() => {});
  }, [activeCall, selectedSim, makeCall, openDialer, upsertRecent]);

  const handleManualStop = useCallback(async () => {
    if (!activeCall) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const cid = callIdRef.current || activeCall.callId;
    if (cid) {
      api.put(`/calls/${cid}/end`, {
        next_action: 'NONE', duration_seconds: timerSec, customer_notes: null,
      }).catch(() => {});

      upsertRecent({
        id: cid,
        call_type: 'OUTGOING',
        call_start: activeCall.startedAt ? new Date(activeCall.startedAt).toISOString() : new Date().toISOString(),
        duration_seconds: timerSec,
        call_status: timerSec > 0 ? 'COMPLETED' : 'MISSED',
        call_source: 'APP',
        phone_number_dialed: activeCall.phone,
        lead_id: activeCall.leadId || null,
        lead_name: activeCall.name || 'Manual Call',
      }, { replaceId: activeCall.localTempId || null });

      invalidateCache('/calls/dialer-history');
    }
    setTimerSec(0);
    setActiveCall(null);
    callIdRef.current = null;
    if (tab === 'recents') loadHistory(true);
  }, [activeCall, timerSec, tab, loadHistory, upsertRecent]);

  const onPressKey = useCallback((v) => {
    const input = numberInputRef.current;
    if (!input) { setNumber(p => cleanNumber(p + v)); return; }
    const hasFocus = document.activeElement === input;
    const start = input.selectionStart ?? number.length;
    const end   = input.selectionEnd   ?? number.length;
    const newVal = cleanNumber(number.slice(0, start) + v + number.slice(end));
    setNumber(newVal);
    if (hasFocus) {
      requestAnimationFrame(() => {
        if (numberInputRef.current) {
          numberInputRef.current.setSelectionRange(start + 1, start + 1);
        }
      });
    }
  }, [number]);

  const onBackspace = useCallback(() => {
    const input = numberInputRef.current;
    if (!input) { setNumber(p => p.slice(0, -1)); return; }
    const hasFocus = document.activeElement === input;
    const start = input.selectionStart ?? number.length;
    const end   = input.selectionEnd   ?? number.length;
    let newVal, newPos;
    if (start !== end) {
      newVal = number.slice(0, start) + number.slice(end); newPos = start;
    } else if (start > 0) {
      newVal = number.slice(0, start - 1) + number.slice(start); newPos = start - 1;
    } else return;
    setNumber(newVal);
    if (hasFocus) {
      requestAnimationFrame(() => {
        if (numberInputRef.current) {
          numberInputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    }
  }, [number]);

  const onClearNumber = useCallback(() => {
    setNumber('');
  }, []);

  /* ── Auto-call from query params ── */
  useEffect(() => {
    const autoNumber = cleanNumber(searchParams.get('number') || searchParams.get('lead_phone') || '');
    const autoLeadId = searchParams.get('lead_id');
    const autoName   = searchParams.get('name') || searchParams.get('lead_name') || 'Lead';
    const autoCall   = String(searchParams.get('autoCall') || '').toLowerCase() === 'true';
    if (!autoNumber) return;
    setNumber(autoNumber);
    if (autoCall && !autoCallTriggered.current) {
      autoCallTriggered.current = true;
      startCall(autoNumber, { leadId: autoLeadId, name: autoName });
    }
  }, [searchParams]);

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] -m-2 sm:-m-5 md:-m-8 -mb-[calc(4rem+env(safe-area-inset-bottom,0px))] overflow-hidden">

      {/* ══ FIXED TOP: header + active call + tab switcher ══ */}
      <div className="shrink-0 px-3 pt-3 pb-0">



        {/* ── Active call banner ── */}
        {activeCall && (
          <div className="w-full max-w-sm mx-auto mb-3 rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 text-white px-5 py-3.5 shadow-xl
                          animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {activeCall.isConnected ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Connected
                    </span>
                  ) : '⟳ Dialing…'}
                </p>
                <p className="text-base font-bold mt-0.5 truncate">{activeName}</p>
                <p className="text-sm font-mono text-slate-300">{activeCall.phone}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0 ml-3">
                <span className="text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                  {fmtDuration(timerSec)}
                </span>
                <button
                  type="button"
                  onClick={handleManualStop}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold
                             px-3.5 py-1.5 rounded-full transition-all duration-200 active:scale-95"
                >
                  <PhoneOff className="h-3.5 w-3.5" /> End
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div className="flex items-center bg-slate-100 rounded-full p-1 gap-0.5 w-full max-w-sm mx-auto mb-2">
          {TAB_CONFIG.map(({ key, label, Icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold
                          transition-all duration-200 ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ SCROLLABLE CONTENT AREA ══ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      {tab === 'keypad' && (
        <div className="w-full max-w-xs flex flex-col items-center animate-in fade-in duration-200">

          {/* ── Number input row ── */}
          <div className="w-full flex items-center gap-1.5 px-1 mt-4 mb-1">
            {/* X — clear entire number */}
            <button
              type="button"
              onClick={onClearNumber}
              className={`h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0
                          ${number.length > 0
                            ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-500 opacity-100'
                            : 'opacity-0 pointer-events-none'}`}
            >
              <X className="h-5 w-5" />
            </button>

            {/* Editable number — tap anywhere to place cursor */}
            <input
              ref={numberInputRef}
              type="tel"
              inputMode="none"
              value={number}
              onChange={e => setNumber(cleanNumber(e.target.value))}
              onFocus={(e) => {
                if (isNativeApp()) {
                  e.target.blur();
                }
              }}
              readOnly={isNativeApp()}
              placeholder="Enter number"
              className="flex-1 min-w-0 text-center text-2xl font-mono font-semibold text-slate-900 tracking-wider
                         bg-transparent border-none outline-none caret-green-500
                         placeholder:text-slate-300 placeholder:text-lg placeholder:font-normal placeholder:tracking-normal"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />

            {/* Backspace — delete at cursor */}
            <button
              type="button"
              onPointerDown={e => { e.preventDefault(); onBackspace(); }}
              className={`h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0
                          ${number.length > 0
                            ? 'text-slate-400 hover:bg-slate-100 opacity-100'
                            : 'opacity-0 pointer-events-none'}`}
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          {/* ── Suggestions — directly below input for app-like flow ── */}
          {suggestions.length > 0 && (
            <div className="w-full mt-2 mb-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-150 touch-pan-y max-h-36 overflow-y-auto">
              {suggestions.map((s, i) => (
                <div
                  key={`${s.phone}-${i}`}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 active:bg-slate-100/70
                             transition-colors border-b border-slate-50 last:border-0"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white
                      ${s.type === 'history' ? 'bg-linear-to-br from-slate-400 to-slate-600'
                        : s.type === 'lead'  ? 'bg-linear-to-br from-emerald-400 to-green-600'
                        : 'bg-linear-to-br from-blue-400 to-indigo-600'}`}>
                    {s.name?.charAt(0)?.toUpperCase() || '#'}
                  </div>
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      setNumber(s.phone);
                    }}
                  >
                    <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{s.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono leading-tight">{s.phone}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      startCall(s.phone, { name: s.name, leadId: s.leadId || s.id });
                    }}
                    className="h-7 w-7 rounded-full bg-emerald-500/12 text-emerald-600 border border-emerald-200/70
                               flex items-center justify-center hover:bg-emerald-500/20 active:scale-90 transition-all shrink-0"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Keypad grid ── */}
          <div className="grid grid-cols-3 gap-3 mt-1">
            {KEYS.map(([d, l]) => <KeyBtn key={d} digit={d} letters={l} onPress={onPressKey} />)}
          </div>

          {/* ── Dial action section ── */}
          <div className="w-full mt-3 mb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] flex flex-col items-center gap-2.5">
            {sims.length > 1 && (
              <div className="w-full max-w-46">
                <Select value={selectedSim} onValueChange={setSelectedSim}>
                  <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-medium text-slate-700 bg-white shadow-sm">
                    <SelectValue placeholder="Select SIM" />
                  </SelectTrigger>
                  <SelectContent>
                    {sims.map((sim) => (
                      <SelectItem key={String(sim.slotIndex)} value={String(sim.slotIndex)}>
                        {sim.displayName || sim.carrierName || `SIM ${Number(sim.slotIndex) + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <button
              type="button"
              onClick={() => startCall(number, {})}
              disabled={!number}
              className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.85]
                         shadow-lg shadow-emerald-500/25 ring-2 ring-white flex items-center justify-center text-white
                         transition-all duration-200 disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none"
            >
              <PhoneCall className="h-7 w-7" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════ RECENTS TAB ═══════════════════ */}
      {tab === 'recents' && (
        <div className="w-full max-w-sm animate-in fade-in duration-200">
          {/* Search input + Sync button */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={recentsSearch}
                onChange={(e) => setRecentsSearch(e.target.value)}
                placeholder={contactsSynced ? `Search recents + ${deviceContactCount} contacts…` : 'Search recents…'}
                className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 bg-white
                           text-sm text-slate-900 placeholder:text-slate-400
                           focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500
                           transition-all duration-200"
              />
              {recentsSearch && (
                <button
                  type="button"
                  onClick={() => setRecentsSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-200
                             hover:bg-slate-300 flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3 text-slate-500" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => loadHistory(true)}
              disabled={historyLoading || historyLoadingMore}
              className="shrink-0 h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${(historyLoading || historyLoadingMore) ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => contactsSynced ? handleUnsync() : handleSyncAll()}
              disabled={syncingAll || contactsSyncing}
              className={`shrink-0 h-10 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-95 ${
                contactsSynced
                  ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {(syncingAll || contactsSyncing) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : contactsSynced ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {(syncingAll || contactsSyncing) ? 'Syncing' : contactsSynced ? 'Unsync' : 'Sync'}
            </button>
          </div>

          {/* History list */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            {filteredHistory.length === 0 && filteredDeviceContacts.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  {recentsSearch ? 'No results found' : (historyLoading ? 'Syncing latest calls...' : 'No call history yet')}
                </p>
              </div>
            ) : (
              <>
                {filteredHistory.map((call, i) => (
                  <HistoryRow key={call.id || i} call={call} onCall={startCall} outcomes={outcomes} onUpdate={handleCallUpdate} />
                ))}

                {/* Device contacts matches */}
                {filteredDeviceContacts.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-amber-50/80 border-y border-amber-100">
                      <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                        Device Contacts ({filteredDeviceContacts.length})
                      </p>
                    </div>
                    {filteredDeviceContacts.map((c, i) => {
                      const phone = c.phoneNumber || c.number || '';
                      const name = c.displayName || c.name || 'Contact';
                      return (
                        <div
                          key={`dc-${c.contactId || c.id || i}`}
                          className="flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 last:border-0
                                     hover:bg-slate-50/50 transition-colors duration-150 group"
                        >
                          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <User className="h-4.5 w-4.5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
                            <p className="text-xs text-slate-500 font-mono truncate">{phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startCall(phone, { name })}
                            className="h-10 w-10 rounded-full bg-green-500/10 hover:bg-green-500/20
                                       flex items-center justify-center text-green-600
                                       transition-all duration-200 active:scale-90 shrink-0"
                          >
                            <PhoneCall className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Infinite scroll sentinel */}
                {!recentsSearch && (
                  <>
                    <div ref={historyEndRef} className="h-1" />
                    {historyLoadingMore && (
                      <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-medium">Loading more…</span>
                      </div>
                    )}
                    {!historyHasMore && history.length > 0 && (
                      <div className="py-3 text-center">
                        <p className="text-[10px] text-slate-300 font-medium">End of history</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      </div>{/* end scrollable content */}
    </div>
  );
};

export default DialerPage;
