import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { User, Mail, Phone, MapPin, Briefcase, Camera, Save, X, Lock } from 'lucide-react';

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout, refreshUser } = useAuth();
  const roleLabel = String(user?.role || '').toUpperCase() === 'TEAM_HEAD' ? 'Team Head' : 'Agent';

  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Profile form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    designation: '',
    bio: '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Sync form state when user data loads/changes
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle image selection
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  // Save profile updates
  const handleSaveProfile = async () => {
    try {
      setIsLoading(true);

      const payload = new FormData();
      if (formData.name) payload.append('name', formData.name);
      if (formData.phone) payload.append('phone', formData.phone);
      payload.append('address', formData.address);
      payload.append('designation', formData.designation);
      payload.append('bio', formData.bio);

      // Attach photo file if user selected a new one
      if (selectedFile) {
        payload.append('profile_photo', selectedFile);
      }

      const response = await api.put('/auth/profile', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data?.success) {
        toast.success('Profile updated successfully');
        setIsEditing(false);
        setSelectedFile(null);
        // Refresh user in context so entire app reflects updates
        await refreshUser();
      } else {
        toast.error(response.data?.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Update password
  const handleUpdatePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.put('/auth/profile', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (response.data?.success) {
        toast.success('Password updated successfully');
        setShowPasswordDialog(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(response.data?.message || 'Failed to update password');
      }
    } catch (error) {
      console.error('Password update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      designation: user?.designation || '',
      bio: user?.bio || '',
    });
    setSelectedFile(null);
    setPreviewUrl(user?.profile_photo || null);
    setIsEditing(false);
  };

  // Auto-open settings tab if requested
  const activeTab = searchParams.get('section') || 'profile';

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
          <p className="text-slack-500 mt-1">Manage your account settings and preferences</p>
        </div>
        {!isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Edit Profile
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {}} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                {isEditing ? 'Update your profile details' : 'Your personal and professional information'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-slate-200">
                <div className="relative">
                  <div className="h-32 w-32 rounded-lg bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg overflow-hidden">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-16 w-16 opacity-50" />
                    )}
                  </div>
                  {isEditing && (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full shadow-lg transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </>
                  )}
                </div>

                <div className="flex flex-col justify-center">
                  <h3 className="text-lg font-semibold text-slate-900">{formData.name}</h3>
                  <p className="text-slate-500 mt-1">{formData.designation || roleLabel}</p>
                  <p className="text-sm text-slate-400 mt-2">{formData.email}</p>
                  {isEditing && (
                    <p className="text-xs text-slate-400 mt-3">Click camera icon to change photo</p>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700 font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`${!isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-slate-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-400">Email cannot be changed</p>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-700 font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`${!isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    placeholder="+91 9876543210"
                  />
                </div>

                {/* Designation */}
                <div className="space-y-2">
                  <Label htmlFor="designation" className="text-slate-700 font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    Designation
                  </Label>
                  <Input
                    id="designation"
                    name="designation"
                    value={formData.designation}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`${!isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-slate-700 font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`${!isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    placeholder="City, State"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-slate-700 font-medium">
                    Bio
                  </Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`resize-none ${!isEditing ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    placeholder="Tell us about yourself"
                    rows={4}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Change Password */}
              <div className="pb-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">Change Password</p>
                      <p className="text-sm text-slate-500 mt-1">Update your password regularly to keep your account secure</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowPasswordDialog(true)}
                    variant="outline"
                  >
                    Change
                  </Button>
                </div>
              </div>

              {/* Coming Soon Features */}
              <div className="space-y-4 pt-4">
                <p className="text-sm text-slate-500 font-medium">More security options coming soon</p>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
                    <p className="text-xs text-slate-500 mt-1">Add an extra layer of security to your account</p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-sm font-medium text-slate-700">Active Sessions</p>
                    <p className="text-xs text-slate-500 mt-1">Manage devices and sessions logged into your account</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900">Account Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => logout()}
                variant="outline"
                className="text-red-600 hover:text-red-700 border-red-300 hover:bg-red-100"
              >
                Logout
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Password Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current password and choose a new password
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium">
                Current Password
              </Label>
              <Input
                id="currentPassword"
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">
                New Password
              </Label>
              <Input
                id="newPassword"
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdatePassword}
              disabled={isLoading || !passwordData.currentPassword || !passwordData.newPassword}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
