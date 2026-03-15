import { Capacitor, registerPlugin } from '@capacitor/core';

const Dialer = registerPlugin('Dialer');
const noopHandle = { remove: () => {} };

const isNative = () => Capacitor.isNativePlatform();

export const useDialer = () => {
  const requestPermissions = async () => {
    if (!isNative()) return { callPhone: false, callLog: false, phoneState: false, contacts: false };
    return Dialer.requestPermissions();
  };

  const makeCall = async (phoneNumber, simSlot = -1) => {
    const clean = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!clean) throw new Error('Phone number is required');
    if (!isNative()) {
      window.open(`tel:${clean}`, '_self');
      return { started: true, phoneNumber: clean };
    }
    return Dialer.makeCall({ phoneNumber: clean, simSlot });
  };

  const openDialer = async (phoneNumber) => {
    const clean = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!isNative()) {
      window.open(`tel:${clean}`, '_self');
      return { opened: true };
    }
    return Dialer.openDialer({ phoneNumber: clean });
  };

  const getRecentCalls = async (limit = 50) => {
    if (!isNative()) return [];
    const res = await Dialer.getRecentCalls({ limit });
    return res?.calls || [];
  };

  const getSIMInfo = async () => {
    if (!isNative()) return [];
    const res = await Dialer.getSIMInfo();
    return res?.sims || [];
  };

  const onCallStateChanged = (callback) => {
    if (!isNative()) return noopHandle;
    return Dialer.addListener('callStateChanged', callback);
  };

  const onCallConnected = (callback) => {
    if (!isNative()) return noopHandle;
    return Dialer.addListener('callConnected', callback);
  };

  const onCallEnded = (callback) => {
    if (!isNative()) return noopHandle;
    return Dialer.addListener('callEnded', callback);
  };

  return {
    requestPermissions,
    makeCall,
    openDialer,
    getRecentCalls,
    getSIMInfo,
    onCallStateChanged,
    onCallConnected,
    onCallEnded,
  };
};

export default useDialer;
