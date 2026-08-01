import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  User, Mail, Phone, MapPin, Briefcase, Camera, Save, X,
  Lock, Hash, Copy, Check, Eye, EyeOff, ChevronRight,
  LogOut, Shield, KeyRound, Pencil, UserPlus, Users,
} from 'lucide-react';

const TABS = [
  { id: 'profile',  label: 'Profile'  },
  { id: 'settings', label: 'Settings' },
];

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout, refreshUser } = useAuth();
  const fileInputRef = useRef(null);
  const roleLabel = String(user?.role || '').toUpperCase() === 'TEAM_HEAD' ? 'Team Head' : 'Agent';

  const [activeTab, setActiveTab] = useState(searchParams.get('section') || 'profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl]     = useState(null);

  // Password form
  const [pwOpen, setPwOpen]     = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw]     = useState({ current: false, new: false, confirm: false });
  const [pwData, setPwData]     = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  // Sub-agent form (only for AGENT role)
  const isAgent = String(user?.role || '').toUpperCase() === 'AGENT';
  const [subAgentOpen, setSubAgentOpen] = useState(false);
  const [subAgentSaving, setSubAgentSaving] = useState(false);
  const [subAgentData, setSubAgentData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [subAgentShowPw, setSubAgentShowPw] = useState({ password: false, confirmPassword: false });

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '', designation: '', bio: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        designation: user.designation || '',
        bio: user.bio || '',
      });
      setPreviewUrl(user.profile_photo || null);
    }
  }, [user]);

  const switchTab = (id) => {
    setActiveTab(id);
    setSearchParams({ section: id }, { replace: true });
  };

  const handleInput = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handlePwInput = (e) => setPwData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = new FormData();
      if (formData.name)  payload.append('name', formData.name);
      if (formData.phone) payload.append('phone', formData.phone);
      payload.append('address', formData.address);
      payload.append('designation', formData.designation);
      payload.append('bio', formData.bio);
      if (selectedFile) payload.append('profile_photo', selectedFile);

      const { data } = await api.put('/auth/profile', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.success) {
        toast.success('Profile updated');
        setIsEditing(false);
        setSelectedFile(null);
        await refreshUser();
      } else {
        toast.error(data?.message || 'Failed to update profile');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '', email: user?.email || '', phone: user?.phone || '',
      address: user?.address || '', designation: user?.designation || '', bio: user?.bio || '',
    });
    setSelectedFile(null);
    setPreviewUrl(user?.profile_photo || null);
    setIsEditing(false);
  };

  const handlePasswordUpdate = async () => {
    if (!pwData.currentPassword) { toast.error('Enter your current password'); return; }
    if (pwData.newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (pwData.newPassword !== pwData.confirmPassword) { toast.error('New passwords do not match'); return; }
    setPwSaving(true);
    try {
      const { data } = await api.put('/auth/profile', {
        currentPassword: pwData.currentPassword,
        newPassword: pwData.newPassword,
      });
      if (data?.success) {
        toast.success('Password updated successfully');
        setPwOpen(false);
        setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(data?.message || 'Failed to update password');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!user?.sponsor_code) return;
    try {
      await navigator.clipboard.writeText(user.sponsor_code);
      setCopiedCode(true);
      toast.success('Referral code copied');
      setTimeout(() => setCopiedCode(false), 1800);
    } catch { toast.error('Could not copy'); }
  };

  const handleSubAgentInput = (e) => setSubAgentData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubAgentRegister = async () => {
    if (!subAgentData.name || !subAgentData.email || !subAgentData.password) {
      toast.error('Name, email and password are required'); return;
    }
    if (subAgentData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (subAgentData.password !== subAgentData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (!user?.team_id) { toast.error('You must be assigned to a team first'); return; }
    setSubAgentSaving(true);
    try {
      const { data } = await api.post('/teams/my/register-sub-agent', {
        name: subAgentData.name,
        email: subAgentData.email,
        phone: subAgentData.phone || undefined,
        password: subAgentData.password,
      });
      if (data?.success) {
        toast.success('Sub-agent registered successfully');
        setSubAgentOpen(false);
        setSubAgentData({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
      } else {
        toast.error(data?.message || 'Failed to register sub-agent');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register sub-agent');
    } finally {
      setSubAgentSaving(false);
    }
  };

  const initials = (user?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-4 pb-8 max-w-lg mx-auto">

      {/* ── Avatar hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm">
        <div className="h-1.5 w-full bg-linear-to-r from-indigo-500 via-violet-500 to-purple-500" />
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white overflow-hidden shadow-md">
                {previewUrl
                  ? <img src={previewUrl} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-bold">{initials}</span>
                }
              </div>
              {isEditing && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-700 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                </>
              )}
            </div>

            {/* Name / role */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-lg font-bold text-slate-900 truncate">{formData.name || '—'}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{formData.designation || roleLabel}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{formData.email}</p>
            </div>

            {/* Edit button (view mode only) */}
            {!isEditing && activeTab === 'profile' && (
              <button
                onClick={() => setIsEditing(true)}
                className="shrink-0 h-8 w-8 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors mt-1"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
              activeTab === t.id
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ PROFILE TAB ══════════════════ */}
      {activeTab === 'profile' && (
        <div className="space-y-3">

          {/* Referral code */}
          {user?.sponsor_code && (
            <div className="bg-linear-to-br from-indigo-50 via-violet-50 to-fuchsia-50 border border-indigo-100 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-white/70 ring-1 ring-indigo-100 flex items-center justify-center shrink-0">
                    <Hash className="h-4 w-4 text-indigo-600" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Referral Code</p>
                    <p className="text-xl font-bold text-slate-900 tabular-nums tracking-wider">{user.sponsor_code}</p>
                  </div>
                </div>
                <button
                  onClick={handleCopyReferral}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Personal Info</p>
              {isEditing && (
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">Editing</span>
              )}
            </div>

            <div className="divide-y divide-slate-50">
              <FieldRow icon={<User className="h-3.5 w-3.5" />} label="Full Name">
                {isEditing
                  ? <Input name="name" value={formData.name} onChange={handleInput} className="h-8 text-sm border-slate-200" />
                  : <span className="text-sm text-slate-800 font-medium">{formData.name || '—'}</span>
                }
              </FieldRow>

              <FieldRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                <div>
                  <span className="text-sm text-slate-800 font-medium">{formData.email || '—'}</span>
                  <p className="text-[10px] text-slate-400">Cannot be changed</p>
                </div>
              </FieldRow>

              <FieldRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                {isEditing
                  ? <Input name="phone" value={formData.phone} onChange={handleInput} className="h-8 text-sm border-slate-200" placeholder="+91 9876543210" />
                  : <span className="text-sm text-slate-800 font-medium">{formData.phone || '—'}</span>
                }
              </FieldRow>

              <FieldRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Designation">
                {isEditing
                  ? <Input name="designation" value={formData.designation} onChange={handleInput} className="h-8 text-sm border-slate-200" />
                  : <span className="text-sm text-slate-800 font-medium">{formData.designation || '—'}</span>
                }
              </FieldRow>

              <FieldRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address">
                {isEditing
                  ? <Input name="address" value={formData.address} onChange={handleInput} className="h-8 text-sm border-slate-200" placeholder="City, State" />
                  : <span className="text-sm text-slate-800 font-medium">{formData.address || '—'}</span>
                }
              </FieldRow>
            </div>

            {/* Bio */}
            <div className="px-4 py-3 border-t border-slate-50">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Bio</p>
              {isEditing
                ? <Textarea name="bio" value={formData.bio} onChange={handleInput} className="resize-none text-sm border-slate-200 min-h-20" placeholder="Tell us about yourself…" rows={3} />
                : <p className="text-sm text-slate-700">{formData.bio || <span className="text-slate-400 italic">No bio yet</span>}</p>
              }
            </div>
          </div>

          {/* Save / Cancel */}
          {isEditing && (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-1.5"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="gap-1.5">
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ SETTINGS TAB ══════════════════ */}
      {activeTab === 'settings' && (
        <div className="space-y-3">

          {/* Security */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-500" /> Security
              </p>
            </div>

            {/* Change password toggle row */}
            <button
              onClick={() => setPwOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">Change Password</p>
                  <p className="text-xs text-slate-400">Update your account password</p>
                </div>
              </div>
              <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${pwOpen ? 'rotate-90' : ''}`} />
            </button>

            {/* Inline password form */}
            {pwOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-1 duration-200">
                <PwField
                  id="currentPassword" name="currentPassword" label="Current Password"
                  value={pwData.currentPassword} onChange={handlePwInput}
                  show={showPw.current} onToggle={() => setShowPw(p => ({ ...p, current: !p.current }))}
                />
                <PwField
                  id="newPassword" name="newPassword" label="New Password"
                  value={pwData.newPassword} onChange={handlePwInput}
                  show={showPw.new} onToggle={() => setShowPw(p => ({ ...p, new: !p.new }))}
                />
                <PwField
                  id="confirmPassword" name="confirmPassword" label="Confirm New Password"
                  value={pwData.confirmPassword} onChange={handlePwInput}
                  show={showPw.confirm} onToggle={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handlePasswordUpdate}
                    disabled={pwSaving || !pwData.currentPassword || !pwData.newPassword}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => { setPwOpen(false); setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
                    disabled={pwSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Account info */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" /> Account
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              <InfoRow label="Role" value={roleLabel} />
              <InfoRow label="Email" value={user?.email || '—'} />
              {user?.team_id && <InfoRow label="Team ID" value={`#${user.team_id}`} />}
              {user?.sponsor_code && <InfoRow label="Referral Code" value={user.sponsor_code} />}
            </div>
          </div>

          {/* Sub-Agent Management — only for AGENT role */}
          {isAgent && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" /> Sub-Agents
                </p>
              </div>

              {/* Add Sub-Agent toggle row */}
              <button
                onClick={() => setSubAgentOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Add Sub-Agent</p>
                    <p className="text-xs text-slate-400">Register a sub-agent under your referral</p>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${subAgentOpen ? 'rotate-90' : ''}`} />
              </button>

              {/* Inline sub-agent form */}
              {subAgentOpen && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1">
                    <Label htmlFor="sa-name" className="text-xs font-medium text-slate-600">Full Name</Label>
                    <Input id="sa-name" name="name" value={subAgentData.name} onChange={handleSubAgentInput} className="h-9 text-sm border-slate-200" placeholder="Sub-agent name" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sa-email" className="text-xs font-medium text-slate-600">Email</Label>
                    <Input id="sa-email" name="email" type="email" value={subAgentData.email} onChange={handleSubAgentInput} className="h-9 text-sm border-slate-200" placeholder="sub-agent@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sa-phone" className="text-xs font-medium text-slate-600">Phone <span className="text-slate-400">(optional)</span></Label>
                    <Input id="sa-phone" name="phone" value={subAgentData.phone} onChange={handleSubAgentInput} className="h-9 text-sm border-slate-200" placeholder="+91 9876543210" />
                  </div>
                  <PwField
                    id="sa-password" name="password" label="Password"
                    value={subAgentData.password} onChange={handleSubAgentInput}
                    show={subAgentShowPw.password} onToggle={() => setSubAgentShowPw(p => ({ ...p, password: !p.password }))}
                  />
                  <PwField
                    id="sa-confirm" name="confirmPassword" label="Confirm Password"
                    value={subAgentData.confirmPassword} onChange={handleSubAgentInput}
                    show={subAgentShowPw.confirmPassword} onToggle={() => setSubAgentShowPw(p => ({ ...p, confirmPassword: !p.confirmPassword }))}
                  />
                  <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
                    Sub-agent will be linked to your referral code <strong>{user?.sponsor_code}</strong> and assigned to your team.
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={handleSubAgentRegister}
                      disabled={subAgentSaving || !subAgentData.name || !subAgentData.email || !subAgentData.password}
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {subAgentSaving ? 'Registering…' : 'Register Sub-Agent'}
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { setSubAgentOpen(false); setSubAgentData({ name: '', email: '', phone: '', password: '', confirmPassword: '' }); }}
                      disabled={subAgentSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          <div className="bg-white border border-red-100 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-50 transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center">
                <LogOut className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-600">Sign Out</p>
                <p className="text-xs text-red-400">Log out of your account</p>
              </div>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

/* ── Small helpers ── */

function FieldRow({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="shrink-0 mt-0.5 text-slate-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function PwField({ id, name, label, value, onChange, show, onToggle }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</Label>
      <div className="relative">
        <Input
          id={id} name={name}
          type={show ? 'text' : 'password'}
          value={value} onChange={onChange}
          className="pr-9 h-9 text-sm border-slate-200"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
