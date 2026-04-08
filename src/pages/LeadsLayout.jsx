import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  List, FileSpreadsheet, ArrowRightLeft, History, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const TABS = [
  { to: '/leads',                    label: 'Leads',   Icon: List },
  { to: '/leads/bulk',               label: 'Import',  Icon: FileSpreadsheet },
  { to: '/leads/assign',             label: 'Assign',  Icon: ArrowRightLeft },
  { to: '/leads/assignment-history', label: 'History', Icon: History },
];

export default function LeadsLayout() {
  const { pathname } = useLocation();

  return (
    <div className="space-y-2">
      {/* Persistent header — always visible regardless of sub-page */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-slate-800">My Leads</h1>
        <Link to="/leads/add">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs gap-1 rounded-lg px-3">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </Link>
      </div>

      {/* Persistent tab bar — stays frozen on navigation */}
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

      {/* Sub-page content rendered here */}
      <Outlet />
    </div>
  );
}
