import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, Search, ChevronLeft, ChevronRight, MapPin,
  Download, Loader2, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Status palette uses subtle bg + dot to keep the list calm and scannable
// on a phone — no large coloured banners on every card.
const STATUS_META = {
  PENDING_APPROVAL: { label: 'Pending',     dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  ACTIVE:           { label: 'Active',      dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  COMPLETED:        { label: 'Done',        dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  CANCELLED:        { label: 'Cancelled',   dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50' },
  TRANSFERRED:      { label: 'Transferred', dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50' },
};

const FILTERS = [
  { value: '',                  label: 'All' },
  { value: 'PENDING_APPROVAL',  label: 'Pending' },
  { value: 'ACTIVE',            label: 'Active' },
  { value: 'COMPLETED',         label: 'Done' },
  { value: 'CANCELLED',         label: 'Cancelled' },
];

// Compact INR — "₹1.2L" instead of "₹1,20,000" on tight mobile cards.
const fmtCompact = (v) => {
  const n = Number(v || 0);
  if (n >= 10000000) return `₹${(n/10000000).toFixed(n % 10000000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000)     return `₹${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `₹${n}`;
};

const PlotBookings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleQuickDownload = async (e, booking) => {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(booking.id);
    try {
      const [{ downloadBookingReceipt }, { data }] = await Promise.all([
        import('@/lib/bookingReceipt'),
        api.get(`/bookings/${booking.id}`),
      ]);
      const full = data?.booking || booking;
      await downloadBookingReceipt(full, data?.payments || [], data?.paymentSummary || null, {
        agentName: user?.name || full.booked_by_name,
      });
      toast.success('Receipt ready');
    } catch (err) {
      console.error('[receipt]', err);
      toast.error(err?.message || 'Could not generate receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/bookings?${params}`);
      if (data.success) {
        setBookings(data.bookings);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings/stats');
      if (data.success) setStats(data.stats);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="pb-24 md:pb-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight">My Bookings</h1>
        <span className="text-[12px] text-slate-500 font-medium">{total} total</span>
      </div>

      {/* Stats — 2x2 on mobile, 4 cols at sm+ */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <StatPill label="Bookings" value={stats.total_bookings || 0}     accent="text-slate-800" />
          <StatPill label="Active"   value={stats.active_bookings || 0}    accent="text-blue-600" />
          <StatPill label="Done"     value={stats.completed_bookings || 0} accent="text-emerald-600" />
          <StatPill label="Value"    value={fmtCompact(stats.total_value || 0)} accent="text-violet-600" />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search client, phone, plot…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white ring-1 ring-slate-200 focus:ring-slate-400 outline-none text-[14px] placeholder:text-slate-400 transition-shadow"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setPage(1); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100 active:scale-90 transition"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Filter chips — horizontal scroll, hides scrollbar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const active = statusFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`shrink-0 px-3.5 h-8 rounded-full text-[12px] font-semibold transition-all ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2.5">
          {bookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              downloading={downloadingId === b.id}
              onOpen={() => navigate(`/bookings/${b.id}`)}
              onDownload={(e) => handleQuickDownload(e, b)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-2 pt-5">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="h-10 w-10 rounded-xl bg-white ring-1 ring-slate-200 disabled:opacity-40 flex items-center justify-center active:scale-95 transition"
          >
            <ChevronLeft className="w-4 h-4 text-slate-700" />
          </button>
          <span className="text-[13px] text-slate-600 font-semibold px-3 tabular-nums">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="h-10 w-10 rounded-xl bg-white ring-1 ring-slate-200 disabled:opacity-40 flex items-center justify-center active:scale-95 transition"
          >
            <ChevronRight className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      )}
    </div>
  );
};

function StatPill({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-100 p-3">
      <p className={`text-[18px] font-bold tabular-nums leading-tight truncate ${accent}`}>{value}</p>
      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function BookingCard({ booking, downloading, onOpen, onDownload }) {
  const status = STATUS_META[booking.status]
    || { label: booking.status || '—', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50' };
  const paid = Number(booking.total_paid || 0);
  const totalAmt = Number(booking.total_amount || 0);
  const pct = totalAmt > 0 ? Math.min(100, Math.round((paid / totalAmt) * 100)) : 0;

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-2xl ring-1 ring-slate-100 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] p-4 cursor-pointer active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start gap-3">
        {/* Plot badge — square chip with plot number */}
        <div className="shrink-0 h-12 w-12 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 flex flex-col items-center justify-center">
          <MapPin className="w-3 h-3 opacity-70" />
          <span className="text-[10px] font-bold mt-0.5 leading-none truncate max-w-[44px]">
            {booking.plot_number?.toString().slice(0, 6) || '—'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-bold text-slate-900 truncate">{booking.client_name || '—'}</p>
            <span className={`shrink-0 inline-flex items-center gap-1.5 ${status.bg} ${status.text} text-[10px] font-bold px-2 h-5 rounded-full uppercase tracking-wide`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <p className="text-[12px] text-slate-500 truncate">{booking.client_phone || '—'}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {booking.colony_name || 'RiverGreen'} · Plot {booking.plot_number}
          </p>
        </div>
      </div>

      {/* Progress + amount */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-emerald-700 tabular-nums">{fmtCompact(paid)}</span>
          <span className="text-slate-400 tabular-nums">of {fmtCompact(totalAmt)} · {pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Download CTA — single primary action; "View Details" handled by tapping card */}
      <button
        onClick={onDownload}
        disabled={downloading}
        className="mt-3 w-full h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed text-emerald-700 text-[12px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
      >
        {downloading
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…</>
          : <><Download className="w-3.5 h-3.5" /> Download Receipt</>}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-white ring-1 ring-slate-100 p-10 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
        <BookOpen className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-[15px] font-semibold text-slate-800">No Bookings Yet</p>
      <p className="text-[12px] text-slate-500 mt-1 max-w-[260px] mx-auto">
        Bookings tied to your referral code will appear here.
      </p>
    </div>
  );
}

export default PlotBookings;
