import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, ChevronRight, Calendar, IndianRupee, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, Receipt, Wallet, MapPin,
} from 'lucide-react';

const STATUS_COLORS = {
  COMPLETED: { bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PENDING:   { bg: 'bg-amber-50',   ring: 'ring-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  FAILED:    { bg: 'bg-rose-50',    ring: 'ring-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500' },
  REFUNDED:  { bg: 'bg-violet-50',  ring: 'ring-violet-200',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  CANCELLED: { bg: 'bg-slate-50',   ring: 'ring-slate-200',   text: 'text-slate-600',   dot: 'bg-slate-400' },
};

const PAYMENT_TYPE_LABELS = {
  BOOKING: 'Booking', INSTALLMENT: 'Installment', FULL_PAYMENT: 'Full Payment',
  ADVANCE: 'Advance', FINAL: 'Final', PENALTY: 'Penalty', REFUND: 'Refund',
};

const METHOD_LABELS = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', UPI: 'UPI', CARD: 'Card',
};

const fmtINR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy'); }
  catch { return '—'; }
};

export default function Sales() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/payments?${params}`);
      if (data.success) {
        setPayments(data.payments || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/payments/stats');
      if (data.success) setStats(data.stats);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
            My Sales
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Payments on bookings tied to your referral code · {total} records
          </p>
        </div>
      </div>

      {/* Stats grid */}
      {stats ? (
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Collected"
            value={fmtINR(stats.total_collected)}
            sub="All-time"
            icon={TrendingUp}
            tint="emerald"
          />
          <StatCard
            label="This Month"
            value={fmtINR(stats.this_month_amount || stats.this_month_collected)}
            sub={`${stats.this_week_payments || 0} payments · 7d`}
            icon={Wallet}
            tint="indigo"
          />
          <StatCard
            label="Pending"
            value={fmtINR(stats.total_pending)}
            sub="Awaiting"
            icon={Clock}
            tint="amber"
          />
          <StatCard
            label="Overdue"
            value={fmtINR(stats.overdue_amount)}
            sub={`${stats.overdue_count || 0} payments`}
            icon={AlertTriangle}
            tint="rose"
            alert={Number(stats.overdue_count) > 0}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[88px] rounded-2xl" />)}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter || 'ALL'} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-10 rounded-xl bg-white text-[13px] font-semibold flex-1">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-slate-100 p-8 text-center">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
            <Receipt className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="text-[15px] font-semibold text-slate-800">No payments yet</p>
          <p className="text-[12px] text-slate-500 mt-1">Payments on bookings tied to your referral code show up here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {payments.map((p) => <PaymentCard key={p.id} payment={p} onOpen={() => p.booking_id && navigate(`/bookings/${p.booking_id}`)} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl">‹</Button>
          <span className="text-sm text-slate-600 font-medium">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl">›</Button>
        </div>
      )}
    </div>
  );
}

const TINT_MAP = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  value: 'text-indigo-700' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   value: 'text-amber-700' },
  rose:    { bg: 'bg-rose-50',    icon: 'text-rose-600',    value: 'text-rose-700' },
};

function StatCard({ label, value, sub, icon: Icon, tint = 'emerald', alert = false }) {
  const t = TINT_MAP[tint] || TINT_MAP.emerald;
  return (
    <div className={`rounded-2xl bg-white ring-1 ${alert ? 'ring-rose-200' : 'ring-slate-100'} p-3.5 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)]`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <div className={`h-7 w-7 rounded-lg ${t.bg} flex items-center justify-center`}>
          <Icon className={`h-3.5 w-3.5 ${t.icon}`} strokeWidth={2.4} />
        </div>
      </div>
      <p className={`text-[18px] font-bold tabular-nums ${t.value} truncate`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function PaymentCard({ payment, onOpen }) {
  const status = STATUS_COLORS[payment.status] || STATUS_COLORS.PENDING;
  const typeLabel = PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type;
  const methodLabel = METHOD_LABELS[payment.payment_method] || payment.payment_method;
  const isOverdue = payment.status === 'PENDING' && payment.due_date && new Date(payment.due_date) < new Date();

  return (
    <button
      onClick={onOpen}
      disabled={!payment.booking_id}
      className={`w-full text-left rounded-2xl bg-white ring-1 ${isOverdue ? 'ring-rose-200' : 'ring-slate-100'} p-3.5 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.04)] flex items-center gap-3 hover:ring-slate-200 active:scale-[0.99] transition-all disabled:cursor-default`}
    >
      <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-50 flex items-center justify-center">
        <IndianRupee className="h-5 w-5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-slate-900 tabular-nums">
            {fmtINR(payment.amount)}
          </p>
          <span className={`px-2 h-5 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 ${status.text} ${status.bg} ring-1 ${status.ring}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {payment.status}
          </span>
        </div>
        <p className="text-[12px] text-slate-600 mt-0.5 truncate">
          {payment.client_name || 'Booking'} · {typeLabel}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {payment.plot_number && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Plot {payment.plot_number}
            </span>
          )}
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {payment.payment_date ? fmtDate(payment.payment_date) : payment.due_date ? `Due ${fmtDate(payment.due_date)}` : '—'}
          </span>
          {methodLabel && (
            <span className="text-[10px] text-slate-500">{methodLabel}</span>
          )}
          {isOverdue && (
            <span className="text-[10px] text-rose-700 font-bold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Overdue
            </span>
          )}
        </div>
      </div>
      {payment.booking_id && <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
    </button>
  );
}
