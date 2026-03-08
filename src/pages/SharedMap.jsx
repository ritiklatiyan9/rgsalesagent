import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
    Map, Phone, Share2, Compass, Home, User, Maximize2, Minimize2,
    MapPin, IndianRupee, Ruler, Layers, ArrowRight, X,
    Loader2, CheckCircle2, BookOpen, Camera, Shield, Eye,
    FileText, Upload, Landmark, QrCode, Copy
} from 'lucide-react';
import { toast } from 'sonner';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://rivergreenbackend.onrender.com/api';
const SERVER_URL = BASE_URL.replace('/api', '');
const publicApi = axios.create({ baseURL: BASE_URL });

const STATUS_COLORS = {
    AVAILABLE: '#22c55e', BOOKED: '#ef4444', SOLD: '#991b1b', RESERVED: '#eab308',
    BLOCKED: '#f97316', MORTGAGE: '#8b5cf6', REGISTRY_PENDING: '#3b82f6',
};
const STATUS_LABELS = {
    AVAILABLE: 'Available', BOOKED: 'Booked', SOLD: 'Sold', RESERVED: 'Reserved',
    BLOCKED: 'Hold', MORTGAGE: 'Mortgage', REGISTRY_PENDING: 'Registry Pending',
};

const UPI_APPS = [
    { id: 'phonepe', name: 'PhonePe', color: '#5f259f', icon: '📱' },
    { id: 'gpay', name: 'Google Pay', color: '#4285F4', icon: '💳' },
    { id: 'paytm', name: 'Paytm', color: '#00BAF2', icon: '💰' },
    { id: 'bhim', name: 'BHIM UPI', color: '#00897B', icon: '🏦' },
    { id: 'other', name: 'Other UPI', color: '#6b7280', icon: '📲' },
];

