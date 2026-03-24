import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Ship, Mail, Lock } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Ongeldig emailadres" }),
  password: z.string().min(6, { message: "Wachtwoord moet minimaal 6 tekens zijn" }),
});

export default function Auth() {
  const navigate = useNavigate();
  const transitionNavigate = useTransitionNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setTimeout(async () => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('must_change_password')
            .eq('id', session.user.id)
            .single();

          if (profile?.must_change_password) {
            navigate('/reset-password');
          } else {
            transitionNavigate('/');
          }
        }, 0);
      }
      setCheckingAuth(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('must_change_password')
          .eq('id', session.user.id)
          .single();

        if (profile?.must_change_password) {
          navigate('/reset-password');
        } else {
          transitionNavigate('/');
        }
      }
      setCheckingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, transitionNavigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!validation.success) {
      toast({
        title: 'Validatiefout',
        description: validation.error.errors[0].message,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      let message = error.message;
      if (error.message.includes('Invalid login credentials')) {
        message = 'Onjuiste email of wachtwoord';
      }
      toast({ title: 'Login mislukt', description: message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', data.user.id)
        .single();

      if (profile?.must_change_password) {
        toast({ title: 'Welkom!', description: 'Stel eerst je nieuwe wachtwoord in' });
        navigate('/reset-password');
        setLoading(false);
        return;
      }
    }

    toast({ title: 'Welkom terug!', description: 'Je bent succesvol ingelogd' });
    setLoading(false);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF3FB 50%, #EEF2FF 100%)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF3FB 50%, #EEF2FF 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-4"
            style={{ boxShadow: '0 8px 24px -4px rgba(0,128,255,0.3)' }}>
            <Ship className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">LBH Cura&ccedil;ao</h1>
          <p className="text-sm text-muted-foreground/60 mt-1">Maritime Services Portal</p>
        </div>

        <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 16px 48px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)' }}>
          <h2 className="text-lg font-semibold text-center mb-5">Inloggen</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground/50" /> Email
              </Label>
              <Input
                id="login-email"
                type="email"
                placeholder="naam@bedrijf.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="h-11 rounded-xl border-border/60 placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className="text-sm font-medium flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/50" /> Wachtwoord
                </Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Vergeten?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="h-11 rounded-xl border-border/60 placeholder:text-muted-foreground/40"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm" size="lg" disabled={loading}
              style={{ boxShadow: '0 4px 14px -3px rgba(0,128,255,0.4)' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Inloggen
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
