import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Delete, PhoneCall, PhoneOff, Search, X,
  ArrowDownLeft, ArrowUpRight, PhoneMissed,
  Clock, Keyboard, Loader2, User, RefreshCw,
  ChevronDown, Pencil, MessageSquare, Eye,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { cachedGet, getCachedSync, invalidateCache } from '@/lib/queryCache';
import {
  useRecents,
  upsertRecent as storeUpsertRecent,
  refresh as refreshRecents,
  loadMore as loadMoreRecents,
  setFilter as setRecentsFilter,
  markPending as markRecentPending,
  clearPending as clearRecentPending,
  syncDeviceLog,
  mergeDeviceCalls,
} from '@/lib/recentsStore';
import { useDialer } from '@/hooks/useDialer';
import { useDeviceContacts } from '@/hooks/useDeviceContacts';
import { useCallDrawer } from '@/context/CallDrawerContext';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye as EyeIcon } from 'lucide-react';
import { format } from 'date-fns';
import CallTimeline from '@/components/CallTimeline';

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

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New Lead', color: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { value: 'INTERESTED', label: 'Interested', color: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  { value: 'SITE_VISIT', label: 'Site Visit', color: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { value: 'NEGOTIATION', label: 'Negotiation', color: 'bg-purple-50 text-purple-700 ring-purple-200' },
  { value: 'BOOKED', label: 'Booked', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { value: 'LOST', label: 'Lost', color: 'bg-slate-50 text-slate-700 ring-slate-200' },
  { value: 'INCOMING_OFF', label: 'Incoming Off', color: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { value: 'SWITCH_OFF', label: 'Switch Off', color: 'bg-red-50 text-red-700 ring-red-200' },
  { value: 'NOT_ANSWERING', label: 'Not Answering', color: 'bg-rose-50 text-rose-700 ring-rose-200' },
];

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

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/* ── Keypad button — flat, neutral, system-app feel ──────────────────────── */
const KeyBtn = memo(({ digit, letters, onPress }) => {
  const [pressed, setPressed] = useState(false);
  const handleDown = (e) => { e.preventDefault(); setPressed(true); };
  const handleUp = (e) => { e.preventDefault(); setPressed(false); onPress(digit); };

  return (
    <button
      type="button"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={`relative flex flex-col items-center justify-center select-none rounded-full
        transition-colors duration-75 ease-out touch-none
        h-12 w-12 xs:h-[3.25rem] xs:w-[3.25rem] sm:h-[3.5rem] sm:w-[3.5rem]
        ${pressed
          ? 'bg-slate-200/80 text-slate-900'
          : 'bg-slate-100/70 hover:bg-slate-200/60 text-slate-900'
        }`}
    >
      <span className="text-[1.15rem] xs:text-[1.2rem] sm:text-[1.3rem] font-normal leading-none">
        {digit}
      </span>
      {letters && (
        <span className="text-[7.5px] xs:text-[8px] font-medium leading-none mt-[2px] tracking-[0.15em] text-slate-500">
          {letters}
        </span>
      )}
    </button>
  );
});
KeyBtn.displayName = 'KeyBtn';

/* ── Suggestion chip for horizontal ribbon ───────────────────────────────── */
const SuggestionChip = memo(({ s, onSelect, onCall }) => {
  const pointerStart = useRef(null);
  const didScroll = useRef(false);

  const handlePointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    didScroll.current = false;
  };
  const handlePointerMove = (e) => {
    if (!pointerStart.current) return;
    const dx = Math.abs(e.clientX - pointerStart.current.x);
    const dy = Math.abs(e.clientY - pointerStart.current.y);
    if (dx > 6 || dy > 6) didScroll.current = true;
  };
  const handlePointerUp = () => {
    if (!didScroll.current) onSelect(s.phone);
    pointerStart.current = null;
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg pl-2 pr-1.5 py-1
                 hover:border-slate-300 active:bg-slate-50
                 transition-colors duration-100 cursor-pointer select-none touch-pan-x
                 min-w-[8rem] max-w-[10.5rem]"
    >
      <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-medium text-slate-600 bg-slate-100">
        {s.name?.charAt(0)?.toUpperCase() || '#'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] font-medium text-slate-900 truncate leading-tight">{s.name}</p>
        <p className="text-[9.5px] text-slate-500 font-mono leading-tight truncate">{s.phone}</p>
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onCall(s.phone, { name: s.name, leadId: s.leadId || s.id }); }}
        className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center
                   shrink-0 hover:bg-emerald-700 active:scale-90 transition-colors"
      >
        <PhoneCall className="h-3 w-3" />
      </button>
    </div>
  );
});
SuggestionChip.displayName = 'SuggestionChip';

