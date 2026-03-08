import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus, Trash2, Save, Download, Search, Phone,
  PhoneOutgoing, PhoneIncoming, CalendarDays,
  ChevronLeft, ChevronRight, ClipboardList, X, Loader2,
} from 'lucide-react';

const EMPTY_ROW = () => ({
  _id: crypto.randomUUID(),
  lead_id: '', lead_name: '', lead_phone: '',
  call_type: 'OUTGOING',
  call_date: format(new Date(), 'yyyy-MM-dd'),
  call_start_time: '', call_end_time: '',
  outcome_id: '', customer_words: '', agent_action: '',
  next_action: 'NONE', followup_date: '', followup_time: '',
});

const NEXT_ACTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'VISIT', label: 'Schedule Visit' },
  { value: 'CLOSE', label: 'Close / Booking' },
  { value: 'NO_RESPONSE', label: 'No Response' },
];

const OUTCOME_STATUS_MAP = {
  'Interested': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', short: 'Interested' },
  'Follow-up Required': { color: 'bg-amber-100 text-amber-700 border-amber-200', short: 'Follow-up' },
  'Not Reachable': { color: 'bg-red-100 text-red-700 border-red-200', short: 'Unreachable' },
  'Switched Off': { color: 'bg-rose-100 text-rose-700 border-rose-200', short: 'Off' },
  'Invalid Number': { color: 'bg-slate-100 text-slate-600 border-slate-200', short: 'Invalid' },
  'Call Back Later': { color: 'bg-sky-100 text-sky-700 border-sky-200', short: 'Callback' },
  'Budget Issue': { color: 'bg-orange-100 text-orange-700 border-orange-200', short: 'Budget' },
  'Site Visit Requested': { color: 'bg-violet-100 text-violet-700 border-violet-200', short: 'Visit' },
  'Negotiation Ongoing': { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', short: 'Negotiation' },
  'Not Interested': { color: 'bg-slate-100 text-slate-700 border-slate-200', short: 'Not Interested' },
};

const PAGE_SIZE = 15;

const calcDuration = (s, e) => {
  if (!s || !e) return '';
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  let d = (eh * 60 + em) - (sh * 60 + sm);
  if (d < 0) d += 24 * 60;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const LeadPicker = memo(({ value, leadName, leads, onChange }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return leads.slice(0, 10);
    const q = search.toLowerCase();
    return leads.filter((l) => l.name?.toLowerCase().includes(q) || l.phone?.includes(q)).slice(0, 10);
  }, [search, leads]);

  if (value && leadName) {
    return (
      <div className="flex items-center gap-2 min-w-40 bg-indigo-50/70 border border-indigo-100 rounded-md px-2.5 py-1.5 h-9">
        <span className="text-sm font-medium text-indigo-900 truncate max-w-35">{leadName}</span>
        <button type="button" onClick={() => onChange('', '', '')} className="shrink-0 text-indigo-400 hover:text-red-500 ml-auto p-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-start text-sm font-normal text-muted-foreground min-w-40 px-3 rounded-md">
          <Search className="h-4 w-4 mr-2 shrink-0" /> Search lead...
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-75 p-2 z-200 shadow-xl" align="start">
        <Input placeholder="Name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 text-sm mb-1.5" autoFocus />
        <div className="max-h-55 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No leads found</p>
          ) : filtered.map((l) => (
            <button key={l.id} type="button"
              onClick={() => { onChange(l.id, l.name, l.phone || ''); setSearch(''); setOpen(false); }}
              className="w-full text-left px-2.5 py-2 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-2.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-medium truncate text-slate-700">{l.name}</span>
              <span className="text-xs text-slate-400 ml-auto shrink-0">{l.phone}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});
LeadPicker.displayName = 'LeadPicker';

const EditableRow = memo(({ row, index, outcomes, leads, onUpdate, onDelete }) => {
  const handleChange = useCallback((field, value) => onUpdate(row._id, field, value), [row._id, onUpdate]);
  const outcomeLabel = outcomes.find((o) => o.id === row.outcome_id)?.label;
  const statusInfo = outcomeLabel ? OUTCOME_STATUS_MAP[outcomeLabel] : null;
  const duration = calcDuration(row.call_start_time, row.call_end_time);

  return (
    <TableRow className="group hover:bg-muted/30 transition-colors">
      <TableCell className="text-center text-xs text-muted-foreground font-mono w-10">{index + 1}</TableCell>
      <TableCell className="min-w-38">
        <LeadPicker value={row.lead_id} leadName={row.lead_name} leads={leads}
          onChange={(id, name, phone) => { onUpdate(row._id, 'lead_id', id); onUpdate(row._id, 'lead_name', name); onUpdate(row._id, 'lead_phone', phone); }} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground min-w-25">{row.lead_phone || '—'}</TableCell>
      <TableCell className="min-w-25">
        <div className="flex gap-1">
          <button type="button" onClick={() => handleChange('call_type', 'OUTGOING')}
            className={`p-1 rounded transition-colors ${row.call_type === 'OUTGOING' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}>
            <PhoneOutgoing className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => handleChange('call_type', 'INCOMING')}
            className={`p-1 rounded transition-colors ${row.call_type === 'INCOMING' ? 'bg-emerald-100 text-emerald-600' : 'text-slate-300 hover:text-slate-500'}`}>
            <PhoneIncoming className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
      <TableCell className="min-w-35">
        <Input type="date" value={row.call_date} onChange={(e) => handleChange('call_date', e.target.value)} className="h-9 text-sm px-2.5 rounded-md" />
      </TableCell>
      <TableCell className="min-w-27.5">
        <Input type="time" value={row.call_start_time} onChange={(e) => handleChange('call_start_time', e.target.value)} className="h-9 text-sm px-2.5 rounded-md" />
      </TableCell>
      <TableCell className="min-w-27.5">
        <Input type="time" value={row.call_end_time} onChange={(e) => handleChange('call_end_time', e.target.value)} className="h-9 text-sm px-2.5 rounded-md" />
      </TableCell>
      <TableCell className="text-sm font-medium text-center min-w-17.5">
        <span className={duration ? 'text-indigo-600' : 'text-muted-foreground'}>{duration || '—'}</span>
      </TableCell>
      <TableCell className="min-w-42.5">
        <Select value={row.outcome_id} onValueChange={(v) => handleChange('outcome_id', v)}>
          <SelectTrigger className="h-9 text-sm px-3 rounded-md"><SelectValue placeholder="Outcome..." /></SelectTrigger>
          <SelectContent className="z-200">
            {outcomes.map((o) => <SelectItem key={o.id} value={o.id} className="text-sm">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="min-w-50">
        <Input placeholder="What customer said..." value={row.customer_words} onChange={(e) => handleChange('customer_words', e.target.value)} className="h-9 text-sm px-2.5 rounded-md" />
      </TableCell>
      <TableCell className="min-w-50">
        <Input placeholder="Action taken..." value={row.agent_action} onChange={(e) => handleChange('agent_action', e.target.value)} className="h-9 text-sm px-2.5 rounded-md" />
      </TableCell>
      <TableCell className="min-w-35">
        <Input type="date" value={row.followup_date} onChange={(e) => handleChange('followup_date', e.target.value)} className="h-9 text-sm px-2.5 rounded-md" />
      </TableCell>
      <TableCell className="min-w-27.5">
        <Input type="time" value={row.followup_time} onChange={(e) => handleChange('followup_time', e.target.value)} className="h-9 text-sm px-2.5 rounded-md" />
      </TableCell>
      <TableCell className="min-w-40">
        <Select value={row.next_action} onValueChange={(v) => handleChange('next_action', v)}>
          <SelectTrigger className="h-9 text-sm px-3 rounded-md"><SelectValue /></SelectTrigger>
          <SelectContent className="z-200">
            {NEXT_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value} className="text-sm">{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="min-w-27.5">
        {statusInfo ? (
          <Badge variant="outline" className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusInfo.color}`}>{statusInfo.short}</Badge>
        ) : <span className="text-sm text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="w-10">
        <Button variant="ghost" size="icon" onClick={() => onDelete(row._id)}
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
});
EditableRow.displayName = 'EditableRow';

const DailyCallEntry = () => {
  const [rows, setRows] = useState([EMPTY_ROW()]);
  const [leads, setLeads] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const updateRow = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [outcomesData, leadsData] = await Promise.all([
          cachedGet('/calls/outcomes'),
          api.get('/leads?limit=300'),
        ]);
        if (outcomesData.success) setOutcomes(outcomesData.outcomes);
        const ld = leadsData.data;
        if (ld?.success) setLeads(ld.leads || []);
      } catch (err) {
        console.error('DailyEntry init error:', err);
      } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const addRow = useCallback(() => setRows((prev) => [...prev, EMPTY_ROW()]), []);

  const deleteRow = useCallback((id) => {
    setRows((prev) => {
      if (prev.length <= 1) { toast.info('Keep at least one row'); return prev; }
      return prev.filter((r) => r._id !== id);
    });
  }, []);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => r.lead_name?.toLowerCase().includes(q) || r.lead_phone?.includes(q) || r.customer_words?.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const handleBulkSave = async () => {
    const validRows = rows.filter((r) => r.lead_id);
    if (validRows.length === 0) { toast.error('No valid rows. Please select a lead for each row.'); return; }
    setSaving(true);
    try {
      const callEntries = validRows.map((r) => {
        const callDate = r.call_date || format(new Date(), 'yyyy-MM-dd');
        return {
          lead_id: r.lead_id,
          assigned_to: user?.id,
          call_type: r.call_type,
          call_start: r.call_start_time ? `${callDate}T${r.call_start_time}:00` : new Date().toISOString(),
          call_end: r.call_end_time ? `${callDate}T${r.call_end_time}:00` : null,
          outcome_id: r.outcome_id || null,
          next_action: r.next_action,
          customer_words: r.customer_words || null,
          agent_action: r.agent_action || null,
          customer_notes: r.customer_words || null,
          followup_date: r.followup_date || null,
          followup_time: r.followup_time || null,
        };
      });
      const { data } = await api.post('/calls/bulk', { calls: callEntries });
      if (data.success) {
        toast.success(data.message, { description: data.followups?.length ? `${data.followups.length} follow-ups scheduled` : undefined });
        invalidateCache('/calls');
        invalidateCache('/followups');
        setRows([EMPTY_ROW()]);
        setCurrentPage(1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save calls');
    } finally { setSaving(false); }
  };

  const handleExportCSV = useCallback(() => {
    const headers = ['Lead Name','Phone','Call Type','Date','Start Time','End Time','Duration','Outcome','Customer Words','Agent Action','Follow-up Date','Follow-up Time','Next Step'];
    const csvRows = rows.filter((r) => r.lead_id).map((r) => {
      const outcomeLabel = outcomes.find((o) => o.id === r.outcome_id)?.label || '';
      const nextLabel = NEXT_ACTIONS.find((a) => a.value === r.next_action)?.label || '';
      return [r.lead_name, r.lead_phone, r.call_type, r.call_date, r.call_start_time, r.call_end_time, calcDuration(r.call_start_time, r.call_end_time), outcomeLabel, r.customer_words, r.agent_action, r.followup_date, r.followup_time, nextLabel].map((v) => `"${(v || '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-calls-${filterDate || format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }, [rows, outcomes, filterDate]);

  const validCount = rows.filter((r) => r.lead_id).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-125 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Daily Call Entry</h1>
            <p className="text-xs text-muted-foreground">Log your daily call activity in bulk</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 border-indigo-200">
            {rows.length} rows · {validCount} ready
          </Badge>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={validCount === 0} className="gap-1.5 text-xs h-8">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={handleBulkSave} disabled={saving || validCount === 0}
            className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700 min-w-25">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      <Card className="card-elevated border-0">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-45 max-w-70">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search leads, phone, notes..." value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-8 h-8 text-xs" />
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="h-8 text-xs w-35" />
            </div>
            <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs h-8 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" /> Add Row
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100/80 hover:bg-slate-100/80">
                {['#','Lead','Phone','Type','Date','Start','End','Dur.','Outcome','Customer Words','Agent Action','F/U Date','F/U Time','Next Step','Status',''].map((h, i) => (
                  <TableHead key={i} className={`text-xs font-semibold uppercase tracking-wider text-slate-600 sticky top-0 bg-slate-100/80 z-10 py-3.5 ${i === 0 ? 'text-center w-12.5' : ''} ${i === 7 ? 'text-center' : ''}`}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8 text-slate-300" />
                      <p className="text-sm">No entries yet</p>
                      <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs mt-1">
                        <Plus className="h-3.5 w-3.5" /> Add First Row
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedRows.map((row, idx) => (
                <EditableRow key={row._id} row={row} index={(currentPage - 1) * PAGE_SIZE + idx}
                  outcomes={outcomes} leads={leads} onUpdate={updateRow} onDelete={deleteRow} />
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-border/40 bg-slate-50/50 px-4 py-2.5 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={addRow} className="gap-1.5 text-xs text-indigo-600 hover:bg-indigo-50">
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-start gap-2 px-1">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-semibold text-slate-600">Tips:</span> Search leads to assign each row. Duration auto-calculates. Fill rows then click <span className="font-semibold text-indigo-600">Save All</span>.
        </p>
      </div>
    </div>
  );
};

export default DailyCallEntry;
