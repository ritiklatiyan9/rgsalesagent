import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import api, { getAccessToken } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { prefetch } from '@/lib/queryCache';
import {
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UsersRound,
  X,
  Phone,
  CalendarClock,
  PhoneMissed,
  BarChart3,
  Zap,
  UserPlus,
  List,
  Users,
  ClipboardList,
  PhoneCall,
  BellRing,
  Crown,
  TrendingUp,
  Settings,
  History,
  ArrowRightLeft,
  FileSpreadsheet,
  Share2,
  FileText,
  Fingerprint,
  CalendarDays,
  MessageSquare,
  Check,
} from 'lucide-react';
import { PhoneOutgoing } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar as ShadSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://rivergreenbackend.onrender.com';

const getNavItems = (isTeamHead) => {
  const items = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', iconColor: 'text-blue-500' },
    {
      id: 'leads-menu', icon: Users, label: 'Leads', iconColor: 'text-emerald-500',
      subItems: [
        { to: '/leads', icon: List, label: 'My Leads' },
        { to: '/leads/add', icon: UserPlus, label: 'Add Lead' },
        { to: '/leads/bulk', icon: FileSpreadsheet, label: 'Bulk Import' },
        { to: '/leads/assign', icon: ArrowRightLeft, label: 'Assign Leads' },
        { to: '/leads/assignment-history', icon: History, label: 'Assignment History' },
      ]
    },
    {
      id: 'contacts-menu', icon: List, label: 'Contacts', iconColor: 'text-cyan-500',
      subItems: [
        { to: '/all-contacts', icon: List, label: 'All Contacts' },
        { to: '/all-contacts/bulk', icon: FileSpreadsheet, label: 'Bulk Import' },
        { to: '/contacts/shift-to-call', icon: PhoneOutgoing, label: 'Shift to Call' },
        { to: '/calls/dialer', icon: Phone, label: 'Dialer' },
      ]
    },
    {
      id: 'calls-menu', icon: Phone, label: 'Call Management', iconColor: 'text-indigo-500',
      subItems: [
        { to: '/calls', icon: LayoutDashboard, label: 'Call Dashboard' },
        { to: '/calls/dialer', icon: Phone, label: 'Dialer' },
        { to: '/calls/leads-dialer', icon: PhoneCall, label: 'Leads Dialer' },
        { to: '/calls/history', icon: History, label: 'Call History' },
        { to: '/calls/daily', icon: ClipboardList, label: 'Daily Entry' },
        { to: '/calls/scheduled', icon: CalendarClock, label: 'Scheduled' },
        { to: '/calls/missed-followups', icon: BellRing, label: 'Missed Follow Up' },
        { to: '/calls/missed', icon: PhoneMissed, label: 'Missed Calls' },
        { to: '/calls/analytics', icon: BarChart3, label: 'My Analytics' },
      ]
    },
    {
      id: 'content-menu', icon: Share2, label: 'Content Share', iconColor: 'text-green-500',
      subItems: [
        { to: '/content-share', icon: FileText, label: 'Library & Create' },
      ]
    },
    { to: '/reminders', icon: BellRing, label: 'Reminders', iconColor: 'text-amber-500' },
    {
      id: 'attendance-menu', icon: Fingerprint, label: 'Attendance', iconColor: 'text-violet-500',
      subItems: [
        { to: '/attendance', icon: Fingerprint, label: 'Mark Attendance' },
        { to: '/attendance/history', icon: CalendarDays, label: 'My History' },
      ]
    },
    { to: '/chat', icon: MessageSquare, label: 'Chat', iconColor: 'text-green-500' },
  ];

  if (isTeamHead) {
    items.push({
      id: 'team-lead-menu', icon: Crown, label: 'Team Leader', iconColor: 'text-violet-500',
      subItems: [
        { to: '/team', icon: UsersRound, label: 'Team Members' },
        { to: '/team/manage', icon: Settings, label: 'Team Management' },
        { to: '/team/manage/register-agent', icon: UserPlus, label: 'Agent Register' },
        { to: '/team/performance', icon: TrendingUp, label: 'Performance' },
      ]
    });
  } else {
    items.push({ to: '/team', icon: UsersRound, label: 'My Team', iconColor: 'text-orange-500' });
  }

  return items;
};

