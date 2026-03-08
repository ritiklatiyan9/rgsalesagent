import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  ArrowLeft, BookOpen, User, CreditCard, ImageIcon, CheckCircle2,
  Clock, XCircle, IndianRupee, CalendarDays, X,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://rivergreenbackend.onrender.com';

const STATUS_COLORS = {
  ACTIVE: '#3b82f6', COMPLETED: '#22c55e', CANCELLED: '#ef4444',
  TRANSFERRED: '#8b5cf6', PENDING_APPROVAL: '#eab308',
};
const PAY_STATUS_ICON = {
  COMPLETED: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  PENDING: <Clock className="w-3.5 h-3.5 text-yellow-500" />,
  CANCELLED: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  REFUNDED: <XCircle className="w-3.5 h-3.5 text-purple-400" />,
};
const PAY_STATUS_BADGE = {
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  CANCELLED: 'bg-red-50 text-red-500 border-red-200',
  REFUNDED: 'bg-purple-50 text-purple-600 border-purple-200',
};

const fmt = (v) => Number(v || 0).toLocaleString('en-IN');

const Row = ({ label, value }) => (
  <div className="flex items-start gap-3">
    <span className="text-xs font-medium text-slate-400 w-24 sm:w-28 shrink-0 pt-0.5">{label}</span>
    <div className="flex-1 text-sm text-slate-700 font-medium min-w-0">{value}</div>
  </div>
);

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomImg, setZoomImg] = useState(null);

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

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );

  if (!booking) return (
    <div className="text-center py-20">
      <p className="text-slate-500">Booking not found</p>
      <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate('/bookings')}>Back</Button>
    </div>
  );

  const sc = STATUS_COLORS[booking.status] || '#6b7280';
  const paid = Number(summary?.total_paid || booking.total_paid || 0);
  const totalAmt = Number(booking.total_amount || 0);
  const bookingAmt = Number(booking.booking_amount || 0);
  const pct = totalAmt > 0 ? Math.min(100, Math.round((paid / totalAmt) * 100)) : 0;

  const bookingScreenshots = (() => {
    try {
      const urls = typeof booking.screenshot_urls === 'string'
        ? JSON.parse(booking.screenshot_urls) : (booking.screenshot_urls || []);
      return Array.isArray(urls) ? urls.filter(Boolean) : [];
    } catch { return []; }
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')} className="rounded-lg cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-1" /> Bookings
        </Button>
        <span className="h-5 w-px bg-slate-200 hidden sm:block" />
        <h1 className="text-lg sm:text-xl font-bold text-slate-800">Plot {booking.plot_number}</h1>
        <span className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ backgroundColor: sc + '20', color: sc }}>
          {booking.status}
        </span>
        {booking.booking_source === 'PUBLIC' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
            🌐 Public
          </span>
        )}
      </div>

      {/* Payment Progress */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-500" /> Payment Progress
          </h3>
          <span className="text-xs font-bold text-slate-500">{pct}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-linear-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total</p>
            <p className="text-sm sm:text-lg font-bold text-slate-800">₹{fmt(totalAmt)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Paid</p>
            <p className="text-sm sm:text-lg font-bold text-emerald-600">₹{fmt(paid)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Remaining</p>
            <p className="text-sm sm:text-lg font-bold text-orange-500">₹{fmt(Math.max(0, totalAmt - paid))}</p>
          </div>
        </div>
      </div>

      {/* Booking Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Client Info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-slate-50 bg-slate-50/50">
            <User className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-700">Client Information</h3>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            <Row label="Name" value={booking.client_name} />
            <Row label="Phone" value={booking.client_phone} />
            <Row label="Email" value={booking.client_email || '—'} />
            <Row label="Booked By" value={booking.booked_by_name || '—'} />
            {booking.booked_by_sponsor_code && (
              <Row label="Agent Code" value={
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  🔗 {booking.booked_by_sponsor_code}
                </span>
              } />
            )}
            {booking.referred_by_name && booking.referred_by !== booking.booked_by && (
              <Row label="Referred By" value={
                <span className="flex items-center gap-1.5 flex-wrap">
                  {booking.referred_by_name}
                  {booking.referred_by_sponsor_code && (
                    <span className="inline-flex items-center bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-purple-200">
                      {booking.referred_by_sponsor_code}
                    </span>
                  )}
                </span>
              } />
            )}
            {booking.approved_by_name && <Row label="Approved By" value={booking.approved_by_name} />}
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-slate-50 bg-slate-50/50">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-700">Booking Details</h3>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            <Row label="Colony" value={booking.colony_name || '—'} />
            <Row label="Plot" value={booking.plot_number} />
            <Row label="Block" value={booking.block || '—'} />
            <Row label="Plot Type" value={booking.plot_type || '—'} />
            <Row label="Facing" value={booking.facing || '—'} />
            <Row label="Area" value={booking.area_sqft ? `${booking.area_sqft} sqft` : '—'} />
            <Row label="Dimensions" value={booking.dimensions || '—'} />
            <Row label="Booking Amt" value={`₹${fmt(bookingAmt)}`} />
            <Row label="Total Price" value={`₹${fmt(totalAmt)}`} />
            <Row label="Payment Type" value={booking.payment_type === 'INSTALLMENT' ? 'Installment' : 'One-Time'} />
            {booking.installment_count > 1 && (
              <Row label="Installments" value={`${booking.installment_count} (${booking.installment_frequency})`} />
            )}
            <Row label="Booking Date" value={
              booking.booking_date ? new Date(booking.booking_date).toLocaleDateString('en-IN')
              : (booking.created_at ? new Date(booking.created_at).toLocaleDateString('en-IN') : '—')
            } />
            {booking.notes && <Row label="Notes" value={<span className="text-slate-500 italic">{booking.notes}</span>} />}
          </div>
        </div>
      </div>

      {/* Booking Screenshots */}
      {bookingScreenshots.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-slate-50 bg-slate-50/50">
            <ImageIcon className="w-4 h-4 text-pink-500" />
            <h3 className="text-sm font-bold text-slate-700">Booking Screenshots</h3>
            <span className="text-[10px] bg-pink-50 text-pink-600 font-bold px-2 py-0.5 rounded-full border border-pink-200">
              {bookingScreenshots.length} uploaded
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {bookingScreenshots.map((url, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setZoomImg(`${API_BASE}${url}`)}>
                  <img src={`${API_BASE}${url}`} alt={`Screenshot ${i + 1}`}
                    className="w-full h-28 sm:h-32 object-cover group-hover:scale-105 transition-transform duration-200" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments Table */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-slate-50 bg-slate-50/50">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-700">All Payments</h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              {payments.length} records
            </span>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-slate-50">
            {payments.map((p, idx) => {
              const pScreenshots = (() => {
                try {
                  const urls = typeof p.screenshot_urls === 'string' ? JSON.parse(p.screenshot_urls) : (p.screenshot_urls || []);
                  return Array.isArray(urls) ? urls.filter(Boolean) : [];
                } catch { return []; }
              })();
              const isOverdue = p.status === 'PENDING' && p.due_date && new Date(p.due_date) < new Date();
              return (
                <div key={p.id || idx} className={`p-4 space-y-2 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                      <span className={`font-bold text-xs uppercase ${p.payment_type === 'BOOKING' ? 'text-blue-600' : 'text-slate-600'}`}>
                        {p.payment_type || '—'}
                        {p.installment_number > 0 && <span className="text-slate-400 ml-1">#{p.installment_number}</span>}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${PAY_STATUS_BADGE[p.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {PAY_STATUS_ICON[p.status]} {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-slate-800">₹{fmt(p.amount)}</span>
                    <span className="text-xs text-slate-500">{p.payment_method || '—'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {p.payment_date && <span>Paid: {new Date(p.payment_date).toLocaleDateString('en-IN')}</span>}
                    {p.due_date && (
                      <span className={isOverdue ? 'text-red-500 font-bold' : ''}>
                        Due: {new Date(p.due_date).toLocaleDateString('en-IN')}
                        {isOverdue && ' (OVERDUE)'}
                      </span>
                    )}
                  </div>
                  {pScreenshots.length > 0 && (
                    <div className="flex gap-1.5 pt-1">
                      {pScreenshots.map((url, si) => (
                        <img key={si} src={`${API_BASE}${url}`} alt=""
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 cursor-pointer"
                          onClick={() => setZoomImg(`${API_BASE}${url}`)} />
                      ))}
                    </div>
                  )}
                  {p.notes && <p className="text-xs text-slate-400 truncate">{p.notes}</p>}
                </div>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-left">
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Screenshots</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((p, idx) => {
                  const pScreenshots = (() => {
                    try {
                      const urls = typeof p.screenshot_urls === 'string' ? JSON.parse(p.screenshot_urls) : (p.screenshot_urls || []);
                      return Array.isArray(urls) ? urls.filter(Boolean) : [];
                    } catch { return []; }
                  })();
                  const isOverdue = p.status === 'PENDING' && p.due_date && new Date(p.due_date) < new Date();
                  return (
                    <tr key={p.id || idx} className={`hover:bg-slate-50/60 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold uppercase tracking-wider ${p.payment_type === 'BOOKING' ? 'text-blue-600' : 'text-slate-600'}`}>
                          {p.payment_type || '—'}
                        </span>
                        {p.installment_number > 0 && (
                          <span className="ml-1 text-[9px] text-slate-400">#{p.installment_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">₹{fmt(p.amount)}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.payment_method || '—'}
                        {p.transaction_id && <span className="block text-[9px] text-slate-400 font-mono">{p.transaction_id}</span>}
                        {p.upi_id && <span className="block text-[9px] text-slate-400">{p.upi_id}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.due_date ? (
                          <span className={isOverdue ? 'text-red-500 font-bold' : ''}>
                            {new Date(p.due_date).toLocaleDateString('en-IN')}
                            {isOverdue && <span className="block text-[9px]">OVERDUE</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${PAY_STATUS_BADGE[p.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          {PAY_STATUS_ICON[p.status]} {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {pScreenshots.length > 0 ? (
                          <div className="flex gap-1">
                            {pScreenshots.map((url, si) => (
                              <img key={si} src={`${API_BASE}${url}`} alt=""
                                className="w-8 h-8 rounded-md object-cover border border-slate-200 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => setZoomImg(`${API_BASE}${url}`)} />
                            ))}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-40 truncate" title={p.notes}>
                        {p.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          {summary && (
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3 sm:gap-6 flex-wrap text-xs">
              <span className="text-slate-500">
                <strong className="text-slate-700">{summary.total_payments}</strong> total
              </span>
              <span className="text-emerald-600">
                <strong>₹{fmt(summary.total_paid)}</strong> paid
              </span>
              <span className="text-yellow-600">
                <strong>₹{fmt(summary.total_pending)}</strong> pending
              </span>
              {Number(summary.overdue_count) > 0 && (
                <span className="text-red-500 font-bold">
                  ⚠️ {summary.overdue_count} overdue
                </span>
              )}
              {summary.next_due_date && (
                <span className="text-slate-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Next: <strong>{new Date(summary.next_due_date).toLocaleDateString('en-IN')}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-3xl p-2 rounded-2xl bg-black/95 border-none">
          <button onClick={() => setZoomImg(null)}
            className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/40 rounded-full p-1 transition-colors cursor-pointer">
            <X className="w-5 h-5 text-white" />
          </button>
          {zoomImg && <img src={zoomImg} alt="Screenshot" className="w-full max-h-[80vh] object-contain rounded-xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingDetail;
