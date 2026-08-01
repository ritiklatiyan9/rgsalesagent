import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCallDrawer } from '@/context/CallDrawerContext';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import {
  PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall,
  Clock, CalendarDays, Save, Loader2,
  Users, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import api from '@/lib/axios';
import { cachedGet, getCachedSync, invalidateCache } from '@/lib/queryCache';
import { broadcastMutation, onMutation } from '@/lib/mutationBus';
import {
  formatCallType, formatCallDuration, defaultLeadName,
} from '@/utils/callParser';

// ─── Constants ────────────────────────────────────────────────────────────
const CALL_TYPE_META = {
  INCOMING: { icon: PhoneIncoming, color: 'text-emerald-600', dot: 'bg-emerald-500' },
  OUTGOING: { icon: PhoneOutgoing, color: 'text-blue-600',    dot: 'bg-blue-500'    },
  MISSED:   { icon: PhoneMissed,   color: 'text-rose-600',    dot: 'bg-rose-500'    },
  UNKNOWN:  { icon: PhoneCall,     color: 'text-slate-500',   dot: 'bg-slate-400'   },
};

const LEAD_STATUS_OPTIONS = [
  { value: 'NEW',             label: 'New Lead'        },
  { value: 'CONTACTED',       label: 'Contacted'       },
  { value: 'INTERESTED',      label: 'Interested'      },
  { value: 'NOT_INTERESTED',  label: 'Not Interested'  },
  { value: 'SITE_VISIT',      label: 'Site Visit'      },
  { value: 'NEGOTIATION',     label: 'Negotiation'     },
  { value: 'BOOKED',          label: 'Booked'          },
  { value: 'LOST',            label: 'Lost'            },
  { value: 'NOT_ANSWERING',   label: 'Not Answering'   },
  { value: 'INCOMING_OFF',    label: 'Incoming Off'    },
  { value: 'SWITCH_OFF',      label: 'Switch Off'      },
];

const QUICK_STATUS_CHIPS = [
  { value: 'NOT_INTERESTED', label: 'Not Interested', cls: 'bg-gray-100 text-gray-600 ring-gray-200 hover:bg-gray-200', activeCls: 'bg-gray-600 text-white ring-gray-600' },
  { value: 'INTERESTED',     label: 'Interested',     cls: 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100', activeCls: 'bg-violet-600 text-white ring-violet-600' },
  { value: 'NOT_ANSWERING',  label: 'No Answer',      cls: 'bg-rose-50 text-rose-600 ring-rose-200 hover:bg-rose-100', activeCls: 'bg-rose-500 text-white ring-rose-500' },
  { value: 'SWITCH_OFF',     label: 'Switch Off',     cls: 'bg-red-50 text-red-600 ring-red-200 hover:bg-red-100', activeCls: 'bg-red-500 text-white ring-red-500' },
  { value: 'CONTACTED',      label: 'Contacted',      cls: 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100', activeCls: 'bg-amber-500 text-white ring-amber-500' },
];
const LEAD_CATEGORY_VALUES = ['PRIME', 'HOT', 'NORMAL', 'COLD', 'DEAD'];
const FOLLOWUP_TYPES = ['CALL', 'WHATSAPP', 'VISIT', 'MEETING'];

const SOURCE_UI_OPTIONS = [
  { value: 'DIRECT_CALL',  label: 'Direct Call'  },
  { value: 'DIRECT_VISIT', label: 'Direct Visit' },
  { value: 'REFERRAL',     label: 'Referral'     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────
const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
const tail10 = (v) => normalizePhone(v).slice(-10);
const phonesMatch = (a, b) => {
  const na = normalizePhone(a), nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb || tail10(na) === tail10(nb);
};
const mapApiSourceToUi = (v) => v === 'Direct Visit' ? 'DIRECT_VISIT' : v === 'Referral' ? 'REFERRAL' : 'DIRECT_CALL';
const mapUiSourceToApi = (v) => v === 'DIRECT_VISIT' ? 'Direct Visit' : v === 'REFERRAL' ? 'Referral' : 'Direct';
const extractReferralName = (notes) => String(notes || '').match(/\[Referee:\s*(.+?)\]/i)?.[1]?.trim() || '';
const composeNotes = (notes, ref) => {
  const base = String(notes || '').replace(/\s*\[Referee:\s*.+?\]\s*/gi, ' ').trim();
  return ref?.trim() ? `${base}${base ? ' ' : ''}[Referee: ${ref.trim()}]` : base || null;
};
const toISODate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const getDefaultForm = (cd) => ({
  id: null,
  name: String(cd?.contactName || cd?.leadName || cd?.name || '').trim() || defaultLeadName(cd?.phoneNumber),
  phone: cd?.phoneNumber ?? '',
  email: '', address: '', profession: '',
  status: 'CONTACTED',
  lead_category: '',
  source_ui: 'DIRECT_CALL',
  referral_name: '',
  notes: '',
});

// ─── Main Component ───────────────────────────────────────────────────────
export default function CallDrawer() {
  const { open, callData, closeDrawer } = useCallDrawer();

  const meta     = CALL_TYPE_META[callData?.callType] ?? CALL_TYPE_META.UNKNOWN;
  const CallIcon = meta.icon;

  // ── state ──
  const [form, setForm]                 = useState(getDefaultForm(callData));
  const [isExisting, setIsExisting]     = useState(false);
  const [callHistory, setCallHistory]   = useState([]);
  const [loadingCtx, setLoadingCtx]     = useState(false);
  const [savingLead, setSavingLead]     = useState(false);
  const [savingSched, setSavingSched]   = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showProfile, setShowProfile]   = useState(false);
  const [showHistory, setShowHistory]   = useState(false);
  const [schedAutoOpen, setSchedAutoOpen] = useState(false);
  const schedRef = useRef(null);

  const [sched, setSched] = useState({
    followup_type: 'CALL',
    scheduled_date: toISODate(new Date()),
    scheduled_time: '10:00',
    notes: '',
  });

  // Invalidate leads + calls cache whenever a call ends and this drawer opens
  useEffect(() => {
    if (open) broadcastMutation(['calls', 'leads']);
  }, [open]);

  const setField = useMemo(() => {
    const cache = {};
    return (k) => {
      if (!cache[k]) cache[k] = (v) => setForm((p) => ({ ...p, [k]: v }));
      return cache[k];
    };
  }, []);

  const formFromLead = useCallback((lead) => {
    if (!lead) return getDefaultForm(callData);
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

  // ── fetch lead context ──
  const fetchLeadContext = useCallback(async () => {
    const optimistic = getDefaultForm(callData);
    setForm(optimistic);
    setIsExisting(false);
    setCallHistory([]);
    setShowSchedule(false);
    setShowProfile(false);
    setShowHistory(false);

    if (!callData?.phoneNumber) return;

    let matched = null;
    if (callData?.leadId) {
      const c = getCachedSync(`/leads/${callData.leadId}`);
      if (c?.success && c.lead) matched = c.lead;
    }
    if (matched) {
      setIsExisting(true);
      setForm(formFromLead(matched));
      const ch = getCachedSync(`/calls/lead/${matched.id}`);
      if (ch?.success) setCallHistory(ch.calls || []);
    }

    setLoadingCtx(true);
    try {
      if (!matched && callData?.leadId) {
        try {
          const d = await cachedGet(`/leads/${callData.leadId}`, { staleTime: 30_000, cacheTime: 300_000 });
          if (d?.success) matched = d.lead;
        } catch {}
      }
      if (!matched) {
        try {
          const search = encodeURIComponent(callData.phoneNumber);
          const d = await cachedGet(`/leads?search=${search}&limit=20`, { staleTime: 60_000, cacheTime: 300_000 });
          matched = (d?.leads || []).find((l) => phonesMatch(l.phone, callData.phoneNumber)) || null;
        } catch {}
      }
      if (!matched) {
        try {
          const search = encodeURIComponent(callData.phoneNumber);
          const d = await cachedGet(`/contacts?search=${search}&limit=10`, { staleTime: 60_000, cacheTime: 600_000 });
          const mc = (d?.contacts || []).find((c) => phonesMatch(c.phone, callData.phoneNumber));
          if (mc?.name) setForm((p) => ({ ...p, name: p.name || mc.name }));
        } catch {}
        setShowProfile(true);
        return;
      }

      const [lr, cr] = await Promise.all([
        cachedGet(`/leads/${matched.id}`, { staleTime: 30_000, cacheTime: 300_000 }).catch(() => null),
        cachedGet(`/calls/lead/${matched.id}`, { staleTime: 30_000, cacheTime: 300_000 }).catch(() => null),
      ]);
      const fullLead = lr?.success ? lr.lead : matched;
      setIsExisting(true);
      setForm(formFromLead(fullLead));
      setCallHistory(cr?.success ? (cr.calls || []) : []);
    } catch {
      setShowProfile(true);
    } finally {
      setLoadingCtx(false);
    }
  }, [callData, formFromLead]);

  useEffect(() => { fetchLeadContext(); }, [fetchLeadContext]);

  // ── auto-scroll to schedule section ──
  useEffect(() => {
    if (showSchedule && schedAutoOpen && schedRef.current) {
      setTimeout(() => schedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      setSchedAutoOpen(false);
    }
  }, [showSchedule, schedAutoOpen]);

  // ── save lead ──
  const saveLead = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required');
      return null;
    }
    setSavingLead(true);
    try {
      const payload = {
        name: form.name.trim(), phone: form.phone.trim(),
        email: form.email?.trim() || null, address: form.address?.trim() || null,
        profession: form.profession?.trim() || null,
        status: form.status || 'CONTACTED',
        lead_category: form.lead_category || null,
        lead_source: mapUiSourceToApi(form.source_ui),
        notes: composeNotes('', form.referral_name),
      };
      const { data } = isExisting && form.id
        ? await api.put(`/leads/${form.id}`, payload)
        : await api.post('/leads', payload);

      if (data?.success) {
        const savedId = data.lead?.id || form.id;
        toast.success(isExisting ? 'Client updated' : 'Client saved');
        setIsExisting(true);
        setForm((p) => ({ ...p, id: savedId }));

        const cid = callData?.callId;
        try {
          window.dispatchEvent(new CustomEvent('rg:call-updated', {
            detail: { callId: cid, leadId: savedId, leadName: form.name.trim(), customerNotes: form.notes?.trim() || null, phone: form.phone || callData?.phoneNumber || null },
          }));
        } catch {}
        if (cid) {
          const body = { customer_notes: form.notes?.trim() || null };
          if (savedId) body.lead_id = savedId;
          api.put(`/calls/${cid}`, body).catch(() => {});
          invalidateCache('/calls/dialer-history');
          if (savedId) { invalidateCache(`/calls/lead/${savedId}`); invalidateCache(`/leads/${savedId}`); }
        }
        return savedId;
      } else {
        toast.error(data?.message || 'Failed to save client');
        return null;
      }
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Network error');
      return null;
    } finally {
      setSavingLead(false);
    }
  };

  // ── open schedule (auto-save if needed) ──
  const handleOpenSchedule = async () => {
    if (!showSchedule) {
      let leadId = form.id;
      if (!leadId) {
        leadId = await saveLead();
        if (!leadId) return;
      }
      setShowSchedule(true);
      setSchedAutoOpen(true);
    } else {
      setShowSchedule((v) => !v);
    }
  };

  // ── save schedule ──
  const saveSchedule = async () => {
    let leadId = form.id;
    if (!leadId) {
      leadId = await saveLead();
      if (!leadId) return;
    }
    if (!sched.scheduled_date) { toast.error('Date is required'); return; }
    setSavingSched(true);
    try {
      const { data } = await api.post('/followups', {
        lead_id: leadId,
        followup_type: sched.followup_type,
        scheduled_date: sched.scheduled_date,
        scheduled_time: sched.scheduled_time || undefined,
        notes: sched.notes?.trim() || null,
      });
      if (data?.success) {
        broadcastMutation(['followups']);
        toast.success('Follow-up scheduled');
        setSched({ followup_type: 'CALL', scheduled_date: toISODate(new Date()), scheduled_time: '10:00', notes: '' });
        setShowSchedule(false);
      } else {
        toast.error(data?.message || 'Failed to schedule');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to schedule');
    } finally {
      setSavingSched(false);
    }
  };

  if (!callData) return null;

  const canSave = !savingLead && !!form.name.trim() && !!form.phone.trim();

  return (
    <Drawer open={open} onOpenChange={(val) => { if (!val) closeDrawer(); }}>
      <DrawerContent className="max-h-[94vh] bg-slate-50 flex flex-col outline-none">

        {/* ══ TOP BAR ══════════════════════════════════════════════════════ */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-3 pt-3 pb-2.5">

          {/* Row 1: close · title · schedule button */}
          <div className="flex items-center gap-2">
            <button
              onClick={closeDrawer}
              className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                {form.name || 'Unknown Caller'}
              </p>
              <p className="text-[10.5px] text-slate-500 font-mono truncate leading-tight">
                {callData?.phoneNumber || '—'}
              </p>
            </div>

            {/* Schedule Button — always visible, top right */}
            <button
              onClick={handleOpenSchedule}
              disabled={savingLead}
              className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all ${
                showSchedule
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-200'
                  : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200 hover:bg-amber-100'
              } disabled:opacity-50`}
            >
              {savingLead ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
              Schedule
            </button>
          </div>

          {/* Row 2: call meta chips */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${meta.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {formatCallType(callData?.callType)}
            </span>
            {callData?.duration > 0 && (
              <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                {formatCallDuration(callData.duration)}
              </span>
            )}
            {callData?.callType === 'MISSED' && (
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full ring-1 ring-rose-200">
                Follow up needed
              </span>
            )}
            {isExisting && (
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ring-1 ring-indigo-200 ml-auto">
                Existing Client
              </span>
            )}
          </div>
        </div>

        {/* ══ SCROLLABLE BODY ══════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-3 pb-4 space-y-2.5">

            {/* ── Schedule Card (shown when toggled) ── */}
            {showSchedule && (
              <div ref={schedRef} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> Schedule Follow-up
                  </p>
                  <button onClick={() => setShowSchedule(false)} className="h-5 w-5 rounded-md text-amber-500 hover:text-amber-700 flex items-center justify-center">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-amber-700 font-semibold">Type</Label>
                    <Select value={sched.followup_type} onValueChange={(v) => setSched((p) => ({ ...p, followup_type: v }))}>
                      <SelectTrigger className="h-9 text-[12px] rounded-xl bg-white border-amber-200 shadow-none focus:ring-1 focus:ring-amber-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOWUP_TYPES.map((t) => <SelectItem key={t} value={t} className="text-[12px]">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-amber-700 font-semibold">Date *</Label>
                    <Input
                      type="date"
                      min={toISODate(new Date())}
                      value={sched.scheduled_date}
                      onChange={(e) => setSched((p) => ({ ...p, scheduled_date: e.target.value }))}
                      className="h-9 text-[12px] rounded-xl bg-white border-amber-200 shadow-none focus-visible:ring-1 focus-visible:ring-amber-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-amber-700 font-semibold">Time</Label>
                    <Input
                      type="time"
                      value={sched.scheduled_time}
                      onChange={(e) => setSched((p) => ({ ...p, scheduled_time: e.target.value }))}
                      className="h-9 text-[12px] rounded-xl bg-white border-amber-200 shadow-none focus-visible:ring-1 focus-visible:ring-amber-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-amber-700 font-semibold">Note</Label>
                    <Input
                      value={sched.notes}
                      onChange={(e) => setSched((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Topic…"
                      className="h-9 text-[12px] rounded-xl bg-white border-amber-200 shadow-none focus-visible:ring-1 focus-visible:ring-amber-300"
                    />
                  </div>
                </div>

                <Button
                  onClick={saveSchedule}
                  disabled={savingSched || !sched.scheduled_date}
                  className="w-full h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-semibold shadow-none"
                >
                  {savingSched ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CalendarDays className="h-3.5 w-3.5 mr-1.5" />}
                  Confirm Schedule
                </Button>
              </div>
            )}

            {/* ── Status + Category + Notes ── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">

              {/* Quick-pick status chips */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Quick Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_STATUS_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setField('status')(chip.value)}
                      className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold ring-1 transition-all active:scale-95 ${
                        form.status === chip.value ? chip.activeCls : chip.cls
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Status</Label>
                  <Select value={form.status} onValueChange={setField('status')}>
                    <SelectTrigger className="h-9 text-[12px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus:ring-1 focus:ring-indigo-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-[12px]">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Category</Label>
                  <Select value={form.lead_category || 'NONE'} onValueChange={(v) => setField('lead_category')(v === 'NONE' ? '' : v)}>
                    <SelectTrigger className="h-9 text-[12px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus:ring-1 focus:ring-indigo-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" className="text-[12px]">Uncategorized</SelectItem>
                      {LEAD_CATEGORY_VALUES.map((c) => <SelectItem key={c} value={c} className="text-[12px]">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Call Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setField('notes')(e.target.value)}
                  placeholder="Discussion summary, objections, next steps…"
                  className="min-h-18 text-[12.5px] resize-none rounded-xl bg-slate-50 border-slate-200 p-2.5 shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-indigo-300"
                />
              </div>
            </div>

            {/* ── Client Profile (collapsible) ── */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowProfile((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="flex-1 text-[12.5px] font-medium text-slate-800">Client Profile</span>
                <span className="text-[10px] text-slate-400 mr-1">{isExisting ? 'Saved' : 'New'}</span>
                {showProfile ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
              </button>

              {showProfile && (
                <div className="px-3.5 pb-3.5 pt-0.5 space-y-2.5 border-t border-slate-100 animate-in slide-in-from-top-1 duration-150">
                  <div className="space-y-1 pt-2">
                    <Label className="text-[10px] text-slate-500">Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setField('name')(e.target.value)}
                      placeholder="Full name"
                      className="h-9 text-[12.5px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">Phone *</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setField('phone')(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="h-9 text-[12.5px] font-mono rounded-xl bg-slate-50 border-slate-200 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">Email</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setField('email')(e.target.value)}
                      placeholder="john@example.com"
                      className="h-9 text-[12.5px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Address</Label>
                      <Input
                        value={form.address}
                        onChange={(e) => setField('address')(e.target.value)}
                        placeholder="City, State"
                        className="h-9 text-[12.5px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Profession</Label>
                      <Input
                        value={form.profession}
                        onChange={(e) => setField('profession')(e.target.value)}
                        placeholder="Engineer"
                        className="h-9 text-[12.5px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">Source</Label>
                    <Select value={form.source_ui} onValueChange={setField('source_ui')}>
                      <SelectTrigger className="h-9 text-[12px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus:ring-1 focus:ring-indigo-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_UI_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-[12px]">{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.source_ui === 'REFERRAL' && (
                    <div className="space-y-1 animate-in fade-in">
                      <Label className="text-[10px] text-slate-500">Referee Name</Label>
                      <Input
                        value={form.referral_name}
                        onChange={(e) => setField('referral_name')(e.target.value)}
                        placeholder="Who referred?"
                        className="h-9 text-[12.5px] rounded-xl bg-slate-50 border-slate-200 shadow-none focus-visible:ring-1 focus-visible:ring-indigo-300"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Call History (collapsible) ── */}
            {callHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="flex-1 text-[12.5px] font-medium text-slate-800">Call History</span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full mr-1">{callHistory.length}</span>
                  {showHistory ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                </button>

                {showHistory && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-52 overflow-y-auto animate-in slide-in-from-top-1 duration-150">
                    {callHistory.map((c) => (
                      <div key={c.id} className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          {c.call_type === 'MISSED'
                            ? <PhoneMissed className="h-3 w-3 text-rose-400 shrink-0" />
                            : <Clock className="h-3 w-3 text-slate-300 shrink-0" />}
                          <p className="text-[11px] text-slate-700 flex-1">
                            {fmtDate(c.call_start)} · {fmtTime(c.call_start)}
                            {c.duration_seconds > 0 && (
                              <span className="text-slate-400 font-mono ml-1">· {formatCallDuration(c.duration_seconds)}</span>
                            )}
                          </p>
                          {c.outcome_label && (
                            <span className="text-[9.5px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full shrink-0">{c.outcome_label}</span>
                          )}
                        </div>
                        {c.customer_notes && (
                          <p className="text-[10.5px] text-slate-500 leading-relaxed mt-1 pl-5 line-clamp-2">{c.customer_notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ══ STICKY FOOTER ════════════════════════════════════════════════ */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-3 py-2.5 flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={closeDrawer}
            disabled={savingLead || savingSched}
            className="h-9 px-3 text-[12.5px] font-medium rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-none"
          >
            Done
          </Button>
          <Button
            onClick={saveLead}
            disabled={!canSave}
            className="flex-1 h-9 gap-1.5 text-[12.5px] font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
          >
            {savingLead ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              <><Save className="h-3.5 w-3.5" />{isExisting ? 'Update Client' : 'Save Client'}</>
            )}
          </Button>
        </div>

      </DrawerContent>
    </Drawer>
  );
}
