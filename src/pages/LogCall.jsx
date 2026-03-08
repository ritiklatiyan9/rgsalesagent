import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { cachedGet, invalidateCache } from '@/lib/queryCache';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Phone, PhoneOutgoing, PhoneIncoming, CalendarDays, Send,
  User, MessageSquare, ChevronLeft, CalendarClock, Search, X,
} from 'lucide-react';

const LogCall = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState('');
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  const [form, setForm] = useState({
    lead_id: '',
    call_type: 'OUTGOING',
    call_start: new Date().toISOString().slice(0, 16),
    call_end: '',
    outcome_id: '',
    next_action: 'NONE',
    customer_notes: '',
    buying_timeline: '',
    budget_confirmation: '',
    visit_preference_date: null,
    specific_requests: '',
    rejection_reason: '',
  });

  const [followup, setFollowup] = useState({
    followup_date: null,
    followup_time: '10:00',
    followup_type: 'CALL',
    followup_notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [outcomesData, leadsData] = await Promise.all([
          cachedGet('/calls/outcomes'),
          cachedGet('/site/leads', { staleTime: 30_000 }),
        ]);
        if (outcomesData.success) setOutcomes(outcomesData.outcomes);
        if (leadsData.success) setLeads(leadsData.leads || []);
      } catch {} finally { setLeadsLoading(false); }
    };
    fetchData();
  }, []);

  const selectedOutcome = outcomes.find((o) => o.id === form.outcome_id);
  const filteredLeads = leads.filter((l) =>
    l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.phone?.includes(leadSearch)
  );
  const selectedLead = leads.find((l) => l.id === form.lead_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lead_id) { toast.error('Please select a lead'); return; }
    if (selectedOutcome?.requires_followup && !followup.followup_date) {
      setShowFollowupModal(true);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        assigned_to: user?.id,
        ...(followup.followup_date ? {
          followup_date: format(followup.followup_date, 'yyyy-MM-dd'),
          followup_time: followup.followup_time,
          followup_type: followup.followup_type,
          followup_notes: followup.followup_notes,
        } : {}),
        visit_preference_date: form.visit_preference_date ? format(form.visit_preference_date, 'yyyy-MM-dd') : null,
      };
      const { data } = await api.post('/calls', payload);
      if (data.success) {
        toast.success('Call logged successfully!', {
          description: data.followup ? 'Follow-up has been scheduled.' : undefined,
        });
        invalidateCache('/calls');
        invalidateCache('/followups');
        navigate('/calls');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log call');
    } finally { setLoading(false); }
  };

  const handleFollowupConfirm = () => {
    setShowFollowupModal(false);
    handleSubmit(new Event('submit'));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/calls')} className="rounded-xl">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="page-title text-xl">Log Call</h1>
          <p className="page-subtitle mt-0.5">Record a new call activity</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Lead Selection + Call Type */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" /> Call Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lead Search */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead <span className="text-red-500">*</span></Label>
                {leadsLoading ? <Skeleton className="h-10 w-full rounded-lg" /> : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search leads by name or phone..." value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)} className="pl-9" />
                    </div>
                    {form.lead_id && selectedLead && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                        <User className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-indigo-900">{selectedLead.name}</span>
                        <span className="text-xs text-indigo-600">{selectedLead.phone}</span>
                        <button type="button" onClick={() => setForm((f) => ({ ...f, lead_id: '' }))} className="ml-auto">
                          <X className="h-3.5 w-3.5 text-indigo-400 hover:text-indigo-600" />
                        </button>
                      </div>
                    )}
                    {leadSearch && !form.lead_id && (
                      <div className="max-h-40 overflow-y-auto rounded-lg border bg-white shadow-sm">
                        {filteredLeads.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3 text-center">No leads found</p>
                        ) : filteredLeads.slice(0, 8).map((l) => (
                          <button key={l.id} type="button"
                            onClick={() => { setForm((f) => ({ ...f, lead_id: l.id })); setLeadSearch(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-2 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{l.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{l.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Call Type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Call Type</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, call_type: 'OUTGOING' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-all
                      ${form.call_type === 'OUTGOING' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-border text-muted-foreground hover:bg-muted/30'}`}>
                    <PhoneOutgoing className="h-4 w-4" /> Outgoing
                  </button>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, call_type: 'INCOMING' }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-all
                      ${form.call_type === 'INCOMING' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-border text-muted-foreground hover:bg-muted/30'}`}>
                    <PhoneIncoming className="h-4 w-4" /> Incoming
                  </button>
                </div>
              </div>
            </div>

            {/* Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Call Start</Label>
                <Input type="datetime-local" value={form.call_start} onChange={(e) => setForm((f) => ({ ...f, call_start: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Call End</Label>
                <Input type="datetime-local" value={form.call_end} onChange={(e) => setForm((f) => ({ ...f, call_end: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outcome & Response */}
        <Card className="card-elevated border-0">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" /> Outcome & Response
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Call Outcome</Label>
                <Select value={form.outcome_id} onValueChange={(v) => setForm((f) => ({ ...f, outcome_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                  <SelectContent>
                    {outcomes.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <div className="flex items-center gap-2">
                          {o.label}
                          {o.requires_followup && <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200">Follow-up</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next Action</Label>
                <Select value={form.next_action} onValueChange={(v) => setForm((f) => ({ ...f, next_action: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                    <SelectItem value="VISIT">Schedule Visit</SelectItem>
                    <SelectItem value="CLOSE">Close / Booking</SelectItem>
                    <SelectItem value="NO_RESPONSE">No Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Response Notes</Label>
              <Textarea placeholder="What did the customer say?..." value={form.customer_notes}
                onChange={(e) => setForm((f) => ({ ...f, customer_notes: e.target.value }))} rows={3} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buying Timeline</Label>
                <Input placeholder="e.g., Within 3 months" value={form.buying_timeline}
                  onChange={(e) => setForm((f) => ({ ...f, buying_timeline: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Budget Confirmation</Label>
                <Input placeholder="e.g., 50-60 Lakhs" value={form.budget_confirmation}
                  onChange={(e) => setForm((f) => ({ ...f, budget_confirmation: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visit Preference Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {form.visit_preference_date ? format(form.visit_preference_date, 'dd MMM yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.visit_preference_date}
                      onSelect={(d) => setForm((f) => ({ ...f, visit_preference_date: d }))} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specific Requests</Label>
                <Input placeholder="e.g., 3BHK facing east" value={form.specific_requests}
                  onChange={(e) => setForm((f) => ({ ...f, specific_requests: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rejection Reason (if any)</Label>
              <Input placeholder="Reason for not being interested..." value={form.rejection_reason}
                onChange={(e) => setForm((f) => ({ ...f, rejection_reason: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* Follow-up Section */}
        {selectedOutcome?.requires_followup && (
          <Card className="card-elevated border-0 border-l-4 border-l-amber-400">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                <CalendarClock className="h-4 w-4" /> Schedule Follow-up
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        {followup.followup_date ? format(followup.followup_date, 'dd MMM yyyy') : 'Pick date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={followup.followup_date}
                        onSelect={(d) => setFollowup((f) => ({ ...f, followup_date: d }))}
                        disabled={(d) => d < new Date()} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</Label>
                  <Input type="time" value={followup.followup_time} onChange={(e) => setFollowup((f) => ({ ...f, followup_time: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select value={followup.followup_type} onValueChange={(v) => setFollowup((f) => ({ ...f, followup_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALL">Call</SelectItem>
                      <SelectItem value="VISIT">Visit</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="MEETING">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-up Notes</Label>
                <Textarea placeholder="Notes for the follow-up..." value={followup.followup_notes}
                  onChange={(e) => setFollowup((f) => ({ ...f, followup_notes: e.target.value }))} rows={2} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/calls')}>Cancel</Button>
          <Button type="submit" disabled={loading} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 min-w-[120px]">
            {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="h-4 w-4" /> Log Call</>}
          </Button>
        </div>
      </form>

      {/* Follow-up Required Modal */}
      <Dialog open={showFollowupModal} onOpenChange={setShowFollowupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" /> Follow-up Required
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">The selected outcome requires a follow-up. Please schedule one or skip.</p>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Follow-up Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {followup.followup_date ? format(followup.followup_date, 'dd MMM yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={followup.followup_date}
                    onSelect={(d) => setFollowup((f) => ({ ...f, followup_date: d }))}
                    disabled={(d) => d < new Date()} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Time</Label>
                <Input type="time" value={followup.followup_time} onChange={(e) => setFollowup((f) => ({ ...f, followup_time: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Type</Label>
                <Select value={followup.followup_type} onValueChange={(v) => setFollowup((f) => ({ ...f, followup_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALL">Call</SelectItem>
                    <SelectItem value="VISIT">Visit</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="MEETING">Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowFollowupModal(false); handleSubmit(new Event('submit')); }}>Skip & Log</Button>
            <Button disabled={!followup.followup_date} onClick={handleFollowupConfirm} className="bg-indigo-600 hover:bg-indigo-700">Schedule & Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogCall;
