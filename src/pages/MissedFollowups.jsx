import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import {
  BellRing,
  CalendarDays, ChevronLeft, ChevronRight, Filter, Search, PhoneOutgoing, Check,
} from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

const MissedFollowups = () => {
  const navigate = useNavigate();
  const [followups, setFollowups] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [datePreset, setDatePreset] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
      case 'week':
        return {
          from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      case 'month':
        return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
      case 'custom':
        return {
          from: customDateFrom ? format(customDateFrom, 'yyyy-MM-dd') : null,
          to: customDateTo ? format(customDateTo, 'yyyy-MM-dd') : null,
        };
      default:
        return { from: null, to: null };
    }
  }, [datePreset, customDateFrom, customDateTo]);

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '15');
      const range = getDateRange();
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);

      const { data } = await api.get(`/followups/missed?${params.toString()}`);
      if (data.success) {
        setFollowups(data.followups || []);
        setPagination(data.pagination || { page, totalPages: 1 });
      }
    } catch {
      toast.error('Failed to load missed follow-ups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [getDateRange]);

  const handleCallLead = async (item) => {
    const phone = item?.lead_phone;
    if (!phone) return;

    const leadId = item?.lead_id;
    if (leadId) {
      const params = new URLSearchParams({
        lead_id: String(leadId),
        lead_name: item.lead_name || 'Lead',
        lead_phone: phone,
        autoCall: 'true',
        source: 'missed-followups',
      });
      navigate(`/calls/dialer?${params.toString()}`);
      return;
    }

    const isApp = window.Capacitor?.isNativePlatform?.() || false;
    if (isApp && window.Capacitor?.Plugins?.CallNumber) {
      try {
        await window.Capacitor.Plugins.CallNumber.callNumber({ number: phone, bypassAppChooser: false });
      } catch {
        window.open(`tel:${phone}`, '_self');
      }
    } else {
      window.open(`tel:${phone}`, '_self');
    }
  };

  const handleOpenWhatsApp = (phone) => {
    if (!phone) return;
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    window.open(`https://wa.me/${waNumber}`, '_blank');
  };

  const markDone = async (followupId) => {
    if (!followupId) return;
    setActionId(followupId);
    try {
      await api.put(`/followups/${followupId}`, { status: 'COMPLETED' });
      setFollowups((prev) => prev.filter((f) => f.id !== followupId));
      toast.success('Follow-up marked completed');
    } catch {
      toast.error('Failed to update follow-up');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
            <BellRing className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Missed Follow Up</h1>
            <p className="text-xs text-muted-foreground">Overdue follow-ups needing action</p>
          </div>
        </div>
      </div>

      <Card className="card-elevated border-0">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0">
              <Filter className="h-3.5 w-3.5" /> Filters
            </div>
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v)}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <CalendarDays className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((d) => (
                  <SelectItem key={d.value} value={d.value} className="text-sm">{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {customDateFrom ? format(customDateFrom, 'dd MMM') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {customDateTo ? format(customDateTo, 'dd MMM') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <Button size="sm" onClick={() => fetchData(1)} className="h-9 gap-1.5 bg-orange-600 hover:bg-orange-700 text-xs">
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lead</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Scheduled</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned</TableHead>
                <TableHead className="text-right pr-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-28 ml-auto" /></TableCell>
                </TableRow>
              )) : followups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <BellRing className="h-10 w-10 text-slate-200" />
                      <p className="text-sm text-muted-foreground">No missed follow-ups found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : followups.map((item) => {
                const phone = item.lead_phone || '—';
                const scheduledAt = item.scheduled_at;
                return (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="text-sm font-medium">{item.lead_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{item.followup_type || 'CALL'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-700">{phone}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-red-600">
                        <CalendarDays className="h-3 w-3" />
                        {scheduledAt ? format(new Date(scheduledAt), 'dd MMM yyyy hh:mm a') : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground truncate max-w-36">{item.agent_name || '—'}</p>
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Call"
                          className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50"
                          onClick={() => handleCallLead(item)}
                        >
                          <PhoneOutgoing className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="WhatsApp"
                          className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50"
                          onClick={() => handleOpenWhatsApp(phone)}
                        >
                          <WhatsAppIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Mark Done"
                          className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          onClick={() => markDone(item.id)}
                          disabled={actionId === item.id}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="border-t border-border/40 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => fetchData(pagination.page - 1)} disabled={pagination.page <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => fetchData(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MissedFollowups;
