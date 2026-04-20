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
import { invalidateCache } from '@/lib/queryCache';
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

const LEAD_STATUS_OPTIONS  = ['NEW','CONTACTED','INTERESTED','SITE_VISIT','NEGOTIATION','BOOKED','LOST'];
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

  // ── fetch lead context ──
  const fetchLeadContext = useCallback(async () => {
    if (!callData?.phoneNumber) {
      setIsExistingLead(false);
      setLeadForm(getDefaultLeadForm(callData));
      setLeadCallHistory([]);
      setIsEditingLead(false);
      return;
    }
    setLoadingContext(true);
    try {
      let matchedLead = null;

      if (callData?.leadId) {
        try {
          const { data } = await api.get(`/leads/${callData.leadId}`);
          if (data?.success) matchedLead = data.lead;
        } catch { /* ignore */ }
      }

      if (!matchedLead) {
        const search = encodeURIComponent(callData.phoneNumber);
        const { data } = await api.get(`/leads?search=${search}&limit=20`);
        const leads    = data?.success ? (data.leads || []) : [];
        matchedLead    = leads.find((l) => phonesMatch(l.phone, callData.phoneNumber)) || null;
      }

      if (!matchedLead) {
        setIsExistingLead(false);
        setIsEditingLead(false);
        
        const formObj = getDefaultLeadForm(callData);
        try {
          const search = encodeURIComponent(callData.phoneNumber);
          const { data } = await api.get(`/contacts?search=${search}&limit=10`);
          const contacts = data?.success ? (data.contacts || []) : [];
          const matchedContact = contacts.find((c) => phonesMatch(c.phone, callData.phoneNumber));
          
          if (matchedContact && matchedContact.name) {
            formObj.name = matchedContact.name;
          }
        } catch (err) {
          // Ignore if API fails
        }
        
        setLeadForm(formObj);
        setLeadCallHistory([]);
        setAccordionValue(['profile']); // Open profile to prompt saving new lead
        return;
      }

      const [leadRes, callRes] = await Promise.all([
        api.get(`/leads/${matchedLead.id}`),
        api.get(`/calls/lead/${matchedLead.id}`),
      ]);

      const fullLead    = leadRes?.data?.success ? leadRes.data.lead : matchedLead;
      const history     = callRes?.data?.success ? (callRes.data.calls || []) : [];
      const referralName = extractReferralName(fullLead?.notes);

      setIsExistingLead(true);
      setIsEditingLead(false);
      setLeadForm({
        id: fullLead.id,
        name: fullLead.name || defaultLeadName(callData?.phoneNumber),
        phone: fullLead.phone || callData?.phoneNumber || '',
        email: fullLead.email || '',
        address: fullLead.address || '',
        profession: fullLead.profession || '',
        status: fullLead.status || 'CONTACTED',
        lead_category: fullLead.lead_category || '',
        source_ui: mapApiSourceToUi(fullLead.lead_source),
        referral_name: referralName,
        notes: String(callData?.customerNotes || '').trim(),
      });
      setLeadCallHistory(history);
      setFutureAction((prev) => ({
        ...prev,
        notes: prev.notes || `Follow up after ${formatCallType(callData?.callType)} call`,
      }));
      setAccordionValue(isEditingLead ? ['profile'] : []); 
    } catch {
      setIsExistingLead(false);
      setIsEditingLead(false);
      setLeadForm(getDefaultLeadForm(callData));
      setLeadCallHistory([]);
      setAccordionValue(['profile']);
    } finally {
      setLoadingContext(false);
    }
  }, [callData]);

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

        // Link this call to the saved lead and persist Call Notes so the call
        // row in Recents shows the client name (instead of "Manual Call") and
        // the notes surface in the timeline.
        const cid = callData?.callId;
        const savedLeadId = result?.lead?.id || leadForm.id || null;
        if (cid) {
          try {
            const body = { customer_notes: leadForm.notes?.trim() || null };
            if (savedLeadId) body.lead_id = savedLeadId;
            await api.put(`/calls/${cid}`, body);
          } catch { /* silent */ }
          try { invalidateCache('/calls/dialer-history'); } catch { /* silent */ }
        }

        // Let the rest of the app (DialerPage recents, etc.) refresh.
        try {
          window.dispatchEvent(new CustomEvent('rg:call-updated', {
            detail: { callId: cid, leadId: savedLeadId, leadName: leadForm.name?.trim() || null },
          }));
        } catch { /* noop */ }

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
      <DrawerContent className="max-h-[90vh] bg-slate-50 flex flex-col">
        {/* ── Top bar ── */}
        <DrawerHeader className="px-5 pt-5 pb-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={closeDrawer}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex-1 min-w-0 text-left">
              <DrawerTitle className="text-[15px] font-bold text-slate-800 truncate m-0 pb-0.5">Call Summary</DrawerTitle>
              <p className="text-[11px] text-slate-500 truncate">Post-call client workspace</p>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color} border ${meta.border}`}>
              <CallIcon className="h-3.5 w-3.5" />
              {formatCallType(callData?.callType)}
            </div>
          </div>
        </DrawerHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-1">
          <div className="max-w-2xl mx-auto px-4 pb-8 space-y-5">

        {/* ── Call Stats Glass Card ── */}
        <div className="bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-100/50 rounded-2xl p-1.5 shadow-sm">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="h-7 w-7 rounded-full bg-indigo-50 flex items-center justify-center">
                <Phone className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Number</span>
              <span className="text-xs font-bold font-mono text-slate-800 truncate w-full text-center">
                {callData?.phoneNumber || 'Unknown'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Duration</span>
              <span className="text-xs font-bold font-mono text-slate-800 uppercase">
                {formatCallDuration(callData?.duration)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <div className="h-7 w-7 rounded-full bg-sky-50 flex items-center justify-center">
                <Calendar className="h-3.5 w-3.5 text-sky-600" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Time</span>
              <span className="text-[11px] font-bold text-slate-800 text-center leading-tight">
                {formatCallTimestamp(callData?.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Missed call notice ── */}
        {callData?.callType === 'MISSED' && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-3">
            <PhoneMissed className="h-5 w-5 text-rose-500 shrink-0" />
            <p className="text-sm text-rose-700 font-medium">
              Missed call — follow up with this client.
            </p>
          </div>
        )}

        {/* ── Core Action Fields ── */}
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</Label>
              <Select value={leadForm.status} onValueChange={setLeadField('status')}>
                <SelectTrigger className="h-12 text-sm rounded-xl bg-white border-slate-200 font-semibold text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="text-sm font-medium">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Category</Label>
              <Select
                value={leadForm.lead_category || 'NONE'}
                onValueChange={(v) => setLeadField('lead_category')(v === 'NONE' ? '' : v)}
              >
                <SelectTrigger className="h-12 text-sm rounded-xl bg-white border-slate-200 font-semibold text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" className="text-sm font-medium">Uncategorized</SelectItem>
                  {LEAD_CATEGORY_VALUES.map((c) => <SelectItem key={c} value={c} className="text-sm font-medium">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Source</Label>
              <Select value={leadForm.source_ui} onValueChange={setLeadField('source_ui')}>
                <SelectTrigger className="h-12 text-sm rounded-xl bg-white border-slate-200 font-semibold text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_UI_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value} className="text-sm font-medium">{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {leadForm.source_ui === 'REFERRAL' && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Referee Name</Label>
                <Input
                  value={leadForm.referral_name}
                  onChange={(e) => setLeadField('referral_name')(e.target.value)}
                  placeholder="Who referred?"
                  className="h-12 text-sm rounded-xl bg-white border-slate-200 font-semibold text-slate-700 shadow-sm focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-all"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Call Notes</Label>
            <Textarea
              value={leadForm.notes}
              onChange={(e) => setLeadField('notes')(e.target.value)}
              placeholder="Discussion summary, objections, next steps..."
              className="min-h-24 text-sm font-medium resize-none rounded-xl bg-white border-slate-200 p-3 shadow-sm placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        {/* ── Progressive Disclosure Accordions ── */}
        <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue} className="space-y-3 pt-3">
          
          {/* Client Profile */}
          <AccordionItem value="profile" className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <AccordionTrigger className="hover:no-underline px-4 py-3.5 border-b border-transparent data-[state=open]:border-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Users className="h-4.5 w-4.5 text-indigo-600" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-[13px] font-bold text-slate-800 tracking-wide">Client Profile</span>
                  <span className="text-[10px] text-slate-500 font-medium">Name, Phone, Email & Address</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-5 pt-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                <Badge variant={isExistingLead ? "default" : "outline"} className={`text-[10px] uppercase tracking-wider ${isExistingLead ? 'bg-indigo-600' : 'border-slate-300 text-slate-500'}`}>
                  {isExistingLead ? 'Saved Client' : 'New Client'}
                </Badge>
                {isExistingLead && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] gap-1 text-indigo-600 hover:bg-indigo-50 px-2.5 rounded-lg"
                    onClick={(e) => { e.preventDefault(); setIsEditingLead((v) => !v); }}
                  >
                    <Edit3 className="h-3 w-3" />
                    {isEditingLead ? 'Lock Info' : 'Edit Info'}
                  </Button>
                )}
              </div>

              {loadingContext ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Full Name <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={leadForm.name}
                        onChange={(e) => setLeadField('name')(e.target.value)}
                        placeholder="e.g. John Doe"
                        disabled={isExistingLead && !isEditingLead}
                        className={`pl-9 h-11 text-sm font-semibold rounded-xl ${errors.name ? 'border-rose-400 ring-rose-400' : 'bg-slate-50/50'}`}
                      />
                    </div>
                    {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Phone <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={leadForm.phone}
                        onChange={(e) => setLeadField('phone')(e.target.value)}
                        placeholder="+91 98765 43210"
                        disabled={isExistingLead && !isEditingLead}
                        className={`pl-9 h-11 text-sm font-mono font-bold rounded-xl ${errors.phone ? 'border-rose-400 ring-rose-400' : 'bg-slate-50/50'}`}
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-rose-500">{errors.phone}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={leadForm.email}
                        onChange={(e) => setLeadField('email')(e.target.value)}
                        placeholder="john@example.com"
                        disabled={isExistingLead && !isEditingLead}
                        className="pl-9 h-11 text-sm font-medium rounded-xl bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          value={leadForm.address}
                          onChange={(e) => setLeadField('address')(e.target.value)}
                          placeholder="City, State"
                          disabled={isExistingLead && !isEditingLead}
                          className="pl-9 h-11 text-sm font-medium rounded-xl bg-slate-50/50"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Profession</Label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          value={leadForm.profession}
                          onChange={(e) => setLeadField('profession')(e.target.value)}
                          placeholder="Software Engineer"
                          disabled={isExistingLead && !isEditingLead}
                          className="pl-9 h-11 text-sm font-medium rounded-xl bg-slate-50/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Timeline */}
          <AccordionItem value="timeline" className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <AccordionTrigger className="hover:no-underline px-4 py-3.5 border-b border-transparent data-[state=open]:border-slate-100 transition-colors">
              <div className="flex items-center gap-3 w-full">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Clock className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <div className="flex flex-col items-start flex-1 text-left">
                  <span className="text-[13px] font-bold text-slate-800 tracking-wide">Call Timeline</span>
                  <span className="text-[10px] text-slate-500 font-medium">History of interactions</span>
                </div>
                <Badge variant="secondary" className="mr-2 text-[10px] rounded-lg px-2 h-5 bg-slate-100 text-slate-600">{leadCallHistory.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-3 space-y-2.5 max-h-[300px] overflow-y-auto">
              {loadingContext ? (
                <p className="text-[11px] text-center text-slate-400 py-4 font-medium">Loading history...</p>
              ) : leadCallHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                    <Phone className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">No Previous Calls</p>
                </div>
              ) : (
                <div className="space-y-2.5 pt-1 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {leadCallHistory.map((call, index) => (
                    <div key={call.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-slate-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                         {call.call_type === 'MISSED' ? <PhoneMissed className="h-3 w-3 text-rose-500" /> : <Clock className="h-3 w-3 text-slate-500" />}
                      </div>
                      <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] pl-3 md:pl-0">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-700">
                            {formatDate(call.call_start)} · {formatTime(call.call_start)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 font-medium">Duration: <span className="font-mono text-slate-800">{formatCallDuration(call.duration_seconds)}</span></span>
                            {call.outcome_label && <span className="text-[9px] uppercase tracking-wider bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-bold">{call.outcome_label}</span>}
                          </div>
                          {call.customer_notes && (
                            <p className="text-[10px] text-indigo-600 mt-1.5 leading-relaxed line-clamp-2 flex items-start gap-1">
                              <Edit3 className="h-2.5 w-2.5 shrink-0 mt-0.5 text-indigo-400" />
                              {call.customer_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* ── Schedule Follow-up ── */}
        <div className="bg-violet-50/50 rounded-2xl border border-violet-100 p-4 shadow-sm mt-2">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-violet-100/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-800 tracking-wide">Schedule Follow-up</p>
                {!leadForm?.id && <p className="text-[10px] text-amber-600 font-medium">Save client to schedule</p>}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleForm((v) => !v)}
              className="gap-1.5 text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-100 bg-white h-8 rounded-lg shadow-sm"
              disabled={!leadForm?.id || savingFutureAction}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {showScheduleForm ? 'Cancel' : 'Plan'}
            </Button>
          </div>

          {showScheduleForm && leadForm?.id && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-violet-700/70">Type</Label>
                  <Select value={futureAction.followup_type} onValueChange={(v) => setFutureAction((p) => ({ ...p, followup_type: v }))}>
                    <SelectTrigger className="h-10 text-sm rounded-xl bg-white border-violet-200 font-medium shadow-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FOLLOWUP_TYPES.map((t) => <SelectItem key={t} value={t} className="text-sm font-medium">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-violet-700/70">Date</Label>
                  <Input
                    type="date"
                    min={toISODate(new Date())}
                    value={futureAction.scheduled_date}
                    onChange={(e) => setFutureAction((p) => ({ ...p, scheduled_date: e.target.value }))}
                    className="h-10 text-sm rounded-xl bg-white border-violet-200 font-medium shadow-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-violet-700/70">Time</Label>
                  <Input
                    type="time"
                    value={futureAction.scheduled_time}
                    onChange={(e) => setFutureAction((p) => ({ ...p, scheduled_time: e.target.value }))}
                    className="h-10 text-sm rounded-xl bg-white border-violet-200 font-medium shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-violet-700/70">Notes</Label>
                  <Input
                    value={futureAction.notes}
                    onChange={(e) => setFutureAction((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Topic..."
                    className="h-10 text-sm rounded-xl bg-white border-violet-200 font-medium shadow-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  className="h-9 gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-[11px] font-bold uppercase px-4 shadow-sm"
                  onClick={saveFutureAction}
                  disabled={!leadForm?.id || savingFutureAction}
                >
                  {savingFutureAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
        </div>
        </div>

        {/* ── Sticky Primary CTA Footer ── */}
        <div className="shrink-0 bg-white border-t border-slate-200/60 p-4 pb-safe flex flex-col gap-2.5 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
          <div className="max-w-2xl mx-auto w-full flex flex-col gap-2.5">
            <Button
              onClick={saveLead}
              disabled={!canSaveLead}
              className="h-12 w-full gap-2 text-[13px] tracking-wide font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all"
            >
              {savingLead ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isExistingLead ? 'Update Client Log' : 'Save As New Client'}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              disabled={savingLead || savingFutureAction}
              className="h-10 w-full text-sm font-semibold gap-1.5 rounded-2xl text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              onClick={closeDrawer}
            >
              Cancel & Dismiss
            </Button>
          </div>
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
