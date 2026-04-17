import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { invalidateCache } from '@/lib/queryCache';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UserPlus, Phone, Mail, MapPin, Briefcase, AlertCircle, Users,
  Camera, X, CalendarDays, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'SITE_VISIT', label: 'Site Visit' },
  { value: 'NOT_ANSWERING', label: 'Not Answering' },
  { value: 'SWITCH_OFF', label: 'Switch Off' },
  { value: 'INCOMING_OFF', label: 'Incoming Off' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'LOST', label: 'Lost' },
];

const LEAD_SOURCE_OPTIONS = [
  { value: 'Direct', label: 'Direct' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Website', label: 'Website' },
  { value: 'Other', label: 'Other' },
];

const LEAD_CATEGORY_OPTIONS = [
  { value: 'PRIME', label: 'Prime' },
  { value: 'HOT', label: 'Hot' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'COLD', label: 'Cold' },
  { value: 'DEAD', label: 'Dead' },
];

const FormField = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em]">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
  </div>
);

const INPUT_CLASS = 'h-11 rounded-2xl border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] focus-visible:ring-slate-200 focus-visible:border-slate-400';
const SELECT_TRIGGER_CLASS = 'h-11 rounded-2xl border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]';

const CATEGORY_TONES = {
  PRIME: 'bg-amber-100 text-amber-800 ring-amber-200',
  HOT: 'bg-rose-100 text-rose-800 ring-rose-200',
  NORMAL: 'bg-blue-100 text-blue-800 ring-blue-200',
  COLD: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
  DEAD: 'bg-slate-200 text-slate-700 ring-slate-300',
};

const CATEGORY_IDLE = 'bg-white text-slate-600 ring-slate-200';

const EMPTY = {
  name: '', phone: '', email: '', address: '', profession: '', status: 'NEW', lead_source: 'Other', lead_category: '', notes: '',
};

