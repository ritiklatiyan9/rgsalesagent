import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    MapPin, Ruler, Home, Phone, Share2, Compass,
    Loader2, CheckCircle2, BookOpen, LogIn, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://rivergreenbackend.onrender.com/api';

// Public instance — no auth
const publicApi = axios.create({ baseURL: BASE_URL });

// Agent instance — carries in-memory access token, refreshes via cookie
const agentApi = axios.create({ baseURL: BASE_URL, withCredentials: true });
let _agentToken = null;
agentApi.interceptors.request.use(cfg => {
    if (_agentToken) cfg.headers.Authorization = `Bearer ${_agentToken}`;
    return cfg;
});
agentApi.interceptors.response.use(
    r => r,
    async err => {
        const orig = err.config;
        if (err.response?.status === 401 && !orig._retry) {
            orig._retry = true;
            try {
                const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
                if (data.accessToken) {
                    _agentToken = data.accessToken;
                    orig.headers.Authorization = `Bearer ${_agentToken}`;
                    return agentApi(orig);
                }
            } catch { /* ignore */ }
        }
        return Promise.reject(err);
    }
);

const STATUS_COLORS = {
    AVAILABLE: '#22c55e', BOOKED: '#eab308', SOLD: '#ef4444', RESERVED: '#f59e0b',
    BLOCKED: '#6b7280', MORTGAGE: '#8b5cf6', REGISTRY_PENDING: '#3b82f6',
};
const STATUS_LABELS = {
    AVAILABLE: 'Available', BOOKED: 'Booked', SOLD: 'Sold', RESERVED: 'Reserved',
    BLOCKED: 'Blocked', MORTGAGE: 'Mortgage', REGISTRY_PENDING: 'Registry Pending',
};

const ALLOWED_AGENT_ROLES = ['AGENT', 'TEAM_HEAD', 'ADMIN', 'OWNER'];

