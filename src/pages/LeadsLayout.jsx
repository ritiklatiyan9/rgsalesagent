import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  List, FileSpreadsheet, ArrowRightLeft, History, Plus,
} from 'lucide-react';

const TABS = [
  { to: '/leads',                    label: 'Leads',   Icon: List },
  { to: '/leads/bulk',               label: 'Import',  Icon: FileSpreadsheet },
  { to: '/leads/assign',             label: 'Assign',  Icon: ArrowRightLeft },
  { to: '/leads/assignment-history', label: 'History', Icon: History },
];

export default function LeadsLayout() {
  const { pathname } = useLocation();
  const activeTab = TABS.find((tab) => pathname === tab.to) || TABS[0];

  return (
    <div className="flex flex-col h-full">
      {/* Sticky app header + tabs */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur pt-0.5 pb-2.5 -mx-2 px-2 sm:-mx-5 sm:px-5 md:-mx-8 md:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative flex items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-indigo-500 via-sky-500 to-emerald-400" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline</p>
              </div>
              <h1 className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-slate-950">
                My Leads
              </h1>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{activeTab.label} workspace</p>
            </div>
            <Link
              to="/leads/add"
              className="shrink-0 h-10 pl-3 pr-3.5 rounded-xl text-xs font-semibold leading-none flex items-center gap-1.5 bg-linear-to-r from-indigo-600 to-sky-500 text-white shadow-sm shadow-indigo-300/40 active:scale-95 transition-all duration-150"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Link>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-2 py-2">
            <div className="grid grid-cols-4 gap-1.5">
              {TABS.map(({ to, label, Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`h-9 min-w-0 rounded-xl text-[11px] font-semibold leading-none flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-150 ${
                      active
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-page content */}
      <div className="flex-1 min-h-0 space-y-3">
        <Outlet />
      </div>
    </div>
  );
}
