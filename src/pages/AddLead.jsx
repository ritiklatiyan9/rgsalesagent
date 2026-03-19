import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  ArrowLeft, UserPlus, Phone, Mail, MapPin, Briefcase, AlertCircle, Users, List,
  FileSpreadsheet, ArrowRightLeft, History, Camera, X, CalendarDays, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New Lead' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'SITE_VISIT', label: 'Site Visit' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'LOST', label: 'Lost' },
];

const LEAD_SOURCE_OPTIONS = [
  { value: 'Direct', label: 'Direct' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Website', label: 'Website' },
  { value: 'Advertisement', label: 'Advertisement' },
  { value: 'Event', label: 'Event' },
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
    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
  </div>
);

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
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leads')} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Add New Lead</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in the details to create a new lead</p>
        </div>
      </div>

      {/* Sub-page tabs */}
      <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1 px-1 py-1 bg-muted/40 rounded-xl min-w-max">
          <Link to="/leads" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
            <List className="h-3.5 w-3.5" />
            My Leads
          </Link>
          <Link to="/leads/add" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60 whitespace-nowrap">
            <UserPlus className="h-3.5 w-3.5" />
            Add Lead
          </Link>
          <Link to="/leads/bulk" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Bulk</span> Import
          </Link>
          <Link to="/leads/assign" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Assign
          </Link>
          <Link to="/leads/assignment-history" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
            <History className="h-3.5 w-3.5" />
            History
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-0 card-elevated">
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-border/50">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold">Lead Information</h3>
            </div>

            {/* Lead Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
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
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => document.getElementById('lead-photo-input').click()}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
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
                <Input placeholder="e.g. Ravi Sharma" value={form.name} onChange={(e) => set('name', e.target.value)} className="rounded-xl" />
              </FormField>
              <FormField label="Status">
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Phone Number" required>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="pl-9 rounded-xl" />
                </div>
              </FormField>
              <FormField label="Email Address">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input type="email" placeholder="email@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} className="pl-9 rounded-xl" />
                </div>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Profession / Occupation">
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="e.g. Software Engineer" value={form.profession} onChange={(e) => set('profession', e.target.value)} className="pl-9 rounded-xl" />
                </div>
              </FormField>
              <FormField label="Lead Source">
                <Select value={form.lead_source} onValueChange={(v) => set('lead_source', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Lead Status">
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Lead Category">
                <Select value={form.lead_category} onValueChange={(v) => set('lead_category', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Address">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="City, State" value={form.address} onChange={(e) => set('address', e.target.value)} className="pl-9 rounded-xl" />
                </div>
              </FormField>
            </div>

            <FormField label="Notes">
              <Textarea placeholder="Any remarks, source of lead, etc." value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="rounded-xl resize-none" />
            </FormField>

            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Make Schedule</p>
                  <p className="text-[11px] text-violet-600/90 mt-0.5">Create a follow-up reminder while adding this lead</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowScheduleForm((v) => !v);
                    setFormError('');
                  }}
                  className="gap-1.5 text-xs text-violet-600 border-violet-200 hover:bg-violet-100 h-8"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {showScheduleForm ? 'Cancel' : 'Schedule Call'}
                </Button>
              </div>

              {showScheduleForm && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 block">Select Date</Label>
                      <Input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={scheduleForm.date}
                        onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 block">Time</Label>
                      <Input
                        type="time"
                        value={scheduleForm.time}
                        onChange={(e) => setScheduleForm((f) => ({ ...f, time: e.target.value }))}
                        className="h-9 text-sm"
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
                      className="text-sm resize-none"
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

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/leads')} className="rounded-xl px-6">Cancel</Button>
          <Button type="submit" disabled={loading} className="rounded-xl px-6 gap-2 bg-indigo-600 hover:bg-indigo-700">
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
      </form>
    </div>
  );
};

export default AddLead;
