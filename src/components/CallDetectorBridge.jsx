import { useState, useCallback, useEffect, useRef, Component } from 'react';
import { useCallListener } from '@/hooks/useCallListener';
import { useDialer } from '@/hooks/useDialer';
import CallLeadDrawer from '@/components/CallLeadDrawer';
import api from '@/lib/axios';

const sanitizePhone = (value) => String(value || '').replace(/[^0-9+]/g, '');
const PENDING_CALL_LOGS_KEY = 'rg:pendingCallLogs';
const MAX_PENDING_CALL_LOGS = 40;

const normalizeCallType = (rawType, durationSecs = 0) => {
  const normalized = String(rawType || '').trim().toUpperCase();
  if (!normalized) return Number(durationSecs) > 0 ? 'OUTGOING' : 'UNKNOWN';

  if (['MISSED', 'MISSED_CALL', 'INCOMING_MISSED', 'UNANSWERED', 'REJECTED', 'DECLINED'].includes(normalized)) {
    return 'MISSED';
  }
  if (['INCOMING', 'INBOUND', 'RECEIVED'].includes(normalized)) {
    return Number(durationSecs) <= 0 ? 'MISSED' : 'INCOMING';
  }
  if (['OUTGOING', 'OUTBOUND', 'DIALED'].includes(normalized)) {
    return 'OUTGOING';
  }
  return normalized;
};

const getDialerFallback = () => {
  try {
    const raw = localStorage.getItem('rg:lastDialedCall');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ageMs = Date.now() - Number(parsed?.timestamp || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 15 * 60 * 1000) return null;
    return {
      phoneNumber: sanitizePhone(parsed?.phone),
      contactName: parsed?.name || '',
      leadId: parsed?.leadId || null,
    };
  } catch {
    return null;
  }
};

const readPendingCallLogs = () => {
  try {
    const raw = localStorage.getItem(PENDING_CALL_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePendingCallLogs = (items) => {
  try {
    localStorage.setItem(PENDING_CALL_LOGS_KEY, JSON.stringify(items.slice(-MAX_PENDING_CALL_LOGS)));
  } catch {
    // ignore storage failures
  }
};

const queuePendingCallLog = (item) => {
  const current = readPendingCallLogs();
  current.push(item);
  writePendingCallLogs(current);
};

const emitMissedCallEvent = ({ savedCall, fallback }) => {
  const phone = savedCall?.phone_number_dialed || fallback?.phone_number || '';
  const callStart = savedCall?.call_start || fallback?.call_start || new Date().toISOString();
  const id = String(savedCall?.id || fallback?.id || `${phone}-${callStart}`);

  window.dispatchEvent(new CustomEvent('rg:missed-call', {
    detail: {
      id,
      phone_number: phone,
      contact_name: fallback?.contact_name || '',
      call_start: callStart,
      call_type: 'MISSED',
    },
  }));
};

class SafeWrap extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(err) {
    console.warn('[CallDetectorBridge] crash caught:', err);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

function Inner() {
  const { getRecentCalls } = useDialer();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [callData, setCallData] = useState(null);
  const flushingRef = useRef(false);

  const logCallNow = useCallback(async (payload) => {
    const { data: response } = await api.post('/calls/quick-log', payload);
    return response?.call || null;
  }, []);

  const flushPendingLogs = useCallback(async () => {
    if (flushingRef.current) return;

    const pending = readPendingCallLogs();
    if (!pending.length) return;

    flushingRef.current = true;
    const keep = [];

    for (const item of pending) {
      try {
        const savedCall = await logCallNow(item.payload);
        if (item.meta?.isMissed) {
          emitMissedCallEvent({
            savedCall,
            fallback: {
              id: item.meta?.id,
              phone_number: item.meta?.phoneNumber,
              contact_name: item.meta?.contactName,
              call_start: item.meta?.callStart,
            },
          });
        }
      } catch {
        keep.push(item);
      }
    }

    writePendingCallLogs(keep);
    flushingRef.current = false;
  }, [logCallNow]);

  useEffect(() => {
    flushPendingLogs();

    const onOnline = () => flushPendingLogs();
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        flushPendingLogs();
      }
    }, 30000);

    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(intervalId);
    };
  }, [flushPendingLogs]);

  const handleCallEnded = useCallback(async (data) => {
    if (!data) return;
    let phoneNumber = sanitizePhone(data.phoneNumber || data.number || '');
    let contactName = String(data.contactName || data.leadName || data.name || '').trim();
    const durationSeconds = Number(data.duration || 0);
    const normalizedCallType = normalizeCallType(data.callType || data.type, durationSeconds);
    const isMissed = normalizedCallType === 'MISSED';
    const isReal = durationSeconds >= 1;

    if (!phoneNumber) {
      const fallback = getDialerFallback();
      if (fallback?.phoneNumber) {
        phoneNumber = fallback.phoneNumber;
        if (!contactName && fallback.contactName) {
          contactName = fallback.contactName;
        }
      }
    }

    if (!phoneNumber) {
      try {
        const recent = await getRecentCalls(1);
        const latest = Array.isArray(recent) ? recent[0] : null;
        phoneNumber = sanitizePhone(latest?.number || latest?.phoneNumber || '');
        if (!contactName && latest?.name) {
          contactName = String(latest.name).trim();
        }
      } catch {
        // ignore fallback errors
      }
    }

    const hasNumber = Boolean(phoneNumber);
    if (!hasNumber) return;

    const enrichedData = {
      ...data,
      callType: normalizedCallType,
      phoneNumber,
      number: phoneNumber,
      contactName,
    };

    const callStartIso = enrichedData.timestamp
      ? new Date(enrichedData.timestamp).toISOString()
      : new Date().toISOString();

    const quickLogPayload = {
      phone_number: phoneNumber,
      call_type: normalizedCallType || 'OUTGOING',
      duration_seconds: durationSeconds || 0,
      call_source: 'APP',
      call_status: 'COMPLETED',
      call_start: callStartIso,
    };

    // Auto-log to backend immediately.
    let savedCall = null;
    try {
      savedCall = await logCallNow(quickLogPayload);
    } catch (err) {
      console.error('[CallDetectorBridge] Auto-log failed:', err);
      queuePendingCallLog({
        payload: quickLogPayload,
        meta: {
          id: String(data.id || `${phoneNumber}-${data.timestamp || Date.now()}`),
          isMissed,
          phoneNumber,
          contactName: contactName || '',
          callStart: callStartIso,
        },
        queuedAt: Date.now(),
      });
    }

    if (isMissed && savedCall) {
      emitMissedCallEvent({
        savedCall,
        fallback: {
          id: String(data.id || `${phoneNumber}-${data.timestamp || Date.now()}`),
          phone_number: phoneNumber,
          contact_name: contactName || '',
          call_start: callStartIso,
        },
      });
    }

    const isOutgoing = normalizedCallType === 'OUTGOING';
    if (!isReal && !isMissed && !isOutgoing) return;

    setCallData(enrichedData);
    setDrawerOpen(true);
  }, [getRecentCalls, logCallNow]);

  useCallListener({ onCallEnded: handleCallEnded });

  return (
    <CallLeadDrawer
      open={drawerOpen}
      callData={callData}
      onClose={() => {
        setDrawerOpen(false);
        setCallData(null);
      }}
    />
  );
}

export default function CallDetectorBridge() {
  return (
    <SafeWrap>
      <Inner />
    </SafeWrap>
  );
}
