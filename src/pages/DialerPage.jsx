import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Phone, Delete, PhoneCall, PhoneOff, Clock3, ArrowDownLeft, ArrowUpRight, PhoneMissed, User, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useDialer } from '@/hooks/useDialer';

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

const fmtDuration = (seconds = 0) => {
  const s = Number(seconds || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

const fmtDate = (epochMs) => {
  if (!epochMs) return 'Unknown time';
  const d = new Date(Number(epochMs));
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const typeMeta = (type) => {
  if (type === 'INCOMING') return { icon: ArrowDownLeft, color: 'text-emerald-600', label: 'Incoming' };
  if (type === 'MISSED' || type === 'REJECTED') return { icon: PhoneMissed, color: 'text-rose-600', label: 'Missed' };
  return { icon: ArrowUpRight, color: 'text-sky-600', label: 'Outgoing' };
};

const cleanNumber = (v) => String(v || '').replace(/[^0-9+*#]/g, '');

const DialerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    requestPermissions,
    makeCall,
    openDialer,
    getRecentCalls,
    getSIMInfo,
    onCallConnected,
    onCallEnded,
  } = useDialer();

  const [tab, setTab] = useState('keypad');
  const [number, setNumber] = useState('');
  const [recentCalls, setRecentCalls] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [sims, setSims] = useState([]);
  const [selectedSim, setSelectedSim] = useState('-1');

  const [activeCall, setActiveCall] = useState(null);
  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef(null);

  const autoCallTriggered = useRef(false);

  const activeName = useMemo(() => activeCall?.name || searchParams.get('name') || 'Unknown', [activeCall, searchParams]);

  const loadRecent = async () => {
    setLoadingRecent(true);
    try {
      const calls = await getRecentCalls(60);
      setRecentCalls(Array.isArray(calls) ? calls : []);
    } catch {
      setRecentCalls([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await requestPermissions();
      } catch {
        // Ignore permission prompt errors on web.
      }
      try {
        const simList = await getSIMInfo();
        setSims(simList || []);
        if (simList?.length) setSelectedSim(String(simList[0].slotIndex));
      } catch {
        setSims([]);
      }
      await loadRecent();
    })();
  }, []);

  useEffect(() => {
    const subConnected = onCallConnected((evt) => {
      const connectedAt = Number(evt?.connectedAt || Date.now());
      setActiveCall((prev) => ({ ...(prev || {}), connectedAt, isConnected: true }));
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimerSec(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
      }, 1000);
    });

    const subEnded = onCallEnded(async (evt) => {
      if (timerRef.current) clearInterval(timerRef.current);
      const nativeDuration = Number(evt?.duration || 0);
      const durationSeconds = nativeDuration > 0 ? nativeDuration : timerSec;

      if (activeCall?.callId) {
        try {
          await api.put(`/calls/${activeCall.callId}/end`, {
            next_action: 'NONE',
            duration_seconds: durationSeconds,
            customer_notes: null,
          });
          toast.success('Call ended and saved', { description: `Duration ${fmtDuration(durationSeconds)}` });
        } catch {
          toast.error('Call ended, but CRM save failed');
        }
      }

      setTimerSec(0);
      setActiveCall(null);
      await loadRecent();
    });

    return () => {
      try { subConnected?.remove?.(); } catch {}
      try { subEnded?.remove?.(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall?.callId, timerSec]);

  const startCall = async (rawNumber, opts = {}) => {
    const phone = cleanNumber(rawNumber);
    if (!phone) {
      toast.error('Enter phone number');
      return;
    }

    try {
      let callId = null;
      const isApp = window.Capacitor?.isNativePlatform?.() || false;
      
      // Always trigger backend quick-log
      try {
        const { data } = await api.post('/calls/quick-log', {
          lead_id: opts.leadId ? Number(opts.leadId) : null,
          phone_number: phone,
          call_source: isApp ? 'APP' : 'WEB',
        });
        callId = data?.call?.id || null;
      } catch (logErr) {
        console.error('Failed to quick-log call:', logErr);
      }

      setActiveCall({
        callId,
        leadId: opts.leadId || null,
        name: opts.name || 'Manual Call',
        phone,
        startedAt: Date.now(),
        connectedAt: null,
        isConnected: false,
      });

      await makeCall(phone, Number(selectedSim));
      toast.success('Dialing...', { description: phone });
    } catch (e) {
      try {
        await openDialer(phone);
        toast.message('Opened system dialer as fallback');
      } catch {
        toast.error(e?.message || 'Failed to start call');
      }
    }
  };

  const handleManualStop = async () => {
    if (!activeCall) return;
    if (timerRef.current) clearInterval(timerRef.current);

    if (activeCall.callId) {
      try {
        await api.put(`/calls/${activeCall.callId}/end`, {
          next_action: 'NONE',
          duration_seconds: timerSec,
          customer_notes: null,
        });
        toast.success('Call stopped and saved');
      } catch {
        toast.error('Failed to save manual stop');
      }
    }

    setTimerSec(0);
    setActiveCall(null);
    await loadRecent();
  };

  useEffect(() => {
    const autoNumber = cleanNumber(searchParams.get('number') || searchParams.get('lead_phone') || '');
    const autoLeadId = searchParams.get('lead_id');
    const autoName = searchParams.get('name') || searchParams.get('lead_name') || 'Lead';
    const autoCall = String(searchParams.get('autoCall') || '').toLowerCase() === 'true';

    if (!autoNumber) return;
    setNumber(autoNumber);

    if (autoCall && !autoCallTriggered.current) {
      autoCallTriggered.current = true;
      startCall(autoNumber, { leadId: autoLeadId, name: autoName });
    }
  }, [searchParams]);

  const onPressKey = (v) => setNumber((p) => cleanNumber(p + v));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dialer</h1>
          <p className="text-xs text-slate-500">In-app keypad, SIM calls, real-time connected timer.</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <Button size="sm" className={`h-8 rounded-lg ${tab === 'keypad' ? '' : 'bg-transparent text-slate-600 hover:bg-slate-200'}`} onClick={() => setTab('keypad')}>
              Keypad
            </Button>
            <Button size="sm" className={`h-8 rounded-lg ${tab === 'recent' ? '' : 'bg-transparent text-slate-600 hover:bg-slate-200'}`} onClick={() => setTab('recent')}>
              Recent
            </Button>
          </div>

          {tab === 'keypad' && (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <Input
                  value={number}
                  onChange={(e) => setNumber(cleanNumber(e.target.value))}
                  placeholder="Enter number"
                  className="h-12 text-xl font-mono"
                />
                <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setNumber((p) => p.slice(0, -1))}>
                  <Delete className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 max-w-sm">
                {KEYS.map(([digit, letters]) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => onPressKey(digit)}
                    className="h-14 rounded-full bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center hover:bg-slate-50"
                  >
                    <span className="text-lg font-semibold text-slate-900 leading-none">{digit}</span>
                    <span className="text-[10px] text-slate-500 leading-none mt-1">{letters}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-4 max-w-sm">
                <Select value={selectedSim} onValueChange={setSelectedSim}>
                  <SelectTrigger className="h-10 rounded-full text-xs">
                    <SelectValue placeholder="SIM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Default SIM</SelectItem>
                    {sims.map((sim) => (
                      <SelectItem key={String(sim.slotIndex)} value={String(sim.slotIndex)}>
                        {(sim.displayName || sim.carrierName || `SIM ${Number(sim.slotIndex) + 1}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  className="h-12 w-12 rounded-full bg-green-600 hover:bg-green-700 shadow-md"
                  onClick={() => startCall(number, {})}
                >
                  <PhoneCall className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {tab === 'recent' && (
            <div className="mt-4 space-y-2">
              {loadingRecent && <p className="text-xs text-slate-500">Loading recent calls...</p>}
              {!loadingRecent && recentCalls.length === 0 && (
                <p className="text-sm text-slate-500">No recent calls found.</p>
              )}
              {recentCalls.map((call) => {
                const meta = typeMeta(call.type);
                const Icon = meta.icon;
                return (
                  <div key={String(call.id)} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{call.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500 truncate">{call.number}</div>
                        <div className="text-[11px] text-slate-400">{fmtDate(call.date)} · {fmtDuration(call.duration)}</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => startCall(call.number, { name: call.name || 'Unknown' })}>
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {activeCall && (
        <Card className="border-0 shadow-lg bg-slate-900 text-white">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-300">{activeCall.isConnected ? 'CONNECTED' : 'DIALING...'}</p>
                <h3 className="text-base font-semibold truncate">{activeName}</h3>
                <p className="text-sm text-slate-300 font-mono">{activeCall.phone}</p>
              </div>
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                <Clock3 className="h-3 w-3 mr-1" /> {fmtDuration(timerSec)}
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button className="h-11 rounded-full bg-rose-600 hover:bg-rose-700 px-5" onClick={handleManualStop}>
                <PhoneOff className="h-4 w-4 mr-2" /> End Call
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DialerPage;