const SharedPlot = () => {
    const { plotId } = useParams();
    const [plot, setPlot] = useState(null);
    const [loading, setLoading] = useState(true);

    // Auth state
    const [agentUser, setAgentUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [loggingIn, setLoggingIn] = useState(false);

    // Booking state
    const [bookingOpen, setBookingOpen] = useState(false);
    const [booking, setBooking] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [bookForm, setBookForm] = useState({
        client_name: '', client_phone: '', client_email: '',
        booking_amount: '', payment_type: 'ONE_TIME',
        installment_count: '', installment_frequency: 'MONTHLY',
        payment_method: 'CASH', transaction_id: '', receipt_number: '',
        bank_name: '', branch_name: '', account_number: '', ifsc_code: '',
        upi_id: '', cheque_number: '', cheque_date: '', card_last4: '', card_network: '',
        payment_time: '', collected_by_name: '', remarks: '',
    });

    // Try to restore session from cookie on mount
    useEffect(() => {
        const tryRestore = async () => {
            try {
                const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
                if (data.success && data.accessToken) {
                    _agentToken = data.accessToken;
                    const meRes = await agentApi.get('/auth/me');
                    if (meRes.data.success && ALLOWED_AGENT_ROLES.includes(meRes.data.user?.role)) {
                        setAgentUser(meRes.data.user);
                    }
                }
            } catch { /* no active session */ }
            finally { setAuthChecked(true); }
        };
        tryRestore();
    }, []);

    useEffect(() => {
        const fetchPlot = async () => {
            try {
                const { data } = await publicApi.get(`/colony-maps/public/plots/${plotId}`);
                if (data.success) setPlot(data.plot);
            } catch {
                toast.error('Could not load plot details. It may have been removed or the link is invalid.');
            } finally { setLoading(false); }
        };
        fetchPlot();
    }, [plotId]);

    const handleAgentLogin = async (e) => {
        e.preventDefault();
        if (!loginForm.email || !loginForm.password) {
            toast.error('Enter email and password');
            return;
        }
        setLoggingIn(true);
        try {
            const { data } = await axios.post(`${BASE_URL}/auth/login`,
                { email: loginForm.email, password: loginForm.password },
                { withCredentials: true }
            );
            if (data.success && data.accessToken) {
                if (!ALLOWED_AGENT_ROLES.includes(data.user?.role)) {
                    toast.error('This account does not have booking access');
                    return;
                }
                _agentToken = data.accessToken;
                setAgentUser(data.user);
                setLoginOpen(false);
                setLoginForm({ email: '', password: '' });
                toast.success(`Welcome, ${data.user.name}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally { setLoggingIn(false); }
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: `Plot ${plot.plot_number} - ${plot.map_name || 'Colony'}`, url: shareUrl }); }
            catch { /* cancelled */ }
        } else {
            navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard!');
        }
    };

    const handleBookPlot = async () => {
        if (!bookForm.client_name || !bookForm.client_phone || !bookForm.booking_amount) {
            toast.error('Please fill client name, phone and booking amount');
            return;
        }
        if (bookForm.payment_type === 'INSTALLMENT' && (!bookForm.installment_count || bookForm.installment_count < 2)) {
            toast.error('Please specify at least 2 installments');
            return;
        }
        setBooking(true);
        try {
            const payload = {
                client_name: bookForm.client_name,
                client_phone: bookForm.client_phone,
                client_email: bookForm.client_email || undefined,
                booking_amount: Number(bookForm.booking_amount),
                total_amount: plot.total_price ? Number(plot.total_price) : Number(bookForm.booking_amount),
                payment_type: bookForm.payment_type,
                installment_count: bookForm.payment_type === 'INSTALLMENT' ? Number(bookForm.installment_count) : undefined,
                installment_frequency: bookForm.payment_type === 'INSTALLMENT' ? bookForm.installment_frequency : undefined,
                payment_method: bookForm.payment_method || undefined,
                transaction_id: bookForm.transaction_id || undefined,
                receipt_number: bookForm.receipt_number || undefined,
                bank_name: bookForm.bank_name || undefined,
                branch_name: bookForm.branch_name || undefined,
                account_number: bookForm.account_number || undefined,
                ifsc_code: bookForm.ifsc_code || undefined,
                upi_id: bookForm.upi_id || undefined,
                cheque_number: bookForm.cheque_number || undefined,
                cheque_date: bookForm.cheque_date || undefined,
                card_last4: bookForm.card_last4 || undefined,
                card_network: bookForm.card_network || undefined,
                payment_time: bookForm.payment_time || undefined,
                collected_by_name: bookForm.collected_by_name || undefined,
                remarks: bookForm.remarks || undefined,
            };

            const { data } = await agentApi.post(`/bookings/agent-book/${plotId}`, payload);
            if (data.success) {
                setBookingSuccess(true);
                toast.success('Plot booked successfully!');
                const { data: refreshed } = await publicApi.get(`/colony-maps/public/plots/${plotId}`);
                if (refreshed.success) setPlot(refreshed.plot);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to book plot');
        } finally { setBooking(false); }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg space-y-4">
                    <Skeleton className="h-48 rounded-2xl" />
                    <Skeleton className="h-8 w-3/4 rounded-lg" />
                    <Skeleton className="h-32 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!plot) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-20 h-20 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-4">
                    <MapPin className="w-10 h-10 text-slate-300" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Plot Not Found</h1>
                <p className="text-slate-500 mt-2 max-w-sm">
                    The plot you're looking for doesn't exist or has been removed.
                </p>
            </div>
        );
    }

    const statusColor = STATUS_COLORS[plot.status] || '#6b7280';
    const isAvailable = plot.status === 'AVAILABLE';
    const canBook = isAvailable && !!agentUser;

    return (
        <div className="min-h-screen bg-slate-50 selection:bg-indigo-100">
            {/* Nav Bar */}
            <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Home className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-lg text-slate-800 tracking-tight">
                        {plot.map_name || 'RiverGreen Heights'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {agentUser ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100">
                            <ShieldCheck className="w-3.5 h-3.5" /> {agentUser.name}
                        </span>
                    ) : authChecked && (
                        <Button variant="outline" size="sm" onClick={() => setLoginOpen(true)}
                            className="rounded-xl text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                            <LogIn className="w-4 h-4 mr-1.5" /> Agent Login
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleShare} className="rounded-xl shadow-sm text-slate-600">
                        <Share2 className="w-4 h-4 mr-1.5 text-indigo-500" /> Share
                    </Button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

                {/* Title & Status */}
                <div className="rounded-3xl p-6 sm:p-8 shadow-sm border text-center relative overflow-hidden"
                    style={{ backgroundColor: statusColor, borderColor: statusColor }}>
                    <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4 shadow-sm"
                        style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                        {STATUS_LABELS[plot.status] || plot.status}
                    </span>
                    <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">Plot {plot.plot_number}</h1>
                    <p className="text-white/80 font-medium text-lg">
                        Block {plot.block || '-'} &bull; {plot.plot_type}
                    </p>
                </div>

                {/* Map Image */}
                {plot.map_image_url && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-50">
                            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Compass className="w-4 h-4 text-indigo-500" /> Layout Map
                            </h2>
                        </div>
                        <div className="bg-slate-50 p-2 sm:p-4 flex justify-center items-center">
                            <img src={plot.map_image_url} alt="Colony Layout"
                                className="max-w-full h-auto max-h-[500px] object-contain rounded-2xl border border-slate-200 shadow-sm" />
                        </div>
                    </div>
                )}

                {/* Specs */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
                    <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-6 uppercase tracking-wider">
                        <Ruler className="w-4 h-4 text-indigo-500" /> Plot Specifications
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                        <SpecItem label="Dimensions" value={plot.dimensions || '—'} />
                        <SpecItem label="Area (sqft)" value={plot.area_sqft ? `${plot.area_sqft} sqft` : '—'} />
                        <SpecItem label="Facing" value={plot.facing || '—'} />
                        <SpecItem label="Price / sqft" value={plot.price_per_sqft ? `₹${Number(plot.price_per_sqft).toLocaleString('en-IN')}` : '—'} />
                    </div>
                    {plot.total_price && (
                        <div className="mt-8 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                            <span className="font-semibold text-indigo-800">Total Value</span>
                            <span className="text-2xl font-black text-indigo-600">
                                ₹{Number(plot.total_price).toLocaleString('en-IN')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Agent Booking Section */}
                {isAvailable && (
                    <div className={`rounded-3xl p-6 sm:p-8 text-center text-white shadow-lg ${canBook ? 'bg-gradient-to-br from-indigo-600 to-blue-700' : 'bg-slate-800'}`}>
                        {canBook ? (
                            <>
                                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-80" />
                                <h3 className="text-2xl font-bold mb-2">Book This Plot for Client</h3>
                                <p className="text-indigo-100 mb-6 max-w-md mx-auto">
                                    Book this plot directly for your client as a registered agent.
                                </p>
                                <Button size="lg" onClick={() => { setBookingOpen(true); setBookingSuccess(false); }}
                                    className="bg-white text-indigo-700 hover:bg-indigo-50 rounded-full font-bold px-8 shadow-xl">
                                    <BookOpen className="w-4 h-4 mr-2" /> Book Plot Now
                                </Button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-2xl font-bold mb-2">Interested in Plot {plot.plot_number}?</h3>
                                <p className="text-slate-300 mb-6 max-w-md mx-auto">
                                    Agents can log in to book this plot directly, or contact our sales team.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Button size="lg" onClick={() => setLoginOpen(true)}
                                        className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full font-bold px-8">
                                        <LogIn className="w-4 h-4 mr-2" /> Agent Login & Book
                                    </Button>
                                    <a href="tel:+1234567890">
                                        <Button size="lg" variant="outline"
                                            className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-full font-bold px-8">
                                            <Phone className="w-4 h-4 mr-2" /> Call Sales Team
                                        </Button>
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {!isAvailable && (
                    <div className="bg-slate-800 rounded-3xl p-6 sm:p-8 text-center text-white shadow-lg">
                        <h3 className="text-2xl font-bold mb-2">Plot {plot.plot_number}</h3>
                        <p className="text-slate-300 mb-6 max-w-md mx-auto">
                            This plot is currently <strong>{STATUS_LABELS[plot.status] || plot.status}</strong>. Contact us for other available plots.
                        </p>
                        <a href="tel:+1234567890">
                            <Button size="lg" className="bg-white text-slate-800 hover:bg-slate-100 rounded-full font-bold px-8 shadow-xl">
                                <Phone className="w-4 h-4 mr-2" /> Call Sales Team
                            </Button>
                        </a>
                    </div>
                )}

                <p className="text-center text-xs text-slate-400 font-medium pt-8 pb-12">
                    Powered by RiverGreen
                </p>
            </div>

            {/* Agent Login Dialog */}
            <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
                <DialogContent className="max-w-sm rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" /> Agent Login
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAgentLogin} className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                            <Input type="email" placeholder="agent@example.com" value={loginForm.email}
                                onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                                className="rounded-lg" autoComplete="email" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Password</label>
                            <Input type="password" placeholder="Password" value={loginForm.password}
                                onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                                className="rounded-lg" autoComplete="current-password" />
                        </div>
                        <DialogFooter className="gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setLoginOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={loggingIn}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                                {loggingIn ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                                Login
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Booking Dialog */}
            <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
                <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">
                            {bookingSuccess ? 'Booking Confirmed!' : `Book Plot ${plot.plot_number}`}
                        </DialogTitle>
                    </DialogHeader>

                    {bookingSuccess ? (
                        <div className="text-center py-6">
                            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Successfully Booked!</h3>
                            <p className="text-slate-500">Plot {plot.plot_number} has been booked for {bookForm.client_name}.</p>
                            <Button className="mt-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() => setBookingOpen(false)}>
                                Done
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 py-2">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Client Name *</label>
                                    <Input placeholder="Full name" value={bookForm.client_name}
                                        onChange={e => setBookForm(p => ({ ...p, client_name: e.target.value }))}
                                        className="rounded-lg" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Client Phone *</label>
                                    <Input placeholder="Phone number" value={bookForm.client_phone}
                                        onChange={e => setBookForm(p => ({ ...p, client_phone: e.target.value }))}
                                        className="rounded-lg" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Client Email</label>
                                    <Input placeholder="Email (optional)" value={bookForm.client_email}
                                        onChange={e => setBookForm(p => ({ ...p, client_email: e.target.value }))}
                                        className="rounded-lg" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Booking Amount (₹) *</label>
                                    <Input type="number" placeholder="Amount" value={bookForm.booking_amount}
                                        onChange={e => setBookForm(p => ({ ...p, booking_amount: e.target.value }))}
                                        className="rounded-lg" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Payment Type</label>
                                    <Select value={bookForm.payment_type}
                                        onValueChange={v => setBookForm(p => ({ ...p, payment_type: v }))}>
                                        <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ONE_TIME">One-Time Payment</SelectItem>
                                            <SelectItem value="INSTALLMENT">Installments</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Payment Method</label>
                                    <Select value={bookForm.payment_method}
                                        onValueChange={v => setBookForm(p => ({ ...p, payment_method: v }))}>
                                        <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CASH">Cash</SelectItem>
                                            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                            <SelectItem value="UPI">UPI</SelectItem>
                                            <SelectItem value="CHEQUE">Cheque</SelectItem>
                                            <SelectItem value="CARD">Card</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Conditional payment details */}
                                {bookForm.payment_method === 'BANK_TRANSFER' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Bank Name</label>
                                            <Input value={bookForm.bank_name} onChange={e => setBookForm(p => ({ ...p, bank_name: e.target.value }))} className="rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">IFSC</label>
                                            <Input value={bookForm.ifsc_code} onChange={e => setBookForm(p => ({ ...p, ifsc_code: e.target.value }))} className="rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Branch</label>
                                            <Input value={bookForm.branch_name} onChange={e => setBookForm(p => ({ ...p, branch_name: e.target.value }))} className="rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Account #</label>
                                            <Input value={bookForm.account_number} onChange={e => setBookForm(p => ({ ...p, account_number: e.target.value }))} className="rounded-lg" />
                                        </div>
                                    </div>
                                )}

                                {bookForm.payment_method === 'UPI' && (
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">UPI ID</label>
                                        <Input value={bookForm.upi_id} onChange={e => setBookForm(p => ({ ...p, upi_id: e.target.value }))} className="rounded-lg" />
                                    </div>
                                )}

                                {bookForm.payment_method === 'CHEQUE' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Cheque Number</label>
                                            <Input value={bookForm.cheque_number} onChange={e => setBookForm(p => ({ ...p, cheque_number: e.target.value }))} className="rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Cheque Date</label>
                                            <Input type="date" value={bookForm.cheque_date || ''} onChange={e => setBookForm(p => ({ ...p, cheque_date: e.target.value }))} className="rounded-lg" />
                                        </div>
                                    </div>
                                )}

                                {bookForm.payment_method === 'CARD' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Card Last4</label>
                                            <Input value={bookForm.card_last4} onChange={e => setBookForm(p => ({ ...p, card_last4: e.target.value }))} className="rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Card Network</label>
                                            <Input value={bookForm.card_network} onChange={e => setBookForm(p => ({ ...p, card_network: e.target.value }))} className="rounded-lg" />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Transaction ID</label>
                                        <Input value={bookForm.transaction_id} onChange={e => setBookForm(p => ({ ...p, transaction_id: e.target.value }))} className="rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Receipt #</label>
                                        <Input value={bookForm.receipt_number} onChange={e => setBookForm(p => ({ ...p, receipt_number: e.target.value }))} className="rounded-lg" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Payment Time</label>
                                        <Input type="time" value={bookForm.payment_time || ''} onChange={e => setBookForm(p => ({ ...p, payment_time: e.target.value }))} className="rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Collected By</label>
                                        <Input value={bookForm.collected_by_name} onChange={e => setBookForm(p => ({ ...p, collected_by_name: e.target.value }))} className="rounded-lg" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Remarks</label>
                                    <Input value={bookForm.remarks} onChange={e => setBookForm(p => ({ ...p, remarks: e.target.value }))} className="rounded-lg" />
                                </div>
                                {bookForm.payment_type === 'INSTALLMENT' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">No. of Installments</label>
                                            <Input type="number" placeholder="e.g. 12" value={bookForm.installment_count}
                                                onChange={e => setBookForm(p => ({ ...p, installment_count: e.target.value }))}
                                                className="rounded-lg" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Frequency</label>
                                            <Select value={bookForm.installment_frequency}
                                                onValueChange={v => setBookForm(p => ({ ...p, installment_frequency: v }))}>
                                                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                                                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                                                    <SelectItem value="HALF_YEARLY">Half Yearly</SelectItem>
                                                    <SelectItem value="YEARLY">Yearly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setBookingOpen(false)} className="rounded-xl">Cancel</Button>
                                <Button onClick={handleBookPlot} disabled={booking}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                                    {booking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                                    Confirm Booking
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

const SpecItem = ({ label, value }) => (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-base font-medium text-slate-800">{value}</span>
    </div>
);

export default SharedPlot;
