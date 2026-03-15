import { useState, useEffect } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall, X, UserPlus, Clock, Calendar } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { createLead, LEAD_SOURCE_OPTIONS } from '@/services/leadApi';
import api from '@/lib/axios';
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

export default function CallLeadDrawer({ open, callData, onClose, onLeadCreated }) {
  const meta = CALL_TYPE_META[callData?.callType] ?? CALL_TYPE_META.UNKNOWN;
  const CallIcon = meta.icon;

  const [form, setForm] = useState({
    name: '',
    phone: '',
    notes: '',
    lead_source: 'Other',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open && callData) {
      setForm({
        name: defaultLeadName(callData.phoneNumber),
        phone: callData.phoneNumber ?? '',
        notes: '',
        lead_source: 'Other',
      });
      setErrors({});
    }
  }, [open, callData]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await createLead({
        name: form.name.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim() || null,
        lead_source: form.lead_source,
      });
      if (result.success) {
        toast.success('Lead created!', {
          description: `${form.name} has been added to your leads.`,
        });
        onLeadCreated?.(result.lead);
        onClose?.();
      } else {
        toast.error(result.message || 'Failed to create lead');
      }
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Network error - could not create lead';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (value) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v && !submitting) onClose?.(); }}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2">
          <div className={`mx-auto mb-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${meta.bg} ${meta.color} border ${meta.border}`}>
            <CallIcon className="h-4 w-4" />
            {formatCallType(callData?.callType)}
          </div>

          <DrawerTitle className="text-base font-bold text-center text-foreground">
            Add as Lead
          </DrawerTitle>
          <DrawerDescription className="text-center text-xs text-muted-foreground">
            A call just ended - save this contact as a lead in your CRM.
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
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Full Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set('name')(e.target.value)}
              placeholder="e.g. Ravi Kumar"
              className={`h-10 text-sm ${errors.name ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
            />
            {errors.name && <p className="text-xs text-rose-500">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phone <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.phone}
              onChange={(e) => set('phone')(e.target.value)}
              placeholder="+91 9876543210"
              type="tel"
              className={`h-10 text-sm font-mono ${errors.phone ? 'border-rose-400 focus-visible:ring-rose-400' : ''}`}
            />
            {errors.phone && <p className="text-xs text-rose-500">{errors.phone}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lead Source
            </Label>
            <Select value={form.lead_source} onValueChange={set('lead_source')}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              placeholder="Any notes about this lead..."
              className="min-h-16 text-sm resize-none"
            />
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

        <DrawerFooter className="pt-3 gap-2">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-11 gap-2 text-sm font-semibold bg-primary hover:bg-primary/90"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create Lead
              </>
            )}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="outline"
              disabled={submitting}
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
  );
}
