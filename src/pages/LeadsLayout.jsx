import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  List, FileSpreadsheet, ArrowRightLeft, History, Plus,
} from 'lucide-react';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

const TABS = [
  { to: '/leads',                    label: 'Leads',   Icon: List },
  { to: '/leads/bulk',               label: 'Import',  Icon: FileSpreadsheet },
  { to: '/leads/assign',             label: 'Assign',  Icon: ArrowRightLeft },
  { to: '/leads/assignment-history', label: 'History', Icon: History },
];

export default function LeadsLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col h-full">
      {/* Sticky editorial header + tabs */}
      <div className="sticky top-0 z-20 bg-background pt-0.5 pb-2.5 -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">Pipeline</p>
            <h1 className="leading-[1.05] tracking-tight flex flex-wrap items-baseline gap-x-2">
              <span className="text-[22px] font-bold text-slate-900">My</span>
              <span className="text-[22px] font-normal italic text-indigo-600" style={serif}>leads.</span>
            </h1>
          </div>
          <Link
            to="/leads/add"
            className="shrink-0 h-9 pl-3 pr-3.5 rounded-full text-[11px] font-bold leading-none flex items-center gap-1.5 bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-300/40 active:scale-95 transition-all duration-150"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Link>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ to, label, Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`shrink-0 h-9 pl-2.5 pr-3.5 rounded-full text-[11px] font-bold leading-none whitespace-nowrap flex items-center gap-1.5 ring-1 ring-inset active:scale-95 transition-all duration-150 ${
                  active
                    ? 'bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-300/40 ring-transparent'
                    : 'bg-white text-slate-600 ring-slate-200'
                }`}
              >
                <Icon className={`h-3 w-3 ${active ? 'text-white/80' : 'text-slate-400'}`} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Sub-page content */}
      <div className="flex-1 min-h-0 space-y-3">
        <Outlet />
      </div>
    </div>
  );
}
