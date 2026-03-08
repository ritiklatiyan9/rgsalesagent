import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DollarSign, Search, Filter, ChevronLeft, ChevronRight, Plus,
  CheckCircle2, Clock, Loader2, CreditCard, TrendingUp, Printer,
} from 'lucide-react';

const STATUS_COLORS = {
  PENDING: '#f59e0b', COMPLETED: '#22c55e', FAILED: '#ef4444',
  REFUNDED: '#8b5cf6', CANCELLED: '#6b7280',
};
const METHOD_LABELS = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque',
  UPI: 'UPI', CARD: 'Card', OTHER: 'Other',
};
const TYPE_LABELS = {
  BOOKING: 'Booking', INSTALLMENT: 'Installment', FULL_PAYMENT: 'Full Payment',
  ADVANCE: 'Advance', FINAL: 'Final', PENALTY: 'Penalty', REFUND: 'Refund',
};

const fmtINR = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const generateReceiptHTML = (payment, cumulativePaid, balance) => {
  const isPaid = payment.status === 'COMPLETED';
  const watermarkColor = isPaid ? '#16a34a' : '#f59e0b';
  const watermarkText = isPaid ? 'PAID' : payment.status;
  const receiptNo = payment.receipt_number || payment.transaction_id || `RG-${payment.id?.toString().slice(0, 8).toUpperCase()}`;
  const payDate = payment.payment_date
    ? new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Receipt ${receiptNo}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;background:#f0fdf4;display:flex;align-items:flex-start;justify-content:center;min-height:100vh;padding:40px 20px;}.receipt{background:#fff;width:680px;max-width:100%;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.12);position:relative;}.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:110px;font-weight:900;color:${watermarkColor};opacity:0.07;pointer-events:none;user-select:none;white-space:nowrap;z-index:0;}.header{background:linear-gradient(135deg,#16a34a 0%,#059669 100%);padding:28px 32px;color:#fff;position:relative;z-index:1;}.company-name{font-size:24px;font-weight:800;}.receipt-badge{background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.4);border-radius:10px;padding:8px 16px;text-align:right;}.receipt-badge .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;opacity:0.8;}.receipt-badge .val{font-size:14px;font-weight:700;margin-top:2px;}.header-top{display:flex;align-items:flex-start;justify-content:space-between;}.header-meta{display:flex;gap:28px;font-size:12px;opacity:0.85;margin-top:16px;}.header-meta span{display:flex;flex-direction:column;gap:2px;}.header-meta strong{font-size:13px;font-weight:600;}.status-banner{background:${isPaid?'#dcfce7':'#fef9c3'};border-bottom:2px solid ${isPaid?'#bbf7d0':'#fef08a'};padding:10px 32px;display:flex;align-items:center;gap:8px;position:relative;z-index:1;}.status-dot{width:8px;height:8px;border-radius:50%;background:${isPaid?'#16a34a':'#d97706'};}.status-text{font-size:13px;font-weight:600;color:${isPaid?'#15803d':'#92400e'};}.body{padding:24px 32px;position:relative;z-index:1;}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}.info-box{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px 16px;}.info-box h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;margin-bottom:8px;}.info-row{display:flex;justify-content:space-between;margin-bottom:5px;}.info-label{font-size:11px;color:#94a3b8;}.info-value{font-size:12px;font-weight:600;color:#1e293b;text-align:right;}.amount-section{margin-bottom:20px;}.amount-section h4{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;margin-bottom:10px;}.amount-table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1.5px solid #e2e8f0;}.amount-table td{padding:8px 12px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;}.amount-table td:last-child{text-align:right;font-weight:600;}.highlight{background:#f0fdf4;}.highlight td{color:#15803d;font-weight:700;}.total-row td{background:#f8fafc;font-weight:700;font-size:13px;color:#0f172a;}.footer{background:#f8fafc;border-top:1.5px solid #e2e8f0;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;}@media print{body{background:#fff;padding:0;}.receipt{box-shadow:none;border-radius:0;width:100%;}.no-print{display:none!important;}}</style>
  </head><body><div class="receipt"><div class="watermark">${watermarkText}</div>
  <div class="header"><div class="header-top"><div><div class="company-name">RiverGreen</div><div style="font-size:12px;opacity:0.8;margin-top:2px;">Property Management & Real Estate</div></div><div class="receipt-badge"><div class="lbl">Receipt No.</div><div class="val">${receiptNo}</div></div></div>
  <div class="header-meta"><span><span>Date</span><strong>${payDate}</strong></span><span><span>Client</span><strong>${payment.client_name||'—'}</strong></span><span><span>Plot</span><strong>${payment.plot_number?'Plot '+payment.plot_number:'—'}</strong></span>${payment.colony_name?`<span><span>Colony</span><strong>${payment.colony_name}</strong></span>`:''}</div></div>
  <div class="status-banner"><div class="status-dot"></div><div class="status-text">${isPaid?'Payment Successfully Received':'Payment '+payment.status}${payment.installment_number?' — Installment #'+payment.installment_number:''}&nbsp;&nbsp;|&nbsp;&nbsp;${METHOD_LABELS[payment.payment_method]||payment.payment_method||'—'}</div></div>
  <div class="body"><div class="two-col"><div class="info-box"><h4>Payment Details</h4><div class="info-row"><span class="info-label">Type</span><span class="info-value">${TYPE_LABELS[payment.payment_type]||payment.payment_type||'—'}</span></div><div class="info-row"><span class="info-label">Method</span><span class="info-value">${METHOD_LABELS[payment.payment_method]||payment.payment_method||'—'}</span></div>${payment.transaction_id?`<div class="info-row"><span class="info-label">Txn Ref</span><span class="info-value">${payment.transaction_id}</span></div>`:''}</div>
  <div class="info-box"><h4>Booking Info</h4><div class="info-row"><span class="info-label">Client</span><span class="info-value">${payment.client_name||'—'}</span></div>${payment.client_phone?`<div class="info-row"><span class="info-label">Phone</span><span class="info-value">${payment.client_phone}</span></div>`:''}<div class="info-row"><span class="info-label">Plot</span><span class="info-value">${payment.plot_number?'Plot '+payment.plot_number:'—'}</span></div>${payment.total_amount?`<div class="info-row"><span class="info-label">Plot Price</span><span class="info-value">${fmtINR(payment.total_amount)}</span></div>`:''}</div></div>
  <div class="amount-section"><h4>Payment Breakdown</h4><table class="amount-table">${payment.total_amount?`<tr><td>Plot Price</td><td>${fmtINR(payment.total_amount)}</td></tr>`:''}<tr class="highlight"><td>This Payment${payment.installment_number?' (Installment #'+payment.installment_number+')':''}</td><td>${fmtINR(payment.amount)}</td></tr><tr class="total-row"><td>Total Paid to Date</td><td>${fmtINR(cumulativePaid)}</td></tr>${balance!=null?`<tr><td style="color:${balance<=0?'#16a34a':'#dc2626'};font-weight:700;">${balance<=0?'Fully Paid':'Remaining Balance'}</td><td style="color:${balance<=0?'#16a34a':'#dc2626'};font-weight:700;text-align:right;">${balance<=0?fmtINR(0):fmtINR(balance)}</td></tr>`:''}</table></div>
  ${payment.notes?`<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:12px;color:#92400e;"><strong style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;color:#b45309;">Notes</strong>${payment.notes}</div>`:''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:12px;"><div style="border-top:1.5px dashed #cbd5e1;padding-top:10px;text-align:center;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Authorised Signatory<br/><span style="font-size:12px;font-weight:600;color:#475569;">RiverGreen</span></div><div style="border-top:1.5px dashed #cbd5e1;padding-top:10px;text-align:center;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Client Acknowledgement<br/><span style="font-size:12px;font-weight:600;color:#475569;">${payment.client_name||''}</span></div></div></div>
  <div class="footer"><div>Generated on ${new Date().toLocaleString('en-IN')}</div><div>Computer-generated receipt</div></div></div>
  <div class="no-print" style="display:flex;gap:12px;justify-content:center;margin-top:24px;padding-bottom:36px;"><button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">🖨️ Print</button><button onclick="window.close()" style="background:#e2e8f0;color:#334155;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Close</button></div>
  </body></html>`;
};

const openReceiptWindow = (payment, cumulativePaid, balance) => {
  const html = generateReceiptHTML(payment, cumulativePaid, balance);
  const w = window.open('', '_blank', 'width=800,height=900,scrollbars=yes');
  if (w) { w.document.write(html); w.document.close(); }
};

const Payments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    booking_id: '', amount: '', payment_method: 'CASH', payment_type: 'INSTALLMENT',
    transaction_reference: '', notes: '', installment_number: '',
    bank_name: '', branch_name: '', account_number: '', ifsc_code: '',
    upi_id: '', cheque_number: '', cheque_date: '', card_last4: '', card_network: '',
    payment_time: '', collected_by_name: '', remarks: '',
  });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/payments?${params}`);
      if (data.success) {
        setPayments(data.payments);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);

  const fetchClients = useCallback(async () => {
    try {
      const { data } = await api.get('/clients?page=1&limit=100');
      if (data.success) setClients(data.clients || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/payments/stats');
        if (data.success) setStats(data.stats);
      } catch { /* silent */ }
    };
    fetchStats();
    fetchClients();
  }, [fetchClients]);

  const handleSubmit = async () => {
    if (!form.booking_id || !form.amount) { toast.error('Booking and amount are required'); return; }
    setSaving(true);
    try {
      let data;
      if (editingPayment?.id) {
        const res = await api.put(`/payments/${editingPayment.id}`, { ...form, amount: Number(form.amount), installment_number: form.installment_number ? Number(form.installment_number) : undefined, status: 'COMPLETED' });
        data = res.data;
      } else {
        const res = await api.post('/payments', { ...form, amount: Number(form.amount), installment_number: form.installment_number ? Number(form.installment_number) : undefined });
        data = res.data;
      }
      if (data.success) {
        toast.success(editingPayment ? 'Payment updated' : 'Payment recorded!');
        setDialogOpen(false);
        setEditingPayment(null);
        setForm({ booking_id: '', amount: '', payment_method: 'CASH', payment_type: 'INSTALLMENT', transaction_reference: '', notes: '', installment_number: '', bank_name: '', branch_name: '', account_number: '', ifsc_code: '', upi_id: '', cheque_number: '', cheque_date: '', card_last4: '', card_network: '', payment_time: '', collected_by_name: '', remarks: '' });
        invalidateCache('/payments');
        fetchPayments();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to record payment'); }
    finally { setSaving(false); }
  };

  const openEditPayment = (p) => {
    setEditingPayment(p);
    setForm({ booking_id: p.booking_id, amount: p.amount, payment_method: p.payment_method || 'CASH', payment_type: p.payment_type || 'INSTALLMENT', transaction_reference: p.transaction_id || '', notes: p.notes || '', installment_number: p.installment_number || '', bank_name: p.bank_name || '', branch_name: p.branch_name || '', account_number: p.account_number || '', ifsc_code: p.ifsc_code || '', upi_id: p.upi_id || '', cheque_number: p.cheque_number || '', cheque_date: p.cheque_date || '', card_last4: p.card_last4 || '', card_network: p.card_network || '', payment_time: p.payment_time || '', collected_by_name: p.collected_by_name || '', remarks: p.remarks || '' });
    setDialogOpen(true);
  };

  const runningTotals = useMemo(() => {
    const groups = {};
    payments.forEach(p => {
      const bid = p.booking_id || '__none__';
      if (!groups[bid]) groups[bid] = [];
      groups[bid].push(p);
    });
    Object.values(groups).forEach(g => g.sort((a, b) => new Date(a.payment_date || a.created_at || 0) - new Date(b.payment_date || b.created_at || 0)));
    const map = {};
    Object.values(groups).forEach(g => {
      let cum = 0;
      g.forEach(p => {
        if (p.status === 'COMPLETED') cum += Number(p.amount || 0);
        map[p.id] = cum;
      });
    });
    return map;
  }, [payments]);

  const statCards = stats ? [
    { label: 'Total Collected', value: `₹${Number(stats.total_collected || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Pending', value: `₹${Number(stats.total_pending || 0).toLocaleString('en-IN')}`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Total Payments', value: stats.total_payments || 0, icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-50' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-500" /> Payments
          </h1>
          <p className="text-sm text-slate-500 mt-1">{total} payment records</p>
        </div>
        <Button
          onClick={() => { setEditingPayment(null); setForm({ booking_id: selectedBooking || '', amount: '', payment_method: 'CASH', payment_type: 'INSTALLMENT', transaction_reference: '', notes: '', installment_number: '', bank_name: '', branch_name: '', account_number: '', ifsc_code: '', upi_id: '', cheque_number: '', cheque_date: '', card_last4: '', card_network: '', payment_time: '', collected_by_name: '', remarks: '' }); setDialogOpen(true); }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Record Payment
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <form onSubmit={e => { e.preventDefault(); setPage(1); fetchPayments(); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search payments..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedBooking} onValueChange={v => { setSelectedBooking(v); setPage(1); }}>
            <SelectTrigger className="w-56 rounded-xl"><SelectValue placeholder="Filter by Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Clients</SelectItem>
              {clients.map(c => (
                <SelectItem key={c.booking_id} value={String(c.booking_id)}>
                  {`${c.client_name || c.client_phone || 'Booking #' + c.booking_id}${c.plot_number ? ' — Plot ' + c.plot_number : ''}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl">
              <Filter className="w-4 h-4 mr-2" /> Filter
            </Button>
            {selectedBooking && (
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => navigate(`/bookings/${selectedBooking}`)}>
                Open Booking
              </Button>
            )}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <DollarSign className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-600 mb-2">No Payments Found</h3>
          <p className="text-slate-400">No payment records match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="px-4 py-3">Client / Plot</TableHead>
                  <TableHead className="px-4 py-3">Type</TableHead>
                  <TableHead className="px-4 py-3">Amount</TableHead>
                  <TableHead className="px-4 py-3">Total Paid</TableHead>
                  <TableHead className="px-4 py-3">Balance</TableHead>
                  <TableHead className="px-4 py-3">Method</TableHead>
                  <TableHead className="px-4 py-3">Date</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="px-4 py-3 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => {
                  const sc = STATUS_COLORS[p.status] || '#6b7280';
                  const plotPrice = p.total_amount != null ? Number(p.total_amount) : p.booking_amount != null ? Number(p.booking_amount) : null;
                  const cumulativePaid = runningTotals[p.id] ?? (p.booking_total_paid != null ? Number(p.booking_total_paid) : 0);
                  const balance = plotPrice != null ? plotPrice - cumulativePaid : null;
                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-4 py-3">
                        <div className="font-medium text-slate-700">{p.client_name || '—'}</div>
                        <div className="text-xs text-slate-400">Plot {p.plot_number || '—'}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          {TYPE_LABELS[p.payment_type] || p.payment_type}
                        </span>
                        {p.installment_number && <span className="text-[10px] text-slate-400 ml-1">#{p.installment_number}</span>}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-bold text-slate-800">₹{Number(p.amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="px-4 py-3 text-slate-700">{cumulativePaid != null ? `₹${Number(cumulativePaid).toLocaleString('en-IN')}` : '—'}</TableCell>
                      <TableCell className="px-4 py-3 text-slate-700">{balance != null ? `₹${Number(balance).toLocaleString('en-IN')}` : '—'}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-500">{METHOD_LABELS[p.payment_method] || p.payment_method}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-500">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase" style={{ backgroundColor: sc + '15', color: sc }}>
                          {p.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status === 'PENDING' && (
                            <Button size="sm" variant="outline" onClick={() => openEditPayment(p)}
                              className="rounded-lg text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid
                            </Button>
                          )}
                          {p.status === 'COMPLETED' && (
                            <Button size="sm" variant="outline" onClick={() => openReceiptWindow(p, cumulativePaid, balance)}
                              className="rounded-lg text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                              <Printer className="w-3 h-3 mr-1" /> Receipt
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-600 font-medium">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingPayment ? 'Update Payment' : 'Record Payment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Booking *</label>
              {clients.length > 0 ? (
                <Select value={form.booking_id || ''} onValueChange={v => setForm(p => ({ ...p, booking_id: v }))}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select booking" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.booking_id} value={String(c.booking_id)}>
                        {`${c.client_name || c.client_phone || 'Booking #' + c.booking_id}${c.plot_number ? ' — Plot ' + c.plot_number : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Booking ID" value={form.booking_id} onChange={e => setForm(p => ({ ...p, booking_id: e.target.value }))} className="rounded-lg" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Amount (₹) *</label>
                <Input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="rounded-lg" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Installment #</label>
                <Input type="number" placeholder="e.g. 3" value={form.installment_number} onChange={e => setForm(p => ({ ...p, installment_number: e.target.value }))} className="rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Method</label>
                <Select value={form.payment_method} onValueChange={v => setForm(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Type</label>
                <Select value={form.payment_type} onValueChange={v => setForm(p => ({ ...p, payment_type: v }))}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.payment_method === 'UPI' && (
              <div><label className="text-xs font-semibold text-slate-500 mb-1 block">UPI ID</label>
                <Input value={form.upi_id} onChange={e => setForm(p => ({ ...p, upi_id: e.target.value }))} className="rounded-lg" /></div>
            )}
            {form.payment_method === 'CHEQUE' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Cheque No.</label><Input value={form.cheque_number} onChange={e => setForm(p => ({ ...p, cheque_number: e.target.value }))} className="rounded-lg" /></div>
                <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Cheque Date</label><Input type="date" value={form.cheque_date || ''} onChange={e => setForm(p => ({ ...p, cheque_date: e.target.value }))} className="rounded-lg" /></div>
              </div>
            )}
            <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Transaction Reference</label>
              <Input placeholder="Txn ID / cheque no." value={form.transaction_reference} onChange={e => setForm(p => ({ ...p, transaction_reference: e.target.value }))} className="rounded-lg" /></div>
            <div><label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
              <Textarea placeholder="Additional notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="rounded-lg min-h-[60px]" /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingPayment(null); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
              {editingPayment ? 'Update' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payments;
