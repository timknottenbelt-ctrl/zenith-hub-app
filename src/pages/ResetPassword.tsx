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
        await supabase.auth.setSession({ access_token, refresh_token });
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
      <div className="min-h-screen flex items-center justify-center bg-[#070b16]">
        <Loader2 className="w-8 h-8 animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b16] text-white p-6">
      <div className="absolute top-0 right-0 w-[26rem] h-[26rem] rounded-full bg-[#1e63d4]/12 blur-[120px] pointer-events-none" />
      <div className="relative w-full max-w-[420px]">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-xl bg-[#1e63d4] flex items-center justify-center"
            style={{ boxShadow: '0 8px 24px -6px rgba(30,99,212,0.6)' }}>
            <Ship className="w-[22px] h-[22px] text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-[15px]">LBH Curaçao</p>
            <p className="text-[11px] text-white/45">Maritime Services</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8" style={{ boxShadow: '0 24px 64px -24px rgba(0,0,0,0.7)' }}>
          <p className="text-[11px] font-semibold tracking-[0.25em] text-[#5fa8ff]/80 uppercase mb-3">Beveiliging</p>
          <h1 className="text-[1.6rem] font-bold tracking-tight">Wachtwoord instellen</h1>
          <p className="text-white/45 text-[14px] mt-2 mb-7">Kies een nieuw wachtwoord voor je account.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-medium text-white/70">Nieuw wachtwoord</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 pl-11 rounded-xl bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus-visible:ring-[#5fa8ff]/40 focus-visible:border-[#5fa8ff]/40"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-white/70">Bevestig wachtwoord</Label>
              <div className="relative">
                <Check className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 pl-11 rounded-xl bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus-visible:ring-[#5fa8ff]/40 focus-visible:border-[#5fa8ff]/40"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading}
              className="w-full h-12 rounded-xl bg-white text-[#070b16] font-semibold text-[15px] hover:bg-white/90">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Wachtwoord opslaan'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