const SharedMap = () => {
    const { mapId } = useParams();
    const [searchParams] = useSearchParams();
    const refCode = searchParams.get('ref') || '';
    const fileInputRef = useRef(null);

    const [colonyData, setColonyData] = useState(null);
    const [referringAgent, setReferringAgent] = useState(null);
    const [financialSettings, setFinancialSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Selected plot + booking
    const [selectedPlot, setSelectedPlot] = useState(null);
    const [showBookingForm, setShowBookingForm] = useState(false);
    const [booking, setBooking] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [screenshots, setScreenshots] = useState([]);
    const [screenshotPreviews, setScreenshotPreviews] = useState([]);
    const [bookForm, setBookForm] = useState({
        client_name: '', client_phone: '', client_email: '',
        booking_amount: '', payment_type: 'ONE_TIME',
        installment_count: '', installment_frequency: 'MONTHLY',
        payment_method: 'UPI', transaction_id: '', upi_id: '', remarks: '',
    });

    useEffect(() => {
        const fetchMap = async () => {
            try {
                const refParam = refCode ? `?ref=${encodeURIComponent(refCode)}` : '';
                const { data } = await publicApi.get(`/colony-maps/public/maps/${mapId}${refParam}`);
                if (data.success) {
                    setColonyData(data.colonyData);
                    if (data.referringAgent) setReferringAgent(data.referringAgent);
                    if (data.financialSettings) setFinancialSettings(data.financialSettings);
                }
            } catch {
                toast.error('Could not load colony map. The link may be invalid.');
            } finally { setLoading(false); }
        };
        fetchMap();
    }, [mapId, refCode]);

    const handleShare = async () => {
        const shareUrl = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: `${colonyData?.name || 'Colony'} — Map`, url: shareUrl }); }
            catch { /* cancelled */ }
        } else {
            navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied!');
        }
    };

    const openPlotModal = (plot) => {
        setSelectedPlot(plot);
        setShowBookingForm(false);
        setBookingSuccess(false);
        setScreenshots([]);
        setScreenshotPreviews([]);
        setBookForm({
            client_name: '', client_phone: '', client_email: '',
            booking_amount: '', payment_type: 'ONE_TIME',
            installment_count: '', installment_frequency: 'MONTHLY',
            payment_method: 'UPI', transaction_id: '', upi_id: '', remarks: '',
        });
    };

    const closePlotModal = () => {
        setSelectedPlot(null);
        setShowBookingForm(false);
        setBookingSuccess(false);
    };

    // ── Booking handlers ──────────────────────────
    const handleAddScreenshots = (e) => {
        const files = Array.from(e.target.files || []);
        if (screenshots.length + files.length > 5) { toast.error('Maximum 5 screenshots allowed'); return; }
        const validFiles = files.filter(f => {
            if (!f.type.startsWith('image/') && f.type !== 'application/pdf') { toast.error(`${f.name} is not valid`); return false; }
            if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} exceeds 5MB`); return false; }
            return true;
        });
        setScreenshots(prev => [...prev, ...validFiles]);
        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => setScreenshotPreviews(prev => [...prev, { name: file.name, url: ev.target.result }]);
            reader.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeScreenshot = (index) => {
        setScreenshots(prev => prev.filter((_, i) => i !== index));
        setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleBookPlot = async () => {
        if (!selectedPlot) return;
        if (!bookForm.client_name.trim()) { toast.error('Please enter your name'); return; }
        if (!bookForm.client_phone.trim() || bookForm.client_phone.trim().length < 10) { toast.error('Please enter a valid phone number'); return; }
        if (!bookForm.booking_amount || Number(bookForm.booking_amount) <= 0) { toast.error('Please enter booking amount'); return; }
        if (bookForm.payment_method === 'UPI' && !bookForm.transaction_id.trim()) { toast.error('Please enter transaction / reference ID'); return; }
        if (screenshots.length === 0) { toast.error('Please upload at least one payment screenshot'); return; }

        setBooking(true);
        try {
            const formData = new FormData();
            formData.append('client_name', bookForm.client_name.trim());
            formData.append('client_phone', bookForm.client_phone.trim());
            if (bookForm.client_email) formData.append('client_email', bookForm.client_email.trim());
            formData.append('booking_amount', bookForm.booking_amount);
            formData.append('total_amount', selectedPlot.total_price || bookForm.booking_amount);
            formData.append('payment_type', bookForm.payment_type);
            if (bookForm.payment_type === 'INSTALLMENT') {
                formData.append('installment_count', bookForm.installment_count || '12');
                formData.append('installment_frequency', bookForm.installment_frequency);
            }
            formData.append('payment_method', bookForm.payment_method);
            if (bookForm.transaction_id) formData.append('transaction_id', bookForm.transaction_id.trim());
            if (bookForm.upi_id) formData.append('upi_id', bookForm.upi_id.trim());
            if (bookForm.remarks) formData.append('remarks', bookForm.remarks.trim());
            if (refCode) formData.append('ref_sponsor_code', refCode);
            screenshots.forEach(file => formData.append('screenshots', file));

            const { data } = await publicApi.post(`/bookings/public-book/${selectedPlot.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (data.success) {
                setBookingSuccess(true);
                toast.success('Booking submitted successfully!');
                // Refresh map data
                const refParam = refCode ? `?ref=${encodeURIComponent(refCode)}` : '';
                const { data: refreshed } = await publicApi.get(`/colony-maps/public/maps/${mapId}${refParam}`);
                if (refreshed.success) setColonyData(refreshed.colonyData);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit booking');
        } finally { setBooking(false); }
    };

    const getUpiDeepLink = (appId) => {
        const amount = bookForm.booking_amount || '';
        const name = encodeURIComponent(selectedPlot?.map_name || colonyData?.name || 'RiverGreen');
        const note = encodeURIComponent(`Plot ${selectedPlot?.plot_number || ''} Booking`);
        const pa = financialSettings?.upi_id ? `&pa=${encodeURIComponent(financialSettings.upi_id)}` : '';
        const baseUri = `upi://pay?pn=${name}&tn=${note}${amount ? `&am=${amount}` : ''}${pa}&cu=INR`;
        switch (appId) {
            case 'phonepe': return `phonepe://pay?pn=${name}&tn=${note}${amount ? `&am=${amount}` : ''}${pa}&cu=INR`;
            case 'gpay': return `gpay://upi/pay?pn=${name}&tn=${note}${amount ? `&am=${amount}` : ''}${pa}&cu=INR`;
            case 'paytm': return `paytmmp://pay?pn=${name}&tn=${note}${amount ? `&am=${amount}` : ''}${pa}&cu=INR`;
            default: return baseUri;
        }
    };

    const ef = (k, v) => setBookForm(prev => ({ ...prev, [k]: v }));

    // ── Loading ────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-lg space-y-4">
                    <Skeleton className="h-12 rounded-xl" />
                    <Skeleton className="h-8 w-3/4 rounded-xl" />
                    <Skeleton className="h-[400px] rounded-3xl" />
                </div>
            </div>
        );
    }

    if (!colonyData) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-24 h-24 bg-white shadow-lg rounded-3xl flex items-center justify-center mb-6 border border-slate-100">
                    <MapPin className="w-12 h-12 text-slate-300" />
                </div>
                <h1 className="text-3xl font-black text-slate-800">Map Not Found</h1>
                <p className="text-slate-500 mt-3 max-w-sm">The colony map you're looking for doesn't exist or may have been removed.</p>
            </div>
        );
    }

    const availableCount = (colonyData.plots || []).filter(p => p.status === 'AVAILABLE').length;
    const totalPlots = (colonyData.plots || []).length;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 selection:bg-emerald-100">
            {/* Sticky Nav */}
            <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-3
                flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600
                        flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <Home className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="leading-tight">
                        <span className="font-bold text-base text-slate-800 block tracking-tight">
                            {colonyData.name || 'Colony'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                            {availableCount} of {totalPlots} plots available
                        </span>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleShare}
                    className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm h-9 px-3">
                    <Share2 className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Share
                </Button>
            </nav>

            {/* Hero */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 opacity-20"
                    style={{ background: 'linear-gradient(135deg, #22c55e40, #22c55e10, transparent)' }} />
                <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-6 text-center relative">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4
                        border shadow-sm text-xs font-bold uppercase tracking-widest
                        bg-emerald-50 border-emerald-200 text-emerald-600">
                        <Map className="w-3.5 h-3.5" /> Colony Map
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
                        {colonyData.name || 'Colony'}
                    </h1>
                    <p className="text-slate-500 font-medium text-base sm:text-lg mb-4">
                        Browse available plots and book the one you like
                    </p>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-slate-100 flex items-center gap-2">
                            <Map className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-bold text-slate-700">{totalPlots} Total Plots</span>
                        </div>
                        <div className="bg-emerald-50 rounded-2xl px-4 py-2.5 shadow-sm border border-emerald-200 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm font-bold text-emerald-700">{availableCount} Available</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive Colony Map */}
            {colonyData?.layout_config && (
                <div className={`transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-900' : 'w-full'}`}>
                    <ColonyMapGrid
                        colonyData={colonyData}
                        selectedPlotId={selectedPlot?.id}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={() => setIsFullscreen(f => !f)}
                        onPlotSelect={openPlotModal}
                    />
                </div>
            )}

            {/* Content */}
            <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-5 pt-6 pb-24">

                {/* Colony Map Image */}
                {colonyData?.image_url && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4">
                            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                                <Compass className="w-4 h-4 text-emerald-500" /> Colony Layout
                            </h2>
                            <img src={`${SERVER_URL}${colonyData.image_url}`} alt="Colony Layout"
                                className="w-full h-auto object-contain rounded-2xl border border-slate-200 shadow-sm" />
                        </div>
                    </div>
                )}

                {/* Referring Agent */}
                {referringAgent && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-5 shadow-sm border border-blue-100/80">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shrink-0
                                border border-blue-200 shadow-sm overflow-hidden">
                                {referringAgent.profile_photo ? (
                                    <img src={referringAgent.profile_photo} alt="" className="w-14 h-14 rounded-2xl object-cover" />
                                ) : (
                                    <User className="w-7 h-7 text-blue-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Your Agent</p>
                                <p className="text-base font-bold text-slate-800 truncate">{referringAgent.name}</p>
                                <p className="text-xs text-slate-400">
                                    Code: <span className="font-mono font-bold text-blue-600">{referringAgent.sponsor_code}</span>
                                </p>
                            </div>
                            {referringAgent.phone && (
                                <a href={`tel:${referringAgent.phone}`}>
                                    <Button size="sm" className="rounded-2xl bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 h-10 px-4">
                                        <Phone className="w-3.5 h-3.5 mr-1.5" /> Call
                                    </Button>
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* How It Works */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
                    <h2 className="text-xs font-bold text-slate-400 flex items-center gap-2 mb-4 uppercase tracking-widest">
                        How to Book
                    </h2>
                    <div className="space-y-3">
                        {[
                            { n: '1', t: 'Browse the map above and tap any plot' },
                            { n: '2', t: 'View plot details — area, price, dimensions' },
                            { n: '3', t: 'Click "Book This Plot", fill your details & pay via UPI' },
                            { n: '4', t: 'Upload payment screenshot — you\'re done!' },
                        ].map(s => (
                            <div key={s.n} className="flex items-start gap-3">
                                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white
                                    text-xs font-bold flex items-center justify-center shrink-0 shadow-sm mt-0.5">{s.n}</span>
                                <p className="text-sm text-slate-600 leading-relaxed">{s.t}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center pt-8 pb-6">
                    <p className="text-[10px] text-slate-300 font-medium tracking-wider uppercase">
                        Powered by River Green
                    </p>
                </div>
            </div>

            {/* ═══ Plot Detail + Booking Modal ═══ */}
            {selectedPlot && (
                <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePlotModal} />

                    {/* Modal */}
                    <div className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto
                        shadow-2xl border border-slate-200/50 animate-in slide-in-from-bottom-4 duration-300">

                        {/* ── Booking Success ── */}
                        {bookingSuccess ? (
                            <div className="p-8 text-center">
                                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-100">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">Booking Submitted!</h3>
                                <p className="text-slate-500 text-sm max-w-sm mx-auto mb-1">
                                    Your booking for <strong>Plot {selectedPlot.plot_number}</strong> has been submitted successfully.
                                </p>
                                <p className="text-slate-400 text-xs max-w-sm mx-auto">
                                    Our admin team will verify your payment and confirm shortly.
                                </p>
                                <div className="mt-5 bg-amber-50 rounded-2xl p-4 border border-amber-100 text-left">
                                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5" /> Pending Verification
                                    </p>
                                    <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                                        The admin will review your payment screenshot and transaction details. The plot is temporarily reserved for you.
                                    </p>
                                </div>
                                <Button onClick={closePlotModal} className="mt-5 rounded-2xl">Close</Button>
                            </div>
                        ) : !showBookingForm ? (
                            /* ── Plot Details View ── */
                            <>
                                {/* Header */}
                                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-4 flex items-center justify-between
                                    rounded-t-3xl sm:rounded-t-3xl sticky top-0 z-10">
                                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                                        <MapPin className="w-5 h-5" /> Plot {selectedPlot.plot_number}
                                    </h3>
                                    <button onClick={closePlotModal}
                                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                        <X className="w-4 h-4 text-white" />
                                    </button>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Status */}
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
                                        style={{
                                            backgroundColor: `${STATUS_COLORS[selectedPlot.status]}15`,
                                            color: STATUS_COLORS[selectedPlot.status],
                                            border: `1px solid ${STATUS_COLORS[selectedPlot.status]}30`,
                                        }}>
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[selectedPlot.status] }} />
                                        {STATUS_LABELS[selectedPlot.status] || selectedPlot.status}
                                    </div>

                                    {/* Specs Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedPlot.area_sqft && (
                                            <SpecItem label="Area" value={`${selectedPlot.area_sqft} sqft`}
                                                icon={<Ruler className="w-3.5 h-3.5 text-emerald-500" />} />
                                        )}
                                        {selectedPlot.dimensions && (
                                            <SpecItem label="Dimensions" value={selectedPlot.dimensions}
                                                icon={<Layers className="w-3.5 h-3.5 text-blue-500" />} />
                                        )}
                                        {selectedPlot.facing && (
                                            <SpecItem label="Facing" value={selectedPlot.facing}
                                                icon={<Compass className="w-3.5 h-3.5 text-amber-500" />} />
                                        )}
                                        {selectedPlot.block && (
                                            <SpecItem label="Block" value={selectedPlot.block}
                                                icon={<Map className="w-3.5 h-3.5 text-indigo-500" />} />
                                        )}
                                        {selectedPlot.plot_type && (
                                            <SpecItem label="Type" value={selectedPlot.plot_type}
                                                icon={<Home className="w-3.5 h-3.5 text-purple-500" />} />
                                        )}
                                    </div>

                                    {/* Price */}
                                    {selectedPlot.total_price && (
                                        <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3">
                                            <IndianRupee className="w-5 h-5 text-emerald-600" />
                                            <span className="text-2xl font-black text-emerald-700">
                                                {Number(selectedPlot.total_price).toLocaleString('en-IN')}
                                            </span>
                                            {selectedPlot.price_per_sqft && (
                                                <span className="text-xs text-emerald-500 font-medium ml-1">
                                                    (₹{Number(selectedPlot.price_per_sqft).toLocaleString('en-IN')}/sqft)
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Agent */}
                                    {referringAgent && (
                                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50 border border-blue-100">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 border border-blue-200 overflow-hidden">
                                                {referringAgent.profile_photo ? (
                                                    <img src={referringAgent.profile_photo} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                                ) : (
                                                    <User className="w-5 h-5 text-blue-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Your Agent</p>
                                                <p className="text-sm font-bold text-slate-800 truncate">{referringAgent.name}</p>
                                            </div>
                                            {referringAgent.phone && (
                                                <a href={`tel:${referringAgent.phone}`}>
                                                    <Button size="sm" variant="outline" className="rounded-xl text-blue-600 border-blue-200 h-8 px-3 text-xs">
                                                        <Phone className="w-3 h-3 mr-1" /> Call
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Book Now CTA */}
                                    {selectedPlot.status === 'AVAILABLE' ? (
                                        <Button size="lg" onClick={() => setShowBookingForm(true)}
                                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                                                text-white rounded-2xl h-13 text-base font-bold shadow-lg shadow-blue-500/20">
                                            <BookOpen className="w-5 h-5 mr-2" /> Book This Plot
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    ) : (
                                        <div className="bg-slate-100 rounded-2xl p-4 text-center">
                                            <p className="text-sm font-semibold text-slate-500">
                                                This plot is <strong>{STATUS_LABELS[selectedPlot.status] || selectedPlot.status}</strong>
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">Select another available (green) plot from the map</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* ── Booking Form ── */
                            <>
                                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between
                                    rounded-t-3xl sm:rounded-t-3xl sticky top-0 z-10">
                                    <div>
                                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                                            <BookOpen className="w-5 h-5" /> Book Plot {selectedPlot.plot_number}
                                        </h3>
                                        <p className="text-blue-100 text-xs mt-0.5">Fill details, pay via UPI, upload screenshot</p>
                                    </div>
                                    <button onClick={() => setShowBookingForm(false)}
                                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                                        <X className="w-4 h-4 text-white" />
                                    </button>
                                </div>

                                <div className="p-5 space-y-6">
                                    {/* Step 1 — Details */}
                                    <div>
                                        <SectionHeader number="1" title="Your Details" />
                                        <div className="space-y-3 mt-3">
                                            <FormField label="Full Name *">
                                                <Input placeholder="Enter your full name" value={bookForm.client_name}
                                                    onChange={e => ef('client_name', e.target.value)} className="rounded-xl h-11 border-slate-200" />
                                            </FormField>
                                            <FormField label="Phone Number *">
                                                <Input type="tel" placeholder="10-digit mobile number" value={bookForm.client_phone}
                                                    onChange={e => ef('client_phone', e.target.value)} className="rounded-xl h-11 border-slate-200" />
                                            </FormField>
                                            <FormField label="Email (optional)">
                                                <Input type="email" placeholder="your@email.com" value={bookForm.client_email}
                                                    onChange={e => ef('client_email', e.target.value)} className="rounded-xl h-11 border-slate-200" />
                                            </FormField>
                                        </div>
                                    </div>

                                    {/* Step 2 — Payment */}
                                    <div>
                                        <SectionHeader number="2" title="Payment" />
                                        <div className="space-y-3 mt-3">
                                            <FormField label="Booking Amount (₹) *">
                                                <div className="relative">
                                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <Input type="number" placeholder="Enter amount" value={bookForm.booking_amount}
                                                        onChange={e => ef('booking_amount', e.target.value)} className="rounded-xl h-11 pl-9 border-slate-200" />
                                                </div>
                                            </FormField>
                                            <FormField label="Payment Type">
                                                <Select value={bookForm.payment_type} onValueChange={v => ef('payment_type', v)}>
                                                    <SelectTrigger className="rounded-xl h-11 border-slate-200"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ONE_TIME">One-Time Payment</SelectItem>
                                                        <SelectItem value="INSTALLMENT">Installment</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormField>
                                            {bookForm.payment_type === 'INSTALLMENT' && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <FormField label="No. of Installments">
                                                        <Input type="number" placeholder="e.g. 12" value={bookForm.installment_count}
                                                            onChange={e => ef('installment_count', e.target.value)} className="rounded-xl h-10 border-slate-200" />
                                                    </FormField>
                                                    <FormField label="Frequency">
                                                        <Select value={bookForm.installment_frequency} onValueChange={v => ef('installment_frequency', v)}>
                                                            <SelectTrigger className="rounded-xl h-10 border-slate-200"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="MONTHLY">Monthly</SelectItem>
                                                                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                                                                <SelectItem value="HALF_YEARLY">Half Yearly</SelectItem>
                                                                <SelectItem value="YEARLY">Yearly</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormField>
                                                </div>
                                            )}
                                            <FormField label="Payment Method">
                                                <Select value={bookForm.payment_method} onValueChange={v => ef('payment_method', v)}>
                                                    <SelectTrigger className="rounded-xl h-11 border-slate-200"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="UPI">UPI (PhonePe / GPay / Paytm)</SelectItem>
                                                        <SelectItem value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</SelectItem>
                                                        <SelectItem value="CASH">Cash</SelectItem>
                                                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                                                        <SelectItem value="OTHER">Other</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormField>
                                        </div>
                                    </div>

                                    {/* Payment Details from Admin */}
                                    {financialSettings && (
                                        <div>
                                            <SectionHeader number="" title="Payment Details" />
                                            <p className="text-xs text-slate-400 mt-1 mb-3">Send payment to the following account details</p>
                                            <div className="space-y-3">
                                                {financialSettings.upi_scanner_url && (
                                                    <div className="flex flex-col items-center p-4 bg-white rounded-2xl border border-slate-200">
                                                        <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-slate-700">
                                                            <QrCode className="w-4 h-4 text-purple-500" /> Scan QR to Pay
                                                        </div>
                                                        <img src={financialSettings.upi_scanner_url} alt="UPI QR"
                                                            className="w-48 h-48 object-contain rounded-xl border border-slate-100 bg-white p-1" />
                                                    </div>
                                                )}
                                                {financialSettings.upi_id && (
                                                    <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 border border-purple-100">
                                                        <div>
                                                            <p className="text-[10px] text-purple-400 font-medium uppercase tracking-wider">UPI ID</p>
                                                            <p className="text-sm font-bold text-purple-700">{financialSettings.upi_id}</p>
                                                        </div>
                                                        <button onClick={() => { navigator.clipboard.writeText(financialSettings.upi_id); toast.success('UPI ID copied!'); }}
                                                            className="p-2 rounded-lg hover:bg-purple-100 transition-colors">
                                                            <Copy className="w-4 h-4 text-purple-500" />
                                                        </button>
                                                    </div>
                                                )}
                                                {financialSettings.account_number && (
                                                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
                                                        <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 mb-2">
                                                            <Landmark className="w-4 h-4" /> Bank Transfer Details
                                                        </div>
                                                        {financialSettings.bank_name && (
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-blue-400">Bank</span>
                                                                <span className="font-semibold text-blue-700">{financialSettings.bank_name}</span>
                                                            </div>
                                                        )}
                                                        {financialSettings.account_holder_name && (
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-blue-400">Account Holder</span>
                                                                <span className="font-semibold text-blue-700">{financialSettings.account_holder_name}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-blue-400">Account No.</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-semibold text-blue-700">{financialSettings.account_number}</span>
                                                                <button onClick={() => { navigator.clipboard.writeText(financialSettings.account_number); toast.success('Account number copied!'); }}
                                                                    className="p-1 rounded hover:bg-blue-100 transition-colors">
                                                                    <Copy className="w-3 h-3 text-blue-500" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {financialSettings.ifsc_code && (
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="text-blue-400">IFSC Code</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-blue-700">{financialSettings.ifsc_code}</span>
                                                                    <button onClick={() => { navigator.clipboard.writeText(financialSettings.ifsc_code); toast.success('IFSC copied!'); }}
                                                                        className="p-1 rounded hover:bg-blue-100 transition-colors">
                                                                        <Copy className="w-3 h-3 text-blue-500" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {financialSettings.bank_branch && (
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-blue-400">Branch</span>
                                                                <span className="font-semibold text-blue-700">{financialSettings.bank_branch}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {financialSettings.payment_instructions && (
                                                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                                                        <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider mb-1">Instructions</p>
                                                        <p className="text-xs text-amber-700 leading-relaxed whitespace-pre-line">{financialSettings.payment_instructions}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3 — UPI Quick Pay */}
                                    {bookForm.payment_method === 'UPI' && (
                                        <div>
                                            <SectionHeader number="3" title="Pay via UPI App" />
                                            <p className="text-xs text-slate-400 mt-1 mb-3">
                                                Tap any app to open it for payment, then come back to upload the screenshot.
                                            </p>
                                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                                {UPI_APPS.map(app => (
                                                    <a key={app.id} href={getUpiDeepLink(app.id)}
                                                        className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-slate-100
                                                            hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer group
                                                            hover:shadow-sm active:scale-95">
                                                        <span className="text-2xl group-hover:scale-110 transition-transform">{app.icon}</span>
                                                        <span className="text-[10px] font-semibold text-slate-600 text-center leading-tight">{app.name}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 4 — Transaction Details */}
                                    <div>
                                        <SectionHeader number={bookForm.payment_method === 'UPI' ? '4' : '3'} title="Transaction Details" />
                                        <div className="space-y-3 mt-3">
                                            <FormField label={bookForm.payment_method === 'UPI' ? 'UPI Transaction / Reference ID *' : 'Transaction / Reference ID *'}>
                                                <Input placeholder="e.g. 432156789012" value={bookForm.transaction_id}
                                                    onChange={e => ef('transaction_id', e.target.value)} className="rounded-xl h-11 border-slate-200" />
                                            </FormField>
                                            {bookForm.payment_method === 'UPI' && (
                                                <FormField label="Your UPI ID (optional)">
                                                    <Input placeholder="e.g. name@upi" value={bookForm.upi_id}
                                                        onChange={e => ef('upi_id', e.target.value)} className="rounded-xl h-11 border-slate-200" />
                                                </FormField>
                                            )}
                                            <FormField label="Remarks (optional)">
                                                <Input placeholder="Any additional notes" value={bookForm.remarks}
                                                    onChange={e => ef('remarks', e.target.value)} className="rounded-xl h-11 border-slate-200" />
                                            </FormField>
                                        </div>
                                    </div>

                                    {/* Step 5 — Screenshots */}
                                    <div>
                                        <SectionHeader number={bookForm.payment_method === 'UPI' ? '5' : '4'} title="Upload Payment Proof *" />
                                        <p className="text-xs text-slate-400 mt-1 mb-3">Upload screenshots of your payment confirmation (max 5)</p>
                                        <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden"
                                            onChange={handleAddScreenshots} />
                                        {screenshotPreviews.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                {screenshotPreviews.map((s, i) => (
                                                    <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                                        <img src={s.url} alt={s.name} className="w-full h-24 object-cover" />
                                                        <button onClick={() => removeScreenshot(i)}
                                                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full text-white
                                                                flex items-center justify-center opacity-0 group-hover:opacity-100
                                                                transition-opacity shadow-lg">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                        <p className="text-[8px] text-slate-500 p-1 truncate">{s.name}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {screenshots.length < 5 && (
                                            <button onClick={() => fileInputRef.current?.click()}
                                                className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-5
                                                    text-center hover:border-blue-300 hover:bg-blue-50/50 transition-all
                                                    flex flex-col items-center gap-2 cursor-pointer active:scale-[0.98]">
                                                <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <Camera className="w-5 h-5 text-blue-500" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-600">
                                                    {screenshots.length === 0 ? 'Tap to upload screenshots' : 'Add more screenshots'}
                                                </p>
                                                <p className="text-[10px] text-slate-400">{screenshots.length}/5 uploaded • JPG, PNG, PDF up to 5MB</p>
                                            </button>
                                        )}
                                    </div>

                                    {/* Submit */}
                                    <div className="pt-2 space-y-3 pb-2">
                                        <Button onClick={handleBookPlot} disabled={booking} size="lg"
                                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-13
                                                text-base font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all">
                                            {booking ? (
                                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
                                            ) : (
                                                <><Upload className="w-5 h-5 mr-2" /> Submit Booking</>
                                            )}
                                        </Button>
                                        <Button variant="ghost" onClick={() => setShowBookingForm(false)}
                                            className="w-full rounded-xl text-slate-400 hover:text-slate-600">Back to Plot Details</Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══ Sub-components ═══════════════════════════════════════

const SpecItem = ({ label, value, icon }) => (
    <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100">
        <div className="flex items-center gap-1.5 mb-1">
            {icon}
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-base font-bold text-slate-800">{value}</span>
    </div>
);

const FormField = ({ label, children }) => (
    <div>
        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">{label}</label>
        {children}
    </div>
);

const SectionHeader = ({ number, title }) => (
    <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white
            text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
            {number}
        </span>
        <h4 className="text-sm font-bold text-slate-700">{title}</h4>
    </div>
);

// ═══ Colony Map Grid (Interactive) ═══════════════════════

const ColonyMapGrid = ({ colonyData, selectedPlotId, isFullscreen, onToggleFullscreen, onPlotSelect }) => {
    const [hoveredPlot, setHoveredPlot] = useState(null);
    const selectedRef = useRef(null);

    const config = (() => {
        try {
            return typeof colonyData.layout_config === 'string'
                ? JSON.parse(colonyData.layout_config) : colonyData.layout_config;
        } catch { return null; }
    })();

    if (!config) return null;

    const plotLookup = {};
    (colonyData.plots || []).forEach(p => {
        try {
            const pts = typeof p.polygon_points === 'string' ? JSON.parse(p.polygon_points) : p.polygon_points;
            if (Array.isArray(pts) && pts[0]?.quadrant !== undefined) {
                plotLookup[`${pts[0].quadrant}-${pts[0].row}-${pts[0].col}`] = p;
            }
        } catch { /* noop */ }
    });

    const existingKeys = new Set(Object.keys(plotLookup));
    const { topLeft, topRight, bottomLeft, bottomRight, roadEvery = 2, roadRowOffset = 0, excludedRoads = [] } = config;
    const topRows = Math.max(topLeft?.rows || 0, topRight?.rows || 0);
    const bottomRows = Math.max(bottomLeft?.rows || 0, bottomRight?.rows || 0);

    const statusCounts = {};
    (colonyData.plots || []).forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });

    const scrollToSelected = () => {
        if (selectedRef.current) selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    };

    const renderPlot = (key) => {
        if (!existingKeys.has(key)) return null;
        const p = plotLookup[key];
        const bg = STATUS_COLORS[p?.status] || '#22c55e';
        const isAvail = p?.status === 'AVAILABLE';
        const isHovered = hoveredPlot === p?.id;
        const isSelected = selectedPlotId === p?.id;

        return (
            <div
                key={key}
                ref={isSelected ? selectedRef : undefined}
                className={`flex-1 rounded border transition-all duration-200
                    flex items-center justify-center font-bold text-white select-none relative group
                    ${isFullscreen ? 'h-11 min-w-[32px] text-[9px]' : 'h-9 min-w-[24px] text-[7px]'}
                    cursor-pointer
                    ${isSelected
                        ? 'ring-2 ring-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.6)] scale-110 z-20 border-yellow-400'
                        : isHovered
                            ? 'brightness-125 scale-105 z-10 border-white/50 shadow-lg'
                            : 'border-white/10 hover:brightness-110'}`}
                style={{ backgroundColor: bg }}
                onClick={() => p && onPlotSelect(p)}
                onMouseEnter={() => setHoveredPlot(p?.id)}
                onMouseLeave={() => setHoveredPlot(null)}
                title={`${p?.plot_number || key} — ${STATUS_LABELS[p?.status] || p?.status}`}
            >
                {/* Always show plot number */}
                <span className="text-white/90 drop-shadow leading-none truncate px-0.5">
                    {p?.plot_number || ''}
                </span>

                {/* Selected badge */}
                {isSelected && (
                    <span className={`absolute left-1/2 -translate-x-1/2 font-black text-white
                        bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full whitespace-nowrap
                        shadow-lg shadow-yellow-500/30 animate-bounce
                        ${isFullscreen ? '-top-6 text-[10px] px-3 py-1' : '-top-4.5 text-[7px] px-2 py-0.5'}`}>
                        ★ SELECTED
                    </span>
                )}

                {/* Hover tooltip */}
                {isHovered && !isSelected && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px]
                        px-2.5 py-1 rounded-lg whitespace-nowrap shadow-xl z-30 pointer-events-none font-semibold">
                        {p?.plot_number} • {STATUS_LABELS[p?.status] || p?.status}
                        {p?.total_price ? ` • ₹${Number(p.total_price).toLocaleString('en-IN')}` : ''}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full
                            border-4 border-transparent border-t-slate-900" />
                    </div>
                )}
            </div>
        );
    };

    const renderRow = (leftQ, rightQ, r, leftCols, rightCols, leftMaxRows, rightMaxRows) => {
        const leftPlots = [];
        const rightPlots = [];
        if (r < leftMaxRows) {
            for (let c = 0; c < leftCols; c++) {
                const key = `${leftQ}-${r}-${c}`;
                if (existingKeys.has(key)) leftPlots.push(renderPlot(key));
            }
        }
        if (r < rightMaxRows) {
            for (let c = 0; c < rightCols; c++) {
                const key = `${rightQ}-${r}-${c}`;
                if (existingKeys.has(key)) rightPlots.push(renderPlot(key));
            }
        }
        if (leftPlots.length === 0 && rightPlots.length === 0) return null;
        return (
            <div key={`row-${leftQ}-${r}`} className="flex items-stretch gap-0">
                <div className="flex gap-px" style={{ width: '44%' }}>
                    {leftPlots.length > 0 ? leftPlots : <div className="flex-1" />}
                </div>
                <div className="bg-slate-700/60 shrink-0 flex items-center justify-center relative"
                    style={{ width: '3%', minWidth: '10px' }}>
                    <div className="w-px h-full bg-yellow-400/15" />
                </div>
                <div className="flex gap-px" style={{ width: '53%' }}>
                    {rightPlots.length > 0 ? rightPlots : <div className="flex-1" />}
                </div>
            </div>
        );
    };

    const buildHalf = (leftQ, rightQ, totalRows, leftCfg, rightCfg) => {
        const els = [];
        for (let r = 0; r < totalRows; r++) {
            const adjustedRow = r + roadRowOffset;
            if (r > 0 && roadEvery > 0 && adjustedRow % roadEvery === 0) {
                const roadKey = `${leftQ}-${r}`;
                if (!excludedRoads.includes(roadKey)) {
                    els.push(
                        <div key={`road-${roadKey}`}
                            className={`bg-slate-700/40 flex items-center justify-center relative overflow-hidden
                                ${isFullscreen ? 'py-2' : 'py-1'}`}>
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-dashed border-white/8" />
                            </div>
                            <span className={`relative bg-slate-600/60 text-white/30 font-bold tracking-[0.2em] uppercase
                                rounded-full ${isFullscreen ? 'text-[8px] px-4 py-0.5' : 'text-[6px] px-3 py-0.5'}`}>
                                ROAD
                            </span>
                        </div>
                    );
                }
            }
            const row = renderRow(leftQ, rightQ, r, leftCfg?.cols || 0, rightCfg?.cols || 0, leftCfg?.rows || 0, rightCfg?.rows || 0);
            if (row) els.push(row);
        }
        return els;
    };

    return (
        <div className={`${isFullscreen ? 'h-full flex flex-col' : ''}`}>
            {/* Header */}
            <div className={`flex items-center justify-between flex-wrap gap-3
                ${isFullscreen
                    ? 'bg-slate-900 px-5 py-4 border-b border-slate-700'
                    : 'bg-white px-4 sm:px-6 py-4 border-y border-slate-100'}`}>
                <div>
                    <h2 className={`font-black flex items-center gap-2
                        ${isFullscreen ? 'text-white text-lg' : 'text-slate-800 text-base'}`}>
                        <Map className={`${isFullscreen ? 'w-5 h-5 text-emerald-400' : 'w-4 h-4 text-emerald-500'}`} />
                        {colonyData.name || 'Colony'} — Interactive Map
                    </h2>
                    <p className={`mt-0.5 font-medium
                        ${isFullscreen ? 'text-slate-400 text-xs' : 'text-slate-400 text-[11px]'}`}>
                        Tap any plot to view details & book
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedPlotId && (
                        <button onClick={scrollToSelected}
                            className={`flex items-center gap-1.5 rounded-xl font-semibold transition-all
                                ${isFullscreen
                                    ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 px-3 py-2 text-xs'
                                    : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 px-2.5 py-1.5 text-[10px]'}`}>
                            <MapPin className="w-3.5 h-3.5" /> Find Selected
                        </button>
                    )}
                    <button onClick={onToggleFullscreen}
                        className={`flex items-center gap-1.5 rounded-xl font-semibold transition-all
                            ${isFullscreen
                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 px-3 py-2 text-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 px-2.5 py-1.5 text-[10px]'}`}>
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        {isFullscreen ? 'Exit' : 'Fullscreen'}
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className={`flex flex-wrap gap-1.5 px-4 sm:px-6
                ${isFullscreen
                    ? 'bg-slate-900 py-3 border-b border-slate-700/50'
                    : 'bg-slate-50/80 py-2.5 border-b border-slate-100'}`}>
                {Object.entries(STATUS_COLORS).map(([key, color]) => (
                    statusCounts[key] ? (
                        <div key={key} className={`flex items-center gap-1.5 rounded-lg font-semibold
                            ${isFullscreen
                                ? 'text-[10px] text-slate-300 bg-slate-800 px-2.5 py-1'
                                : 'text-[9px] text-slate-500 bg-white px-2 py-1 border border-slate-100 shadow-sm'}`}>
                            <span className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ backgroundColor: color }} />
                            {STATUS_LABELS[key]} ({statusCounts[key]})
                        </div>
                    ) : null
                ))}
            </div>

            {/* Map Grid */}
            <div className={`overflow-auto
                ${isFullscreen ? 'flex-1 bg-slate-900 p-4' : 'bg-slate-50/50 p-3 sm:p-4'}`}>
                <div className={`rounded-2xl overflow-hidden shadow-xl border
                    ${isFullscreen
                        ? 'bg-[#0f1f0f] border-slate-700 min-h-full'
                        : 'bg-[#142514] border-slate-200'}`}>
                    <div className={`p-3 sm:p-4 ${isFullscreen ? 'min-w-[520px]' : 'min-w-[340px]'}`}>
                        <div className="flex flex-col gap-px">
                            {buildHalf('TL', 'TR', topRows, topLeft, topRight)}

                            {/* Main Road */}
                            <div className={`bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700
                                flex items-center justify-center relative overflow-hidden
                                ${isFullscreen ? 'py-3.5' : 'py-2'}`}>
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t-2 border-dashed border-yellow-400/20" />
                                </div>
                                <span className={`relative bg-slate-800 text-yellow-400/70 font-black
                                    tracking-[0.25em] uppercase rounded-full border border-yellow-400/10
                                    ${isFullscreen ? 'text-[10px] px-6 py-1' : 'text-[8px] px-4 py-0.5'}`}>
                                    ★ MAIN ROAD ★
                                </span>
                            </div>

                            {buildHalf('BL', 'BR', bottomRows, bottomLeft, bottomRight)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SharedMap;