const PREFETCH_MAP = {
  '/dashboard': ['/leads?page=1&limit=15'],
  '/leads': ['/leads?page=1&limit=15'],
  '/leads/add': [],
  '/leads/assign': ['/leads/assignable-users'],
  '/leads/assignment-history': [],
  '/calls': ['/calls?limit=10', '/followups/counts'],
  '/calls/dialer': ['/calls/outcomes'],
  '/calls/leads-dialer': ['/calls/leads-dialer?page=1&limit=25'],
  '/calls/history': ['/calls?limit=20'],
  '/calls/daily': ['/calls/outcomes'],
  '/calls/scheduled': ['/followups/scheduled'],
  '/calls/missed-followups': ['/followups/missed?limit=20'],
  '/calls/missed': ['/calls?call_type=MISSED&limit=20'],
  '/calls/analytics': ['/calls/analytics'],
  '/all-contacts': ['/contacts?page=1&limit=25'],
  '/all-contacts/bulk': [],
  '/contacts/shift-to-call': ['/calls/shift-to-call?page=1&limit=100'],
  '/reminders': ['/followups/counts'],
  '/content-share': ['/content-share'],
  '/team': [],
  '/team/manage': [],
  '/team/manage/register-agent': [],
  '/team/performance': [],
  '/attendance': ['/attendance/locations/active', '/attendance/my-today'],
  '/attendance/history': ['/attendance/my-history?page=1&limit=31'],
};

