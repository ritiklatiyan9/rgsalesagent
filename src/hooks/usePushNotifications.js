import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { ringNotification } from '@/utils/notificationSound';

// Silent by default — only critical errors surface as toasts so the user
// knows when FCM has actually failed. Info/success goes to console only.
// Set localStorage.fcm_debug = '1' to re-enable the verbose on-screen mode.
const wantDebug = () => {
  try { return localStorage.getItem('fcm_debug') === '1'; } catch { return false; }
};
const log = (msg, kind = 'info') => {
  const line = `[fcm] ${msg}`;
  if (kind === 'error') console.error(line);
  else console.log(line);
  // Errors always visible; info/success only in debug mode.
  if (kind !== 'error' && !wantDebug()) return;
  try {
    if (kind === 'error') toast.error(line, { duration: 8000 });
    else if (kind === 'success') toast.success(line, { duration: 4000 });
    else toast(line, { duration: 4000 });
  } catch { /* noop */ }
};

const isNative = () => {
  try {
    const Cap = typeof window !== 'undefined' ? window.Capacitor : null;
    return !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  } catch { return false; }
};

const loadPushPlugin = async () => {
  try {
    const mod = await import('@capacitor/push-notifications');
    return { Push: mod.PushNotifications };
  } catch (e) {
    log(`push plugin load failed: ${e?.message || e}`, 'error');
    return null;
  }
};

const loadLocalPlugin = async () => {
  try {
    const mod = await import('@capacitor/local-notifications');
    return { Local: mod.LocalNotifications };
  } catch (e) {
    log(`local plugin load failed: ${e?.message || e}`, 'error');
    return null;
  }
};

// Agent-side deep-link routes. Matches the Agent Panel router.
const routeFromData = (data = {}) => {
  if (!data || typeof data !== 'object') return null;
  switch (data.type) {
    case 'chat':
      return {
        path: '/chat',
        state: data.conversation_id ? { openConversationId: String(data.conversation_id) } : undefined,
      };
    case 'lead':
      return { path: data.lead_id ? `/leads/${data.lead_id}` : '/leads' };
    case 'call':
      return { path: data.lead_id ? `/calls/lead/${data.lead_id}` : '/calls/scheduled' };
    case 'followup':
    case 'reminder':
      return { path: '/calls/scheduled' };
    case 'schedule':
      return { path: '/calls/scheduled' };
    case 'booking':
      return { path: data.booking_id ? `/bookings/${data.booking_id}` : '/bookings' };
    case 'payment':
    case 'sale':
      return { path: data.booking_id ? `/bookings/${data.booking_id}` : '/sales' };
    case 'task':
      // The backend currently fires `type:'task'` for supervision tasks (admin
      // → assignee). Agent's self-created todos go to /tasks. We disambiguate
      // by an explicit `subtype` if present, otherwise default to supervision.
      if (data.subtype === 'self' || data.subtype === 'todo') return { path: '/tasks' };
      return { path: '/supervision-tasks' };
    case 'supervision_task':
      return { path: '/supervision-tasks' };
    case 'attendance':
    case 'attendance_eod':
      // Admin pushes carry route:'/attendance/records' which doesn't exist
      // on the agent app — always land on the agent's own history page.
      return { path: '/attendance/history' };
    default:
      return data.route ? { path: data.route } : null;
  }
};

const runWhenIdle = (fn) => {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback;
  if (typeof ric === 'function') ric(fn, { timeout: 2000 });
  else setTimeout(fn, 0);
};

// Module-level guard against multiple hook mounts re-registering FCM.
let _fcmInitStarted = false;

