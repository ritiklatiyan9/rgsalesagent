/**
 * JS bridge for the native CallDetectorPlugin.
 *
 * Uses LAZY initialisation — registerPlugin is only called on first method
 * invocation, not at module-load time.  This avoids timing issues where
 * window.Capacitor might not be fully ready when the module evaluates.
 *
 * Falls back to no-op stubs on web or if anything goes wrong.
 */

const NOOP = {
  startListening:          async () => ({ listening: false }),
  stopListening:           async () => ({ listening: false }),
  requestPermissions:      async () => ({ granted: false }),
  addListener:             (_ev, _fn) => Promise.resolve({ remove: () => {} }),
  removeAllListeners:      async () => {},
  getLastCall:             async () => ({ hasCall: false }),
  startCallDetection:      async () => ({ started: false }),
  stopCallDetection:       async () => ({ stopped: false }),
  requestOverlayPermission: async () => ({ granted: false }),
  checkOverlayPermission:  async () => ({ granted: false }),
  openAutostartSettings:   async () => ({ success: false }),
  openBatterySettings:     async () => ({ success: false, alreadyIgnored: false }),
};

let _plugin = null;

function getPlugin() {
  if (_plugin) return _plugin;
  try {
    const Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.registerPlugin) {
      _plugin = Cap.registerPlugin('CallDetector');
      return _plugin;
    }
  } catch (e) {
    console.warn('[CallDetector] registerPlugin failed:', e);
  }
  _plugin = NOOP;
  return NOOP;
}

// Lazy proxy — each method call resolves the real plugin on first use
const CallDetector = {
  startListening:          (...a) => getPlugin().startListening(...a),
  stopListening:           (...a) => getPlugin().stopListening(...a),
  requestPermissions:      (...a) => getPlugin().requestPermissions(...a),
  addListener:             (...a) => getPlugin().addListener(...a),
  removeAllListeners:      (...a) => getPlugin().removeAllListeners(...a),
  getLastCall:             (...a) => getPlugin().getLastCall(...a),
  startCallDetection:      (...a) => getPlugin().startCallDetection(...a),
  stopCallDetection:       (...a) => getPlugin().stopCallDetection(...a),
  requestOverlayPermission:(...a) => getPlugin().requestOverlayPermission(...a),
  checkOverlayPermission:  (...a) => getPlugin().checkOverlayPermission(...a),
  openAutostartSettings:   (...a) => getPlugin().openAutostartSettings(...a),
  openBatterySettings:     (...a) => getPlugin().openBatterySettings(...a),
};

export default CallDetector;
