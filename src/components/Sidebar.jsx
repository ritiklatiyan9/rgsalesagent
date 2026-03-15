import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { prefetch } from '@/lib/queryCache';
import {
  LayoutDashboard, LogOut, ChevronLeft, ChevronRight, ChevronDown,
  UsersRound, Layers, X, Phone, PhoneOutgoing,
  CalendarClock, PhoneMissed, BarChart3, Zap,
  UserPlus, List, Map, MapPin, BookOpen, DollarSign,
  Activity, CreditCard, Users, ClipboardList, PhoneCall,
  BellRing, Crown, TrendingUp, Settings, History, ArrowRightLeft, FileSpreadsheet,
  Share2, FileText, Send,
  Fingerprint, CalendarDays, ClipboardCheck,
  MessageSquare,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

// forwardRef wrappers to avoid React 19 "element.ref" warning from Radix asChild
const FwdNavLink = React.forwardRef(({ to, onMouseEnter, children, ...props }, ref) => (
  <NavLink ref={ref} to={to} onMouseEnter={onMouseEnter} {...props}>{children}</NavLink>
));
FwdNavLink.displayName = 'FwdNavLink';

const FwdDiv = React.forwardRef(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>{children}</div>
));
FwdDiv.displayName = 'FwdDiv';

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
    {
      id: 'colony-menu', icon: Map, label: 'Colony Maps', iconColor: 'text-rose-500',
      subItems: [
        { to: '/colony-maps', icon: Map, label: 'View Maps' },
        { to: '/colony-maps/plots', icon: MapPin, label: 'All Plots' },
      ]
    },
    {
      id: 'bookings-menu', icon: BookOpen, label: 'Bookings & Sales', iconColor: 'text-blue-500',
      subItems: [
        { to: '/bookings', icon: CreditCard, label: 'My Bookings' },
      ]
    },
    { to: '/chat', icon: MessageSquare, label: 'Chat', iconColor: 'text-green-500' },
  ];

  // Team Lead exclusive section — use isTeamHead flag, NOT user.role
  // (assignTeamHead sets team.head_id but never changes users.role in DB)
  if (isTeamHead) {
    items.push({
      id: 'team-lead-menu', icon: Crown, label: 'Team Leader', iconColor: 'text-violet-500',
      subItems: [
        { to: '/team', icon: UsersRound, label: 'Team Members' },
        { to: '/team/manage', icon: Settings, label: 'Team Management' },
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
  '/calls/missed': ['/followups/missed'],
  '/calls/analytics': ['/calls/analytics'],
  '/all-contacts': ['/contacts?page=1&limit=25'],
  '/all-contacts/bulk': [],
  '/reminders': ['/followups/counts'],
  '/colony-maps': ['/colony-maps'],
  '/colony-maps/plots': ['/colony-maps'],
  '/bookings': ['/bookings?page=1&limit=12', '/bookings/stats'],
  '/content-share': ['/content-share'],
  '/team': [],
  '/team/manage': [],
  '/team/performance': [],
  '/attendance': ['/attendance/locations/active', '/attendance/my-today'],
  '/attendance/history': ['/attendance/my-history?page=1&limit=31'],
};

const NavItem = ({ item, collapsed }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = item.to ? (location.pathname === item.to || location.pathname.startsWith(item.to + '/')) : false;
  const hasActiveChild = item.subItems?.some(sub => location.pathname === sub.to || location.pathname.startsWith(sub.to + '/'));

  useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  const handlePrefetch = useCallback((url) => {
    const urls = PREFETCH_MAP[url];
    if (urls) urls.forEach((u) => prefetch(u));
  }, []);

  if (collapsed) {
    const active = isActive || hasActiveChild;
    const content = (
      <div className={cn(
        "flex items-center justify-center shrink-0 transition-all duration-300 rounded-2xl w-11 h-11 mx-auto my-1",
        active ? "bg-slate-100" : "bg-transparent hover:bg-slate-50"
      )}>
        <item.icon className={cn("w-5 h-5", active ? "text-[#1e6091]" : "text-slate-400")} strokeWidth={active ? 2.5 : 2} />
      </div>
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {item.to ? (
            <FwdNavLink to={item.to} onMouseEnter={() => handlePrefetch(item.to)}>
              {content}
            </FwdNavLink>
          ) : (
            <FwdDiv onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
              {content}
            </FwdDiv>
          )}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="font-semibold text-xs border-none shadow-md">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (item.subItems) {
    return (
      <div className="flex flex-col mb-1.5">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors font-medium text-[14.5px] text-slate-700 hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <item.icon className={cn("w-5.5 h-5.5", item.iconColor || "text-sky-500")} strokeWidth={hasActiveChild ? 2.5 : 2} />
            <span className="truncate">{item.label}</span>
          </div>
          <ChevronDown className={cn("w-4.5 h-4.5 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>

        {isOpen && (
          <div className="flex flex-col ml-5.5 pl-4 border-l border-slate-200 space-y-1 mt-1 mb-2">
            {item.subItems.map((sub) => {
              const isSubActive = location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');
              return (
                <NavLink
                  key={sub.to}
                  to={sub.to}
                  onMouseEnter={() => handlePrefetch(sub.to)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-[14px] transition-colors",
                    isSubActive ? "text-blue-600 bg-slate-50/50" : "text-slate-600 hover:text-blue-600 hover:bg-slate-50/50"
                  )}
                >
                  <sub.icon className="w-4.5 h-4.5" strokeWidth={isSubActive ? 2.5 : 2} />
                  <span>{sub.label}</span>
                </NavLink>
              )
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      onMouseEnter={() => handlePrefetch(item.to)}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-[14.5px] transition-colors outline-none mb-1.5",
        isActive ? "bg-[#f0f4f8] text-[#1e6091]" : "text-slate-700 hover:bg-slate-50"
      )}
    >
      <item.icon className={cn("w-5.5 h-5.5", isActive ? "text-[#1e6091]" : (item.iconColor || "text-blue-500"))} strokeWidth={isActive ? 2.5 : 2} />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
};

const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen }) => {
  const { user, isTeamHead, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

  const toggleSidebar = () => setCollapsed(!collapsed);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        'fixed md:relative z-50 flex flex-col bg-white shrink-0 transition-all duration-300 ease-in-out shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-100',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'md:w-22' : 'w-70',
        'h-dvh overflow-visible block'
      )}>
        {mobileMenuOpen && (
          <button
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 md:hidden bg-slate-100 rounded-full"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={toggleSidebar}
          className="hidden md:flex absolute -right-3.5 top-11 w-7 h-7 bg-white border border-slate-200 rounded-full items-center justify-center shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors z-60"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex flex-col overflow-y-auto relative h-full [scrollbar-width:auto] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
          <div className={cn(
            "flex items-center shrink-0 pt-8 pb-6",
            collapsed ? "justify-center px-2" : "px-5"
          )}>
            <div className="flex items-center gap-3 w-full">
              <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-indigo-700/20">
                <Zap className="w-7 h-7 text-white drop-shadow-sm" />
              </div>
              {!collapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="font-semibold text-[17px] text-slate-800 leading-tight truncate tracking-tight">
                    RiverGreen
                  </span>
                  <span className="text-[13px] text-slate-500 mt-0.5 tracking-wide">{isTeamHead ? 'Team Lead Portal' : 'Agent Portal'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 mt-2 mb-4">
            {!collapsed && (
              <div className="text-[13.5px] text-slate-500 mb-3 px-2 font-medium">Navigation</div>
            )}
            <nav className="space-y-1">
              {getNavItems(isTeamHead).map((item, idx) => (
                <NavItem key={item.id || item.to || idx} item={item} collapsed={collapsed} />
              ))}
            </nav>
          </div>

          <div className="p-4 mt-auto space-y-4 pb-10">
            {!collapsed && (
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm overflow-hidden">
                  {user?.profile_photo ? (
                    <img src={user.profile_photo} alt={user?.name} className="h-full w-full object-cover" />
                  ) : (
                    <Zap className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-[14px] font-semibold text-slate-800 truncate tracking-tight">{user?.name || 'Agent'}</span>
                  <span className="text-[12px] text-slate-500 truncate">{user?.email || 'agent@rivergreen.com'}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-3 w-full text-[#e63946] hover:text-red-700 transition-colors py-1",
                collapsed ? "justify-center" : "px-2"
              )}
              title="Logout"
            >
              <LogOut className="w-5 h-5" strokeWidth={2.5} />
              {!collapsed && <span className="font-medium text-[15px]">Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
