import { useCallback, useEffect, useRef, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallListener } from '@/hooks/useCallListener';
import { useDialer } from '@/hooks/useDialer';
import { useCallDrawer } from '@/context/CallDrawerContext';
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
      callId: parsed?.callId || null,
    };
  } catch {
    return null;
  }
};

const consumeDialerFallback = () => {
  try { localStorage.removeItem('rg:lastDialedCall'); } catch { /* noop */ }
};

/** Compare last N digits of two phone numbers (handles +91 / 0 prefix differences) */
const phoneTailMatch = (a, b, digits = 10) => {
  const ta = sanitizePhone(a).replace(/^\+/, '').slice(-digits);
  const tb = sanitizePhone(b).replace(/^\+/, '').slice(-digits);
  return ta.length >= 7 && tb.length >= 7 && ta === tb;
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
  const { openDrawer } = useCallDrawer();
  const navigate       = useNavigate();
  const flushingRef    = useRef(false);
  const recentEndEventsRef = useRef(new Map());

  const isDuplicateEndEvent = useCallback((event) => {
    const now = Date.now();
    const phone = sanitizePhone(event?.phoneNumber || event?.number || '');
    const type = normalizeCallType(event?.callType || event?.type, Number(event?.duration || 0));
    const duration = Number(event?.duration || 0);
    const rawTs = Number(event?.timestamp || now);
    const bucketTs = Math.floor(rawTs / 5000); // 5s bucket to smooth noisy duplicate emits
    const key = `${event?.id || ''}|${phone}|${type}|${duration}|${bucketTs}`;

    const map = recentEndEventsRef.current;
    for (const [k, ts] of map.entries()) {
      if (now - ts > 120000) map.delete(k); // 2 min TTL
    }

    if (map.has(key)) return true;
    map.set(key, now);
    return false;
  }, []);

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
    if (isDuplicateEndEvent(data)) return;

    let phoneNumber = sanitizePhone(data.phoneNumber || data.number || '');
    let contactName = String(data.contactName || data.leadName || data.name || '').trim();
    const durationSeconds = Number(data.duration || 0);
    const normalizedCallType = normalizeCallType(data.callType || data.type, durationSeconds);
    const isMissed = normalizedCallType === 'MISSED';
    const isReal = durationSeconds >= 1;

    // Check BEFORE phone enrichment — only open drawer for calls initiated from the app
    const appFallback = getDialerFallback();

    // Determine if this specific call was started from inside the app:
    // 1. A recent rg:lastDialedCall entry must exist (set only when dialer page fires a call)
    // 2. The phone number from the native detector must match what was dialed
    //    (prevents external incoming/outgoing calls from triggering the drawer)
    let isAppInitiated = false;
    if (appFallback?.phoneNumber) {
      // If the native detector gave us a phone, compare it
      if (phoneNumber) {
        isAppInitiated = phoneTailMatch(phoneNumber, appFallback.phoneNumber);
      } else {
        // No phone from detector yet — we'll enrich below; defer the match check
        isAppInitiated = true; // tentative, re-checked after enrichment
      }
    }

    if (!phoneNumber) {
      if (appFallback?.phoneNumber) {
        phoneNumber = appFallback.phoneNumber;
        if (!contactName && appFallback.contactName) {
          contactName = appFallback.contactName;
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

    // Re-verify after enrichment: if we tentatively set isAppInitiated=true because
    // detector had no phone, now compare the enriched number against what was dialed.
    if (isAppInitiated && appFallback?.phoneNumber && phoneNumber) {
      isAppInitiated = phoneTailMatch(phoneNumber, appFallback.phoneNumber);
    }

    // Consume the fallback so it can't trigger the drawer for the next unrelated call
    if (isAppInitiated) {
      consumeDialerFallback();
    }

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

    if (isAppInitiated && appFallback?.callId) {
      // App already created the call record at dial-time — just UPDATE it
      try {
        const { data: response } = await api.put(`/calls/${appFallback.callId}/end`, {
          duration_seconds: durationSeconds || 0,
          call_status: isMissed ? 'MISSED' : 'COMPLETED',
          customer_notes: null,
        });
        savedCall = response?.call || { id: appFallback.callId };
      } catch (err) {
        console.error('[CallDetectorBridge] Update call failed:', err);
      }
    } else {
      // External/incoming call — create a new record
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

    // Only open the summary page if this call was started from within the app.
    // Background / external calls are auto-logged above but don't pop the UI.
    if (!isAppInitiated) return;

    enrichedData.callId = savedCall?.id || appFallback?.callId || null;
    openDrawer(enrichedData);
  }, [getRecentCalls, isDuplicateEndEvent, logCallNow, openDrawer]);

  useCallListener({ onCallEnded: handleCallEnded });

  // ── Web / PC fallback ─────────────────────────────────────────────────────
  // On non-native (browser/PC), the native call detector never fires.
  // When the tab regains focus after a tel: link was opened we check
  // rg:lastDialedCall and open the remark drawer if a callId was saved.
  useEffect(() => {
    let isNative = false;
    try { isNative = !!(window.Capacitor?.isNativePlatform?.()); } catch {}
    if (isNative) return; // native path is handled by useCallListener above

    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      const fallback = getDialerFallback();
      if (!fallback?.callId || !fallback?.phoneNumber) return;

      consumeDialerFallback();

      // Finalize the call record (was created as ACTIVE at dial time)
      try {
        await api.put(`/calls/${fallback.callId}/end`, {
          duration_seconds: 0,
          call_status: 'COMPLETED',
          customer_notes: null,
        });
      } catch { /* silent */ }

      openDrawer({
        phoneNumber: fallback.phoneNumber,
        contactName: fallback.contactName || '',
        callType: 'OUTGOING',
        duration: 0,
        timestamp: new Date().toISOString(),
        callId: fallback.callId,
        leadId: fallback.leadId || null,
      });
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [openDrawer]);

  return null;
}

export default function CallDetectorBridge() {
  return (
    <SafeWrap>
      <Inner />
    </SafeWrap>
  );
}
