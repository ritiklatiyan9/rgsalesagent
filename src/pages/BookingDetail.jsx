import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  ArrowLeft, User, CreditCard, ImageIcon, CheckCircle2,
  MapPin, Phone, Mail, Calendar, Hash, X, Download, Loader2, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://rivergreenbackend.onrender.com';

const STATUS_META = {
  PENDING_APPROVAL: { label: 'Pending',     dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  ACTIVE:           { label: 'Active',      dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  COMPLETED:        { label: 'Done',        dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  CANCELLED:        { label: 'Cancelled',   dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50' },
  TRANSFERRED:      { label: 'Transferred', dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50' },
};

const PAY_STATUS = {
  COMPLETED: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  PENDING:   { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  CANCELLED: { dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50' },
  REFUNDED:  { dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50' },
};

const fmt = (v) => Number(v || 0).toLocaleString('en-IN');
const fmtCompact = (v) => {
  const n = Number(v || 0);
  if (n >= 10000000) return `₹${(n/10000000).toFixed(n % 10000000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000)     return `₹${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `₹${n}`;
};
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomImg, setZoomImg] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!booking || downloading) return;
    setDownloading(true);
    try {
      const { downloadBookingReceipt } = await import('@/lib/bookingReceipt');
      await downloadBookingReceipt(booking, payments, summary, {
        agentName: user?.name || booking.booked_by_name,
      });
      toast.success('Receipt ready');
    } catch (err) {
      console.error('[receipt]', err);
      toast.error(err?.message || 'Could not generate receipt');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const { data } = await api.get(`/bookings/${id}`);
        if (data.success) {
          setBooking(data.booking);
          setPayments(data.payments || []);
          setSummary(data.paymentSummary || null);
        }
      } catch { toast.error('Failed to load booking'); }
      finally { setLoading(false); }
    };
    fetchBooking();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-3 pb-20 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-4">Booking not found</p>
        <button
          onClick={() => navigate('/bookings')}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-10 text-sm font-semibold transition-colors"
        >
          Back to bookings
        </button>
      </div>
    );
  }

  const status = STATUS_META[booking.status]
    || { label: booking.status || '—', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50' };
  const paid = Number(summary?.total_paid || booking.total_paid || 0);
  const totalAmt = Number(booking.total_amount || 0);
  const bookingAmt = Number(booking.booking_amount || 0);
  const remaining = Math.max(0, totalAmt - paid);
  const pct = totalAmt > 0 ? Math.min(100, Math.round((paid / totalAmt) * 100)) : 0;

  const bookingScreenshots = (() => {
    try {
      const urls = typeof booking.screenshot_urls === 'string'
        ? JSON.parse(booking.screenshot_urls) : (booking.screenshot_urls || []);
      return Array.isArray(urls) ? urls.filter(Boolean) : [];
    } catch { return []; }
  })();

  return (
    <div className="pb-24 md:pb-6 max-w-3xl mx-auto">
      {/* Sticky compact app-bar */}
      <div className="sticky top-0 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 sm:py-3 bg-slate-50/85 backdrop-blur-md border-b border-slate-200/60 sm:border-0 sm:bg-transparent sm:backdrop-blur-none mb-3 sm:mb-4">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/bookings')}
            aria-label="Back"
            className="shrink-0 h-9 w-9 rounded-full bg-white ring-1 ring-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-slate-900 truncate leading-tight">
              Plot {booking.plot_number}
            </h1>
            <p className="text-[11px] text-slate-500 truncate leading-tight">
              {booking.colony_name || 'RiverGreen'}
              {booking.booking_source === 'PUBLIC' && <> · <span className="text-blue-600 font-semibold">Public</span></>}
            </p>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 ${status.bg} ${status.text} text-[10px] font-bold px-2 h-5 rounded-full uppercase tracking-wide`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* Hero amount card — light theme, emerald tint with subtle gradient */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-white ring-1 ring-emerald-100 p-5 sm:p-6 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.2)]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">Total Paid</p>
          <p className="text-[34px] sm:text-[42px] font-bold leading-none mt-1.5 tabular-nums text-slate-900">
            ₹{fmt(paid)}
          </p>
          <p className="text-[12px] text-slate-500 mt-1.5">of ₹{fmt(totalAmt)}  ·  {pct}% paid</p>

          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-4">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-emerald-100/70">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500">Total</p>
              <p className="text-[14px] font-bold text-slate-800 mt-0.5 tabular-nums">{fmtCompact(totalAmt)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500">Paid</p>
              <p className="text-[14px] font-bold text-emerald-600 mt-0.5 tabular-nums">{fmtCompact(paid)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-500">Balance</p>
              <p className={`text-[14px] font-bold mt-0.5 tabular-nums ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {fmtCompact(remaining)}
              </p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="mt-5 w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-[0_6px_18px_-4px_rgba(16,185,129,0.5)]"
          >
            {downloading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing receipt…</>
              : <><Download className="w-4 h-4" /> Download Receipt</>}
          </button>
        </div>

        {/* Client */}
        <Section title="Client" icon={User}>
          <div className="flex items-start gap-3 mb-2">
            <div className="shrink-0 h-10 w-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[15px]">
              {(booking.client_name || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-slate-900 truncate leading-tight">
                {booking.client_name || '—'}
              </p>
              {booking.client_phone && (
                <a
                  href={`tel:${booking.client_phone}`}
                  className="text-[12px] text-blue-600 inline-flex items-center gap-1.5 mt-0.5"
                >
                  <Phone className="w-3 h-3" /> {booking.client_phone}
                </a>
              )}
            </div>
          </div>

          {booking.client_email && (
            <Row icon={Mail} label="Email" value={booking.client_email} />
          )}
          {booking.booked_by_name && (
            <Row
              icon={BadgeCheck}
              label="Booked by"
              value={
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  {booking.booked_by_name}
                  {booking.booked_by_sponsor_code && (
                    <span className="inline-flex items-center text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 h-4 rounded-full ring-1 ring-blue-200 font-mono">
                      {booking.booked_by_sponsor_code}
                    </span>
                  )}
                </span>
              }
            />
          )}
          {booking.referred_by_name && booking.referred_by !== booking.booked_by && (
            <Row
              icon={BadgeCheck}
              label="Referred by"
              value={
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  {booking.referred_by_name}
                  {booking.referred_by_sponsor_code && (
                    <span className="inline-flex items-center text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 h-4 rounded-full ring-1 ring-violet-200 font-mono">
                      {booking.referred_by_sponsor_code}
                    </span>
                  )}
                </span>
              }
            />
          )}
          {booking.approved_by_name && (
            <Row icon={CheckCircle2} label="Approved by" value={booking.approved_by_name} />
          )}
        </Section>

        {/* Property */}
        <Section title="Property" icon={MapPin}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <KV label="Colony" value={booking.colony_name} />
            <KV label="Plot No." value={booking.plot_number} />
            <KV label="Block" value={booking.block} />
            <KV label="Type" value={booking.plot_type} />
            <KV label="Area" value={booking.area_sqft ? `${booking.area_sqft} sqft` : null} />
            <KV label="Facing" value={booking.facing} />
            <KV label="Dimensions" value={booking.dimensions} />
            <KV
              label="Plan"
              value={
                booking.payment_type === 'INSTALLMENT'
                  ? `Inst. (${booking.installment_count || 1}× ${booking.installment_frequency || ''})`.trim()
                  : 'One-Time'
              }
            />
          </div>
          <Row icon={Calendar} label="Booked on" value={fmtDate(booking.booking_date || booking.created_at)} />
          <Row icon={Hash} label="Booking amt" value={`₹${fmt(bookingAmt)}`} />
          {booking.notes && (
            <div className="mt-2.5 p-3 rounded-xl bg-slate-50 ring-1 ring-slate-100">
              <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wide mb-1">Notes</p>
              <p className="text-[12px] text-slate-700 leading-relaxed">{booking.notes}</p>
            </div>
          )}
        </Section>

        {/* Payments */}
        {payments.length > 0 && (
          <Section title="Payments" icon={CreditCard} badge={`${payments.length}`}>
            <div className="space-y-2">
              {payments.map((p, i) => (
                <PaymentRow key={p.id || i} p={p} idx={i} onZoom={setZoomImg} />
              ))}
            </div>

            {summary && (
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                <SummaryLine label="Paid" value={`₹${fmt(summary.total_paid)}`} color="text-emerald-700" />
                <SummaryLine label="Pending" value={`₹${fmt(summary.total_pending)}`} color="text-amber-700" />
                {Number(summary.overdue_count) > 0 && (
                  <SummaryLine label="Overdue" value={summary.overdue_count} color="text-rose-700" />
                )}
                {summary.next_due_date && (
                  <SummaryLine label="Next due" value={fmtDate(summary.next_due_date)} color="text-slate-700" />
                )}
              </div>
            )}
          </Section>
        )}

        {/* Screenshots */}
        {bookingScreenshots.length > 0 && (
          <Section title="Screenshots" icon={ImageIcon} badge={`${bookingScreenshots.length}`}>
            <div className="grid grid-cols-3 gap-2">
              {bookingScreenshots.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setZoomImg(`${API_BASE}${url}`)}
                  className="relative rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-50 active:scale-95 transition-transform aspect-square"
                >
                  <img
                    src={`${API_BASE}${url}`}
                    alt={`Screenshot ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                    #{i + 1}
                  </span>
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Image zoom dialog */}
      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-3xl p-2 rounded-2xl bg-black/95 border-none">
          <button
            onClick={() => setZoomImg(null)}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/40 rounded-full p-1.5 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          {zoomImg && (
            <img
              src={zoomImg}
              alt="Screenshot"
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Small primitives ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, badge, children }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 p-4 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-700">{title}</h3>
        </div>
        {badge != null && (
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 h-5 rounded-full inline-flex items-center tabular-nums">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-[12px] text-slate-500 w-20 shrink-0">{label}</span>
      <span className="text-[13px] text-slate-800 font-medium flex-1 min-w-0 truncate">{value || '—'}</span>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div className="bg-slate-50/70 rounded-xl p-2.5">
      <p className="text-[10px] font-medium uppercase text-slate-400 tracking-wide">{label}</p>
      <p className="text-[13px] text-slate-800 font-semibold mt-0.5 truncate">{value || '—'}</p>
    </div>
  );
}

function SummaryLine({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <strong className={`tabular-nums ${color}`}>{value}</strong>
    </div>
  );
}

function PaymentRow({ p, idx, onZoom }) {
  const status = PAY_STATUS[p.status]
    || { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50' };
  const isOverdue = p.status === 'PENDING' && p.due_date && new Date(p.due_date) < new Date();

  const screenshots = (() => {
    try {
      const urls = typeof p.screenshot_urls === 'string'
        ? JSON.parse(p.screenshot_urls) : (p.screenshot_urls || []);
      return Array.isArray(urls) ? urls.filter(Boolean) : [];
    } catch { return []; }
  })();

  return (
    <div className={`rounded-xl p-3 ring-1 ${isOverdue ? 'bg-rose-50/40 ring-rose-200' : 'bg-slate-50/50 ring-slate-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              {p.payment_type || '—'}
              {p.installment_number > 0 && (
                <span className="text-slate-400 ml-1">#{p.installment_number}</span>
              )}
            </span>
          </div>
          <p className="text-[16px] font-bold text-slate-900 leading-tight tabular-nums">
            ₹{fmt(p.amount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{p.payment_method || '—'}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 ${status.bg} ${status.text} text-[10px] font-bold px-2 h-5 rounded-full uppercase`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {p.status}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
        {p.payment_date && <span>Paid {fmtDate(p.payment_date)}</span>}
        {p.due_date && (
          <span className={isOverdue ? 'text-rose-600 font-bold' : ''}>
            Due {fmtDate(p.due_date)}{isOverdue && ' · OVERDUE'}
          </span>
        )}
      </div>

      {(p.transaction_id || p.upi_id) && (
        <p className="text-[10px] text-slate-400 font-mono mt-1.5 truncate">
          {p.transaction_id || p.upi_id}
        </p>
      )}

      {screenshots.length > 0 && (
        <div className="flex gap-1.5 mt-2">
          {screenshots.map((url, si) => (
            <button
              key={si}
              onClick={() => onZoom(`${API_BASE}${url}`)}
              className="w-10 h-10 rounded-lg overflow-hidden ring-1 ring-slate-200 active:scale-95 transition-transform"
            >
              <img src={`${API_BASE}${url}`} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {p.notes && (
        <p className="text-[10px] text-slate-400 italic mt-2 line-clamp-2">{p.notes}</p>
      )}
    </div>
  );
}

export default BookingDetail;
