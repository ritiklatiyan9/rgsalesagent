import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  BookOpen, Search, Filter, ChevronLeft, ChevronRight, Eye, MapPin,
  User, Phone, CheckCircle2, Clock, Loader2, BadgeCheck,
  TrendingUp, Plus, Table2, CreditCard,
} from 'lucide-react';

const STATUS_COLORS = {
  PENDING_APPROVAL: '#f59e0b', ACTIVE: '#3b82f6', COMPLETED: '#22c55e',
  CANCELLED: '#ef4444', TRANSFERRED: '#8b5cf6',
};
const STATUS_LABELS = {
  PENDING_APPROVAL: 'Pending Approval', ACTIVE: 'Active', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled', TRANSFERRED: 'Transferred',
};
const PAYMENT_LABELS = { ONE_TIME: 'One-Time', INSTALLMENT: 'Installment' };
const FREQ_MONTHS = { WEEKLY: 0, MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };

const genSchedule = (bookingAmt, totalAmt, count, frequency, startDate) => {
  if (count < 2 || !totalAmt) return [];
  const remaining = totalAmt - bookingAmt;
  const each = Math.ceil(remaining / (count - 1));
  const schedule = [];
  const base = startDate ? new Date(startDate) : new Date();
  for (let i = 1; i < count; i++) {
    const d = new Date(base);
    if (frequency === 'WEEKLY') d.setDate(d.getDate() + 7 * i);
    else if (frequency === 'YEARLY') d.setFullYear(d.getFullYear() + i);
    else d.setMonth(d.getMonth() + (FREQ_MONTHS[frequency] || 1) * i);
    const amt = i === count - 1 ? remaining - each * (count - 2) : each;
    schedule.push({ num: i, date: d.toLocaleDateString('en-IN'), amount: Math.max(0, amt) });
  }
  return schedule;
};

