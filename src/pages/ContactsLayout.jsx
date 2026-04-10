import { Outlet, Link, useLocation } from 'react-router-dom';
import { Users, PhoneOutgoing, History, FileSpreadsheet } from 'lucide-react';

const TABS = [
  { to: '/all-contacts',            label: 'Contacts',     Icon: Users },
  { to: '/contacts/shift-to-call',  label: 'Shift to Call',Icon: PhoneOutgoing },
  { to: '/calls/history',           label: 'Call History', Icon: History },
  { to: '/all-contacts/bulk',       label: 'Import',       Icon: FileSpreadsheet },
];

export default function ContactsLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header: title + tabs */}
      <div className="sticky top-0 z-20 bg-background pt-0.5 pb-2 -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 space-y-2">
        <h1 className="text-base font-semibold text-slate-800">All Contacts</h1>

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5 w-max border border-border/30">
            {TABS.map(({ to, label, Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white shadow-sm text-indigo-700 font-semibold border border-border/60'
                      : 'text-muted-foreground font-medium hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sub-page content */}
      <div className="flex-1 min-h-0 space-y-2">
        <Outlet />
      </div>
    </div>
  );
}
