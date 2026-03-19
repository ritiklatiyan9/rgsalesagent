import { useState, Suspense, useEffect, useRef, useTransition } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { Bell, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, ChevronRight, LogOut, User, Settings, LayoutDashboard, Users, List, MoreHorizontal, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import api, { getAccessToken } from '@/lib/axios';
import { cn } from '@/lib/utils';
import BackgroundPermissionBanner from '@/components/BackgroundPermissionBanner';

const routeNames = {
  '/dashboard': 'Dashboard',
  '/leads': 'My Leads',
  '/leads/add': 'Add Lead',
  '/calls': 'Call Dashboard',
  '/calls/dialer': 'Dialer',
  '/calls/leads-dialer': 'Leads Dialer',
  '/calls/log': 'Log Call',
  '/calls/daily-entry': 'Daily Entry',
  '/calls/scheduled': 'Scheduled Calls',
  '/calls/missed-followups': 'Missed Follow Up',
  '/calls/missed': 'Missed Calls',
  '/calls/analytics': 'My Analytics',
  '/reminders': 'Reminders',
  '/colony-maps': 'Colony Maps',
  '/team': 'My Team',
  '/team/manage': 'Team Management',
  '/team/performance': 'Team Performance',
  '/attendance': 'Mark Attendance',
  '/attendance/history': 'My Attendance',
  '/chat': 'Chat',
};

const PageSkeleton = () => (
  <div className="space-y-5 animate-pulse pt-1">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44 rounded-lg" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <Skeleton className="h-9 w-28 rounded-xl" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
    </div>
    <Skeleton className="h-72 rounded-xl" />
  </div>
);

const CALL_TYPE_ICON = {
  INBOUND: { icon: PhoneIncoming, color: 'text-emerald-500' },
  OUTBOUND: { icon: PhoneOutgoing, color: 'text-sky-500' },
  MISSED: { icon: PhoneMissed, color: 'text-rose-500' },
};
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://rivergreenbackend.onrender.com';
const MISSED_CALLS_SEEN_KEY = 'rg:lastSeenMissedCallAt';

const getParticipantPhone = (participant) => {
  const raw = participant?.phone
    || participant?.phone_number
    || participant?.mobile
    || participant?.mobile_number
    || participant?.whatsapp_number
    || participant?.contact_number
    || participant?.number;
  return raw ? String(raw).trim() : '';
};

const getParticipantDisplayName = (participant) => {
  const name = participant?.name || participant?.contact_name || participant?.lead_name;
  if (name && String(name).trim()) return String(name).trim();
  const phone = getParticipantPhone(participant);
  return phone || 'Unknown';
};

const getIncomingMessageTitle = (msg) => {
  const senderName = msg?.sender_name || msg?.senderName;
  if (senderName && String(senderName).trim()) return String(senderName).trim();
  const senderPhone = msg?.sender_phone
    || msg?.senderPhone
    || msg?.sender_mobile
    || msg?.senderMobile
    || msg?.sender_number
    || msg?.senderNumber;
  return senderPhone ? String(senderPhone).trim() : 'Unknown';
};

const getIncomingMessagePreview = (msg) => {
  if (msg?.is_deleted) return 'Message deleted';
  return msg?.message_text || msg?.messageText || (msg?.file_name || msg?.fileName ? 'File received' : 'New message');
};

const getMissedCallPhone = (call) => String(
  call?.phone_number_dialed
  || call?.lead_phone
  || call?.phone_number
  || call?.phone
  || ''
).trim();

const toMissedNotification = (call) => {
  const phone = getMissedCallPhone(call);
  const title = call?.lead_name || call?.contact_name || phone || 'Unknown number';
  return {
    id: String(call?.id || `${phone}-${call?.call_start || call?.created_at || Date.now()}`),
    title,
    phone,
    preview: phone ? `Missed call from ${phone}` : 'Missed call detected',
    createdAt: call?.call_start || call?.created_at || new Date().toISOString(),
  };
};

const getMissedSeenAt = () => {
  try {
    return localStorage.getItem(MISSED_CALLS_SEEN_KEY) || null;
  } catch {
    return null;
  }
};

const setMissedSeenNow = () => {
  try {
    localStorage.setItem(MISSED_CALLS_SEEN_KEY, new Date().toISOString());
  } catch {
    // no-op
  }
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const LayoutBody = () => {
  const { openMobile, setOpenMobile } = useSidebar();
  const { pathname } = useLocation();
  const { user, logout, activeSiteId } = useAuth();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [calls, setCalls] = useState([]);
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0);
  const [chatNotifications, setChatNotifications] = useState([]);
  const [missedUnreadTotal, setMissedUnreadTotal] = useState(0);
  const [missedCallNotifications, setMissedCallNotifications] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!openMobile) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openMobile]);

  const loadChatNotifications = async () => {
    try {
      const { data } = await api.get('/chat/conversations');
      if (!data?.success || !Array.isArray(data.conversations)) return;

      const unreadConversations = data.conversations
        .map((conv) => {
          const unreadRaw = conv?.unread_count ?? conv?.unreadCount ?? 0;
          const unread = Number.isFinite(Number(unreadRaw)) ? Math.max(0, Number(unreadRaw)) : 0;
          if (unread <= 0) return null;

          const isGroup = !!conv?.is_group;
          const other = conv?.other_participants?.[0];
          const title = isGroup
            ? (conv?.group_name || conv?.other_participants?.map((p) => getParticipantDisplayName(p)).filter(Boolean).slice(0, 2).join(', ') || 'Group Chat')
            : getParticipantDisplayName(other);

          const preview = conv?.last_message?.is_deleted
            ? 'Message deleted'
            : (conv?.last_message?.message_text || (conv?.last_message?.file_name ? 'File received' : 'New message'));

          return {
            id: conv?.id,
            title,
            preview,
            unread,
            createdAt: conv?.last_message?.created_at || conv?.updated_at || conv?.created_at,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const total = unreadConversations.reduce((sum, item) => sum + item.unread, 0);
      const isOnChatPage = /^\/chat\/?$/.test(pathname);
      setChatUnreadTotal((prev) => (isOnChatPage ? total : Math.max(prev, total)));
      setChatNotifications((prev) => {
        const next = unreadConversations.slice(0, 6);
        if (!isOnChatPage && next.length === 0 && prev.length > 0) {
          return prev;
        }
        return next;
      });
    } catch {
      // Ignore intermittent chat fetch issues for header bell.
    }
  };

  const loadMissedCallNotifications = async () => {
    try {
      const { data } = await api.get('/calls?limit=30&call_type=MISSED');
      if (!data?.success || !Array.isArray(data.calls)) return;

      const seenAt = getMissedSeenAt();
      const seenTs = seenAt ? new Date(seenAt).getTime() : 0;

      const items = data.calls
        .map(toMissedNotification)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const unread = items.filter((item) => {
        const ts = new Date(item.createdAt || 0).getTime();
        return Number.isFinite(ts) && ts > seenTs;
      });

      setMissedUnreadTotal(unread.length);
      setMissedCallNotifications(unread.slice(0, 6));
    } catch {
      // Ignore intermittent fetch failures.
    }
  };

  const markMissedCallsAsSeen = () => {
    setMissedSeenNow();
    setMissedUnreadTotal(0);
    setMissedCallNotifications([]);
  };

  useEffect(() => {
    if (!/^\/calls\/missed\/?$/.test(pathname)) return;
    markMissedCallsAsSeen();
  }, [pathname]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !user?.id) return;

    loadChatNotifications();
    loadMissedCallNotifications();

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    let refreshTimer;
    const queueRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        loadChatNotifications();
      }, 1500);
    };

    socket.on('chat:message', (msg) => {
      const senderId = String(msg?.sender_id ?? msg?.senderId ?? '');
      if (senderId === String(user.id)) return;
      if (/^\/chat\/?$/.test(pathname)) return;

      const convId = String(msg?.conversation_id ?? msg?.conversationId ?? `temp-${Date.now()}`);
      const optimistic = {
        id: convId,
        title: getIncomingMessageTitle(msg),
        preview: getIncomingMessagePreview(msg),
        unread: 1,
        createdAt: msg?.created_at || msg?.createdAt || new Date().toISOString(),
      };

      setChatNotifications((prev) => {
        const idx = prev.findIndex((item) => String(item.id) === convId);
        if (idx === -1) {
          return [optimistic, ...prev].slice(0, 6);
        }
        const existing = prev[idx];
        const merged = {
          ...existing,
          ...optimistic,
          unread: (Number(existing.unread) || 0) + 1,
        };
        const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        return [merged, ...rest].slice(0, 6);
      });

      setChatUnreadTotal((prev) => prev + 1);
      queueRefresh();
    });

    const onMissedCall = (evt) => {
      if (/^\/calls\/missed\/?$/.test(pathname)) return;
      const mapped = toMissedNotification(evt?.detail || {});

      setMissedCallNotifications((prev) => {
        const rest = prev.filter((item) => String(item.id) !== String(mapped.id));
        return [mapped, ...rest].slice(0, 6);
      });
      setMissedUnreadTotal((prev) => prev + 1);

      // Sync with server state after quick-log write settles.
      setTimeout(() => {
        loadMissedCallNotifications();
      }, 1200);
    };
    window.addEventListener('rg:missed-call', onMissedCall);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('rg:missed-call', onMissedCall);
      socket?.disconnect();
    };
  }, [user?.id, pathname]);

  useEffect(() => {
    if (!notifOpen || calls.length > 0) return;
    setCallsLoading(true);
    api.get('/calls?limit=15')
      .then(({ data }) => { if (data.success) setCalls(data.calls ?? []); })
      .catch(() => { })
      .finally(() => setCallsLoading(false));
  }, [notifOpen]);

  const pageTitle = routeNames[pathname]
    || (pathname.includes('/calls/lead/') ? 'Call History'
      : 'Dashboard');
  const totalNotificationCount = (chatUnreadTotal || 0) + (missedUnreadTotal || 0);

  return (
    <>
      {openMobile && (
        <div
          className="fixed inset-0 bg-slate-900/20 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setOpenMobile(false)}
        />
      )}

      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white/80 backdrop-blur-lg shrink-0 z-20 border-b border-slate-100 shadow-sm sticky top-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 md:px-8">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <h2 className="text-[15px] sm:text-[17px] font-bold text-slate-800 tracking-tight truncate">{pageTitle}</h2>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((o) => !o)}
                  className={`h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl border transition-colors shrink-0
                  ${notifOpen
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-indigo-600 hover:bg-slate-50 hover:border-slate-100'
                    }`}
                >
                  <Bell className="h-4 w-4" strokeWidth={2.5} />
                  {totalNotificationCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none shadow-sm shadow-rose-200/80">
                      {totalNotificationCount > 99 ? '99+' : totalNotificationCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18)] border border-slate-100 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Notifications</p>
                      <button
                        className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                        onClick={() => {
                          setNotifOpen(false);
                          navigate('/chat');
                        }}
                      >
                        Open chat <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 [scrollbar-width:thin]">
                      <div className="px-4 py-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-rose-500" /> Unread Chats
                          </p>
                          <span className="text-[11px] text-rose-600 font-semibold">{chatUnreadTotal}</span>
                        </div>
                        {chatNotifications.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-1">No unread messages</div>
                        ) : (
                          <div className="space-y-1.5">
                            {chatNotifications.map((item) => (
                              <button
                                key={item.id}
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-left hover:bg-slate-50 transition-colors"
                                onClick={() => {
                                  setNotifOpen(false);
                                  navigate('/chat');
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[12px] font-semibold text-slate-800 truncate">{item.title}</p>
                                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                                    {item.unread > 99 ? '99+' : item.unread}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.preview}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-2.5 border-t border-slate-100/80">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <PhoneMissed className="h-3.5 w-3.5 text-rose-500" /> Missed Calls
                          </p>
                          <span className="text-[11px] text-rose-600 font-semibold">{missedUnreadTotal}</span>
                        </div>
                        {missedCallNotifications.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-1">No missed calls</div>
                        ) : (
                          <div className="space-y-1.5">
                            {missedCallNotifications.map((item) => (
                              <button
                                key={item.id}
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-left hover:bg-slate-50 transition-colors"
                                onClick={() => {
                                  setNotifOpen(false);
                                  markMissedCallsAsSeen();
                                  navigate('/calls/missed');
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[12px] font-semibold text-slate-800 truncate">{item.title}</p>
                                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">{timeAgo(item.createdAt)}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.preview}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {callsLoading ? (
                        <div className="p-4 space-y-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <Skeleton className="h-7 w-7 rounded-lg" />
                              <div className="flex-1 space-y-1">
                                <Skeleton className="h-3 w-28 rounded" />
                                <Skeleton className="h-2.5 w-20 rounded" />
                              </div>
                              <Skeleton className="h-2.5 w-10 rounded" />
                            </div>
                          ))}
                        </div>
                      ) : calls.length === 0 ? (
                        <div className="py-4 text-center text-sm text-slate-400">No recent calls</div>
                      ) : (
                        <>
                          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-[11px] font-semibold text-slate-600">Recent Calls</div>
                          {calls.map((c) => {
                            const meta = CALL_TYPE_ICON[c.call_type] ?? CALL_TYPE_ICON.OUTBOUND;
                            const IconComp = meta.icon;
                            return (
                              <div
                                key={c.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => { setNotifOpen(false); startTransition(() => navigate(`/calls/lead/${c.lead_id}`)); }}
                              >
                                <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                  <IconComp className={`h-3.5 w-3.5 ${meta.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-800 truncate">
                                    {c.lead_name || c.lead_phone || 'Unknown lead'}
                                  </p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {c.outcome_label ? c.outcome_label : c.call_type?.toLowerCase()}
                                  </p>
                                </div>
                                <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                  {timeAgo(c.call_start || c.created_at)}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>

                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="w-full text-xs text-center text-indigo-600 hover:underline font-medium"
                          onClick={() => {
                            setNotifOpen(false);
                            startTransition(() => navigate('/chat'));
                          }}
                        >
                          Open Chat
                        </button>
                        <button
                          className="w-full text-xs text-center text-indigo-600 hover:underline font-medium"
                          onClick={() => {
                            setNotifOpen(false);
                            markMissedCallsAsSeen();
                            startTransition(() => navigate('/calls/missed'));
                          }}
                        >
                          Missed Calls
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shadow-sm border ml-0.5 sm:ml-1 transition-colors shrink-0 overflow-hidden
                  ${profileOpen
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-indigo-50 border-indigo-100/50 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600'
                    }`}
                  title={user?.name || 'Profile'}
                >
                  {user?.profile_photo ? (
                    <img
                      src={user.profile_photo}
                      alt={user?.name || 'Profile'}
                      className="h-full w-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-sm font-bold leading-none">
                      {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                  )}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18)] border border-slate-100 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800">{user?.name || 'Agent'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{user?.email || 'agent@rivergeen.com'}</p>
                    </div>

                    <div className="py-1.5">
                      <button
                        onClick={() => { setProfileOpen(false); startTransition(() => navigate('/profile')); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        <span>Edit Profile</span>
                      </button>
                      <button
                        onClick={() => { setProfileOpen(false); startTransition(() => navigate('/profile?section=settings')); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-slate-400" />
                        <span>Settings</span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 py-1.5">
                      <button
                        onClick={() => { setProfileOpen(false); logout(); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <BackgroundPermissionBanner />

        <main className="flex-1 min-h-0 overflow-y-auto w-full [scrollbar-width:thin] [scrollbar-color:var(--color-slate-200)_transparent] bg-white sm:bg-[#f8fafc]">
          <div className="p-2 sm:p-5 md:p-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-10 max-w-7xl mx-auto">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet key={activeSiteId || 'no-site'} />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile floating dock navigation */}
      <nav
        className={cn(
          'md:hidden fixed bottom-2 left-0 right-0 z-30 px-3 transition-opacity duration-200',
          openMobile ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto max-w-md rounded-[1.35rem] border border-slate-200/80 bg-white/90 backdrop-blur-md p-1.5 shadow-[0_12px_24px_-10px_rgba(0,0,0,0.15)]">
          <div className="grid grid-cols-5 gap-1">
            {[
              { to: '/dashboard', icon: LayoutDashboard, label: 'Home', iconColor: 'text-indigo-600', activeBg: 'from-indigo-50/80 to-slate-50/50' },
              { to: '/leads', icon: Users, label: 'Leads', iconColor: 'text-emerald-600', activeBg: 'from-emerald-50/80 to-slate-50/50' },
              { to: '/all-contacts', icon: List, label: 'Contacts', iconColor: 'text-cyan-600', activeBg: 'from-cyan-50/80 to-slate-50/50' },
              { to: '/calls/dialer', icon: Phone, label: 'Calls', iconColor: 'text-rose-600', activeBg: 'from-rose-50/80 to-slate-50/50' },
            ].map(({ to, icon: Icon, label, iconColor, activeBg }) => {
              const isActive = pathname === to || (to !== '/dashboard' && pathname.startsWith(to + '/')) || (to === '/leads' && pathname.startsWith('/leads'));
              return (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  className={`rounded-xl px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 transition-all ${isActive
                      ? `bg-linear-to-b ${activeBg} border border-slate-200/60 shadow-[0_4px_8px_-4px_rgba(0,0,0,0.1)]`
                      : 'border border-transparent active:bg-slate-100'
                    }`}
                >
                  <span className={`h-6 w-6 rounded-full grid place-items-center ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}>
                    <Icon className={`h-4 w-4 ${iconColor} ${isActive ? 'opacity-100' : 'opacity-70'}`} strokeWidth={isActive ? 2.5 : 2.1} />
                  </span>
                  <span className={`text-[9px] leading-none font-medium ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>{label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setOpenMobile(true)}
              className="rounded-xl px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 border border-transparent active:bg-slate-100 transition-all"
            >
              <span className="h-6 w-6 rounded-full grid place-items-center bg-transparent">
                <MoreHorizontal className="h-4 w-4 text-violet-600 opacity-75" strokeWidth={2.1} />
              </span>
              <span className="text-[9px] leading-none font-medium text-slate-500">More</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

const Layout = () => (
  <SidebarProvider
    defaultOpen
    style={{ '--sidebar-width': '17.5rem', '--sidebar-width-icon': '4.75rem' }}
    className="h-dvh overflow-hidden bg-[#f4f7fc]"
  >
    <LayoutBody />
  </SidebarProvider>
);

export default Layout;
