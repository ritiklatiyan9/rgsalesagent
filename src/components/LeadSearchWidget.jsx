import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, X, Phone, ChevronRight, UserCircle2, Target
} from 'lucide-react';

const LEAD_STATUS_STYLE = {
  NEW:         { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'     },
  CONTACTED:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  INTERESTED:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  SITE_VISIT:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  NEGOTIATION: { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200'  },
  BOOKED:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  LOST:        { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-200'    },
};

const AVATAR_PALETTE = [
  'bg-sky-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-amber-500', 'bg-rose-500', 'bg-teal-500',
  'bg-indigo-500', 'bg-orange-500',
];

const avatarBg = (name = '') => AVATAR_PALETTE[(name.charCodeAt(0) || 0) % AVATAR_PALETTE.length];
const initials = (name = '') =>
  (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const HighlightMatch = ({ text = '', query = '' }) => {
  if (!query) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-primary/15 text-primary font-semibold rounded-[2px] px-px">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
};

const LeadSearchWidget = () => {
  const navigate     = useNavigate();
  const [query,      setQuery]     = useState('');
  const [leads,      setLeads]     = useState([]);
  const [loading,    setLoading]   = useState(false);
  const [open,       setOpen]      = useState(false);
  const [activeIdx,  setActiveIdx] = useState(-1);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);

  const doSearch = useCallback(async (q) => {
    try {
      const res = await api.get(`/leads?search=${encodeURIComponent(q)}&limit=10`);
      setLeads(res.data.success ? res.data.leads : []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query) { setLeads([]); setOpen(false); setLoading(false); return; }
    setOpen(true);
    if (query.length < 2) { setLeads([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (lead) => {
    // Navigate to lead details or filtered leads list
    navigate(`/leads?search=${encodeURIComponent(lead.phone || lead.name || '')}`);
    setQuery('');
    setOpen(false);
    setLeads([]);
  };

  const handleKeyDown = (e) => {
    if (!open || leads.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, leads.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
        break;
      case 'Enter':
        if (activeIdx >= 0 && leads[activeIdx]) handleSelect(leads[activeIdx]);
        break;
      case 'Escape':
        setOpen(false);
        inputRef.current?.blur();
        break;
      default: break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && setOpen(true)}
          placeholder="Quick search leads by name or phone..."
          className="pl-10 pr-9 h-10 text-sm bg-white border-border/60 shadow-sm rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all placeholder:text-muted-foreground/60"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        )}
        {!loading && query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-2 w-full bg-white rounded-xl border border-border/50 shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
          {query.length < 2 ? (
            <div className="flex items-center gap-2.5 px-4 py-3.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5 shrink-0" />
              Type at least <strong className="text-foreground mx-0.5">2 characters</strong> to search…
            </div>
          ) : loading ? (
            <div className="p-3 space-y-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-36 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-8 px-4 text-center">
              <UserCircle2 className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No leads found for "{query}"</p>
            </div>
          ) : (
            <div className="p-2">
              {leads.map((lead, idx) => {
                const isActive = idx === activeIdx;
                const ls = LEAD_STATUS_STYLE[lead.status] ?? LEAD_STATUS_STYLE.NEW;
                return (
                  <button
                    key={lead.id}
                    className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-primary/5 ring-1 ring-primary/10' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelect(lead)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <div className={`h-8 w-8 rounded-full ${avatarBg(lead.name)} text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm`}>
                      {initials(lead.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">
                        <HighlightMatch text={lead.name} query={query} />
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        <HighlightMatch text={lead.phone} query={query} />
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${ls.bg} ${ls.text} ${ls.border}`}>
                        {lead.status?.replace('_', ' ')}
                      </span>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/30 ${isActive ? 'translate-x-0.5 text-primary/50' : ''}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadSearchWidget;
