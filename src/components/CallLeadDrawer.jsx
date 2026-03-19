import { useState, useEffect, useCallback } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall, X, UserPlus, Clock, Calendar, Edit3, Save, Loader2, Mail, MapPin, Briefcase, Eye, Users, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
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

import api from '@/lib/axios';
import { invalidateCache } from '@/lib/queryCache';
import {
  formatCallType,
  formatCallDuration,
  formatCallTimestamp,
  defaultLeadName,
} from '@/utils/callParser';

const CALL_TYPE_META = {
  INCOMING: { icon: PhoneIncoming, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  OUTGOING: { icon: PhoneOutgoing, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  MISSED: { icon: PhoneMissed, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  UNKNOWN: { icon: PhoneCall, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
};

const SOURCE_UI_OPTIONS = [
  { value: 'DIRECT', label: 'DIRECT' },
  { value: 'REFERALL', label: 'REFERALL' },
  { value: 'PERSONAL REFERAL', label: 'PERSONAL REFERAL' },
];

const LEAD_STATUS_OPTIONS = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];
const LEAD_CATEGORY_VALUES = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];
const FOLLOWUP_TYPES = ['CALL', 'WHATSAPP', 'VISIT', 'MEETING'];

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const tail10 = (value) => normalizePhone(value).slice(-10);
const phonesMatch = (a, b) => {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb || tail10(na) === tail10(nb);
};

const mapApiSourceToUi = (value, referralName) => {
  if (value === 'Direct') return 'DIRECT';
  if (value === 'Referral') return referralName ? 'PERSONAL REFERAL' : 'REFERALL';
  return 'DIRECT';
};

const mapUiSourceToApi = (value) => {
  if (value === 'DIRECT') return 'Direct';
  if (value === 'REFERALL' || value === 'PERSONAL REFERAL') return 'Referral';
  return 'Other';
};

const extractReferralName = (notes) => {
  const raw = String(notes || '');
  const m = raw.match(/\[Referee:\s*(.+?)\]/i);
  return m?.[1]?.trim() || '';
};

const composeNotes = (notes, referralName) => {
  const withoutTag = String(notes || '').replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim();
  if (!referralName?.trim()) return withoutTag || null;
  return `${withoutTag}${withoutTag ? ' ' : ''}[Referee: ${referralName.trim()}]`;
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const getDefaultLeadForm = (callData) => {
  const detectedName = callData?.contactName || callData?.leadName || callData?.name || '';
  return {
    id: null,
    name: String(detectedName).trim() || defaultLeadName(callData?.phoneNumber),
    phone: callData?.phoneNumber ?? '',
    email: '',
    address: '',
    profession: '',
    status: 'CONTACTED',
    lead_category: '',
    source_ui: 'DIRECT',
    referral_name: '',
    notes: '',
  };
};

const toISODate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

export default function CallLeadDrawer({ open, callData, onClose, onLeadCreated }) {
  const meta = CALL_TYPE_META[callData?.callType] ?? CALL_TYPE_META.UNKNOWN;
  const CallIcon = meta.icon;

  const [leadForm, setLeadForm] = useState(getDefaultLeadForm(callData));
  const [isExistingLead, setIsExistingLead] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [leadCallHistory, setLeadCallHistory] = useState([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [savingFutureAction, setSavingFutureAction] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [futureAction, setFutureAction] = useState({
    followup_type: 'CALL',
    scheduled_date: toISODate(new Date()),
    scheduled_time: '10:00',
    notes: '',
  });

  const setLeadField = (field) => (value) => setLeadForm((prev) => ({ ...prev, [field]: value }));

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
          const leadRes = await api.get(`/leads/${callData.leadId}`);
          if (leadRes?.data?.success) {
            matchedLead = leadRes.data.lead;
          }
        } catch {
          matchedLead = null;
        }
      }

      if (!matchedLead) {
        const search = encodeURIComponent(callData.phoneNumber);
        const leadsRes = await api.get(`/leads?search=${search}&limit=20`);
        const leads = leadsRes?.data?.success ? (leadsRes.data.leads || []) : [];
        matchedLead = leads.find((l) => phonesMatch(l.phone, callData.phoneNumber)) || null;
      }

      if (!matchedLead) {
        setIsExistingLead(false);
        setIsEditingLead(false);
        setLeadForm(getDefaultLeadForm(callData));
        setLeadCallHistory([]);
        return;
      }

      const [leadRes, callRes] = await Promise.all([
        api.get(`/leads/${matchedLead.id}`),
        api.get(`/calls/lead/${matchedLead.id}`),
      ]);

      const fullLead = leadRes?.data?.success ? leadRes.data.lead : matchedLead;
      const history = callRes?.data?.success ? (callRes.data.calls || []) : [];
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
        source_ui: mapApiSourceToUi(fullLead.lead_source, referralName),
        referral_name: referralName,
        notes: String(fullLead.notes || '').replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim(),
      });
      setLeadCallHistory(history);
      setFutureAction((prev) => ({
        ...prev,
        notes: prev.notes || `Follow up after ${formatCallType(callData?.callType)} call`,
      }));
    } catch {
      setIsExistingLead(false);
      setIsEditingLead(false);
      setLeadForm(getDefaultLeadForm(callData));
      setLeadCallHistory([]);
    } finally {
      setLoadingContext(false);
    }
  }, [callData]);

  useEffect(() => {
    if (open) {
      setErrors({});
      setFutureAction({
        followup_type: 'CALL',
        scheduled_date: toISODate(new Date()),
        scheduled_time: '10:00',
        notes: '',
      });
      setShowScheduleForm(false);
      fetchLeadContext();
    }
  }, [open, fetchLeadContext]);

  const validate = () => {
    const e = {};
    if (!leadForm.name.trim()) e.name = 'Name is required';
    if (!leadForm.phone.trim()) e.phone = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

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
        notes: composeNotes(leadForm.notes, leadForm.referral_name),
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
        toast.success(isExistingLead ? 'Client updated successfully' : 'Client saved successfully');
        onLeadCreated?.(result.lead);
        setIsExistingLead(true);
        setIsEditingLead(false);
        await fetchLeadContext();
      } else {
        toast.error(result?.message || 'Failed to save client');
      }
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Network error - could not save client';
      toast.error(msg);
    } finally {
      setSavingLead(false);
    }
  };

  const saveFutureAction = async () => {
    if (!leadForm?.id) {
      toast.error('Save client first before adding future action');
      return;
    }
    if (!futureAction.scheduled_date) {
      toast.error('Scheduled date is required');
      return;
    }

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
        toast.success('Future action saved');
        setFutureAction({
          followup_type: 'CALL',
          scheduled_date: toISODate(new Date()),
          scheduled_time: '10:00',
          notes: '',
        });
        setShowScheduleForm(false);
      } else {
        toast.error(data?.message || 'Unable to save future action');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to save future action');
    } finally {
      setSavingFutureAction(false);
    }
  };

  const canSaveLead = !savingLead && !!leadForm.name.trim() && !!leadForm.phone.trim();

  return (
    <>
      <Drawer open={open} onOpenChange={(v) => { if (!v && !savingLead && !savingFutureAction) onClose?.(); }}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2">
          <div className={`mx-auto mb-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${meta.bg} ${meta.color} border ${meta.border}`}>
            <CallIcon className="h-4 w-4" />
            {formatCallType(callData?.callType)}
          </div>

          <DrawerTitle className="text-base font-bold text-center text-foreground">
            Client Call Workspace
          </DrawerTitle>
          <DrawerDescription className="text-center text-xs text-muted-foreground">
            Post-call capture, timeline review, and future action planning.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 mb-4 grid grid-cols-2 xs:grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 px-1 py-2 border border-border/40 min-w-0">
            <Phone className="h-4 w-4 text-indigo-500" strokeWidth={2.5} />
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">Number</span>
            <span className="text-[11px] font-bold font-mono text-foreground truncate w-full text-center px-1">
              {callData?.phoneNumber || 'Unknown'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 px-1 py-2 border border-border/40 min-w-0">
            <Clock className="h-4 w-4 text-indigo-500" strokeWidth={2.5} />
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">Duration</span>
            <span className="text-[11px] font-bold font-mono text-foreground uppercase tracking-tight">
              {formatCallDuration(callData?.duration)}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 px-1 py-2 border border-border/40 col-span-2 xs:col-span-1 min-w-0">
            <Calendar className="h-4 w-4 text-indigo-500" strokeWidth={2.5} />
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">Time</span>
            <span className="text-[10px] font-bold text-foreground text-center leading-tight">
              {formatCallTimestamp(callData?.timestamp)}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto px-4 space-y-3 pb-2">
          {loadingContext ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading client timeline and profile...
            </div>
          ) : null}

          {/* Lead Details Summary (View Only) */}
          {isExistingLead && !isEditingLead && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-indigo-200">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-indigo-600" />
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Saved Details</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSourceModal(true)}
                  className="h-8 gap-1 text-indigo-600 hover:bg-indigo-100"
                  title="View source details"
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Status</p>
                  <p className="text-sm font-semibold text-slate-900">{leadForm.status || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Category</p>
                  <p className="text-sm font-semibold text-slate-900">{leadForm.lead_category || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Source</p>
                  <p className="text-sm font-semibold text-slate-900">{leadForm.source_ui === 'REFERALL' ? 'Referral' : leadForm.source_ui === 'PERSONAL REFERAL' ? `Referral (${leadForm.referral_name})` : 'Direct'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Email</p>
                  <p className="text-sm font-semibold text-slate-900">{leadForm.email || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Address</p>
                  <p className="text-sm font-semibold text-slate-900">{leadForm.address || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Profession</p>
                  <p className="text-sm font-semibold text-slate-900">{leadForm.profession || '—'}</p>
                </div>
              </div>
              {leadForm.notes && (
                <div className="pt-2 border-t border-indigo-200">
                  <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">{String(leadForm.notes || '').replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim()}</p>
                </div>
              )}
            </div>
          )}

          {/* Lead Form Section */}
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Lead Information</p>
              </div>
              {isExistingLead ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-indigo-600"
                  onClick={() => setIsEditingLead((v) => !v)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  {isEditingLead ? 'Cancel Edit' : 'Edit'}
                </Button>
              ) : (
                <Badge variant="outline" className="text-[10px]">New Client</Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full Name <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={leadForm.name}
                  onChange={(e) => setLeadField('name')(e.target.value)}
                  placeholder="e.g. Ravi Kumar"
                  disabled={isExistingLead && !isEditingLead}
                  className={`pl-9 h-10 text-sm rounded-lg ${errors.name ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
                />
              </div>
              {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Phone <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={leadForm.phone}
                    onChange={(e) => setLeadField('phone')(e.target.value)}
                    placeholder="+91 9876543210"
                    type="tel"
                    disabled={isExistingLead && !isEditingLead}
                    className={`pl-9 h-10 text-sm font-mono rounded-lg ${errors.phone ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
                  />
                </div>
                {errors.phone && <p className="text-xs text-rose-500">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={leadForm.email}
                    onChange={(e) => setLeadField('email')(e.target.value)}
                    placeholder="name@email.com"
                    disabled={isExistingLead && !isEditingLead}
                    className="pl-9 h-10 text-sm rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client Status</Label>
                <Select value={leadForm.status} onValueChange={setLeadField('status')} disabled={isExistingLead && !isEditingLead}>
                  <SelectTrigger className="h-10 text-sm rounded-lg">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client Category</Label>
                <Select value={leadForm.lead_category || 'NONE'} onValueChange={(v) => setLeadField('lead_category')(v === 'NONE' ? '' : v)} disabled={isExistingLead && !isEditingLead}>
                  <SelectTrigger className="h-10 text-sm rounded-lg">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" className="text-sm">No Category</SelectItem>
                    {LEAD_CATEGORY_VALUES.map((c) => (
                      <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</Label>
                <Select value={leadForm.source_ui} onValueChange={setLeadField('source_ui')} disabled={isExistingLead && !isEditingLead}>
                  <SelectTrigger className="h-10 text-sm rounded-lg">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_UI_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-sm">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referee Name</Label>
                <Input
                  value={leadForm.referral_name}
                  onChange={(e) => setLeadField('referral_name')(e.target.value)}
                  placeholder="Enter name of referee"
                  disabled={(isExistingLead && !isEditingLead) || !['REFERALL', 'PERSONAL REFERAL'].includes(leadForm.source_ui)}
                  className="h-10 text-sm rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={leadForm.address}
                    onChange={(e) => setLeadField('address')(e.target.value)}
                    placeholder="City, State"
                    disabled={isExistingLead && !isEditingLead}
                    className="pl-9 h-10 text-sm rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profession</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={leadForm.profession}
                    onChange={(e) => setLeadField('profession')(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    disabled={isExistingLead && !isEditingLead}
                    className="pl-9 h-10 text-sm rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea
                value={leadForm.notes}
                onChange={(e) => setLeadField('notes')(e.target.value)}
                placeholder="Client details, discussion summary, objections..."
                disabled={isExistingLead && !isEditingLead}
                className="min-h-16 text-sm resize-none rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {isExistingLead && isEditingLead ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    setIsEditingLead(false);
                    fetchLeadContext();
                  }}
                  disabled={savingLead}
                >
                  Cancel
                </Button>
              ) : null}

              <Button
                type="button"
                className="h-9 gap-1.5"
                onClick={saveLead}
                disabled={!canSaveLead}
              >
                {savingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : (isExistingLead ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
                {isExistingLead ? 'Save Client' : 'Save as Client'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Timeline Section */}
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-border/50">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-slate-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Timeline</p>
            </div>
            {loadingContext ? (
              <p className="text-xs text-muted-foreground">Loading timeline...</p>
            ) : leadCallHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No previous calls found for this client.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {leadCallHistory.map((call) => (
                  <div key={call.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-slate-700">{formatDate(call.call_start)} {formatTime(call.call_start)}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">Duration: <span className="font-mono font-semibold">{formatCallDuration(call.duration_seconds)}</span></p>
                        {call.outcome_label && (
                          <p className="text-[11px] text-slate-600 mt-0.5">Outcome: <span className="font-semibold">{call.outcome_label}</span></p>
                        )}
                      </div>
                    </div>
                    {call.customer_notes ? (
                      <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 italic">{call.customer_notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Future Action Section */}
          <div className="rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-border/50">
              <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-violet-600" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Schedule Action</p>
            </div>
            
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Make Schedule</p>
                  <p className="text-[11px] text-violet-600/90 mt-0.5">Create a follow-up action for this client</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScheduleForm((v) => !v)}
                  className="gap-1.5 text-xs text-violet-600 border-violet-200 hover:bg-violet-100 h-8"
                  disabled={!leadForm?.id || savingFutureAction}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {showScheduleForm ? 'Cancel' : 'Schedule Call'}
                </Button>
              </div>

              {showScheduleForm && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <Select value={futureAction.followup_type} onValueChange={(v) => setFutureAction((p) => ({ ...p, followup_type: v }))}>
                        <SelectTrigger className="h-9 text-sm rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOLLOWUP_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        min={toISODate(new Date())}
                        value={futureAction.scheduled_date}
                        onChange={(e) => setFutureAction((p) => ({ ...p, scheduled_date: e.target.value }))}
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Time</Label>
                      <Input
                        type="time"
                        value={futureAction.scheduled_time}
                        onChange={(e) => setFutureAction((p) => ({ ...p, scheduled_time: e.target.value }))}
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Notes</Label>
                      <Input
                        value={futureAction.notes}
                        onChange={(e) => setFutureAction((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="What to do next"
                        className="h-9 text-sm rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="h-9 gap-1.5"
                      onClick={saveFutureAction}
                      disabled={!leadForm?.id || savingFutureAction}
                    >
                      {savingFutureAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Future Action
                    </Button>
                  </div>
                </>
              )}
            </div>
            {!leadForm?.id ? (
              <p className="text-[11px] text-amber-600">Save client first to enable future actions.</p>
            ) : null}
          </div>

          {callData?.callType === 'MISSED' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 flex items-center gap-2">
              <PhoneMissed className="h-4 w-4 text-rose-500 shrink-0" />
              <p className="text-xs text-rose-700 font-medium">
                This was a missed call. Follow up with this number.
              </p>
            </div>
          )}
        </div>

        <DrawerFooter className="pt-4 gap-2 border-t border-border/50">
          <Button
            onClick={saveLead}
            disabled={!canSaveLead}
            className="h-11 gap-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700"
          >
            {savingLead ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isExistingLead ? 'Save Client Info' : 'Save as New Client'}
              </>
            )}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="outline"
              disabled={savingLead || savingFutureAction}
              className="h-10 text-sm gap-1.5 text-muted-foreground"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
      </Drawer>

      {/* Source Details Modal */}
      <Dialog open={showSourceModal} onOpenChange={setShowSourceModal}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-lg font-bold">Source Information</DialogTitle>
          <DialogDescription className="text-xs">
            Details about how this lead was acquired
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Type */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Lead Source</p>
            {leadForm.source_ui === 'DIRECT' ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Direct Visit</p>
                  <p className="text-xs text-slate-600">This lead came directly from your outreach</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Referral</p>
                  <p className="text-xs text-slate-600">This lead was referred to you</p>
                </div>
              </div>
            )}
          </div>

          {/* Referee Details (if referral) */}
          {(leadForm.source_ui === 'REFERALL' || leadForm.source_ui === 'PERSONAL REFERAL') && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Referee Information</p>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-1">Referee Name</p>
                  <p className="text-sm font-semibold text-slate-900">{leadForm.referral_name || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Details */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact Details</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-mono text-slate-900 break-all">{leadForm.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Email</p>
                  <p className="text-sm text-slate-900 truncate">{leadForm.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Address</p>
                  <p className="text-sm text-slate-900">{leadForm.address || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Profession</p>
                  <p className="text-sm text-slate-900">{leadForm.profession || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Overview */}
          <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Current Status</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider mb-1">Status</p>
                <p className="text-sm font-bold text-slate-900">{leadForm.status || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider mb-1">Category</p>
                <p className="text-sm font-bold text-slate-900">{leadForm.lead_category || '—'}</p>
              </div>
            </div>
          </div>

          {/* Notes (if any) */}
          {leadForm.notes && String(leadForm.notes || '').replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim() && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Notes</p>
              <p className="text-sm text-slate-700 leading-relaxed">{String(leadForm.notes || '').replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim()}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-3 border-t border-border/50">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1 h-9">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