export default function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const registeredTokenRef = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      _fcmInitStarted = false;
      return;
    }
    // Loud diagnostic — proves the hook is firing for this user.
    if (!isNative()) {
      log('not running on native — skipping (browser dev mode)');
      return;
    }
    if (_fcmInitStarted) {
      log('init already started this session — skipping');
      return;
    }
    _fcmInitStarted = true;

    log(`FCM init starting for user ${user.id.slice(0, 8)}…`);
    let mounted = true;
    let listeners = [];

    const init = async () => {
      const pushWrap = await loadPushPlugin();
      const localWrap = await loadLocalPlugin();
      const Push = pushWrap?.Push;
      const Local = localWrap?.Local;
      if (!mounted) return;
      if (!Push) { log('PushNotifications plugin missing — did cap sync run?', 'error'); return; }

      // Listeners must be attached before register() — Android can fire the
      // registration event synchronously.
      listeners.push(await Push.addListener('registration', async ({ value: token }) => {
        if (!token) { log('registration fired but token is empty', 'error'); return; }
        if (registeredTokenRef.current === token) return;
        registeredTokenRef.current = token;
        try { window.__rg_fcm_token = token; } catch { /* noop */ }
        log(`token received (${token.length} chars)`, 'success');
        try {
          const resp = await api.post('/auth/fcm-token', { token, platform: 'android' });
          log(`token uploaded (HTTP ${resp?.status})`, 'success');
        } catch (e) {
          const status = e?.response?.status || 'no-response';
          const url = `${e?.config?.baseURL || ''}${e?.config?.url || '/auth/fcm-token'}`;
          const serverMsg = e?.response?.data?.message || e?.message || 'unknown error';
          log(`upload FAILED ${status} → ${url}\n${serverMsg}`, 'error');
        }
      }));

      listeners.push(await Push.addListener('registrationError', (err) => {
        log(`registration ERROR: ${err?.error || JSON.stringify(err)}`, 'error');
      }));

      listeners.push(await Push.addListener('pushNotificationReceived', async (notif) => {
        log(`push arrived (fg): ${notif?.title || notif?.data?.sender_name || '?'}`, 'success');
        try {
          ringNotification();
          if (Local) {
            const id = Math.floor(Math.random() * 2_000_000_000);
            await Local.schedule({
              notifications: [{
                id,
                title: notif?.title || notif?.data?.sender_name || 'New notification',
                body:  notif?.body  || notif?.data?.preview     || '',
                channelId: 'chat_messages',
                sound: 'notification_bell.wav',
                smallIcon: 'ic_stat_icon',
                extra: notif?.data || {},
              }],
            });
          }
        } catch (e) {
          log(`fg display failed: ${e?.message}`, 'error');
        }
      }));

      listeners.push(await Push.addListener('pushNotificationActionPerformed', (action) => {
        const data = action?.notification?.data || {};
        const target = routeFromData(data);
        if (target?.path) navigate(target.path, target.state ? { state: target.state } : undefined);
      }));

      if (Local) {
        listeners.push(await Local.addListener('localNotificationActionPerformed', (ev) => {
          const data = ev?.notification?.extra || {};
          const target = routeFromData(data);
          if (target?.path) navigate(target.path, target.state ? { state: target.state } : undefined);
        }));
      }

      try {
        await Push.createChannel?.({
          id: 'chat_messages',
          name: 'RiverGreen alerts',
          description: 'Chat, tasks, bookings, sales and reminders',
          importance: 5,
          visibility: 1,
          lights: true,
          lightColor: '#6366f1',
          vibration: true,
          sound: 'notification_bell',
        });
        log('channel "chat_messages" ready');
      } catch (e) {
        log(`createChannel failed: ${e?.message}`, 'error');
      }

      // Permission — always log the current state, then unconditionally call
      // requestPermissions(). On a fresh install Android shows the system
      // dialog; on subsequent calls it's a no-op that just returns the
      // remembered state. Either way we get a clean answer to act on.
      let perm;
      try {
        const current = await Push.checkPermissions();
        log(`current permission: ${current?.receive || 'unknown'}`);
        perm = await Push.requestPermissions();
        log(`requestPermissions returned: ${perm?.receive || 'unknown'}`,
            perm?.receive === 'granted' ? 'success' : 'error');
      } catch (e) {
        log(`permission flow threw: ${e?.message}`, 'error');
        return;
      }

      if (perm?.receive !== 'granted') {
        log('permission not granted — aborting register()', 'error');
        // Android remembers the previous "Deny" — requestPermissions() will
        // never show the system dialog again. Use a confirm() to offer the
        // user a one-tap path into the app settings page where they can
        // toggle notifications on themselves.
        const opened = window.confirm(
          'Notifications are blocked for DG Sales.\n\n' +
          'Tap OK to open the app settings → tap "Notifications" → enable them. ' +
          'Then come back to the app and log in again.'
        );
        if (opened) {
          try {
            const { registerPlugin } = await import('@capacitor/core');
            const Bg = registerPlugin('BackgroundGeolocation');
            // openSettings() lands on the app info page in system settings.
            // From there "Notifications" is one tap away.
            await Bg.openSettings();
          } catch (e) {
            log(`could not open settings: ${e?.message}`, 'error');
          }
        }
        return;
      }

      try {
        await Push.register();
        log('register() called — awaiting FCM token…');
      } catch (e) {
        log(`register() threw: ${e?.message}`, 'error');
        return;
      }

      // Watchdog: if Firebase never hands us a token, retry once before giving up.
      setTimeout(async () => {
        if (registeredTokenRef.current) return;
        log('no token after 15s — retrying register()', 'info');
        try {
          await Push.register();
        } catch (e) {
          log(`retry register() threw: ${e?.message}`, 'error');
        }
        // Final 15s window after retry — if still nothing, surface a clear error.
        setTimeout(() => {
          if (!registeredTokenRef.current) {
            log('still no FCM token after retry — check google-services.json package matches com.rivergreen.agent', 'error');
          }
        }, 15_000);
      }, 15_000);
    };

    // Run immediately — no idle-callback deferral. The brief delay was hiding
    // bugs and making it hard to tell whether init was actually firing.
    init().catch((e) => log(`init crashed: ${e?.message || e}`, 'error'));

    return () => {
      mounted = false;
      listeners.forEach((l) => { try { l?.remove?.(); } catch { /* noop */ } });
    };
  }, [user?.id, navigate]);
}
