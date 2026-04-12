import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, X, Phone, ChevronRight, UserCircle2, Target, Users
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

const CONTACT_STATUS_STYLE = {
  bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200',
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

const LeadSearchWidget = ({ category = 'ALL', dark = false }) => {
  const navigate     = useNavigate();
  const [query,      setQuery]     = useState('');
  const [results,    setResults]   = useState([]);
  const [loading,    setLoading]   = useState(false);
  const [open,       setOpen]      = useState(false);
  const [activeIdx,  setActiveIdx] = useState(-1);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef  = useRef(null);
  const debounceRef  = useRef(null);
  const [dropPos,    setDropPos]   = useState({ top: 0, left: 0, width: 0 });

  const measureDrop = useCallback(() => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  const doSearch = useCallback(async (q) => {
    try {
      const catParam = category && category !== 'ALL' ? `&lead_category=${encodeURIComponent(category)}` : '';
      const [leadsRes, contactsRes] = await Promise.allSettled([
        api.get(`/leads?search=${encodeURIComponent(q)}&limit=6${catParam}`),
        api.get(`/contacts?search=${encodeURIComponent(q)}&limit=4${catParam}`),
      ]);

      const leads = (leadsRes.status === 'fulfilled' && leadsRes.value.data.success)
        ? leadsRes.value.data.leads.map((l) => ({ ...l, _type: 'lead' }))
        : [];
      const contacts = (contactsRes.status === 'fulfilled' && contactsRes.value.data.success)
        ? contactsRes.value.data.contacts.map((c) => ({ ...c, _type: 'contact' }))
        : [];

      setResults([...leads, ...contacts]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query) { setResults([]); setOpen(false); setLoading(false); return; }
    setOpen(true);
    if (query.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(query), 50);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  useEffect(() => {
    const handler = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    measureDrop();
    const onScroll = () => measureDrop();
    const onResize = () => measureDrop();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, measureDrop]);

  const handleSelect = (item) => {
    const searchVal = encodeURIComponent(item.name || item.phone || '');
    if (item._type === 'contact') {
      navigate(`/all-contacts?search=${searchVal}`);
    } else {
      navigate(`/leads?search=${searchVal}`);
    }
    setQuery('');
    setOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        if (open && results.length > 0) {
          e.preventDefault();
          setActiveIdx((i) => Math.min(i + 1, results.length - 1));
        }
        break;
      case 'ArrowUp':
        if (open && results.length > 0) {
          e.preventDefault();
          setActiveIdx((i) => Math.max(i - 1, -1));
        }
        break;
      case 'Enter':
        if (open && activeIdx >= 0 && results[activeIdx]) {
          e.preventDefault();
          handleSelect(results[activeIdx]);
        } else if (query.trim().length >= 2) {
          e.preventDefault();
          navigate(`/leads?search=${encodeURIComponent(query.trim())}`);
          setOpen(false);
        }
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
        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${dark ? 'text-slate-400' : 'text-muted-foreground'}`} />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && setOpen(true)}
          placeholder="Search leads & contacts by name or phone..."
          className={`w-full min-w-0 pl-10 pr-9 h-10 text-sm shadow-sm rounded-xl focus-visible:ring-2 transition-all placeholder:text-muted-foreground/60 ${
            dark
              ? 'bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-violet-500/40 focus-visible:border-violet-400/60'
              : 'bg-white border-black/40 text-foreground focus-visible:ring-primary/20 focus-visible:border-primary/50'
          }`}
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
            className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${dark ? 'text-slate-400 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="bg-white rounded-xl border border-slate-200 shadow-[0_8px_32px_rgba(0,0,0,0.16)] overflow-hidden max-h-80 overflow-y-auto"
        >
          {query.length < 1 ? (
            <div className="flex items-center gap-2.5 px-4 py-3.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5 shrink-0" />
              Start typing to search…
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
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-8 px-4 text-center">
              <UserCircle2 className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-2">
              {results.map((item, idx) => {
                const isActive = idx === activeIdx;
                const isContact = item._type === 'contact';
                const ls = isContact ? CONTACT_STATUS_STYLE : (LEAD_STATUS_STYLE[item.status] ?? LEAD_STATUS_STYLE.NEW);
                return (
                  <button
                    key={`${item._type}-${item.id}`}
                    className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-primary/5 ring-1 ring-primary/10' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <div className={`h-8 w-8 rounded-full ${avatarBg(item.name)} text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm`}>
                      {initials(item.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">
                        <HighlightMatch text={item.name} query={query} />
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        <HighlightMatch text={item.phone} query={query} />
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${ls.bg} ${ls.text} ${ls.border}`}>
                        {isContact ? 'CONTACT' : (item.status?.replace('_', ' ') || 'LEAD')}
                      </span>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/30 ${isActive ? 'translate-x-0.5 text-primary/50' : ''}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default LeadSearchWidget;
