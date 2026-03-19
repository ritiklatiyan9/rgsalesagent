import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { PhoneOutgoing, RefreshCw, Users, ArrowLeft, Phone } from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const ShiftToCallQueue = () => {
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [callingId, setCallingId] = useState(null);

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/calls/shift-to-call?page=1&limit=200');
            if (data?.success) setQueue(data.items || []);
        } catch {
            toast.error('Failed to load shift-to-call queue');
            setQueue([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);

    const handleCall = async (item) => {
        if (!item.phone) { toast.error('No phone number available'); return; }
        setCallingId(item.queue_id);
        try {
            const isApp = window.Capacitor?.isNativePlatform?.() || false;
            await api.post('/calls/quick-log', {
                lead_id: item.lead_id,
                call_source: 'SHIFT_TO_CALL',
                shift_queue_id: item.queue_id,
            });
            if (isApp && window.Capacitor?.Plugins?.CallNumber) {
                try { await window.Capacitor.Plugins.CallNumber.callNumber({ number: item.phone, bypassAppChooser: false }); }
                catch { window.open(`tel:${item.phone}`, '_self'); }
            } else {
                window.open(`tel:${item.phone}`, '_self');
            }
            toast.success(`Calling ${item.contact_name}…`, { description: item.phone });
            setQueue((prev) => prev.filter((q) => q.queue_id !== item.queue_id));
        } catch {
            toast.error('Failed to initiate call');
        } finally {
            setCallingId(null);
        }
    };

    const handleOpenWhatsApp = (phone) => {
        if (!phone) {
            toast.error('No phone number available');
            return;
        }
        const cleaned = String(phone).replace(/[^0-9]/g, '');
        const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
        window.open(`https://wa.me/${waNumber}`, '_blank');
    };

    return (
        <div className="space-y-4 p-4 md:p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <button
                        onClick={() => navigate('/all-contacts')}
                        className="shrink-0 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        All Contacts
                    </button>
                    <span className="text-slate-300 shrink-0">/</span>
                    <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">Shift to Call Queue</h1>
                </div>
                <div className="flex items-center gap-2 justify-start sm:justify-end">
                    <Badge variant="secondary" className="gap-1">
                        <Phone className="h-3 w-3" />
                        {queue.length} Pending
                    </Badge>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchQueue}
                        disabled={loading}
                        className="h-8 gap-1.5 text-xs"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Queue Card */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-3">
                            {Array(5).fill(0).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full rounded-lg" />
                            ))}
                        </div>
                    ) : queue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="rounded-full bg-slate-100 p-4 mb-4">
                                <Users className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-700">Queue is empty</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-xs">
                                Select contacts from All Contacts and use &quot;Shift to Call&quot; to add them here.
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-4 text-xs gap-1.5"
                                onClick={() => navigate('/all-contacts')}
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Go to All Contacts
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="md:hidden p-3 space-y-2.5">
                                {queue.map((item, idx) => (
                                    <div key={item.queue_id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-mono text-slate-400">#{idx + 1}</p>
                                                <p className="text-sm font-medium text-slate-800 truncate">{item.contact_name}</p>
                                                <p className="text-xs text-slate-500 font-mono">{item.phone}</p>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="shrink-0 text-[11px] text-slate-500 border-slate-200"
                                            >
                                                {item.total_calls || 0} calls
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                            <Button
                                                size="sm"
                                                className="h-8 flex-1 gap-1.5 text-xs bg-green-500 hover:bg-green-600"
                                                disabled={callingId === item.queue_id}
                                                onClick={() => handleCall(item)}
                                            >
                                                {callingId === item.queue_id
                                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    : <PhoneOutgoing className="h-3.5 w-3.5" />}
                                                Call
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="WhatsApp"
                                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                                onClick={() => handleOpenWhatsApp(item.phone)}
                                            >
                                                <WhatsAppIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="hidden md:block divide-y divide-slate-100">
                                {queue.map((item, idx) => (
                                    <div
                                        key={item.queue_id}
                                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                                    >
                                        <span className="shrink-0 text-xs font-mono text-slate-400 w-6 text-right">{idx + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{item.contact_name}</p>
                                            <p className="text-xs text-slate-500 font-mono">{item.phone}</p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 text-[11px] text-slate-500 border-slate-200"
                                        >
                                            {item.total_calls || 0} calls
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="WhatsApp"
                                            className="shrink-0 h-9 w-9 p-0 text-green-600 hover:bg-green-50"
                                            onClick={() => handleOpenWhatsApp(item.phone)}
                                        >
                                            <WhatsAppIcon className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="shrink-0 h-9 w-9 p-0 rounded-full bg-green-500 hover:bg-green-600"
                                            disabled={callingId === item.queue_id}
                                            onClick={() => handleCall(item)}
                                        >
                                            <PhoneOutgoing className="h-4 w-4 text-white" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {queue.length > 0 && (
                <p className="text-xs text-center text-slate-400">
                    Contacts are removed from this queue after being called.
                </p>
            )}
        </div>
    );
};

export default ShiftToCallQueue;