const AddLead = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '10:00', notes: '' });

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) return setFormError('Lead name is required');
    if (!form.phone.trim() && !form.email.trim()) return setFormError('Either phone or email is required');
    if (showScheduleForm && !scheduleForm.date) return setFormError('Please choose a schedule date');

    try {
      setLoading(true);
      const payload = new FormData();
      payload.append('name', form.name.trim());
      if (form.phone.trim()) payload.append('phone', form.phone.trim());
      if (form.email.trim()) payload.append('email', form.email.trim());
      if (form.address.trim()) payload.append('address', form.address.trim());
      if (form.profession.trim()) payload.append('profession', form.profession.trim());
      payload.append('status', form.status);
      payload.append('lead_source', form.lead_source);
      if (form.lead_category) payload.append('lead_category', form.lead_category);
      if (form.notes.trim()) payload.append('notes', form.notes.trim());
      if (photoFile) payload.append('photo', photoFile);

      const { data } = await api.post('/leads', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        if (showScheduleForm && scheduleForm.date && data.lead?.id) {
          try {
            await api.post('/followups', {
              lead_id: data.lead.id,
              followup_type: 'CALL',
              scheduled_date: scheduleForm.date,
              scheduled_time: scheduleForm.time || '10:00',
              ...(scheduleForm.notes.trim() ? { notes: scheduleForm.notes.trim() } : {}),
            });
            invalidateCache('/followups');
            invalidateCache('/followups/counts');
            toast.success('Lead added and follow-up scheduled!');
          } catch {
            toast.error('Lead added, but scheduling failed. You can schedule from lead details.');
          }
        } else {
          toast.success('Lead added successfully!');
        }
        invalidateCache('/leads');
        navigate('/leads');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-[calc(12rem+env(safe-area-inset-bottom,0px))] md:pb-4">
      <form onSubmit={handleSubmit} className="space-y-4">
     

        <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/80">
          <CardContent className="p-4 sm:p-5 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="h-9 w-9 rounded-2xl bg-slate-100 flex items-center justify-center shadow-sm">
                <Users className="h-4.5 w-4.5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-800">Lead Details</h3>
                <p className="text-[10px] text-slate-400 font-medium">Everything your team needs before first contact</p>
              </div>
            </div>

            {/* Lead Photo */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-sm">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Lead" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 ring-2 ring-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                  onClick={() => document.getElementById('lead-photo-input').click()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <p className="text-[10px] text-slate-500 mt-1">JPG, PNG up to 5MB</p>
                <input
                  id="lead-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Full Name" required>
                <Input placeholder="e.g. Ravi Sharma" value={form.name} onChange={(e) => set('name', e.target.value)} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Phone Number" required>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={`pl-9 ${INPUT_CLASS}`} />
                </div>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email Address">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input type="email" placeholder="email@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} className={`pl-9 ${INPUT_CLASS}`} />
                </div>
              </FormField>
              <FormField label="Profession / Occupation">
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="e.g. Software Engineer" value={form.profession} onChange={(e) => set('profession', e.target.value)} className={`pl-9 ${INPUT_CLASS}`} />
                </div>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Lead Status">
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Lead Source">
                <Select value={form.lead_source} onValueChange={(v) => set('lead_source', v)}>
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="Lead Category">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {LEAD_CATEGORY_OPTIONS.map((c) => {
                  const active = form.lead_category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => set('lead_category', active ? '' : c.value)}
                      className={`shrink-0 h-8 px-3.5 rounded-full text-[11px] font-bold ring-1 ring-inset active:scale-95 transition-all ${active ? CATEGORY_TONES[c.value] : CATEGORY_IDLE}`}
                    >
                      {c.label}
                    </button>
                  );
                })}
                {form.lead_category && (
                  <button
                    type="button"
                    onClick={() => set('lead_category', '')}
                    className="shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold bg-white text-slate-500 ring-1 ring-slate-200 active:scale-95"
                  >
                    Clear
                  </button>
                )}
              </div>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Address">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="City, State" value={form.address} onChange={(e) => set('address', e.target.value)} className={`pl-9 ${INPUT_CLASS}`} />
                </div>
              </FormField>
            </div>

            <FormField label="Notes">
              <Textarea placeholder="Any remarks, source of lead, budget or timeline notes..." value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="rounded-2xl border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] resize-none focus-visible:ring-slate-200 focus-visible:border-slate-400" />
            </FormField>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Make Schedule</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Create a follow-up reminder while adding this lead</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowScheduleForm((v) => !v);
                    setFormError('');
                  }}
                  className="gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-100 h-8"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {showScheduleForm ? 'Cancel' : 'Schedule Call'}
                </Button>
              </div>

              {showScheduleForm && (
                <div className="space-y-3 rounded-xl bg-white border border-slate-200 p-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 block">Select Date</Label>
                      <Input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={scheduleForm.date}
                        onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
                        className="h-10 text-sm rounded-xl border-slate-300"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 block">Time</Label>
                      <Input
                        type="time"
                        value={scheduleForm.time}
                        onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
                        className="h-10 text-sm rounded-xl border-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600 mb-1 block">Notes (optional)</Label>
                    <Textarea
                      placeholder="Add notes for this follow-up..."
                      value={scheduleForm.notes}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="text-sm resize-none rounded-xl border-slate-300"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {formError && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="fixed md:static inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+8px)] md:bottom-auto z-20 px-3 pt-2 md:p-0">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-200/60 md:rounded-none md:border-0 md:bg-transparent md:shadow-none md:p-0">
            <div className="flex items-center justify-between gap-2 px-1 pb-2 md:hidden">
              <p className="text-[11px] text-slate-500 font-medium">Ready to save this lead?</p>
              <span className="text-[10px] rounded-full bg-slate-100 text-slate-600 px-2 py-1 font-semibold">Quick Add</span>
            </div>
            <div className="flex gap-2.5 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate('/leads')} className="h-11 rounded-xl px-5 flex-1 md:flex-none">Cancel</Button>
              <Button type="submit" disabled={loading} className="h-11 rounded-xl px-5 gap-2 bg-slate-900 hover:bg-slate-800 flex-[1.35] md:flex-none">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Add Lead
              </>
            )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AddLead;
