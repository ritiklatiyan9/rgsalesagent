import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Crown, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const TeamAgentRegister = () => {
  const navigate = useNavigate();
  const { user, isTeamHead } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const canCreate = useMemo(() => Boolean(isTeamHead && user?.team_id), [isTeamHead, user?.team_id]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    });
  };

  const validate = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      return 'Name, email, and password are required.';
    }
    if (form.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (form.password !== form.confirmPassword) {
      return 'Password and confirm password do not match.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!canCreate) {
      toast.error('Only team leaders with an assigned team can register agents.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      };

      if (form.phone.trim()) {
        payload.phone = form.phone.trim();
      }

      const res = await api.post(`/teams/${user.team_id}/register-agent`, payload);
      if (res.data?.success) {
        toast.success('Agent registered successfully.');
        resetForm();
      } else {
        toast.error('Failed to register agent.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to register agent.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="card-elevated border-0">
          <CardContent className="py-14 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600 font-medium">Access denied.</p>
            <p className="text-sm text-slate-400 mt-1">Only team leaders with an assigned team can register agents.</p>
            <Button className="mt-5" variant="outline" onClick={() => navigate('/team/manage')}>
              Back to Team Management
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/team/manage')} className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="page-title text-xl flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              Agent Register
            </h1>
            <p className="page-subtitle mt-0.5">Create an agent account directly under your team.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-100 text-violet-700">
          <Crown className="h-3.5 w-3.5" /> Team Leader Action
        </span>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">New Agent Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">Full Name</Label>
                <Input
                  id="agent-name"
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agent-email">Email</Label>
                <Input
                  id="agent-email"
                  type="email"
                  placeholder="agent@example.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agent-phone">Phone</Label>
                <Input
                  id="agent-phone"
                  placeholder="Optional"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agent-password">Password</Label>
                <Input
                  id="agent-password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="agent-confirm-password">Confirm Password</Label>
                <Input
                  id="agent-confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  required
                />
              </div>
            </div>

            <Alert className="border-emerald-200 bg-emerald-50/60">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-800 text-sm">
                The new account will be created as role <strong>AGENT</strong> and automatically assigned to your team.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => navigate('/team/manage')}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {submitting ? 'Registering…' : 'Register Agent'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamAgentRegister;
