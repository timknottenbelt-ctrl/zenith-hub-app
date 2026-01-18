import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Language } from '@/lib/i18n';
import { 
  User, 
  Globe, 
  Loader2, 
  Camera, 
  Lock, 
  Eye, 
  EyeOff,
  Save,
  Shield,
} from 'lucide-react';

const LBH_OFFICES = [
  { code: 'nl', name: 'Nederland', flag: '🇳🇱' },
  { code: 'cw', name: 'Curaçao', flag: '🇨🇼' },
  { code: 'br', name: 'Brazilië', flag: '🇧🇷' },
  { code: 'pa', name: 'Panama', flag: '🇵🇦' },
  { code: 'cl', name: 'Chili', flag: '🇨🇱' },
  { code: 'ar', name: 'Argentinië', flag: '🇦🇷' },
  { code: 'uy', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'co', name: 'Colombia', flag: '🇨🇴' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },
  { code: 'be', name: 'België', flag: '🇧🇪' },
  { code: 'it', name: 'Italië', flag: '🇮🇹' },
  { code: 'eg', name: 'Egypte', flag: '🇪🇬' },
  { code: 'cn', name: 'China', flag: '🇨🇳' },
  { code: 'za', name: 'Zuid-Afrika', flag: '🇿🇦' },
  { code: 'ke', name: 'Kenia', flag: '🇰🇪' },
  { code: 'mz', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'kr', name: 'Zuid-Korea', flag: '🇰🇷' },
];

export default function Settings() {
  const { t, language, setLanguage, office, setOffice } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    avatar_url: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          name: data.name || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          company: data.company || '',
          avatar_url: data.avatar_url || '',
        });
        if (data.language) {
          setLanguage(data.language as Language);
        }
      }
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      company: profile.company,
      avatar_url: profile.avatar_url,
      language,
    });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: 'Profile saved successfully' });
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }

    setUploadingAvatar(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    
    if (urlData.publicUrl) {
      setProfile(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
      
      // Update profile in database
      await supabase.from('profiles').upsert({
        id: user.id,
        avatar_url: urlData.publicUrl,
      });
      
      toast({ title: t('common.success'), description: 'Profile picture updated' });
    }

    setUploadingAvatar(false);
    e.target.value = '';
  }

  async function handlePasswordChange() {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: 'Password updated successfully' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }

    setChangingPassword(false);
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <DashboardLayout title={t('settings.title')}>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('settings.title')}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile Picture Section */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar_url} alt={profile.name} />
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                    {getInitials(profile.name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div>
                <h3 className="font-medium">{profile.name || 'Your Name'}</h3>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Change Photo'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('settings.profile')}
            </CardTitle>
            <CardDescription>Manage your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.name')}</Label>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.email')}</Label>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.phone')}</Label>
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+1 234 567 890"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.company')}</Label>
                <Input
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                  placeholder="Company Name"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LBH Office Section */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4" />
              LBH Kantoor
            </CardTitle>
            <CardDescription>Selecteer je LBH kantoor locatie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-2">
              <Label>Kantoor</Label>
              <Select value={office || ''} onValueChange={(v) => setOffice(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer kantoor" />
                </SelectTrigger>
                <SelectContent>
                  {LBH_OFFICES.map((o) => (
                    <SelectItem key={o.code} value={o.code}>
                      {o.flag} {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Language Section */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t('settings.language')}
            </CardTitle>
            <CardDescription>Choose your preferred language</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-2">
              <Label>{t('settings.language')}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nl">🇳🇱 {t('settings.dutch')}</SelectItem>
                  <SelectItem value="en">🇬🇧 {t('settings.english')}</SelectItem>
                  <SelectItem value="es">🇪🇸 {t('settings.spanish')}</SelectItem>
                  <SelectItem value="pt">🇧🇷 {t('settings.portuguese')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </CardTitle>
            <CardDescription>Change your password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={changingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              variant="outline"
              className="gap-2"
            >
              {changingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Update Password
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('settings.save')}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
