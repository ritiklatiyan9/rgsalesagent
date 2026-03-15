import { useState, useEffect } from 'react';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CallDetector from '@/plugins/callDetector';

export default function BackgroundPermissionBanner() {
  const [show, setShow] = useState(false);
  const [isAggressiveOem, setIsAggressiveOem] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('rg_bg_perm_dismissed');
    if (dismissed === 'true') return;

    let isNative = false;
    try {
      const Cap = window.Capacitor;
      isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
    } catch {}
    if (!isNative) return;

    const ua = navigator.userAgent.toLowerCase();
    const aggressive = /(xiaomi|miui|redmi|poco|oppo|vivo|realme|oneplus|huawei)/.test(ua);
    setIsAggressiveOem(aggressive);

    setTimeout(() => setShow(true), 2000);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    localStorage.setItem('rg_bg_perm_dismissed', 'true');
    setShow(false);
  };

  const handleOpenSettings = async () => {
    try {
      await CallDetector.openAutostartSettings();
      handleDismiss();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-100 p-1.5 shrink-0 text-amber-600">
          <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900 tracking-tight">Enable Background Limits</h4>
          <p className="text-[13px] text-amber-700 mt-0.5 leading-snug max-w-2xl">
            {isAggressiveOem
              ? "Your phone aggressively kills background apps. To receive the post-call popup reliably, enable Autostart or Background Execution for this app."
              : 'To ensure post-call lead capture works when app is closed, enable Autostart permissions.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 mt-1 sm:mt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDismiss}
          className="h-8 text-xs font-semibold bg-transparent border-amber-300 text-amber-700 hover:bg-amber-100/50 hover:text-amber-800"
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          onClick={handleOpenSettings}
          className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Open Settings
        </Button>
      </div>
    </div>
  );
}
