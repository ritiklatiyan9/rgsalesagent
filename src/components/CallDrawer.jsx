import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallDrawer } from '@/context/CallDrawerContext';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall,
  ArrowLeft, UserPlus, Clock, Calendar, Edit3, Save, Loader2,
  Mail, MapPin, Briefcase, Eye, Users, CalendarDays, X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import api from '@/lib/axios';
import { cachedGet, getCachedSync, invalidateCache } from '@/lib/queryCache';
import {
  formatCallType,
  formatCallDuration,
  formatCallTimestamp,
  defaultLeadName,
} from '@/utils/callParser';

// ─── Constants ───────────────────────────────────────────────
const CALL_TYPE_META = {
  INCOMING: { icon: PhoneIncoming, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-200' },
  OUTGOING: { icon: PhoneOutgoing, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-200' },
  MISSED:   { icon: PhoneMissed,   color: 'text-rose-600',  bg: 'bg-rose-50',  border: 'border-rose-200',  ring: 'ring-rose-200'  },
  UNKNOWN:  { icon: PhoneCall,     color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', ring: 'ring-slate-200' },
};

const SOURCE_UI_OPTIONS = [
  { value: 'DIRECT_CALL',  label: 'Direct Call'  },
  { value: 'DIRECT_VISIT', label: 'Direct Visit' },
  { value: 'REFERRAL',     label: 'Referral'     },
];

// Status values must match VALID_STATUSES in backend/src/controllers/lead.controller.js.
// Order = call-flow + outcome buckets so the most common picks sit at the top.
const LEAD_STATUS_OPTIONS = [
  { value: 'NEW',           label: 'New Lead' },
  { value: 'CONTACTED',     label: 'Contacted' },
  { value: 'INTERESTED',    label: 'Interested' },
  { value: 'SITE_VISIT',    label: 'Site Visit' },
  { value: 'NEGOTIATION',   label: 'Negotiation' },
  { value: 'BOOKED',        label: 'Booked' },
  { value: 'LOST',          label: 'Lost' },
  { value: 'NOT_ANSWERING', label: 'Call Cut / Not Answering' },
  { value: 'INCOMING_OFF',  label: 'Incoming Off' },
  { value: 'SWITCH_OFF',    label: 'Switch Off' },
];
const LEAD_CATEGORY_VALUES = ['PRIME','HOT','NORMAL','COLD','DEAD'];
const FOLLOWUP_TYPES       = ['CALL','WHATSAPP','VISIT','MEETING'];

// ─── Helpers ─────────────────────────────────────────────────
const normalizePhone  = (v) => String(v || '').replace(/\D/g, '');
const tail10          = (v) => normalizePhone(v).slice(-10);
const phonesMatch     = (a, b) => {
  const na = normalizePhone(a), nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb || tail10(na) === tail10(nb);
};

const mapApiSourceToUi = (value) => {
  if (value === 'Direct')       return 'DIRECT_CALL';
  if (value === 'Direct Visit') return 'DIRECT_VISIT';
  if (value === 'Referral')     return 'REFERRAL';
  return 'DIRECT_CALL';
};
const mapUiSourceToApi = (value) => {
  if (value === 'DIRECT_CALL')  return 'Direct';
  if (value === 'DIRECT_VISIT') return 'Direct Visit';
  if (value === 'REFERRAL')     return 'Referral';
  return 'Other';
};

const extractReferralName = (notes) => {
  const m = String(notes || '').match(/\[Referee:\s*(.+?)\]/i);
  return m?.[1]?.trim() || '';
};
const composeNotes = (notes, referralName) => {
  const base = String(notes || '').replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim();
  if (!referralName?.trim()) return base || null;
  return `${base}${base ? ' ' : ''}[Referee: ${referralName.trim()}]`;
};

const toISODate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const getDefaultLeadForm = (callData) => ({
  id: null,
  name: String(callData?.contactName || callData?.leadName || callData?.name || '').trim() || defaultLeadName(callData?.phoneNumber),
  phone: callData?.phoneNumber ?? '',
  email: '',
  address: '',
  profession: '',
  status: 'CONTACTED',
  lead_category: '',
  source_ui: 'DIRECT_CALL',
  referral_name: '',
  notes: '',
});

// ─── Section wrapper ─────────────────────────────────────────
function Section({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, iconBg, iconColor, title, action }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</p>
      </div>
      {action}
    </div>
  );
}

// ─── Main Drawer ────────────────────────────────────────────────
export default function CallDrawer() {
  const navigate  = useNavigate();
  const { open, callData, closeDrawer } = useCallDrawer();

  // We use the existing callData directly from context
  const meta     = CALL_TYPE_META[callData?.callType] ?? CALL_TYPE_META.UNKNOWN;
  const CallIcon = meta.icon;

  // ── form state ──
  const [leadForm, setLeadForm]       = useState(getDefaultLeadForm(callData));
  const [isExistingLead, setIsExistingLead] = useState(false);
  const [isEditingLead, setIsEditingLead]   = useState(false);
  const [leadCallHistory, setLeadCallHistory] = useState([]);
  const [loadingContext, setLoadingContext]    = useState(false);
  const [savingLead, setSavingLead]           = useState(false);
  const [savingFutureAction, setSavingFutureAction] = useState(false);
  const [showScheduleForm, setShowScheduleForm]     = useState(false);
  const [showSourceModal, setShowSourceModal]       = useState(false);
  const [errors, setErrors] = useState({});
  const [futureAction, setFutureAction] = useState({
    followup_type: 'CALL',
    scheduled_date: toISODate(new Date()),
    scheduled_time: '10:00',
    notes: '',
  });

  const [accordionValue, setAccordionValue] = useState([]);

  const setLeadField = useMemo(() => {
    const cache = {};
    return (field) => {
      if (!cache[field]) {
        cache[field] = (value) => setLeadForm((prev) => ({ ...prev, [field]: value }));
      }
      return cache[field];
    };
  }, []);

  // Build a form object from a lead record (server response shape).
  const formFromLead = useCallback((lead) => {
    if (!lead) return getDefaultLeadForm(callData);
    return {
      id: lead.id,
      name: lead.name || defaultLeadName(callData?.phoneNumber),
      phone: lead.phone || callData?.phoneNumber || '',
      email: lead.email || '',
      address: lead.address || '',
      profession: lead.profession || '',
      status: lead.status || 'CONTACTED',
      lead_category: lead.lead_category || '',
      source_ui: mapApiSourceToUi(lead.lead_source),
      referral_name: extractReferralName(lead.notes),
      notes: String(callData?.customerNotes || '').trim(),
    };
  }, [callData]);

  // ── fetch lead context — optimistic, parallel, cache-backed ──
  // Strategy:
  // 1. Synchronously prefill the form from `callData` so the drawer renders
  //    a usable form immediately — never a blank/disabled state.
  // 2. If the server response is already in the in-memory cache, adopt it
  //    on the same tick (no flicker).
  // 3. Otherwise fire the lookups in parallel in the background and merge
  //    when they return. The drawer is interactive the whole time.
  const fetchLeadContext = useCallback(async () => {
    // (1) Optimistic synchronous prefill — never block the render.
    const optimistic = getDefaultLeadForm(callData);
    setLeadForm(optimistic);
    setIsExistingLead(false);
    setIsEditingLead(false);
    setLeadCallHistory([]);
    setAccordionValue([]);

    if (!callData?.phoneNumber) return;

    // (2) Cache-hit path — if we already have the lead in memory, use it.
    let matchedLead = null;
    if (callData?.leadId) {
      const cached = getCachedSync(`/leads/${callData.leadId}`);
      if (cached?.success && cached.lead) matchedLead = cached.lead;
    }
    if (matchedLead) {
      setIsExistingLead(true);
      setLeadForm(formFromLead(matchedLead));
      const cachedHistory = getCachedSync(`/calls/lead/${matchedLead.id}`);
      if (cachedHistory?.success) setLeadCallHistory(cachedHistory.calls || []);
    }

    // (3) Background revalidation — never blocks the form. Quiet loading
    //     indicator only for the timeline / profile sections that need it.
    setLoadingContext(true);
    try {
      // Resolve the lead — prefer the explicit id, otherwise search by phone.
      if (!matchedLead && callData?.leadId) {
        try {
          const data = await cachedGet(`/leads/${callData.leadId}`, { staleTime: 30_000, cacheTime: 300_000 });
          if (data?.success) matchedLead = data.lead;
        } catch { /* ignore */ }
      }
      if (!matchedLead) {
        try {
          const search = encodeURIComponent(callData.phoneNumber);
          const data = await cachedGet(`/leads?search=${search}&limit=20`, { staleTime: 60_000, cacheTime: 300_000 });
          const leads = data?.success ? (data.leads || []) : [];
          matchedLead = leads.find((l) => phonesMatch(l.phone, callData.phoneNumber)) || null;
        } catch { /* ignore */ }
      }

      if (!matchedLead) {
        // No lead — try contact directory in parallel for a name suggestion.
        try {
          const search = encodeURIComponent(callData.phoneNumber);
          const data = await cachedGet(`/contacts?search=${search}&limit=10`, { staleTime: 60_000, cacheTime: 600_000 });
          const contacts = data?.success ? (data.contacts || []) : [];
          const matchedContact = contacts.find((c) => phonesMatch(c.phone, callData.phoneNumber));
          if (matchedContact?.name) {
            setLeadForm((prev) => ({ ...prev, name: prev.name || matchedContact.name }));
          }
        } catch { /* ignore */ }
        setAccordionValue(['profile']);
        return;
      }

      // Lead resolved — fetch full record + history in parallel, but don't
      // hold up the form: each result patches state independently.
      const fullLeadPromise = cachedGet(`/leads/${matchedLead.id}`, { staleTime: 30_000, cacheTime: 300_000 }).catch(() => null);
      const historyPromise  = cachedGet(`/calls/lead/${matchedLead.id}`, { staleTime: 30_000, cacheTime: 300_000 }).catch(() => null);

      const [leadRes, callRes] = await Promise.all([fullLeadPromise, historyPromise]);

      const fullLead = leadRes?.success ? leadRes.lead : matchedLead;
      const history  = callRes?.success ? (callRes.calls || []) : [];

      setIsExistingLead(true);
      setLeadForm(formFromLead(fullLead));
      setLeadCallHistory(history);
      setFutureAction((prev) => ({
        ...prev,
        notes: prev.notes || `Follow up after ${formatCallType(callData?.callType)} call`,
      }));
    } catch {
      // Form already shows the optimistic prefill — leave it as-is.
      setAccordionValue(['profile']);
    } finally {
      setLoadingContext(false);
    }
  }, [callData, formFromLead]);

  useEffect(() => {
    setErrors({});
    fetchLeadContext();
  }, [fetchLeadContext]);

  // ── redirect if no state ──
  // Removed: page now shows demo data when accessed directly

  // ── validate ──
  const validate = () => {
    const e = {};
    if (!leadForm.name.trim())  e.name  = 'Name is required';
    if (!leadForm.phone.trim()) e.phone = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── save lead ──
  const saveLead = async () => {
    if (!validate()) return;
    setSavingLead(true);
    try {
      const payload = {
        name: leadForm.name.trim(),
        phone: leadForm.phone.trim(),
        email: leadForm.email?.trim() || null,
        address: leadForm.address?.trim() || null,
        profession: leadForm.profession?.trim() || null,
        status: leadForm.status || 'CONTACTED',
        lead_category: leadForm.lead_category || null,
        lead_source: mapUiSourceToApi(leadForm.source_ui),
        notes: composeNotes('', leadForm.referral_name),
      };

      let result;
      if (isExistingLead && leadForm.id) {
        const { data } = await api.put(`/leads/${leadForm.id}`, payload);
        result = data;
      } else {
        const { data } = await api.post('/leads', payload);
        result = data;
      }

      if (result?.success) {
        toast.success(isExistingLead ? 'Client updated' : 'Client saved');
        setIsExistingLead(true);
        setIsEditingLead(false);

        const cid = callData?.callId;
        const savedLeadId = result?.lead?.id || leadForm.id || null;
        const savedLeadName = leadForm.name?.trim() || null;
        const savedNotes = leadForm.notes?.trim() || null;

        // Patch the local Recents row instantly (no server round-trip), so
        // the row picks up the client name as soon as the user hits Save.
        // The `phone` is included so the store can ALSO patch any unlinked
        // sibling rows for the same number (e.g. an optimistic local row that
        // was never linked to the server cid because of the bridge race).
        try {
          window.dispatchEvent(new CustomEvent('rg:call-updated', {
            detail: {
              callId: cid,
              leadId: savedLeadId,
              leadName: savedLeadName,
              customerNotes: savedNotes,
              phone: leadForm.phone || callData?.phoneNumber || null,
            },
          }));
        } catch { /* noop */ }

        // Persist the call→lead link + notes in the background; do NOT block
        // the UI on this round-trip.
        if (cid) {
          const body = { customer_notes: savedNotes };
          if (savedLeadId) body.lead_id = savedLeadId;
          api.put(`/calls/${cid}`, body).catch(() => { /* silent */ });
          try {
            invalidateCache('/calls/dialer-history');
            if (savedLeadId) {
              invalidateCache(`/calls/lead/${savedLeadId}`);
              invalidateCache(`/leads/${savedLeadId}`);
            }
          } catch { /* silent */ }
        }

        await fetchLeadContext();
      } else {
        toast.error(result?.message || 'Failed to save client');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Network error — could not save client');
    } finally {
      setSavingLead(false);
    }
  };

  // ── save future action ──
  const saveFutureAction = async () => {
    if (!leadForm?.id) { toast.error('Save client first'); return; }
    if (!futureAction.scheduled_date) { toast.error('Date is required'); return; }
    setSavingFutureAction(true);
    try {
      const { data } = await api.post('/followups', {
        lead_id: leadForm.id,
        followup_type: futureAction.followup_type,
        scheduled_date: futureAction.scheduled_date,
        scheduled_time: futureAction.scheduled_time || undefined,
        notes: futureAction.notes?.trim() || null,
      });
      if (data?.success) {
        invalidateCache('/followups');
        invalidateCache('/followups/counts');
        invalidateCache('/followups/scheduled');
        toast.success('Follow-up scheduled');
        setFutureAction({ followup_type: 'CALL', scheduled_date: toISODate(new Date()), scheduled_time: '10:00', notes: '' });
        setShowScheduleForm(false);
      } else {
        toast.error(data?.message || 'Unable to save follow-up');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to save follow-up');
    } finally {
      setSavingFutureAction(false);
    }
  };

  const canSaveLead = !savingLead && !!leadForm.name.trim() && !!leadForm.phone.trim();

  if (!callData) return null;
  return (
    <Drawer open={open} onOpenChange={(val) => { if (!val) closeDrawer(); }}>
      <DrawerContent className="max-h-[92vh] sm:max-h-[90vh] bg-slate-50 flex flex-col">
        {/* ── Top bar ── */}
        <DrawerHeader className="px-3 pt-2.5 pb-2 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-slate-200">
          <button
            onClick={closeDrawer}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 min-w-0 text-left">
            <DrawerTitle className="text-[13px] font-medium text-slate-900 truncate m-0">Call Summary</DrawerTitle>
            <p className="text-[10.5px] text-slate-500 truncate m-0">
              <span className={meta.color}>{formatCallType(callData?.callType)}</span>
              {callData?.phoneNumber ? <span className="font-mono"> · {callData.phoneNumber}</span> : null}
              {callData?.duration ? <span> · {formatCallDuration(callData.duration)}</span> : null}
            </p>
          </div>
        </DrawerHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-3 pb-4 space-y-2.5">

        {/* ── Missed call notice — single subtle line, no chunky card ── */}
        {callData?.callType === 'MISSED' && (
          <p className="text-[11px] text-rose-600 flex items-center gap-1.5">
            <PhoneMissed className="h-3.5 w-3.5 shrink-0" />
            Missed call — follow up with this client.
          </p>
        )}

        {/* ── Core fields ── */}
        <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5">
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
            <div className="space-y-1 min-w-0">
              <Label className="text-[10.5px] text-slate-500 font-normal">Status</Label>
              <Select value={leadForm.status} onValueChange={setLeadField('status')}>
                <SelectTrigger className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus:ring-1 focus:ring-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-[12.5px]">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-[10.5px] text-slate-500 font-normal">Category</Label>
              <Select
                value={leadForm.lead_category || 'NONE'}
                onValueChange={(v) => setLeadField('lead_category')(v === 'NONE' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus:ring-1 focus:ring-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" className="text-[12.5px]">Uncategorized</SelectItem>
                  {LEAD_CATEGORY_VALUES.map((c) => <SelectItem key={c} value={c} className="text-[12.5px]">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
            <div className="space-y-1 min-w-0">
              <Label className="text-[10.5px] text-slate-500 font-normal">Source</Label>
              <Select value={leadForm.source_ui} onValueChange={setLeadField('source_ui')}>
                <SelectTrigger className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus:ring-1 focus:ring-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_UI_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value} className="text-[12.5px]">{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {leadForm.source_ui === 'REFERRAL' && (
              <div className="space-y-1 min-w-0 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[10.5px] text-slate-500 font-normal">Referee Name</Label>
                <Input
                  value={leadForm.referral_name}
                  onChange={(e) => setLeadField('referral_name')(e.target.value)}
                  placeholder="Who referred?"
                  className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-[10.5px] text-slate-500 font-normal">Call Notes</Label>
            <Textarea
              value={leadForm.notes}
              onChange={(e) => setLeadField('notes')(e.target.value)}
              placeholder="Discussion summary, objections, next steps…"
              className="min-h-20 text-[12.5px] resize-none rounded-md bg-white border-slate-200 p-2.5 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300"
            />
          </div>
        </div>

        {/* ── Progressive Disclosure Accordions ── */}
        <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue} className="space-y-2">

          {/* Client Profile */}
          <AccordionItem value="profile" className="rounded-md border border-slate-200 bg-white overflow-hidden">
            <AccordionTrigger className="hover:no-underline px-3 py-2.5 text-left">
              <div className="flex items-center gap-2 w-full">
                <Users className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="text-[12.5px] font-medium text-slate-900">Client Profile</span>
                <span className="text-[10.5px] text-slate-500 ml-auto mr-2">{isExistingLead ? 'Saved' : 'New'}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1">
              {isExistingLead && (
                <div className="flex justify-end mb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 rounded-md"
                    onClick={(e) => { e.preventDefault(); setIsEditingLead((v) => !v); }}
                  >
                    <Edit3 className="h-3 w-3" />
                    {isEditingLead ? 'Lock' : 'Edit'}
                  </Button>
                </div>
              )}

              {(
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10.5px] text-slate-500 font-normal">Name <span className="text-rose-500">*</span></Label>
                    <Input
                      value={leadForm.name}
                      onChange={(e) => setLeadField('name')(e.target.value)}
                      placeholder="Full name"
                      disabled={isExistingLead && !isEditingLead}
                      className={`h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 ${errors.name ? 'border-rose-400' : ''}`}
                    />
                    {errors.name && <p className="text-[10.5px] text-rose-500">{errors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10.5px] text-slate-500 font-normal">Phone <span className="text-rose-500">*</span></Label>
                    <Input
                      value={leadForm.phone}
                      onChange={(e) => setLeadField('phone')(e.target.value)}
                      placeholder="+91 98765 43210"
                      disabled={isExistingLead && !isEditingLead}
                      className={`h-9 text-[12.5px] font-mono rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 ${errors.phone ? 'border-rose-400' : ''}`}
                    />
                    {errors.phone && <p className="text-[10.5px] text-rose-500">{errors.phone}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10.5px] text-slate-500 font-normal">Email</Label>
                    <Input
                      value={leadForm.email}
                      onChange={(e) => setLeadField('email')(e.target.value)}
                      placeholder="john@example.com"
                      disabled={isExistingLead && !isEditingLead}
                      className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                    <div className="space-y-1 min-w-0">
                      <Label className="text-[10.5px] text-slate-500 font-normal">Address</Label>
                      <Input
                        value={leadForm.address}
                        onChange={(e) => setLeadField('address')(e.target.value)}
                        placeholder="City, State"
                        disabled={isExistingLead && !isEditingLead}
                        className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label className="text-[10.5px] text-slate-500 font-normal">Profession</Label>
                      <Input
                        value={leadForm.profession}
                        onChange={(e) => setLeadField('profession')(e.target.value)}
                        placeholder="Software Engineer"
                        disabled={isExistingLead && !isEditingLead}
                        className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Timeline */}
          <AccordionItem value="timeline" className="rounded-md border border-slate-200 bg-white overflow-hidden">
            <AccordionTrigger className="hover:no-underline px-3 py-2.5 text-left">
              <div className="flex items-center gap-2 w-full">
                <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="text-[12.5px] font-medium text-slate-900">Call Timeline</span>
                <span className="text-[10.5px] text-slate-500 ml-auto mr-2">{leadCallHistory.length}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1 max-h-[260px] overflow-y-auto">
              {leadCallHistory.length === 0 ? (
                <p className="text-[11px] text-center text-slate-400 py-3">
                  {loadingContext ? 'Loading…' : 'No previous calls'}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leadCallHistory.map((call) => (
                    <div key={call.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        {call.call_type === 'MISSED'
                          ? <PhoneMissed className="h-3 w-3 text-rose-500 shrink-0" />
                          : <Clock className="h-3 w-3 text-slate-400 shrink-0" />}
                        <p className="text-[11px] text-slate-700">
                          {formatDate(call.call_start)} · {formatTime(call.call_start)}
                          <span className="text-slate-500 font-mono"> · {formatCallDuration(call.duration_seconds)}</span>
                        </p>
                        {call.outcome_label && (
                          <span className="text-[10px] text-slate-500 ml-auto">{call.outcome_label}</span>
                        )}
                      </div>
                      {call.customer_notes && (
                        <p className="text-[10.5px] text-slate-600 leading-relaxed mt-1 pl-5 line-clamp-2">
                          {call.customer_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Schedule Follow-up */}
          <AccordionItem value="schedule" className="rounded-md border border-slate-200 bg-white overflow-hidden">
            <AccordionTrigger className="hover:no-underline px-3 py-2.5 text-left">
              <div className="flex items-center gap-2 w-full">
                <CalendarDays className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="text-[12.5px] font-medium text-slate-900">Schedule Follow-up</span>
                {!leadForm?.id && <span className="text-[10.5px] text-amber-600 ml-auto mr-2">Save client first</span>}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-1">
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10.5px] text-slate-500 font-normal">Type</Label>
                    <Select value={futureAction.followup_type} onValueChange={(v) => setFutureAction((p) => ({ ...p, followup_type: v }))}>
                      <SelectTrigger className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus:ring-1 focus:ring-slate-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FOLLOWUP_TYPES.map((t) => <SelectItem key={t} value={t} className="text-[12.5px]">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10.5px] text-slate-500 font-normal">Date</Label>
                    <Input
                      type="date"
                      min={toISODate(new Date())}
                      value={futureAction.scheduled_date}
                      onChange={(e) => setFutureAction((p) => ({ ...p, scheduled_date: e.target.value }))}
                      className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10.5px] text-slate-500 font-normal">Time</Label>
                    <Input
                      type="time"
                      value={futureAction.scheduled_time}
                      onChange={(e) => setFutureAction((p) => ({ ...p, scheduled_time: e.target.value }))}
                      className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                    />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <Label className="text-[10.5px] text-slate-500 font-normal">Notes</Label>
                    <Input
                      value={futureAction.notes}
                      onChange={(e) => setFutureAction((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Topic"
                      className="h-9 text-[12.5px] rounded-md bg-white border-slate-200 text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="h-8 gap-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11.5px] font-medium px-3 shadow-none"
                    onClick={saveFutureAction}
                    disabled={!leadForm?.id || savingFutureAction}
                  >
                    {savingFutureAction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Confirm
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        </div>
        </div>

        {/* ── Sticky Footer ── */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-3 py-2.5 pb-safe flex items-center gap-2 z-10">
          <Button
            variant="ghost"
            disabled={savingLead || savingFutureAction}
            className="h-9 text-[12.5px] font-medium gap-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-none px-3"
            onClick={closeDrawer}
          >
            Cancel
          </Button>
          <Button
            onClick={saveLead}
            disabled={!canSaveLead}
            className="flex-1 h-9 gap-1.5 text-[12.5px] font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
          >
            {savingLead ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving
              </span>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                {isExistingLead ? 'Update' : 'Save Client'}
              </>
            )}
          </Button>
        </div>

      {/* ── Source Details Modal ── */}
      <Dialog open={showSourceModal} onOpenChange={setShowSourceModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-bold">Source Information</DialogTitle>
            <DialogDescription className="text-xs">How this lead was acquired</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Lead Source</p>
              {leadForm.source_ui === 'DIRECT_CALL' || leadForm.source_ui === 'DIRECT_VISIT' ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Direct Outreach</p>
                    <p className="text-xs text-slate-500">Acquired through direct contact</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Referral</p>
                    {leadForm.referral_name && (
                      <p className="text-xs text-slate-500">Referred by <span className="font-semibold">{leadForm.referral_name}</span></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </DrawerContent>
    </Drawer>
  );
}