/* ── History row — expandable accordion ─────────────────────────────────── */
const HistoryRow = memo(({ call, onCall, onOpenDrawer, onView }) => {
  const [open, setOpen] = useState(false);

  const { Icon, color, bg } = typeMeta(call.call_type);
  const phone = call.phone_number_dialed || call.lead_phone || '';
  const rawName = call.lead_name;
  const hasRealName = !!rawName && rawName !== 'Manual Call' && rawName !== 'Unknown';
  const name = hasRealName ? rawName : (phone || 'Unknown');
  const isMissed = String(call.call_type).toUpperCase() === 'MISSED';
  const waLink = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : null;
  // Missed calls never have real talk-time. Android occasionally records
  // the ring time as duration on MISSED rows, so guard at display too.
  const dur = (!isMissed && call.duration_seconds > 0) ? fmtDuration(call.duration_seconds) : null;

  const openDrawerFor = (e) => {
    e.stopPropagation();
    onOpenDrawer?.({
      phoneNumber: phone,
      contactName: call.lead_name || '',
      callType: String(call.call_type || 'UNKNOWN').toUpperCase(),
      duration: Number(call.duration_seconds) || 0,
      timestamp: call.call_start || new Date().toISOString(),
      callId: typeof call.id === 'number' ? call.id : (String(call.id || '').startsWith('local-') ? null : call.id || null),
      leadId: call.lead_id || null,
      customerNotes: call.customer_notes || '',
    });
  };

  const viewFor = (e) => {
    e.stopPropagation();
    onView?.(call);
  };

  // Direction icon — flat slate by default, rose only for missed.
  const directionTint = isMissed ? 'text-rose-500' : 'text-slate-400';

  return (
    <div className={`border-b border-slate-100 last:border-0 ${open ? 'bg-slate-50' : ''}`}>
      {/* Summary */}
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left active:bg-slate-100/70 cursor-pointer"
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${directionTint}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[12.5px] font-medium truncate leading-tight ${isMissed ? 'text-rose-600' : 'text-slate-900'}`}>{name}</p>
          <p className="text-[10.5px] text-slate-500 truncate leading-tight mt-0.5">
            {fmtDate(call.call_start)}{dur ? ` · ${dur}` : ''}
            {hasRealName ? ` · ${phone}` : ''}
          </p>
          {call.customer_notes && (
            <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
              {call.customer_notes}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={viewFor}
          title="View details"
          className="h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center shrink-0 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <ChevronDown className={`h-3 w-3 text-slate-300 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded */}
      {open && (
        <div className="px-3 pb-2.5 animate-in fade-in duration-150">
          <div className="space-y-1.5">
            {/* Inline meta — single subtle row, no chips */}
            {(call.lead_status || call.lead_category || call.next_action) && (
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {[
                  call.lead_status,
                  call.lead_category,
                  call.next_action && call.next_action !== 'NONE' ? `Next: ${call.next_action.replace('_', ' ')}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Notes */}
            {call.customer_notes && (
              <p className="text-[11px] text-slate-700 leading-relaxed border-l-2 border-slate-200 pl-2">
                {call.customer_notes}
              </p>
            )}

            {/* Actions — single row, icon-only */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCall(phone, { name, leadId: call.lead_id }); }}
                title="Call"
                className="h-7 w-7 flex items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <PhoneCall className="h-3.5 w-3.5" />
              </button>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  title="WhatsApp"
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={viewFor}
                title="View"
                className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={openDrawerFor}
                title="Edit"
                className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
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
  const { openDrawer: openCallDrawer } = useCallDrawer();

  /* ── Core state ── */
  const [tab, setTab]                   = useState('keypad');
  const [number, setNumber]             = useState('');
  const [sims, setSims]                 = useState([]);
  const [selectedSim, setSelectedSim]   = useState('-1');
  const [activeCall, setActiveCall]     = useState(null);
  const [timerSec, setTimerSec]         = useState(0);
  const [syncingAll, setSyncingAll]     = useState(false);

  /* ── History — backed by the global recents store (single source of truth). ── */
  const recentsState = useRecents();
  const history             = recentsState.calls;
  // Empty-state placeholder — only show "Loading…" message when there are no
  // rows to display yet.
  const historyEmpty        = recentsState.isFetching && history.length === 0;
  // Drives the spinner on the Refresh button — true for ANY in-flight fetch.
  const historyLoading      = recentsState.isFetching;
  const historyLoadingMore  = recentsState.isLoadingMore;
  const historyHasMore      = recentsState.hasMore;
  const historyFilter       = recentsState.filter;
  const setHistoryFilter    = useCallback((next) => setRecentsFilter(next), []);
  /* ── Recents search state ── */
  const [recentsSearch, setRecentsSearch]   = useState('');

  /* ── Call outcomes (for edit dropdown) ── */
  const [outcomes, setOutcomes]             = useState([]);

  /* ── Lead view drawer state (matches Leads page Eye behavior) ── */
  const [viewOpen, setViewOpen]               = useState(false);
  const [viewTarget, setViewTarget]           = useState(null);
  const [viewCallHistory, setViewCallHistory] = useState([]);
  const [viewCallLoading, setViewCallLoading] = useState(false);
  const [viewLoading, setViewLoading]         = useState(false);

  const handleViewCall = useCallback(async (call) => {
    const phone = call?.phone_number_dialed || call?.lead_phone || '';
    setViewOpen(true);
    // Seed current call into timeline immediately so the drawer shows history
    // even for unlinked rows — avoids the "nothing to show + slow spinner" feel.
    const seedCall = call?.id != null && !String(call.id).startsWith('local-') ? [{
      id: call.id,
      call_type: call.call_type,
      call_start: call.call_start,
      call_end: null,
      duration_seconds: call.duration_seconds || 0,
      customer_notes: call.customer_notes || null,
      outcome_label: call.outcome_label || null,
    }] : [];
    setViewCallHistory(seedCall);
    setViewTarget({
      id: call?.lead_id || null,
      name: call?.lead_name || (phone ? phone : 'Unknown'),
      phone,
      email: '',
      address: '',
      profession: '',
      status: call?.lead_status || null,
      lead_category: call?.lead_category || null,
      lead_source: null,
      notes: '',
      photo_url: null,
      created_at: null,
      calls_dialed: null,
    });

    const resolveLeadId = async () => {
      if (call?.lead_id) return call.lead_id;
      if (!phone) return null;
      try {
        // Fast, cached phone lookup so timeline works for unlinked calls too.
        const search = encodeURIComponent(phone);
        const data = await cachedGet(`/leads?search=${search}&limit=5`, { staleTime: 120_000, cacheTime: 600_000 });
        const tail = String(phone).replace(/\D/g, '').slice(-10);
        const match = (data?.leads || []).find((l) => String(l.phone || '').replace(/\D/g, '').slice(-10) === tail);
        return match?.id || null;
      } catch { return null; }
    };

    setViewLoading(true);
    setViewCallLoading(true);
    try {
      const leadId = await resolveLeadId();
      if (!leadId) {
        // No linked lead — keep the seed data; stop spinners.
        setViewLoading(false);
        setViewCallLoading(false);
        return;
      }
      // Parallel fetch — cache-backed so repeat clicks are instant.
      const [leadData, callsData] = await Promise.all([
        cachedGet(`/leads/${leadId}`, { staleTime: 60_000, cacheTime: 600_000 }).catch(() => null),
        cachedGet(`/calls/lead/${leadId}`, { staleTime: 30_000, cacheTime: 300_000 }).catch(() => null),
      ]);
      if (leadData?.success && leadData?.lead) setViewTarget(leadData.lead);
      if (callsData?.success && Array.isArray(callsData.calls)) setViewCallHistory(callsData.calls);
    } finally {
      setViewLoading(false);
      setViewCallLoading(false);
    }
  }, []);

  const timerRef          = useRef(null);
  const timerSecRef       = useRef(0);
  const activeCallRef     = useRef(null);
  const tabRef            = useRef('keypad');
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

  // Optimistic insert/replace into the global recents store. The store handles
  // dedup, persistence (localStorage + IDB), and the pending-id protection
  // window — DialerPage just hands it the new entry.
  const upsertRecent = useCallback((entry, opts = {}) => {
    storeUpsertRecent(entry, opts);
  }, []);

  // User-triggered refresh — spins the Refresh button so the user sees
  // feedback that something is happening.
  const reloadHistory = useCallback(() => {
    refreshRecents({ force: true }).catch(() => {});
  }, []);

  // Background refresh — does NOT spin the Refresh button. Used after
  // call lifecycle events / device-log syncs where the user didn't ask
  // for a refresh and shouldn't see the UI flicker.
  const reloadHistorySilent = useCallback(() => {
    refreshRecents({ force: true, silent: true }).catch(() => {});
  }, []);

  useEffect(() => { timerSecRef.current = timerSec; }, [timerSec]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  /* ── Mirror lead-save events into the open Eye drawer's call timeline so
        notes / lead name show up the moment the post-call drawer saves,
        without waiting for a fresh /calls/lead/{id} fetch. ── */
  useEffect(() => {
    const onCallUpdated = (e) => {
      const detail = e?.detail || {};
      const cid = detail.callId != null ? String(detail.callId) : null;
      if (!cid) return;
      setViewCallHistory((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        let touched = false;
        const next = prev.map((c) => {
          if (c?.id == null || String(c.id) !== cid) return c;
          touched = true;
          return {
            ...c,
            customer_notes: detail.customerNotes !== undefined ? detail.customerNotes : c.customer_notes,
            lead_id: detail.leadId ?? c.lead_id ?? null,
          };
        });
        return touched ? next : prev;
      });
      setViewTarget((prev) => {
        if (!prev) return prev;
        if (detail.leadName) {
          return { ...prev, name: detail.leadName, id: detail.leadId ?? prev.id };
        }
        return prev;
      });
    };
    window.addEventListener('rg:call-updated', onCallUpdated);
    return () => window.removeEventListener('rg:call-updated', onCallUpdated);
  }, []);

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
        const rawName = c.lead_name;
        const realName = rawName && rawName !== 'Manual Call' && rawName !== 'Unknown' ? rawName : phone;
        matches.set(phone, { name: realName, phone, type: 'history', leadId: c.lead_id });
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

      // 2. Fetch phone's native recent call log — sync ALL types so calls
      //    placed from the system dialer also appear in Recents. Server
      //    dedupes on (phone, ±30s) so this is safe even when the app
      //    already logged the call via /calls/quick-log.
      const recentCalls = await getRecentCalls(200);
      if (recentCalls.length > 0) {
        // Stage 1 — instant local merge (shows in UI before the POST returns).
        mergeDeviceCalls(recentCalls);

        const payload = recentCalls
          .map(c => {
            const phone = String(c.number || '').replace(/[^0-9+]/g, '');
            if (!phone) return null;
            const rawType = String(c.type || '').toUpperCase();
            const callType = ['MISSED', 'REJECTED'].includes(rawType) ? 'MISSED'
              : rawType === 'INCOMING' ? 'INCOMING'
              : rawType === 'OUTGOING' ? 'OUTGOING'
              : null;
            if (!callType) return null;
            const rawDur = Number(c.duration) || 0;
            return {
              phone_number: phone,
              call_type: callType,
              call_start: c.date ? new Date(Number(c.date)).toISOString() : new Date().toISOString(),
              duration_seconds: callType === 'MISSED' ? 0 : rawDur,
            };
          })
          .filter(Boolean);

        if (payload.length > 0) {
          const { data } = await api.post('/calls/sync-device-log', { calls: payload });
          if (data.success) {
            toast.success(`Synced ${data.synced} call${data.synced !== 1 ? 's' : ''} from phone${data.skipped ? ` (${data.skipped} duplicates skipped)` : ''}`);
          }
        } else {
          toast.info('No phone calls to sync');
        }
      }

      // 3. Reload history
      reloadHistory();
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncingAll(false);
    }
  }, [syncingAll, syncContacts, getRecentCalls, reloadHistory]);

  const handleUnsync = useCallback(() => {
    clearContactsCache();
    toast('Device contacts unsynced');
  }, [clearContactsCache]);

  /* ── On Recents tab: kick a device-call sync. The recents store already
        polls the native CallLog every 30s, on app boot, and on
        visibilitychange — but this opens a fast path for the user who
        deliberately switched to Recents to *check* for new calls. ── */
  useEffect(() => {
    if (tab !== 'recents') return;
    syncDeviceLog({ force: true }).catch(() => {});
  }, [tab]);

  /* ── Infinite scroll for history ── */
  useEffect(() => {
    if (tab !== 'recents' || !historyHasMore || historyLoadingMore) return;
    const el = historyEndRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreRecents(); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tab, historyHasMore, historyLoadingMore]);

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
        // 1) Optimistic finalize — instant UI update + eager snapshot persist.
        upsertRecent({
          id: cid,
          call_type: 'OUTGOING',
          call_start: currentActiveCall?.startedAt ? new Date(currentActiveCall.startedAt).toISOString() : new Date().toISOString(),
          duration_seconds: dur,
          call_status: dur > 0 ? 'COMPLETED' : 'MISSED',
          call_source: 'APP',
          phone_number_dialed: currentActiveCall?.phone,
          lead_id: currentActiveCall?.leadId || null,
          lead_name: currentActiveCall?.name || null,
        }, { replaceId: currentActiveCall?.localTempId || null });
        invalidateCache('/calls/dialer-history');
        // Protect the optimistic row from being overwritten by an in-flight
        // refresh until the server has caught up.
        markRecentPending(cid);
      }
      setTimerSec(0);
      setActiveCall(null);
      callIdRef.current = null;

      // Wait for the end PUT to land so the subsequent refresh sees the
      // finalized row from the server. Capped so a slow request doesn't
      // block the UI refresh forever.
      if (cid) {
        try {
          await Promise.race([
            api.put(`/calls/${cid}/end`, {
              next_action: 'NONE', duration_seconds: dur, customer_notes: null,
            }),
            new Promise((resolve) => setTimeout(resolve, 1500)),
          ]);
        } catch { /* ignore — optimistic row stays */ }
      }
      reloadHistorySilent();
      if (cid) {
        // Server has had a chance to catch up — drop the pending marker.
        setTimeout(() => clearRecentPending(cid), 30_000);
      }
    });

    return () => {
      try { subConn?.remove?.(); } catch {}
      try { subEnd?.remove?.(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onCallConnected, onCallEnded, upsertRecent, reloadHistorySilent]);

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
      name: opts.name || null,
      phone, startedAt: Date.now(), connectedAt: null, isConnected: false,
      localTempId,
    });

    const isApp = window.Capacitor?.isNativePlatform?.() || false;

    // Show immediately in recents (local-first)
    upsertRecent({
      id: localTempId,
      call_type: 'OUTGOING',
      call_start: nowIso,
      duration_seconds: 0,
      call_status: 'ACTIVE',
      call_source: isApp ? 'APP' : 'WEB',
      phone_number_dialed: phone,
      lead_id: opts.leadId || null,
      lead_name: opts.name || null,
    });

    makeCall(phone, Number(selectedSim)).catch(() => {
      openDialer(phone).catch(() => {});
      toast.message('Opened system dialer');
    });
    try {
      localStorage.setItem('rg:lastDialedCall', JSON.stringify({
        phone, name: opts.name || null,
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
          lead_name: opts.name || data.call.lead_name || null,
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

      // Refresh recents from server so the newly-created call is reflected everywhere.
      reloadHistorySilent();
    }).catch(() => {
      // Even if server failed, keep the optimistic local row — user can retry.
    });
  }, [activeCall, selectedSim, makeCall, openDialer, upsertRecent, reloadHistorySilent]);

  const handleManualStop = useCallback(async () => {
    if (!activeCall) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const cid = callIdRef.current || activeCall.callId;
    if (cid) {
      // Optimistic finalize first — UI shows the ended call instantly and the
      // snapshot is persisted so a cold reload preserves it.
      upsertRecent({
        id: cid,
        call_type: 'OUTGOING',
        call_start: activeCall.startedAt ? new Date(activeCall.startedAt).toISOString() : new Date().toISOString(),
        duration_seconds: timerSec,
        call_status: timerSec > 0 ? 'COMPLETED' : 'MISSED',
        call_source: 'APP',
        phone_number_dialed: activeCall.phone,
        lead_id: activeCall.leadId || null,
        lead_name: activeCall.name || null,
      }, { replaceId: activeCall.localTempId || null });
      invalidateCache('/calls/dialer-history');
      markRecentPending(cid);
    }
    setTimerSec(0);
    setActiveCall(null);
    callIdRef.current = null;

    // Await the end PUT (capped at 1500ms) so the refresh below sees the
    // finalized row from the server instead of racing it.
    if (cid) {
      try {
        await Promise.race([
          api.put(`/calls/${cid}/end`, {
            next_action: 'NONE', duration_seconds: timerSec, customer_notes: null,
          }),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch { /* keep optimistic row */ }
    }
    reloadHistorySilent();
    if (cid) {
      setTimeout(() => clearRecentPending(cid), 30_000);
    }
  }, [activeCall, timerSec, upsertRecent, reloadHistorySilent]);

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
    <div className="flex flex-col flex-1 min-h-0 -m-2 sm:-m-5 md:-m-8 -mb-[calc(4rem+env(safe-area-inset-bottom,0px))] overflow-hidden">

      {/* ══ FIXED TOP: active call + tab switcher ══ */}
      <div className="shrink-0 px-3 pt-2.5 pb-0">

        {/* ── Active call banner ── */}
        {activeCall && (
          <div className="w-full max-w-[22rem] mx-auto mb-2 rounded-lg bg-slate-900 text-white px-3 py-2
                          animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 leading-tight">
                  {activeCall.isConnected ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-emerald-400" /> Connected
                    </span>
                  ) : 'Dialing…'}
                </p>
                <p className="text-[13px] font-medium mt-0.5 truncate leading-tight">{activeName}</p>
                <p className="text-[10.5px] font-mono text-slate-400 truncate leading-tight mt-0.5">{activeCall.phone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[14px] font-mono text-slate-300 tabular-nums">
                  {fmtDuration(timerSec)}
                </span>
                <button
                  type="button"
                  onClick={handleManualStop}
                  className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-medium
                             px-2.5 py-1 rounded-md transition-colors"
                >
                  <PhoneOff className="h-3 w-3" /> End
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab switcher — segmented control ── */}
        <div className="flex items-center w-full max-w-[22rem] mx-auto mb-1 border-b border-slate-200">
          {TAB_CONFIG.map(({ key, label, Icon: TabIcon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] font-medium
                          transition-colors duration-150 border-b-2 -mb-px ${
                tab === key
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ SCROLLABLE CONTENT AREA ══ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
      {tab === 'keypad' && (
        <div className="w-full max-w-[20rem] my-auto flex flex-col items-center animate-in fade-in duration-200">

          {/* ── Number display — clean, single line ── */}
          <div className="w-full flex items-center justify-between gap-1 px-1 mb-2 min-h-[2.75rem]">
            <button
              type="button"
              onClick={onClearNumber}
              className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors shrink-0
                          ${number.length > 0
                            ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 opacity-100'
                            : 'opacity-0 pointer-events-none'}`}
            >
              <X className="h-4 w-4" />
            </button>

            <input
              ref={numberInputRef}
              type="tel"
              inputMode="none"
              value={number}
              onChange={e => {
                const input = numberInputRef.current;
                const prevStart = input?.selectionStart ?? null;
                const raw = e.target.value;
                const cleaned = cleanNumber(raw);
                setNumber(cleaned);
                // If the OS injected characters that got stripped by cleanNumber,
                // walk the caret back so it stays on the digit the user just typed
                // instead of jumping to the end after re-render.
                if (prevStart !== null && cleaned.length !== raw.length) {
                  const delta = raw.length - cleaned.length;
                  const next = Math.max(0, prevStart - delta);
                  requestAnimationFrame(() => {
                    if (numberInputRef.current) {
                      numberInputRef.current.setSelectionRange(next, next);
                    }
                  });
                }
              }}
              placeholder="Enter number"
              className={`flex-1 min-w-0 text-center bg-transparent border-none outline-none caret-slate-900
                         font-normal text-slate-900 tracking-[0.05em]
                         placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal
                         transition-all duration-200
                         ${number.length > 10 ? 'text-[1.25rem]' : number.length > 6 ? 'text-[1.5rem]' : 'text-[1.75rem]'}`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />

            <button
              type="button"
              onPointerDown={e => { e.preventDefault(); onBackspace(); }}
              className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors shrink-0
                          ${number.length > 0
                            ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 opacity-100'
                            : 'opacity-0 pointer-events-none'}`}
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>

          {/* ── Suggestions ribbon ── */}
          <div className={`w-full transition-all duration-200 ${suggestions.length > 0 ? 'mb-2' : 'mb-0 h-0 overflow-hidden'}`}>
            {suggestions.length > 0 && (
              <div className="overflow-x-auto scrollbar-hide -mx-1 animate-in fade-in duration-150">
                <div className="flex gap-1.5 px-1 pb-1" style={{ width: 'max-content' }}>
                  {suggestions.map((s, i) => (
                    <SuggestionChip
                      key={`${s.phone}-${i}`}
                      s={s}
                      onSelect={setNumber}
                      onCall={startCall}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Keypad grid ── */}
          <div className="grid grid-cols-3 w-full justify-items-center" style={{ rowGap: '0.4rem', columnGap: '0.5rem' }}>
            {KEYS.map(([d, l]) => (
              <KeyBtn key={d} digit={d} letters={l} onPress={onPressKey} />
            ))}
          </div>

          {/* ── Dial action row ── */}
          <div className="w-full mt-3 flex items-center justify-center relative">
            {sims.length > 1 && (
              <div className="absolute left-1">
                <Select value={selectedSim} onValueChange={setSelectedSim}>
                  <SelectTrigger className="h-7 w-28 rounded-md border-slate-200 text-[10.5px] font-medium text-slate-700 bg-white">
                    <SelectValue placeholder="SIM" />
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
              className="h-12 w-12 rounded-full bg-emerald-600 hover:bg-emerald-700
                         flex items-center justify-center text-white
                         transition-colors active:scale-95
                         disabled:opacity-30 disabled:pointer-events-none"
            >
              <PhoneCall className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════ RECENTS TAB ═══════════════════ */}
      {tab === 'recents' && (
        <div className="w-full max-w-[22rem] xs:max-w-md sm:max-w-lg animate-in fade-in duration-200 pt-1">
          {/* Search + sync controls */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={recentsSearch}
                onChange={(e) => setRecentsSearch(e.target.value)}
                placeholder={contactsSynced ? `Search recents + ${deviceContactCount} contacts` : 'Search recents'}
                className="w-full h-8 pl-8 pr-7 rounded-md border border-slate-200 bg-white
                           text-[12px] text-slate-900 placeholder:text-slate-400
                           focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300
                           transition-colors"
              />
              {recentsSearch && (
                <button
                  type="button"
                  onClick={() => setRecentsSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full
                             text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => reloadHistory()}
              disabled={historyLoading || historyLoadingMore}
              title="Refresh"
              className="shrink-0 h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${(historyLoading || historyLoadingMore) ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => contactsSynced ? handleUnsync() : handleSyncAll()}
              disabled={syncingAll || contactsSyncing}
              title={contactsSynced ? 'Unsync contacts' : 'Sync device contacts'}
              className={`shrink-0 h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${
                contactsSynced
                  ? 'bg-white text-rose-500 border-slate-200 hover:bg-slate-50'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {(syncingAll || contactsSyncing) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : contactsSynced ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* History list */}
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
            {filteredHistory.length === 0 && filteredDeviceContacts.length === 0 ? (
              <div className="py-10 text-center">
                <Clock className="h-6 w-6 text-slate-200 mx-auto mb-1.5" />
                <p className="text-[12px] text-slate-400">
                  {recentsSearch ? 'No results found' : (historyEmpty ? 'Loading…' : 'No call history')}
                </p>
              </div>
            ) : (
              <>
                {filteredHistory.map((call, i) => (
                  <HistoryRow key={call.id || i} call={call} onCall={startCall} onOpenDrawer={openCallDrawer} onView={handleViewCall} />
                ))}

                {filteredDeviceContacts.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-slate-50 border-y border-slate-200">
                      <p className="text-[10px] font-medium text-slate-500">
                        Device Contacts · {filteredDeviceContacts.length}
                      </p>
                    </div>
                    {filteredDeviceContacts.map((c, i) => {
                      const phone = c.phoneNumber || c.number || '';
                      const name = c.displayName || c.name || 'Contact';
                      return (
                        <div
                          key={`dc-${c.contactId || c.id || i}`}
                          className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                        >
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium text-slate-900 truncate leading-tight">{name}</p>
                            <p className="text-[10.5px] text-slate-500 font-mono truncate leading-tight mt-0.5">{phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startCall(phone, { name })}
                            className="h-7 w-7 rounded-md text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-colors shrink-0"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
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
                      <div className="flex items-center justify-center py-3 gap-2 text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-[11px]">Loading more</span>
                      </div>
                    )}
                    {!historyHasMore && history.length > 0 && (
                      <div className="py-2 text-center">
                        <p className="text-[10px] text-slate-300">End of history</p>
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

      {/* View Details Drawer */}
      <Drawer open={viewOpen} onOpenChange={setViewOpen}>
        <DrawerContent className="max-h-[92vh] bg-slate-50">
          <DrawerHeader className="shrink-0 px-3 sm:px-4 pt-2.5 pb-2 flex-row items-center gap-2 space-y-0 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setViewOpen(false)}
              className="h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1 min-w-0 text-left">
              <DrawerTitle className="text-[13px] font-medium text-slate-900 truncate m-0">Lead Details</DrawerTitle>
              <DrawerDescription className="text-[10.5px] text-slate-500 truncate m-0">
                {viewLoading ? 'Loading…' : (viewTarget?.name || 'Contact')}
              </DrawerDescription>
            </div>
          </DrawerHeader>

          {viewTarget && (
            <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 px-3 sm:px-4 pb-4 space-y-2.5 max-w-2xl mx-auto w-full">

              {/* Identity */}
              <div className="rounded-md border border-slate-200 bg-white p-3 flex items-center gap-3">
                {viewTarget.photo_url ? (
                  <div className="h-12 w-12 rounded-md overflow-hidden border border-slate-200 shrink-0">
                    <img src={viewTarget.photo_url} alt={viewTarget.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 text-base font-medium">
                    {(viewTarget.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-slate-900 truncate leading-tight">{viewTarget.name || '—'}</p>
                  <p className="text-[11.5px] font-mono text-slate-500 truncate leading-tight mt-0.5">{viewTarget.phone || '—'}</p>
                  {(viewTarget.status || viewTarget.lead_category) && (
                    <p className="text-[10.5px] text-slate-500 truncate leading-tight mt-1">
                      {[
                        STATUS_OPTIONS.find((s) => s.value === viewTarget.status)?.label || viewTarget.status,
                        viewTarget.lead_category,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Info grid */}
              <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                <div className="grid grid-cols-1 xs:grid-cols-2 divide-y xs:divide-y-0 xs:divide-x divide-slate-100">
                  {[
                    { label: 'Email', value: viewTarget.email },
                    { label: 'Address', value: viewTarget.address },
                    { label: 'Profession', value: viewTarget.profession },
                    { label: 'Source', value: viewTarget.lead_source },
                    { label: 'Added', value: viewTarget.created_at ? format(new Date(viewTarget.created_at), 'MMM dd, yyyy') : null },
                    // Use the actual timeline length when it's higher than the
                    // (cached / stale) lead.calls_dialed counter — that way a
                    // freshly logged call shows up immediately instead of the
                    // counter lagging by one until the next /leads refresh.
                    { label: 'Calls', value: String(Math.max(Number(viewTarget.calls_dialed) || 0, viewCallHistory.length)) },
                  ].map((row, i) => (
                    <div
                      key={row.label}
                      className={`px-3 py-2 ${i >= 2 ? 'xs:border-t xs:border-slate-100' : ''}`}
                    >
                      <p className="text-[10px] text-slate-500">{row.label}</p>
                      <p className={`text-[12px] truncate mt-0.5 ${row.value ? 'text-slate-800' : 'text-slate-300'}`} title={row.value || ''}>
                        {row.value || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="text-[10px] text-slate-500 mb-1">Notes</p>
                <p className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {(viewTarget.notes && String(viewTarget.notes).replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim()) || <span className="text-slate-300">No notes</span>}
                </p>
              </div>

              {/* Timeline */}
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <CallTimeline calls={viewCallHistory} loading={viewCallLoading} />
              </div>
            </div>
          )}

          <DrawerFooter className="shrink-0 border-t border-slate-200 px-3 sm:px-4 py-2 bg-white">
            <Button
              type="button"
              onClick={() => setViewOpen(false)}
              className="h-9 w-full max-w-2xl mx-auto text-[12.5px] font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 shadow-none"
            >
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default DialerPage;
