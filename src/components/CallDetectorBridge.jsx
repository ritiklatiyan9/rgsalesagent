import { useState, useCallback, Component } from 'react';
import { useCallListener } from '@/hooks/useCallListener';
import CallLeadDrawer from '@/components/CallLeadDrawer';
import api from '@/lib/axios';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [callData, setCallData] = useState(null);

  const handleCallEnded = useCallback(async (data) => {
    if (!data) return;
    const hasNumber = data.phoneNumber && data.phoneNumber.trim() !== '';
    const isMissed = data.callType === 'MISSED';
    const isReal = data.duration >= 1;
    if (!hasNumber && !isReal && !isMissed) return;

    // Auto-log to backend immediately
    try {
      await api.post('/calls/quick-log', {
        phone_number: data.phoneNumber,
        call_type: data.callType || 'UNKNOWN',
        duration_seconds: data.duration || 0,
        call_source: 'NATIVE_DETECTED',
        call_status: 'COMPLETED',
        call_start: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString()
      });
    } catch (err) {
      console.error('[CallDetectorBridge] Auto-log failed:', err);
    }

    setCallData(data);
    setDrawerOpen(true);
  }, []);

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
