/**
 * network.js — Network state detection.
 * Uses @capacitor/network on native, falls back to navigator.onLine on web.
 * Emits events for online/offline transitions.
 */

let _online = typeof navigator !== 'undefined' ? navigator.onLine : true;
let _listeners = [];
let _initialized = false;
let _networkPlugin = null;

/**
 * Subscribe to network state changes.
 * Callback receives boolean (true = online).
 * Returns unsubscribe function.
 */
export function onNetworkChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((f) => f !== fn); };
}

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(_online); } catch {}
  });
}

/**
 * Is the device currently online?
 */
export function isOnline() {
  return _online;
}

/**
 * Initialize network detection.
 * Tries Capacitor Network plugin first, falls back to browser events.
 */
export async function initNetwork() {
  if (_initialized) return;
  _initialized = true;

  // Try Capacitor Network plugin
  try {
    const { Network } = await import('@capacitor/network');
    _networkPlugin = Network;

    const status = await Network.getStatus();
    _online = status.connected;

    Network.addListener('networkStatusChange', (status) => {
      const wasOnline = _online;
      _online = status.connected;
      if (wasOnline !== _online) _notify();
    });

    return;
  } catch {
    // Plugin not available, fall back to browser events
  }

  // Browser fallback
  _online = navigator.onLine;

  window.addEventListener('online', () => {
    _online = true;
    _notify();
  });

  window.addEventListener('offline', () => {
    _online = false;
    _notify();
  });
}
