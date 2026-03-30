import { useState, useEffect } from 'react';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Ship, Lock, Check } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, { message: "Wachtwoord moet minimaal 6 tekens zijn" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Wachtwoorden komen niet overeen",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const navigate = useTransitionNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const type = hashParams.get('type') || url.searchParams.get('type');
      const code = url.searchParams.get('code');

      // Heeft de URL recovery/magic link params? Dan sessie herstellen
      if (access_token && refresh_token) {
        await (supabase.auth as any).setSession({ access_token, refresh_token });
        setReady(true);
        return;
      }

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        setReady(true);
        return;
      }

      // Geen params — check of er al een sessie is
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        // Al ingelogd en op reset-password pagina zonder params → toon het formulier gewoon
        setReady(true);
      } else {
        // Geen sessie en geen params → stuur naar login
        navigate('/auth');
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Validatiefout',
        description: validation.error.errors[0].message,
        variant: 'destructive'
      });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      toast({
        title: 'Sessie verlopen',
        description: 'De link is niet meer geldig. Vraag een nieuwe link aan.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const msg = updateError.message?.toLowerCase().includes('same password')
          ? 'Je nieuwe wachtwoord mag niet hetzelfde zijn als je huidige wachtwoord.'
          : 'Wachtwoord wijzigen mislukt. Probeer opnieuw.';
        toast({ title: 'Niet gelukt', description: msg, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Verwijder must_change_password flag
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id);
        }
      } catch (e) {
        console.error('Profile update error:', e);
      }

      toast({ title: 'Wachtwoord gewijzigd', description: 'Je wachtwoord is succesvol ingesteld.' });
      setLoading(false);
      setTimeout(() => { window.location.href = '/'; }, 500);
    } catch (error) {
      console.error('Password reset error:', error);
      toast({ title: 'Fout', description: 'Er is iets misgegaan. Probeer opnieuw.', variant: 'destructive' });
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Ship className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">LBH Curaçao</h1>
          <p className="text-muted-foreground">Maritime Services Dashboard</p>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-center">Wachtwoord instellen</CardTitle>
            <CardDescription className="text-center">Kies een nieuw wachtwoord voor je account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Nieuw wachtwoord
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> Bevestig wachtwoord
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Wachtwoord opslaan
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