const PlotBookings = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [availablePlots, setAvailablePlots] = useState([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  const [createForm, setCreateForm] = useState({
    plot_id: '', client_name: '', client_phone: '', client_email: '',
    booking_date: new Date().toISOString().slice(0, 10),
    booking_amount: '', total_amount: '',
    payment_type: 'ONE_TIME', installment_count: '12', installment_frequency: 'MONTHLY',
    payment_method: 'CASH', notes: '',
  });

  const installmentSchedule = useMemo(() => {
    if (createForm.payment_type !== 'INSTALLMENT') return [];
    return genSchedule(
      Number(createForm.booking_amount) || 0, Number(createForm.total_amount) || 0,
      Number(createForm.installment_count) || 0, createForm.installment_frequency, createForm.booking_date,
    );
  }, [createForm.booking_amount, createForm.total_amount, createForm.installment_count, createForm.installment_frequency, createForm.booking_date, createForm.payment_type]);

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

  const fetchAvailablePlots = useCallback(async () => {
    setLoadingPlots(true);
    try {
      const { data } = await api.get('/colony-maps/plots?status=AVAILABLE&limit=200');
      if (data.success) setAvailablePlots(data.plots || []);
    } catch { /* silent */ }
    finally { setLoadingPlots(false); }
  }, []);



  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handlePlotSelect = (plotId) => {
    const plot = availablePlots.find(p => p.id === plotId);
    setCreateForm(f => ({ ...f, plot_id: plotId, total_amount: plot?.total_price ? String(plot.total_price) : f.total_amount }));
  };

  const handleCreateBooking = async () => {
    if (!createForm.plot_id || !createForm.client_name || !createForm.client_phone || !createForm.booking_amount) {
      toast.error('Plot, client name, phone, and booking amount are required');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        plot_id: createForm.plot_id,
        client_name: createForm.client_name,
        client_phone: createForm.client_phone,
        client_email: createForm.client_email || undefined,
        booking_date: createForm.booking_date,
        booking_amount: Number(createForm.booking_amount),
        total_amount: Number(createForm.total_amount || createForm.booking_amount),
        payment_type: createForm.payment_type,
        payment_method: createForm.payment_method,
        notes: createForm.notes || undefined,
      };
      if (createForm.payment_type === 'INSTALLMENT') {
        payload.installment_count = Number(createForm.installment_count);
        payload.installment_frequency = createForm.installment_frequency;
      }
      const { data } = await api.post('/bookings', payload);
      if (data.success) {
        toast.success('Booking created successfully!');
        setCreateOpen(false);
        setCreateForm({ plot_id: '', client_name: '', client_phone: '', client_email: '', booking_date: new Date().toISOString().slice(0, 10), booking_amount: '', total_amount: '', payment_type: 'ONE_TIME', installment_count: '12', installment_frequency: 'MONTHLY', payment_method: 'CASH', notes: '' });
        fetchBookings(); fetchStats();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create booking'); }
    finally { setCreating(false); }
  };

  const statCards = stats ? [
    { label: 'My Bookings', value: stats.total_bookings || 0, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Active', value: stats.active_bookings || 0, icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Completed', value: stats.completed_bookings || 0, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Total Value', value: `₹${Number(stats.total_value || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 shrink-0" /> My Bookings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">{total} total booking records</p>
        </div>
        <Button onClick={() => { setCreateOpen(true); fetchAvailablePlots(); }}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl shrink-0">
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">New Booking</span>
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <form onSubmit={e => { e.preventDefault(); setPage(1); fetchBookings(); }} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search by client name, phone, plot..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-600 mb-2">No Bookings Found</h3>
          <p className="text-slate-400">No bookings match your current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map(b => {
            const sc = STATUS_COLORS[b.status] || '#6b7280';
            const paid = Number(b.total_paid || 0);
            const totalAmt = Number(b.total_amount || 0);
            const pct = totalAmt > 0 ? Math.min(100, Math.round((paid / totalAmt) * 100)) : 0;
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1.5 w-full" style={{ backgroundColor: sc }} />
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-slate-800">{b.plot_number}</span>
                        <span className="text-xs text-slate-400">{b.colony_name}</span>
                      </div>
                      <p className="text-sm text-slate-500">{PAYMENT_LABELS[b.payment_type] || b.payment_type}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase"
                      style={{ backgroundColor: sc + '15', color: sc }}>
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-700">{b.client_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="w-3 h-3" /> {b.client_phone}
                    </div>
                    {b.booked_by_name && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <BadgeCheck className="w-3 h-3" /> Agent: {b.booked_by_name}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>₹{paid.toLocaleString('en-IN')} paid</span>
                      <span>₹{totalAmt.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#22c55e' : '#3b82f6' }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{pct}% complete</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/bookings/${b.id}`)}
                      className="flex-1 rounded-lg text-xs">
                      <Eye className="w-3 h-3 mr-1" /> View Details
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* Create Booking Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" /> Create New Booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">Select Plot *</label>
              <Select value={createForm.plot_id} onValueChange={handlePlotSelect}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder={loadingPlots ? 'Loading plots...' : 'Select available plot'} />
                </SelectTrigger>
                <SelectContent>
                  {availablePlots.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      Plot {p.plot_number}{p.block ? ` (Block ${p.block})` : ''} — {p.colony_name || 'Colony'}{p.total_price ? ` • ₹${Number(p.total_price).toLocaleString('en-IN')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Client Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name *</label>
                  <Input placeholder="Client name" value={createForm.client_name}
                    onChange={e => setCreateForm(f => ({ ...f, client_name: e.target.value }))} className="rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone *</label>
                  <Input placeholder="Phone number" value={createForm.client_phone}
                    onChange={e => setCreateForm(f => ({ ...f, client_phone: e.target.value }))} className="rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                  <Input type="email" placeholder="Email (optional)" value={createForm.client_email}
                    onChange={e => setCreateForm(f => ({ ...f, client_email: e.target.value }))} className="rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Booking Date</label>
                  <Input type="date" value={createForm.booking_date}
                    onChange={e => setCreateForm(f => ({ ...f, booking_date: e.target.value }))} className="rounded-lg" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Payment Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Plot Total Price (₹)</label>
                  <Input type="number" placeholder="Total price" value={createForm.total_amount}
                    onChange={e => setCreateForm(f => ({ ...f, total_amount: e.target.value }))} className="rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Booking Amount (₹) *</label>
                  <Input type="number" placeholder="Initial payment" value={createForm.booking_amount}
                    onChange={e => setCreateForm(f => ({ ...f, booking_amount: e.target.value }))} className="rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Payment Type</label>
                  <Select value={createForm.payment_type} onValueChange={v => setCreateForm(f => ({ ...f, payment_type: v }))}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONE_TIME">One-Time Payment</SelectItem>
                      <SelectItem value="INSTALLMENT">Installments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Payment Method</label>
                  <Select value={createForm.payment_method} onValueChange={v => setCreateForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {createForm.payment_type === 'INSTALLMENT' && (
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Installment Schedule</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Total Installments (incl. booking)</label>
                    <Input type="number" min="2" max="120" placeholder="e.g. 12" value={createForm.installment_count}
                      onChange={e => setCreateForm(f => ({ ...f, installment_count: e.target.value }))} className="rounded-lg" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Frequency</label>
                    <Select value={createForm.installment_frequency} onValueChange={v => setCreateForm(f => ({ ...f, installment_frequency: v }))}>
                      <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="HALF_YEARLY">Half Yearly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {installmentSchedule.length > 0 && (
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b border-slate-100">
                      <Table2 className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                        Schedule Preview ({installmentSchedule.length} installments)
                      </span>
                      <span className="ml-auto text-xs font-bold text-emerald-600">
                        Remaining: ₹{(Number(createForm.total_amount || 0) - Number(createForm.booking_amount || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50/50"><tr>
                          <th className="px-4 py-2 text-left text-slate-500 font-semibold">#</th>
                          <th className="px-4 py-2 text-left text-slate-500 font-semibold">Due Date</th>
                          <th className="px-4 py-2 text-right text-slate-500 font-semibold">Amount</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          <tr className="bg-emerald-50/50">
                            <td className="px-4 py-2 text-emerald-700 font-bold">0</td>
                            <td className="px-4 py-2 text-slate-600">{new Date(createForm.booking_date).toLocaleDateString('en-IN')} <span className="text-emerald-600 font-semibold">(Booking)</span></td>
                            <td className="px-4 py-2 text-right font-bold text-emerald-700">₹{Number(createForm.booking_amount || 0).toLocaleString('en-IN')}</td>
                          </tr>
                          {installmentSchedule.map(s => (
                            <tr key={s.num} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2 text-slate-500">{s.num}</td>
                              <td className="px-4 py-2 text-slate-600">{s.date}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-800">₹{s.amount.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50"><tr>
                          <td colSpan={2} className="px-4 py-2 font-bold text-slate-700 text-right">Total</td>
                          <td className="px-4 py-2 font-bold text-right text-slate-900">₹{Number(createForm.total_amount || 0).toLocaleString('en-IN')}</td>
                        </tr></tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Notes</label>
              <Input placeholder="Optional notes..." value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} className="rounded-lg" />
            </div>
          </div>
          <DialogFooter className="gap-2 sticky bottom-0 bg-white pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreateBooking} disabled={creating}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl">
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlotBookings;