function MenuNode({ item, unreadTotal, onChatClick }) {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const isChatItem = item.to === '/chat';

  const isActive = item.to ? (location.pathname === item.to || location.pathname.startsWith(item.to + '/')) : false;
  const hasActiveChild = item.subItems?.some((sub) => location.pathname === sub.to || location.pathname.startsWith(sub.to + '/'));

  const [open, setOpen] = useState(Boolean(hasActiveChild));

  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  const handlePrefetch = useCallback((url) => {
    const urls = PREFETCH_MAP[url];
    if (urls) urls.forEach((u) => prefetch(u));
  }, []);

  const handleItemClick = useCallback(() => {
    if (isChatItem) onChatClick?.();
    if (isMobile) setOpenMobile(false);
  }, [isChatItem, onChatClick, isMobile, setOpenMobile]);

  if (!item.subItems) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} className="relative h-10 rounded-xl text-[14px] font-medium data-[active=true]:bg-indigo-50 data-[active=true]:text-indigo-700 hover:bg-slate-50">
          <NavLink to={item.to} title={item.label} onMouseEnter={() => handlePrefetch(item.to)} onClick={handleItemClick}>
            <span className={cn('h-7 w-7 rounded-lg grid place-items-center transition-colors', isActive ? 'bg-indigo-100' : 'bg-slate-100')}>
              <item.icon className={cn('h-4.5 w-4.5', isActive ? 'text-indigo-700' : (item.iconColor || 'text-blue-500'))} />
            </span>
            <span>{item.label}</span>
            {isChatItem && unreadTotal > 0 && (
              <span className={cn(
                'ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white',
                collapsed && 'absolute right-1 top-1 min-w-4 h-4 px-1 text-[9px]'
              )}>
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={hasActiveChild} className="h-10 rounded-xl text-[14px] font-medium hover:bg-slate-50 data-[active=true]:bg-indigo-50 data-[active=true]:text-indigo-700">
            <span className={cn('h-7 w-7 rounded-lg grid place-items-center transition-colors', hasActiveChild ? 'bg-indigo-100' : 'bg-slate-100')}>
              <item.icon className={cn('h-4.5 w-4.5', hasActiveChild ? 'text-indigo-700' : (item.iconColor || 'text-sky-500'))} />
            </span>
            <span>{item.label}</span>
            <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', hasActiveChild ? 'text-indigo-500' : 'text-slate-400', open && 'rotate-180')} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mt-1 border-slate-200/90">
            {item.subItems.map((sub) => {
              const isSubActive = location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');
              return (
                <SidebarMenuSubItem key={sub.to}>
                  <SidebarMenuSubButton asChild isActive={isSubActive} className="h-8 rounded-lg text-[13.5px]">
                    <NavLink to={sub.to} onMouseEnter={() => handlePrefetch(sub.to)} onClick={() => isMobile && setOpenMobile(false)}>
                      <sub.icon className="h-4.5 w-4.5" />
                      <span>{sub.label}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function SidebarInner() {
  const { user, isTeamHead, logout, sites, activeSiteId, switchSite, siteLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { open, setOpen, openMobile, setOpenMobile } = useSidebar();
  const navItems = useMemo(() => getNavItems(isTeamHead), [isTeamHead]);
  const [chatUnreadTotal, setChatUnreadTotal] = useState(0);
  const currentPathRef = useRef(location.pathname);

  useEffect(() => {
    currentPathRef.current = location.pathname;
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  useEffect(() => {
    if (/^\/chat\/?$/.test(location.pathname)) {
      setChatUnreadTotal(0);
    }
  }, [location.pathname]);

  const loadUnreadFromConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/conversations');
      if (!data?.success || !Array.isArray(data.conversations)) return;
      const hasServerUnread = data.conversations.some((conv) => (
        conv?.unread_count !== undefined || conv?.unreadCount !== undefined
      ));
      if (!hasServerUnread) return;
      const total = data.conversations.reduce((sum, conv) => {
        const raw = conv?.unread_count ?? conv?.unreadCount ?? 0;
        const count = Number(raw);
        return sum + (Number.isFinite(count) && count > 0 ? count : 0);
      }, 0);
      setChatUnreadTotal(total);
    } catch {
      // Ignore intermittent chat fetch issues for sidebar.
    }
  }, []);

  useEffect(() => {
    let socket;
    const token = getAccessToken();
    if (!token || !user?.id) return;

    loadUnreadFromConversations();

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('chat:message', (msg) => {
      const senderId = String(msg?.sender_id ?? msg?.senderId ?? '');
      if (senderId === String(user.id)) return;
      if (/^\/chat\/?$/.test(currentPathRef.current)) return;
      setChatUnreadTotal((prev) => prev + 1);
    });

    return () => {
      socket?.disconnect();
    };
  }, [user?.id, loadUnreadFromConversations]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSiteChange = async (siteId) => {
    const switched = await switchSite(siteId);
    if (switched) {
      setOpenMobile(false);
    }
  };

  return (
    <ShadSidebar collapsible="icon" className="border-r border-slate-200/70 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <SidebarHeader className="relative border-b border-slate-100 px-3 py-4">
        <button
          onClick={() => setOpen((v) => !v)}
          className="hidden md:flex absolute right-2 top-3 h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600"
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-3 pr-9">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 shadow-sm">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-[16px] font-semibold tracking-tight text-slate-800">RiverGreen</div>
            <div className="truncate text-[12px] text-slate-500">{isTeamHead ? 'Team Head Portal' : 'Agent Portal'}</div>
          </div>
        </div>

        <div className="mt-3 pr-9 group-data-[collapsible=icon]:hidden">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Active Site</div>
          <Select
            value={activeSiteId || undefined}
            onValueChange={handleSiteChange}
            disabled={siteLoading || !sites?.length}
          >
            <SelectTrigger className="h-8 bg-slate-50 text-[12px]">
              <SelectValue placeholder={sites?.length ? 'Select site' : 'No site available'} />
            </SelectTrigger>
            <SelectContent>
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

        <button
          className="absolute right-2 top-3 rounded-full bg-slate-100 p-2 text-slate-500 md:hidden"
          onClick={() => setOpenMobile(false)}
          title="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </SidebarHeader>

      <SidebarContent
        className="min-h-0 overflow-y-auto px-0 py-0 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-slate-200/60"
        style={{ scrollbarColor: '#94a3b8 #e2e8f0' }}
      >
        <div className="px-2 py-3">
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500 group-data-[collapsible=icon]:hidden">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="mt-1 gap-0.5">
                {navItems.map((item, idx) => (
                  <MenuNode
                    key={item.id || item.to || idx}
                    item={item}
                    unreadTotal={chatUnreadTotal}
                    onChatClick={() => setChatUnreadTotal(0)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:hidden">
          <div className="h-9 w-9 overflow-hidden rounded-lg border border-indigo-100 bg-indigo-50">
            {user?.profile_photo ? (
              <img src={user.profile_photo} alt={user?.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center">
                <Zap className="h-4.5 w-4.5 text-indigo-600" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-slate-800">{user?.name || 'Agent'}</div>
            <div className="truncate text-[11.5px] text-slate-500">{user?.email || 'agent@rivergreen.com'}</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className={cn(
            'mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[14px] font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700',
            !open && 'justify-center px-0'
          )}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
          <span className="group-data-[collapsible=icon]:hidden">Logout</span>
        </button>
      </SidebarFooter>
    </ShadSidebar>
  );
}

export default function Sidebar(props) {
  return <SidebarInner {...props} />;
}
