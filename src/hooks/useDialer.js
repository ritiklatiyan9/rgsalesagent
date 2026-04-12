import { Capacitor, registerPlugin } from '@capacitor/core';

const noopHandle = { remove: () => {} };

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

// Lazy init — avoid calling registerPlugin at module-load time
// to prevent Vite module initialization ordering issues on web.
let _dialer = null;
function getDialer() {
  if (_dialer) return _dialer;
  try {
    if (isNative()) {
      _dialer = registerPlugin('Dialer');
      return _dialer;
    }
  } catch (e) {
    console.warn('[useDialer] registerPlugin failed:', e);
  }
  _dialer = null;
  return null;
}

export const useDialer = () => {
  const requestPermissions = async () => {
    if (!isNative()) return { callPhone: false, callLog: false, phoneState: false, contacts: false };
    return getDialer()?.requestPermissions() ?? { callPhone: false, callLog: false, phoneState: false, contacts: false };
  };

  const makeCall = async (phoneNumber, simSlot = -1) => {
    const clean = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!clean) throw new Error('Phone number is required');
    if (!isNative()) {
      window.open(`tel:${clean}`, '_self');
      return { started: true, phoneNumber: clean };
    }
    return getDialer()?.makeCall({ phoneNumber: clean, simSlot }) ?? { started: false };
  };

  const openDialer = async (phoneNumber) => {
    const clean = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!isNative()) {
      window.open(`tel:${clean}`, '_self');
      return { opened: true };
    }
    return getDialer()?.openDialer({ phoneNumber: clean }) ?? { opened: false };
  };

  const getRecentCalls = async (limit = 50) => {
    if (!isNative()) return [];
    const res = await (getDialer()?.getRecentCalls({ limit }) ?? Promise.resolve(null));
    return res?.calls || [];
  };

  const getSIMInfo = async () => {
    if (!isNative()) return [];
    const res = await (getDialer()?.getSIMInfo() ?? Promise.resolve(null));
    return res?.sims || [];
  };

  const getDeviceContacts = async () => {
    if (!isNative()) return [];
    const res = await (getDialer()?.getDeviceContacts() ?? Promise.resolve(null));
    return res?.contacts || [];
  };

  const onCallStateChanged = (callback) => {
    if (!isNative()) return noopHandle;
    return getDialer()?.addListener('callStateChanged', callback) ?? noopHandle;
  };

  const onCallConnected = (callback) => {
    if (!isNative()) return noopHandle;
    return getDialer()?.addListener('callConnected', callback) ?? noopHandle;
  };

  const onCallEnded = (callback) => {
    if (!isNative()) return noopHandle;
    return getDialer()?.addListener('callEnded', callback) ?? noopHandle;
  };

  return {
    requestPermissions,
    makeCall,
    openDialer,
    getRecentCalls,
    getSIMInfo,
    getDeviceContacts,
    onCallStateChanged,
    onCallConnected,
    onCallEnded,
  };
};

export default useDialer;
