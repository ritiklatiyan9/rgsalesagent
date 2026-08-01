import { useState, Suspense, useEffect, useRef, useTransition, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { Bell, X, ChevronRight, LogOut, User, Settings, Users, ContactRound, MessageSquare, House, PhoneCall, Calendar, Check, MapPin, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Drawer, DrawerContent, DrawerClose, DrawerTitle } from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api, { getAccessToken } from '@/lib/axios';
import { cn } from '@/lib/utils';
import BackgroundPermissionBanner from '@/components/BackgroundPermissionBanner';
import { startBackgroundTracking, stopBackgroundTracking } from '@/services/BackgroundLocationService';
import usePushNotifications from '@/hooks/usePushNotifications';

const routeNames = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/leads': 'My Leads',
  '/leads/add': 'Add Lead',
  '/calls': 'Call Dashboard',
  '/calls/dialer': 'Dialer',
  '/calls/leads-dialer': 'Leads Dialer',
  '/calls/summary': 'Call Summary',
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
  '/matter-leads': 'Matter Leads',
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

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://rivergreenbackend.onrender.com';

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
  const { pathname, search } = useLocation();
  const { user, logout, activeSiteId, sites, switchSite, siteLoading } = useAuth();
  const handleSiteChange = async (siteId) => {
    await switchSite(siteId);
  };

  // Register FCM token, surface foreground notifications, and route taps to
  // the right page (chat / lead / booking / supervision-task / etc).
  usePushNotifications();
  const roleLabel = String(user?.role || '').toUpperCase() === 'TEAM_HEAD' ? 'Team Head' : 'Agent';
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0);
  const [chatNotifications, setChatNotifications] = useState([]);
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
    const handler = () => setIsMobileView(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (!openMobile) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openMobile]);

  const loadChatNotifications = useCallback(async () => {
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
            ? (conv?.group_name || conv?.other_participants?.map((p) => p?.name || p?.contact_name || '').filter(Boolean).slice(0, 2).join(', ') || 'Group Chat')
            : (other?.name || other?.contact_name || other?.lead_name || other?.phone || 'Unknown');

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
      const isOnChatPage = /^\/chat(\/|$)/.test(pathname);
      setChatUnreadTotal((prev) => (isOnChatPage ? total : Math.max(prev, total)));
      setChatNotifications((prev) => {
        const next = unreadConversations.slice(0, 6);
        if (!isOnChatPage && next.length === 0 && prev.length > 0) return prev;
        return next;
      });
    } catch {
      // Ignore intermittent chat fetch issues for header bell.
    }
  }, [pathname]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !user?.id) return;

    const initialRefresh = setTimeout(() => {
      loadChatNotifications();
    }, 0);

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
      if (/^\/chat(\/|$)/.test(pathname)) return;

      const convId = String(msg?.conversation_id ?? msg?.conversationId ?? `temp-${Date.now()}`);
      const senderName = msg?.sender_name || msg?.senderName;
      const title = (senderName && String(senderName).trim())
        ? String(senderName).trim()
        : String(msg?.sender_phone || msg?.senderPhone || msg?.sender_number || msg?.senderNumber || 'Unknown').trim();
      const preview = msg?.is_deleted ? 'Message deleted'
        : (msg?.message_text || msg?.messageText || (msg?.file_name || msg?.fileName ? 'File received' : 'New message'));
      const optimistic = {
        id: convId,
        title,
        preview,
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

    // Start background location tracking
    startBackgroundTracking();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      clearTimeout(initialRefresh);
      socket?.disconnect();
      stopBackgroundTracking();
    };
  }, [user?.id, pathname, loadChatNotifications]);

  const pageTitle = routeNames[pathname]
    || (pathname.includes('/calls/lead/') ? 'Call History'
      : 'Dashboard');
  const totalNotificationCount = chatUnreadTotal || 0;

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
        <header className="bg-white/90 backdrop-blur-xl shrink-0 z-20 border-b border-slate-200 sticky top-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="h-11 sm:h-12 flex flex-row-reverse items-center justify-between px-3 sm:px-4 md:px-8">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((o) => !o)}
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors shrink-0
                  ${notifOpen
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <Bell className="h-4 w-4" strokeWidth={2} />
                  {totalNotificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none ring-2 ring-white">
                      {totalNotificationCount > 99 ? '99+' : totalNotificationCount}
                    </span>
                  )}
                </button>

                {/* Mobile: shadcn Drawer opens from below */}
                <Drawer open={notifOpen && isMobileView} onOpenChange={(open) => { if (!open) setNotifOpen(false); }} direction="bottom">
                  <DrawerContent className="flex flex-col max-h-[85vh]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}>
                    <DrawerTitle className="sr-only">Chat Notifications</DrawerTitle>
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                      <p className="text-base font-semibold text-slate-800">Notifications</p>
                      <DrawerClose asChild>
                        <button className="text-slate-400 hover:text-slate-600 p-1.5 -mr-1">
                          <X className="h-5 w-5" />
                        </button>
                      </DrawerClose>
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                              <MessageSquare className="h-4 w-4 text-rose-500" /> Unread Chats
                            </p>
                            <span className="text-xs text-rose-600 font-semibold">{chatUnreadTotal}</span>
                          </div>
                          {chatNotifications.length === 0 ? (
                            <div className="text-sm text-slate-400 py-2">No unread messages</div>
                          ) : (
                            <div className="space-y-2.5">
                              {chatNotifications.map((item) => (
                                <button
                                  key={item.id}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-3 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                  onClick={() => { setNotifOpen(false); navigate(`/chat/${item.id}`); }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none shrink-0">
                                      {item.unread > 99 ? '99+' : item.unread}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 truncate mt-1">{item.preview}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    <div className="px-4 py-3 border-t border-slate-100 shrink-0">
                        <button className="w-full text-sm text-center py-2.5 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 active:bg-indigo-100 transition-colors" onClick={() => { setNotifOpen(false); navigate('/chat'); }}>Open Chat</button>
                      </div>
                  </DrawerContent>
                </Drawer>

                {/* Desktop: dropdown popover with highest z-index */}
                {notifOpen && (
                    <div className="hidden sm:block absolute right-0 top-[calc(100%+8px)] w-80 max-w-80 bg-white rounded-2xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] border border-slate-100 z-50 overflow-hidden transition-all duration-200 origin-top-right">
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

                      <div className="max-h-72 overflow-y-auto [scrollbar-width:thin]">
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
                                  onClick={() => { setNotifOpen(false); navigate(`/chat/${item.id}`); }}
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
                      </div>

                      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                        <button
                          className="w-full text-xs text-center text-indigo-600 hover:underline font-medium"
                          onClick={() => { setNotifOpen(false); startTransition(() => navigate('/chat')); }}
                        >
                          Open Chat
                        </button>
                      </div>
                    </div>
                )}
          </div>

          <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center border ml-0.5 sm:ml-1 transition-all shrink-0 overflow-hidden
                  ${profileOpen
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-200'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 hover:shadow-md hover:shadow-indigo-200'
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
                      <p className="text-sm font-semibold text-slate-800">{user?.name || roleLabel}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{user?.email || 'agent@rivergeen.com'}</p>
                    </div>

                    <div className="py-1.5">
                      <button
                        onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        <span>Edit Profile</span>
                      </button>
                      <button
                        onClick={() => { setProfileOpen(false); navigate('/profile?section=settings'); }}
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

            <div className="flex items-center min-w-0 max-w-[60%]">
              <Select
                value={activeSiteId || undefined}
                onValueChange={handleSiteChange}
                disabled={siteLoading || !sites?.length}
              >
                <SelectTrigger
                  className="h-8 bg-transparent border-0 text-slate-800 text-[13px] font-medium rounded-md px-2 gap-1 hover:bg-slate-100 transition-colors min-w-0 max-w-full shadow-none focus:ring-0 [&>span]:truncate"
                  title="Switch site"
                >
                  <SelectValue placeholder={sites?.length ? 'Select site' : 'No site'} />
                </SelectTrigger>
                <SelectContent align="start">
                  {(sites || []).map((site) => (
                    <SelectItem key={site.id} value={String(site.id)}>
                      <div className="flex w-full items-center justify-between gap-2">
                        <span>{site.name}</span>
                        {String(activeSiteId || '') === String(site.id) && (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <BackgroundPermissionBanner />

        <main className="flex-1 min-h-0 overflow-y-auto w-full [scrollbar-width:thin] [scrollbar-color:var(--color-slate-200)_transparent] bg-white sm:bg-[#f8fafc]">
          <div className="p-2 sm:p-5 md:p-8 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-10 max-w-7xl mx-auto min-h-full flex flex-col">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet key={activeSiteId || 'no-site'} />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar with raised center Calls button */}
      <nav
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-30 transition-opacity duration-150',
          openMobile ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* SVG notch cutout background */}
        <div className="relative">
          <svg className="absolute -top-5 left-0 w-full h-5 pointer-events-none" viewBox="0 0 390 20" preserveAspectRatio="none">
            <path d="M0,20 L155,20 C160,20 165,15 170,8 C175,1 180,0 195,0 C210,0 215,1 220,8 C225,15 230,20 235,20 L390,20 L390,20 L0,20 Z" fill="white" />
          </svg>

          <div className="bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div className="relative flex h-14 items-stretch">
              {/* Left tabs: Leads, Calls */}
              {[
                { to: '/leads', icon: Users, label: 'Leads' },
                { to: '/calls/dialer', icon: PhoneCall, label: 'Calls' },
              ].map(({ to, icon: Icon, label }) => {
                const isActive = to === '/calls/dialer'
                  ? (pathname === '/calls/dialer' || pathname.startsWith('/calls/'))
                  : (pathname === to || pathname.startsWith(to + '/'));
                return (
                  <button
                    key={to}
                    onClick={() => navigate(to)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-90"
                  >
                    <div className="relative flex items-center justify-center">
                      {isActive && <div className="absolute inset-0 h-8 w-8 -top-1.5 -left-1.5 rounded-full bg-indigo-500/15 blur-md" />}
                      <Icon
                        className={`relative h-5 w-5 transition-colors duration-150 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`}
                        strokeWidth={isActive ? 2.4 : 1.8}
                      />
                    </div>
                    <span className={`text-[9px] font-bold transition-colors duration-150 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}

              {/* Center spacer for raised button */}
              <div className="flex-1" />

              {/* Right tab: Fresh Leads */}
              {(() => {
                const freshActive = pathname === '/leads' && search.includes('from=fresh');
                return (
                  <button
                    onClick={() => navigate('/leads?status=NEW&from=fresh')}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-90"
                  >
                    <div className="relative flex items-center justify-center">
                      {freshActive && <div className="absolute inset-0 h-8 w-8 -top-1.5 -left-1.5 rounded-full bg-violet-500/15 blur-md" />}
                      <Sparkles
                        className={`relative h-5 w-5 transition-colors duration-150 ${freshActive ? 'text-violet-600' : 'text-slate-500'}`}
                        strokeWidth={freshActive ? 2.4 : 1.8}
                      />
                    </div>
                    <span className={`text-[9px] font-bold transition-colors duration-150 ${freshActive ? 'text-violet-600' : 'text-slate-500'}`}>
                      Fresh
                    </span>
                  </button>
                );
              })()}

              <button
                onClick={() => navigate('/calls/scheduled')}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-90"
              >
                <div className="relative flex items-center justify-center">
                  {(pathname === '/calls/scheduled' || pathname.startsWith('/calls/scheduled')) && <div className="absolute inset-0 h-8 w-8 -top-1.5 -left-1.5 rounded-full bg-indigo-500/15 blur-md" />}
                  <Calendar 
                    className={`relative h-5 w-5 transition-colors duration-150 ${(pathname === '/calls/scheduled' || pathname.startsWith('/calls/scheduled')) ? 'text-indigo-600' : 'text-slate-500'}`}
                    strokeWidth={(pathname === '/calls/scheduled' || pathname.startsWith('/calls/scheduled')) ? 2.4 : 1.8}
                  />
                </div>
                <span className={`text-[9px] font-bold transition-colors duration-150 ${(pathname === '/calls/scheduled' || pathname.startsWith('/calls/scheduled')) ? 'text-indigo-600' : 'text-slate-500'}`}>Scheduled</span>
              </button>
            </div>
          </div>

          {/* Raised center Home button */}
          {(() => {
            const homeActive = pathname === '/' || pathname === '/dashboard';
            return (
              <button
                onClick={() => navigate('/')}
                className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center active:scale-90 transition-transform duration-150"
              >
                <div className={`h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 ${
                  homeActive
                    ? 'bg-indigo-600 shadow-[0_4px_20px_rgba(99,102,241,0.5)]'
                    : 'bg-orange-500 shadow-slate-400/30 hover:bg-slate-800'
                }`}>
                  <House className="h-7 w-7 text-white" strokeWidth={homeActive ? 2.4 : 2} />
                </div>
                <span className={`text-[10px] font-bold mt-0.5 transition-colors duration-150 ${homeActive ? 'text-indigo-600' : 'text-slate-500'}`}>
                  Home
                </span>
              </button>
            );
          })()}
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
