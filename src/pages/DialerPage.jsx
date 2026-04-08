import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Delete, PhoneCall, PhoneOff,
  ArrowDownLeft, ArrowUpRight, PhoneMissed, RefreshCw, Smartphone,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useDialer } from '@/hooks/useDialer';

const KEYS = [
  ['1', ''],     ['2', 'ABC'],  ['3', 'DEF'],
  ['4', 'GHI'],  ['5', 'JKL'],  ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'],  ['9', 'WXYZ'],
  ['*', ''],     ['0', '+'],    ['#', ''],
];

const fmtDuration = (s = 0) => {
  const sec = Math.max(0, Number(s || 0));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

const fmtDate = (ms) => {
  if (!ms) return '';
  return new Date(Number(ms)).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const typeMeta = (type) => {
  if (type === 'INCOMING')                      return { Icon: ArrowDownLeft, color: 'text-emerald-500', bg: 'bg-emerald-50' };
  if (type === 'MISSED' || type === 'REJECTED') return { Icon: PhoneMissed,   color: 'text-rose-500',    bg: 'bg-rose-50'    };
  return                                               { Icon: ArrowUpRight,   color: 'text-sky-500',     bg: 'bg-sky-50'     };
};

const cleanNumber = (v) => String(v || '').replace(/[^0-9+*#]/g, '');

/* ── Memoised key button ──────────────────────────────────────────────────── */
const KeyBtn = memo(({ digit, letters, onPress }) => (
  <button
    type="button"
    onClick={() => onPress(digit)}
    className="h-[4.2rem] w-[4.2rem] rounded-full bg-white border border-slate-200 hover:bg-slate-50 active:scale-90 flex flex-col items-center justify-center select-none transition-transform shadow-sm"
  >
    <span className="text-[1.35rem] font-semibold text-slate-900 leading-none">{digit}</span>
    {letters && <span className="text-[8px] font-medium text-slate-400 leading-none mt-0.5 tracking-[0.18em]">{letters}</span>}
  </button>
));
KeyBtn.displayName = 'KeyBtn';

/* ── Memoised recent call row ─────────────────────────────────────────────── */
const RecentRow = memo(({ call, onCall }) => {
  const { Icon, color, bg } = typeMeta(call.type);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0">
      <div className={`h-9 w-9 rounded-full ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{call.name || 'Unknown'}</p>
        <p className="text-xs text-slate-500 font-mono truncate">{call.number}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(call.date)}{call.duration ? ` · ${fmtDuration(call.duration)}` : ''}</p>
      </div>
      <button
        type="button"
        onClick={() => onCall(call.number, { name: call.name || 'Unknown' })}
        className="h-9 w-9 rounded-full bg-green-50 hover:bg-green-100 flex items-center justify-center text-green-600 transition-colors shrink-0"
      >
        <PhoneCall className="h-4 w-4" />
      </button>
    </div>
  );
});
RecentRow.displayName = 'RecentRow';

/* ── Main component ──────────────────────────────────────────────────────── */
const DialerPage = () => {
  const [searchParams] = useSearchParams();
  const { requestPermissions, makeCall, openDialer, getRecentCalls, getSIMInfo,
          onCallConnected, onCallEnded } = useDialer();

  const [tab, setTab]                   = useState('keypad');
  const [number, setNumber]             = useState('');
  const [recentCalls, setRecentCalls]   = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [sims, setSims]                 = useState([]);
  const [selectedSim, setSelectedSim]   = useState('-1');
  const [activeCall, setActiveCall]     = useState(null);
  const [timerSec, setTimerSec]         = useState(0);

  const timerRef          = useRef(null);
  const autoCallTriggered = useRef(false);
  const callIdRef         = useRef(null);   // holds callId written by background log

  const activeName = useMemo(
    () => activeCall?.name || searchParams.get('name') || 'Unknown',
    [activeCall, searchParams],
  );

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const calls = await getRecentCalls(60);
      setRecentCalls(Array.isArray(calls) ? calls : []);
    } catch { setRecentCalls([]); }
    finally { setLoadingRecent(false); }
  }, [getRecentCalls]);

  // ── init ──
  useEffect(() => {
    (async () => {
      try { await requestPermissions(); } catch {}
      try {
        const simList = await getSIMInfo();
        setSims(simList || []);
        if (simList?.length) setSelectedSim(String(simList[0].slotIndex));
      } catch { setSims([]); }
      loadRecent();
    })();
  }, []);

  // ── call events ──
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
      loadRecent();
    });

    return () => {
      try { subConn?.remove?.(); } catch {}
      try { subEnd?.remove?.(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall?.callId, timerSec]);

  // ── INSTANT call — fire native call first, log to API in background ──
  const startCall = useCallback((rawNumber, opts = {}) => {
    const phone = cleanNumber(rawNumber);
    if (!phone) { toast.error('Enter a phone number'); return; }

    // 1. Set UI state immediately
    callIdRef.current = null;
    setActiveCall({
      callId: null, leadId: opts.leadId || null,
      name: opts.name || 'Manual Call',
      phone, startedAt: Date.now(), connectedAt: null, isConnected: false,
    });

    // 2. Fire native call INSTANTLY — no await
    makeCall(phone, Number(selectedSim)).catch(() => {
      openDialer(phone).catch(() => {});
      toast.message('Opened system dialer');
    });

    // 3. Log to API in background — doesn't block the call
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

    // 4. localStorage in background
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
    loadRecent();
  }, [activeCall, timerSec, loadRecent]);

  const onPressKey  = useCallback((v) => setNumber((p) => cleanNumber(p + v)), []);
  const onBackspace = useCallback(() => setNumber((p) => p.slice(0, -1)), []);

  // ── auto-call from query params ──
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

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col items-center pb-4">

      {/* ── Header row: title left, SIM right ── */}
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
        <div className="w-full max-w-sm mb-3 rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 text-white px-5 py-3.5 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {activeCall.isConnected ? '● Connected' : '⟳ Dialing…'}
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
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors"
              >
                <PhoneOff className="h-3.5 w-3.5" /> End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab switcher ── */}
      <div className="flex items-center bg-slate-100 rounded-full p-1 gap-1 mb-4">
        {['keypad', 'recent'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'keypad' ? 'Keypad' : 'Recent'}
          </button>
        ))}
      </div>

      {/* ── Keypad tab ── */}
      {tab === 'keypad' && (
        <div className="w-full max-w-xs flex flex-col items-center gap-4">
          {/* Number display */}
          <div className="w-full flex mt-14 items-center gap-2 px-1 min-h-12">
            <div className="flex-1 text-center text-2xl font-mono font-semibold text-slate-900 tracking-wider truncate">
              {number || <span className="text-slate-300 text-lg font-normal">Enter number</span>}
            </div>
            {number.length > 0 && (
              <button
                type="button"
                onClick={onBackspace}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors shrink-0"
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Keypad grid */}
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map(([d, l]) => <KeyBtn key={d} digit={d} letters={l} onPress={onPressKey} />)}
          </div>

          {/* Call button centred below keypad */}
          <button
            type="button"
            onClick={() => startCall(number, {})}
            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 active:scale-90 shadow-lg shadow-green-200 flex items-center justify-center text-white transition-all mt-1"
          >
            <PhoneCall className="h-7 w-7" />
          </button>
        </div>
      )}

      {/* ── Recent tab ── */}
      {tab === 'recent' && (
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Calls</p>
            <button
              type="button"
              onClick={loadRecent}
              className="h-7 w-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingRecent ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            {loadingRecent ? (
              <div className="divide-y divide-slate-100">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  </div>
                ))}
              </div>
            ) : recentCalls.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">No recent calls</p>
              </div>
            ) : (
              recentCalls.map((c) => <RecentRow key={String(c.id)} call={c} onCall={startCall} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DialerPage;
