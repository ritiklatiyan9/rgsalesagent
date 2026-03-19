import { useEffect, useRef, useState } from 'react';
import CallDetector from '@/plugins/callDetector';

/**
 * useCallListener — listens for phone calls ending on the device.
 *
 * Uses THREE independent channels for maximum reliability:
 *   1. window 'callEnded' CustomEvent — fired by evaluateJavascript from
 *      the native plugin. Data is in event.detail.
 *   2. Capacitor addListener — fired by notifyListeners (works if
 *      registerPlugin succeeded in JS)
 *   3. visibilitychange polling — when app comes back to foreground,
 *      polls getLastCall() for any pending calls stored in SharedPreferences
 *
 * Events are deduplicated by timestamp so the callback fires only once.
 */
export function useCallListener({ onCallEnded } = {}) {
  const [isListening, setIsListening] = useState(false);
  const callbackRef = useRef(onCallEnded);
  const lastTsRef   = useRef(0);

  useEffect(() => { callbackRef.current = onCallEnded; }, [onCallEnded]);

  useEffect(() => {
    // Only run on native
    let isNative = false;
    try {
      const Cap = window.Capacitor;
      isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
    } catch { /* web */ }
    if (!isNative) return;

    let mounted = true;

    // Deduplicated dispatch — ignores duplicate events with same timestamp
    const dispatch = (data) => {
      if (!mounted || !data) return;
      const ts = data.timestamp || Date.now();
      if (ts === lastTsRef.current) return;
      lastTsRef.current = ts;
      callbackRef.current?.(data);
    };

    // ── Channel 1: window CustomEvent from evaluateJavascript ─────────────
    const onWindowEvent = (e) => {
      try {
        const d = e.detail || e.data;
        if (d) dispatch(d);
      } catch {}
    };
    window.addEventListener('callEnded', onWindowEvent);

    // ── Channel 2: Capacitor plugin proxy ─────────────────────────────────
    let pluginSub = null;
    (async () => {
      try { await CallDetector.requestPermissions(); } catch {}
      try {
        const res = await CallDetector.startListening();
        if (mounted) setIsListening(!!res?.listening);
      } catch {}
      // Start the foreground service for background/killed-app detection
      try { await CallDetector.startCallDetection(); } catch {}
      try {
        pluginSub = await CallDetector.addListener('callEnded', dispatch);
      } catch {}
    })();

    // ── Channel 3: poll getLastCall when app resumes ──────────────────────
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await CallDetector.getLastCall();
        if (res?.hasCall && res.call) dispatch(res.call);
      } catch {}
    };
    document.addEventListener('visibilitychange', onVisibility);

    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        onVisibility();
      }
    }, 30000);
    
    // Poll twice on mount with increasing delays to catch boot-time calls
    setTimeout(onVisibility, 2500);
    setTimeout(onVisibility, 5000);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      mounted = false;
      window.removeEventListener('callEnded', onWindowEvent);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(pollInterval);
      try { pluginSub?.remove?.(); } catch {}
    };
  }, []);

  return { isListening };
}
