import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog, DialogContent,
} from '@/components/ui/dialog';
import {
    Calendar, FileText, Ruler, Share2, ArrowLeft, MapPin,
    User, Phone, Mail, ZoomIn, X, Copy, MessageCircle, Check, Smartphone,
} from 'lucide-react';

const STATUS_COLORS = {
    AVAILABLE: '#22c55e', BOOKED: '#eab308', SOLD: '#ef4444', RESERVED: '#f59e0b',
    BLOCKED: '#6b7280', MORTGAGE: '#8b5cf6', REGISTRY_PENDING: '#3b82f6',
};

const PlotDetail = () => {
    const { id, plotId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [plot, setPlot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [zoomOpen, setZoomOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchPlot = async () => {
            try {
                const { data } = await api.get(`/colony-maps/${id}/plots/${plotId}`);
                if (data.success) setPlot(data.plot);
            } catch { toast.error('Failed to load plot'); }
            finally { setLoading(false); }
        };
        fetchPlot();
    }, [plotId]);

    const buildShareText = () => {
        if (!plot) return '';
        const lines = [
            `🏘️ *${plot.map_name || 'Colony'} — Plot ${plot.plot_number}*`,
            '',
            `📋 *Status:* ${plot.status?.replace('_', ' ')}`,
        ];
        if (plot.block)       lines.push(`🔢 *Block:* ${plot.block}`);
        if (plot.plot_type)   lines.push(`🏠 *Type:* ${plot.plot_type}`);
        if (plot.dimensions)  lines.push(`📐 *Dimensions:* ${plot.dimensions}`);
        if (plot.area_sqft)   lines.push(`📏 *Area:* ${plot.area_sqft} sq.ft${plot.area_sqm ? ` / ${plot.area_sqm} sq.m` : ''}`);
        if (plot.facing)      lines.push(`🧭 *Facing:* ${plot.facing}`);
        if (plot.notes)       lines.push(`📝 *Notes:* ${plot.notes}`);
        const refParam = user?.sponsor_code ? `?ref=${user.sponsor_code}` : '';
        const shareUrl = `${window.location.origin}/share/plot/${plotId}${refParam}`;
        lines.push('', `🔗 View: ${shareUrl}`);
        lines.push('', `📞 Contact us for more details.`);
        return lines.join('\n');
    };

    const handleCopy = async () => {
        try {
            const refParam = user?.sponsor_code ? `?ref=${user.sponsor_code}` : '';
            const shareUrl = `${window.location.origin}/share/plot/${plotId}${refParam}`;
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch { toast.error('Copy failed'); }
    };

    const handleNativeShare = async () => {
        try {
            await navigator.share({
                title: `Plot ${plot?.plot_number} — ${plot?.map_name || 'Colony'}`,
                text: buildShareText(),
            });
        } catch { /* cancelled */ }
    };

    if (loading) {
        return (
            <div className="space-y-4 max-w-4xl mx-auto">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-80 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        );
    }

    if (!plot) {
        return (
            <div className="text-center py-20">
                <p className="text-slate-500">Plot not found</p>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate(`/colony-maps/${id}`)}>
                    Back to Map
                </Button>
            </div>
        );
    }

    const statusColor = STATUS_COLORS[plot.status] || '#6b7280';
    const shareText = buildShareText();
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/colony-maps/${id}`)} className="rounded-lg">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Map
                    </Button>
                    <span className="h-5 w-px bg-slate-200" />
                    <h1 className="text-xl font-bold text-slate-800">Plot {plot.plot_number}</h1>
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ backgroundColor: statusColor + '20', color: statusColor }}>
                        {plot.status?.replace('_', ' ')}
                    </span>
                </div>
                <Button onClick={() => setShareOpen(true)} className="rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Share2 className="w-4 h-4" /> Share Plot
                </Button>
            </div>

            {/* Map image */}
            {plot.map_image_url && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-1">
                    <div className="bg-slate-50 rounded-xl overflow-hidden relative max-h-[300px] flex justify-center items-center group">
                        <img src={plot.map_image_url} alt="Colony Layout" className="object-contain max-h-[300px] w-full" />
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-xs font-semibold px-3 py-1.5 rounded-full text-slate-700 shadow border border-slate-100">
                            {plot.map_name || 'Colony Map'}
                        </div>
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="outline" onClick={() => setZoomOpen(true)}
                                className="bg-white/90 shadow-lg text-slate-800 backdrop-blur-sm rounded-full">
                                <ZoomIn className="w-5 h-5 mr-2" /> View Full Map
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Section title="Plot Information" icon={<MapPin className="w-4 h-4 text-emerald-500" />}>
                    <Row label="Plot Number" value={plot.plot_number} />
                    <Row label="Block"       value={plot.block || '—'} />
                    <Row label="Type"        value={plot.plot_type || '—'} />
                    <Row label="Status"      value={
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: statusColor + '15', color: statusColor }}>
                            {plot.status?.replace('_', ' ')}
                        </span>
                    } />
                </Section>

                <Section title="Dimensions" icon={<Ruler className="w-4 h-4 text-blue-500" />}>
                    <Row label="Dimensions" value={plot.dimensions || '—'} />
                    <Row label="Area (sqft)" value={plot.area_sqft ? `${plot.area_sqft} sqft` : '—'} />
                    <Row label="Area (sqm)"  value={plot.area_sqm  ? `${plot.area_sqm} sqm`   : '—'} />
                    <Row label="Facing"      value={plot.facing || '—'} />
                </Section>

                <Section title="Owner Information" icon={<User className="w-4 h-4 text-purple-500" />}>
                    <Row label="Name"    value={plot.owner_name    || '—'} />
                    <Row label="Phone"   value={plot.owner_phone   || '—'} />
                    <Row label="Email"   value={plot.owner_email   || '—'} />
                    <Row label="Address" value={plot.owner_address || '—'} />
                </Section>

                <Section title="Booking & Registry" icon={<Calendar className="w-4 h-4 text-amber-500" />}>
                    <Row label="Booking Date"    value={plot.booking_date  ? new Date(plot.booking_date).toLocaleDateString()  : '—'} />
                    <Row label="Registry Date"   value={plot.registry_date ? new Date(plot.registry_date).toLocaleDateString() : '—'} />
                    <Row label="Registry Number" value={plot.registry_number || '—'} />
                </Section>

                <Section title="Tracking" icon={<FileText className="w-4 h-4 text-indigo-500" />}>
                    <Row label="Lead"           value={plot.lead_name ? `${plot.lead_name}${plot.lead_phone ? ` (${plot.lead_phone})` : ''}` : '—'} />
                    <Row label="Assigned Agent" value={plot.assigned_agent_name || '—'} />
                    <Row label="Created By"     value={plot.created_by_name || '—'} />
                    <Row label="Added On"       value={plot.created_at ? new Date(plot.created_at).toLocaleDateString() : '—'} />
                </Section>

                <Section title="Notes" icon={<FileText className="w-4 h-4 text-slate-500" />}>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{plot.notes || 'No notes'}</p>
                </Section>
            </div>

            {/* Zoom dialog */}
            <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
                <DialogContent className="max-w-5xl w-full h-[90vh] p-1 bg-black/95 overflow-hidden rounded-2xl">
                    <div className="w-full h-full relative flex items-center justify-center">
                        <div className="absolute top-4 right-4 z-50">
                            <Button variant="ghost" size="icon" onClick={() => setZoomOpen(false)}
                                className="text-white hover:bg-white/20 rounded-full h-10 w-10">
                                <X className="w-6 h-6" />
                            </Button>
                        </div>
                        <img src={plot.map_image_url} alt="Colony Layout Zoomed"
                            className="object-contain w-full h-full max-w-full max-h-full" />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Share dialog */}
            <Dialog open={shareOpen} onOpenChange={(o) => { setShareOpen(o); if (!o) setCopied(false); }}>
                <DialogContent className="w-[95vw] max-w-sm sm:max-w-md rounded-2xl p-6 overflow-y-auto">
                    {/* Header */}
                    <div className="text-center mb-4 sm:mb-6">
                        <div className="flex justify-center mb-2 sm:mb-3">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center shadow-lg"
                                style={{ backgroundColor: statusColor }}>
                                <Share2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                            </div>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Share Plot {plot.plot_number}</h2>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">{plot.map_name || 'Colony Plot'}</p>
                    </div>

                    {/* Plot details cards */}
                    <div className="grid grid-cols-2 gap-2 mb-4 sm:mb-6">
                        {plot.plot_type && (
                            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-blue-100">
                                <p className="text-xs text-slate-500 font-medium">Type</p>
                                <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{plot.plot_type}</p>
                            </div>
                        )}
                        {plot.facing && (
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-amber-100">
                                <p className="text-xs text-slate-500 font-medium">Facing</p>
                                <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{plot.facing}</p>
                            </div>
                        )}
                        {plot.area_sqft && (
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-purple-100">
                                <p className="text-xs text-slate-500 font-medium">Area</p>
                                <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{plot.area_sqft} sqft</p>
                            </div>
                        )}
                        {plot.dimensions && (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-green-100">
                                <p className="text-xs text-slate-500 font-medium">Dimensions</p>
                                <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1">{plot.dimensions}</p>
                            </div>
                        )}
                    </div>

                    {/* Shareable link section */}
                    <div className="mb-4 sm:mb-6">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Share Link</p>
                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg sm:rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <div className="bg-indigo-600 h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-500 font-medium">Public Link</p>
                                <p className="text-xs text-indigo-700 font-mono break-all mt-0.5 line-clamp-2">
                                    {`${window.location.origin}/share/plot/${plotId}${user?.sponsor_code ? `?ref=${user.sponsor_code}` : ''}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Share buttons */}
                    <div className="space-y-2 sm:space-y-3">
                        {/* WhatsApp */}
                        <a href={waUrl} target="_blank" rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-green-500/30 active:scale-95"
                            style={{ backgroundColor: '#25D366' }}>
                            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="hidden sm:inline">Share on WhatsApp</span>
                            <span className="sm:hidden">WhatsApp</span>
                        </a>

                        {/* Copy and More Options */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            <Button 
                                className={`rounded-lg sm:rounded-xl gap-1 sm:gap-2 text-xs sm:text-sm font-semibold transition-all py-2 sm:py-2.5 ${
                                    copied 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                                variant="outline"
                                onClick={handleCopy}>
                                {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
                                <span className="sm:hidden">{copied ? 'Copied!' : 'Copy'}</span>
                            </Button>
                            {typeof navigator !== 'undefined' && !!navigator.share && (
                                <Button 
                                    className="rounded-lg sm:rounded-xl gap-1 sm:gap-2 text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all py-2 sm:py-2.5"
                                    variant="outline"
                                    onClick={handleNativeShare}>
                                    <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline">Share More</span>
                                    <span className="sm:hidden">More</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="text-xs text-slate-500 text-center mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-100">
                        Share this link with clients or prospects to view plot details and book directly
                    </p>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const Section = ({ title, icon, children }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-50 bg-slate-50/50">
            {icon}
            <h3 className="text-sm font-bold text-slate-700">{title}</h3>
        </div>
        <div className="p-5 space-y-3">{children}</div>
    </div>
);

const Row = ({ label, value }) => (
    <div className="flex items-start gap-3">
        <span className="text-xs font-medium text-slate-400 w-28 shrink-0 pt-1">{label}</span>
        <div className="flex-1 text-sm text-slate-700">{value}</div>
    </div>
);

export default PlotDetail;
