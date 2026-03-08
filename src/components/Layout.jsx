import { useState, Suspense, useEffect, useRef, useTransition } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '@/context/AuthContext';
import { Bell, Menu, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, ChevronRight, LogOut, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';

const routeNames = {
  '/dashboard': 'Dashboard',
  '/leads': 'My Leads',
  '/leads/add': 'Add Lead',
  '/calls': 'Call Dashboard',
  '/calls/log': 'Log Call',
  '/calls/daily-entry': 'Daily Entry',
  '/calls/scheduled': 'Scheduled Calls',
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
  INBOUND:  { icon: PhoneIncoming,  color: 'text-emerald-500' },
  OUTBOUND: { icon: PhoneOutgoing,  color: 'text-sky-500'     },
  MISSED:   { icon: PhoneMissed,    color: 'text-rose-500'    },
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const Layout = () => {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [calls, setCalls] = useState([]);
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
    if (!notifOpen || calls.length > 0) return;
    setCallsLoading(true);
    api.get('/calls?limit=15')
      .then(({ data }) => { if (data.success) setCalls(data.calls ?? []); })
      .catch(() => {})
      .finally(() => setCallsLoading(false));
  }, [notifOpen]);

  const pageTitle = routeNames[pathname]
    || (pathname.includes('/calls/lead/') ? 'Call History'
      : 'Dashboard');

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7fc]">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white shrink-0 z-20 border-b border-slate-200/60 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
         <div className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 md:px-8">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
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
                {calls.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18)] border border-slate-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Recent Calls</p>
                    <button
                      className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                      onClick={() => { setNotifOpen(false); navigate('/calls'); }}
                    >
                      View all <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 [scrollbar-width:thin]">
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
                      <div className="py-8 text-center text-sm text-slate-400">No recent calls</div>
                    ) : (
                      calls.map((c) => {
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
                      })
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                    <button
                      className="w-full text-xs text-center text-indigo-600 hover:underline font-medium"
                      onClick={() => { setNotifOpen(false); startTransition(() => navigate('/calls/analytics')); }}
                    >
                      Open Call Analytics
                    </button>
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

        <main className="flex-1 overflow-y-auto w-full [scrollbar-width:thin] [scrollbar-color:var(--color-slate-200)_transparent] bg-[#f8fafc]">
          <div className="p-5 md:p-8 pb-10 max-w-400 mx-auto">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
