import { useCallback } from 'react';
import api from '@/lib/axios';
import { toast } from 'sonner';

const sanitizePhone = (v) => String(v || '').replace(/[^0-9+]/g, '');

/**
 * useCallAction — shared hook that logs a call to the API, stores the
 * call ID in localStorage (so CallDetectorBridge can dedup / open the
 * remark drawer on both native and PC/web), then dials the number.
 *
 * Works from any page — no special context or hook deps required.
 */
export function useCallAction() {
  const initiateCall = useCallback(async (phone, { leadId, name } = {}) => {
    const cleanPhone = sanitizePhone(phone);
    if (!cleanPhone) { toast.error('No phone number'); return null; }

    const isApp = window.Capacitor?.isNativePlatform?.() || false;

    // 1. Create call record in API
    let callId = null;
    try {
      const { data } = await api.post('/calls/quick-log', {
        lead_id: leadId ? Number(leadId) : null,
        phone_number: cleanPhone,
        call_source: isApp ? 'APP' : 'WEB',
      });
      callId = data?.call?.id || null;
    } catch {
      // Don't block the call on API failure
    }

    // 2. Persist to localStorage so CallDetectorBridge can pick it up
    try {
      localStorage.setItem('rg:lastDialedCall', JSON.stringify({
        phone: cleanPhone,
        name: name || '',
        leadId: leadId ? Number(leadId) : null,
        callId,
        timestamp: Date.now(),
      }));
    } catch { /* ignore storage errors */ }

    // 3. Dial the number
    if (isApp && window.Capacitor?.Plugins?.CallNumber) {
      try {
        await window.Capacitor.Plugins.CallNumber.callNumber({ number: cleanPhone, bypassAppChooser: false });
      } catch {
        window.open(`tel:${cleanPhone}`, '_self');
      }
    } else {
      window.open(`tel:${cleanPhone}`, '_self');
    }

    return callId;
  }, []);

  return { initiateCall };
}
