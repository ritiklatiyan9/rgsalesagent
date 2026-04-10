import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Delete, PhoneCall, PhoneOff, Search, X,
  ArrowDownLeft, ArrowUpRight, PhoneMissed, Smartphone,
  Clock, Keyboard, Loader2, User, Phone, ChevronRight,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useDialer } from '@/hooks/useDialer';

/* ── Constants ──────────────────────────────────────────────────────────── */
const KEYS = [
  ['1', ''],     ['2', 'ABC'],  ['3', 'DEF'],
  ['4', 'GHI'],  ['5', 'JKL'],  ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'],  ['9', 'WXYZ'],
  ['*', ''],     ['0', '+'],    ['#', ''],
];

const TAB_CONFIG = [
  { key: 'keypad', label: 'Keypad', Icon: Keyboard },
  { key: 'search', label: 'Search', Icon: Search },
  { key: 'history', label: 'History', Icon: Clock },
];

const HISTORY_LIMIT = 30;

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

/* ── History row (DB-sourced) ──────────────────────────────────────────────── */
const HistoryRow = memo(({ call, onCall, style }) => {
  const { Icon, color, bg } = typeMeta(call.call_type);
  const phone = call.phone_number_dialed || call.lead_phone || '';
  const name = call.lead_name || phone || 'Unknown';
  const isMissed = String(call.call_type).toUpperCase() === 'MISSED';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 last:border-0
                 hover:bg-slate-50/50 transition-colors duration-150 group"
      style={style}
    >
      <div className={`h-10 w-10 rounded-full ${bg} flex items-center justify-center shrink-0
                       transition-transform duration-200 group-hover:scale-105`}>
        <Icon className={`h-4.5 w-4.5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isMissed ? 'text-rose-600' : 'text-slate-900'}`}>
          {name}
        </p>
        {name !== phone && phone && (
          <p className="text-xs text-slate-500 font-mono truncate">{phone}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-400">{fmtDate(call.call_start)}</span>
          {call.duration_seconds > 0 && (
            <span className="text-[10px] text-slate-400">· {fmtDuration(call.duration_seconds)}</span>
          )}
          {call.outcome_label && (
            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">
              {call.outcome_label}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCall(phone, { name, leadId: call.lead_id })}
        className="h-10 w-10 rounded-full bg-green-500/10 hover:bg-green-500/20
                   flex items-center justify-center text-green-600
                   transition-all duration-200 active:scale-90 shrink-0"
      >
        <PhoneCall className="h-4 w-4" />
      </button>
    </div>
  );
});
HistoryRow.displayName = 'HistoryRow';

/* ── Search result row ─────────────────────────────────────────────────────── */
const SearchResultRow = memo(({ item, onCall }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 last:border-0
                  hover:bg-slate-50/50 transition-colors duration-150 group">
    <div className="h-10 w-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0
                    transition-transform duration-200 group-hover:scale-105">
      <User className="h-4.5 w-4.5 text-violet-500" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-slate-900 truncate">{item.name || 'Unknown'}</p>
        {item.lead_category && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${statusBadge(item.lead_category)}`}>
            {item.lead_category}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 font-mono truncate">{item.phone}</p>
      {item.total_calls > 0 && (
        <p className="text-[10px] text-slate-400 mt-0.5">
          {item.total_calls} call{item.total_calls > 1 ? 's' : ''} · Last: {fmtDate(item.last_call_at)}
        </p>
      )}
    </div>
    <button
      type="button"
      onClick={() => onCall(item.phone, { name: item.name, leadId: item.id })}
      className="h-10 w-10 rounded-full bg-green-500/10 hover:bg-green-500/20
                 flex items-center justify-center text-green-600
                 transition-all duration-200 active:scale-90 shrink-0"
    >
      <PhoneCall className="h-4 w-4" />
    </button>
  </div>
));
SearchResultRow.displayName = 'SearchResultRow';

/* ── Skeleton rows ────────────────────────────────────────────────────────── */
const SkeletonRows = ({ count = 5 }) => (
  <div className="divide-y divide-slate-100/80">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      </div>
    ))}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
const DialerPage = () => {
  const [searchParams] = useSearchParams();
  const { requestPermissions, makeCall, openDialer, getRecentCalls, getSIMInfo,
          onCallConnected, onCallEnded, getDeviceContacts } = useDialer();

  /* ── Core state ── */
  const [tab, setTab]                   = useState('keypad');
  const [number, setNumber]             = useState('');
  const [sims, setSims]                 = useState([]);
  const [selectedSim, setSelectedSim]   = useState('-1');
  const [activeCall, setActiveCall]     = useState(null);
  const [timerSec, setTimerSec]         = useState(0);

  /* ── History state (cursor-paginated) ── */
  const [history, setHistory]               = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyCursor, setHistoryCursor]   = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyFilter, setHistoryFilter]   = useState('ALL');

  /* ── Search state ── */
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [deviceContacts, setDeviceContacts] = useState([]);

  const timerRef          = useRef(null);
  const autoCallTriggered = useRef(false);
  const callIdRef         = useRef(null);
  const searchTimerRef    = useRef(null);
  const historyEndRef     = useRef(null);

  const activeName = useMemo(
    () => activeCall?.name || searchParams.get('name') || 'Unknown',
    [activeCall, searchParams],
  );

  /* ── Load history from DB (cursor-based) ── */
  const loadHistory = useCallback(async (reset = false) => {
    if (reset) {
      setHistoryLoading(true);
      setHistory([]);
      setHistoryCursor(null);
    } else {
      setHistoryLoadingMore(true);
    }
    try {
      const params = new URLSearchParams({ limit: HISTORY_LIMIT });
      if (!reset && historyCursor) params.set('cursor', historyCursor);
      if (historyFilter !== 'ALL') params.set('call_type', historyFilter);

      const { data } = await api.get(`/calls/dialer-history?${params}`);
      if (data.success) {
        setHistory(prev => reset ? data.calls : [...prev, ...data.calls]);
        setHistoryCursor(data.nextCursor);
        setHistoryHasMore(data.hasMore);
      }
    } catch { /* silent */ }
    finally {
      setHistoryLoading(false);
      setHistoryLoadingMore(false);
    }
  }, [historyCursor, historyFilter]);

  /* ── Search debounced ── */
  const runSearch = useCallback(async (q) => {
    const trimmed = String(q || '').trim();
    if (trimmed.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await api.get(`/calls/dialer-search?q=${encodeURIComponent(trimmed)}&limit=20`);
      const dbResults = data.success ? (data.results || []) : [];

      // Merge device contacts (filtered client-side)
      const lower = trimmed.toLowerCase();
      const contactMatches = deviceContacts
        .filter(c => {
          const name = String(c.displayName || c.name || '').toLowerCase();
          const phone = String(c.phoneNumber || c.number || '');
          return name.includes(lower) || phone.includes(trimmed);
        })
        .slice(0, 10)
        .map(c => ({
          id: `contact-${c.contactId || c.id}`,
          name: c.displayName || c.name || 'Contact',
          phone: c.phoneNumber || c.number || '',
          source: 'contact',
        }));

      // Deduplicate by phone
      const seen = new Set(dbResults.map(r => cleanNumber(r.phone)));
      const merged = [
        ...dbResults,
        ...contactMatches.filter(c => !seen.has(cleanNumber(c.phone))),
      ];
      setSearchResults(merged);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, [deviceContacts]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => runSearch(searchQuery), 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, runSearch]);

  /* ── Load history on tab switch or filter change ── */
  useEffect(() => {
    if (tab === 'history') loadHistory(true);
  }, [tab, historyFilter]);

  /* ── Infinite scroll for history ── */
  useEffect(() => {
    if (tab !== 'history' || !historyHasMore || historyLoadingMore) return;
    const el = historyEndRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadHistory(false); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tab, historyHasMore, historyLoadingMore, loadHistory]);

  /* ── Init: permissions, SIMs, device contacts ── */
  useEffect(() => {
    (async () => {
      try { await requestPermissions(); } catch {}
      try {
        const simList = await getSIMInfo();
        setSims(simList || []);
        if (simList?.length) setSelectedSim(String(simList[0].slotIndex));
      } catch { setSims([]); }
      try {
        const contacts = await getDeviceContacts();
        setDeviceContacts(Array.isArray(contacts) ? contacts : []);
      } catch { setDeviceContacts([]); }
    })();
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
      const dur = (evt && typeof evt.duration === 'number') ? evt.duration : timerSec;
      const cid = callIdRef.current || activeCall?.callId;
      if (cid) {
        api.put(`/calls/${cid}/end`, {
          next_action: 'NONE', duration_seconds: dur, customer_notes: null,
        }).catch(() => {});
      }
      setTimerSec(0);
      setActiveCall(null);
      callIdRef.current = null;
      // Refresh history if on that tab
      if (tab === 'history') loadHistory(true);
    });

    return () => {
      try { subConn?.remove?.(); } catch {}
      try { subEnd?.remove?.(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall?.callId, timerSec, tab]);

  /* ── INSTANT call — fire native first, log to API in background ── */
  const startCall = useCallback((rawNumber, opts = {}) => {
    const phone = cleanNumber(rawNumber);
    if (!phone) { toast.error('Enter a phone number'); return; }

    callIdRef.current = null;
    setActiveCall({
      callId: null, leadId: opts.leadId || null,
      name: opts.name || 'Manual Call',
      phone, startedAt: Date.now(), connectedAt: null, isConnected: false,
    });

    makeCall(phone, Number(selectedSim)).catch(() => {
      openDialer(phone).catch(() => {});
      toast.message('Opened system dialer');
    });

    const isApp = window.Capacitor?.isNativePlatform?.() || false;
    api.post('/calls/quick-log', {
      lead_id: opts.leadId ? Number(opts.leadId) : null,
      phone_number: phone,
      call_source: isApp ? 'APP' : 'WEB',
    }).then(({ data }) => {
      const cid = data?.call?.id || null;
      callIdRef.current = cid;
      setActiveCall((p) => p ? { ...p, callId: cid } : p);
    }).catch(() => {});

    try {
      localStorage.setItem('rg:lastDialedCall', JSON.stringify({
        phone, name: opts.name || 'Manual Call',
        leadId: opts.leadId ? Number(opts.leadId) : null, timestamp: Date.now(),
      }));
    } catch {}
  }, [selectedSim, makeCall, openDialer]);

  const handleManualStop = useCallback(async () => {
    if (!activeCall) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const cid = callIdRef.current || activeCall.callId;
    if (cid) {
      api.put(`/calls/${cid}/end`, {
        next_action: 'NONE', duration_seconds: timerSec, customer_notes: null,
      }).catch(() => {});
    }
    setTimerSec(0);
    setActiveCall(null);
    callIdRef.current = null;
    if (tab === 'history') loadHistory(true);
  }, [activeCall, timerSec, tab]);

  const onPressKey  = useCallback((v) => setNumber((p) => cleanNumber(p + v)), []);
  const onBackspace = useCallback(() => setNumber((p) => p.slice(0, -1)), []);

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
    <div className="flex flex-col items-center pb-4 min-h-dvh">

      {/* ── Header row ── */}
      <div className="w-full flex items-center justify-between px-1 mb-3">
        <h1 className="text-lg font-bold text-slate-900">Dialer</h1>
        <Select value={selectedSim} onValueChange={setSelectedSim}>
          <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-slate-200 px-3 text-xs font-medium">
            <Smartphone className="h-3.5 w-3.5 text-slate-500" />
            <SelectValue placeholder="SIM" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="-1" className="text-xs">Default SIM</SelectItem>
            {sims.map((sim) => (
              <SelectItem key={String(sim.slotIndex)} value={String(sim.slotIndex)} className="text-xs">
                {sim.displayName || sim.carrierName || `SIM ${Number(sim.slotIndex) + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Active call banner ── */}
      {activeCall && (
        <div className="w-full max-w-sm mb-3 rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 text-white px-5 py-3.5 shadow-xl
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

      {/* ── Tab switcher (3 tabs) ── */}
      <div className="flex items-center bg-slate-100 rounded-full p-1 gap-0.5 mb-4 w-full max-w-sm">
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

      {/* ═══════════════════ KEYPAD TAB ═══════════════════ */}
      {tab === 'keypad' && (
        <div className="w-full max-w-xs flex flex-col items-center gap-4 animate-in fade-in duration-200">
          {/* Number display */}
          <div className="w-full flex mt-10 items-center gap-2 px-1 min-h-12">
            <div className="flex-1 text-center text-2xl font-mono font-semibold text-slate-900 tracking-wider truncate">
              {number || <span className="text-slate-300 text-lg font-normal">Enter number</span>}
            </div>
            {number.length > 0 && (
              <button
                type="button"
                onClick={onBackspace}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400
                           transition-all duration-150 active:scale-90 shrink-0"
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Keypad grid */}
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map(([d, l]) => <KeyBtn key={d} digit={d} letters={l} onPress={onPressKey} />)}
          </div>

          {/* Call button */}
          <button
            type="button"
            onClick={() => startCall(number, {})}
            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 active:scale-[0.85]
                       shadow-lg shadow-green-500/25 flex items-center justify-center text-white
                       transition-all duration-200 mt-1"
          >
            <PhoneCall className="h-7 w-7" />
          </button>
        </div>
      )}

      {/* ═══════════════════ SEARCH TAB ═══════════════════ */}
      {tab === 'search' && (
        <div className="w-full max-w-sm animate-in fade-in duration-200">
          {/* Search input */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or phone number…"
              autoFocus
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-white
                         text-sm text-slate-900 placeholder:text-slate-400
                         focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500
                         transition-all duration-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-200
                           hover:bg-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3 text-slate-500" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            {searchLoading ? (
              <SkeletonRows count={4} />
            ) : searchResults.length === 0 ? (
              <div className="py-12 text-center">
                <Search className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  {searchQuery.length >= 2 ? 'No results found' : 'Type to search leads & contacts'}
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {searchResults.map((item) => (
                  <SearchResultRow key={String(item.id)} item={item} onCall={startCall} />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ HISTORY TAB ═══════════════════ */}
      {tab === 'history' && (
        <div className="w-full max-w-sm animate-in fade-in duration-200">
          {/* Filter chips */}
          <div className="flex items-center gap-1.5 mb-3 px-0.5 overflow-x-auto no-scrollbar">
            {['ALL', 'OUTGOING', 'INCOMING', 'MISSED'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap
                           transition-all duration-200 ${
                  historyFilter === f
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* History list */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            {historyLoading ? (
              <SkeletonRows count={6} />
            ) : history.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No call history yet</p>
              </div>
            ) : (
              <>
                {history.map((call, i) => (
                  <HistoryRow key={call.id || i} call={call} onCall={startCall} />
                ))}
                {/* Infinite scroll sentinel */}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default DialerPage;
