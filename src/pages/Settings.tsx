import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase, Profile } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Language } from '@/lib/i18n';
import { User, Globe, Loader2 } from 'lucide-react';

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
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

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        company: profile.company,
        language,
      });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: 'Profile saved' });
    }
    setSaving(false);
  }

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
      <div className="max-w-2xl space-y-6">
        {/* Profile Section */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('settings.profile')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.name')}</Label>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.email')}</Label>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.phone')}</Label>
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.company')}</Label>
                <Input
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                />
              </div>
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
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-2">
              <Label>{t('settings.language')}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nl">{t('settings.dutch')}</SelectItem>
                  <SelectItem value="en">{t('settings.english')}</SelectItem>
                  <SelectItem value="es">{t('settings.spanish')}</SelectItem>
                  <SelectItem value="pt">{t('settings.portuguese')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('settings.save')}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
