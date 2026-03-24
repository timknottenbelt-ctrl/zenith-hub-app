import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        // Check if user must change password
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

    // Check if must change password
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
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-[hsl(222,47%,6%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center dark:bg-primary/15">
            <Ship className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted dark:from-[hsl(224,50%,5%)] dark:via-[hsl(222,47%,6%)] dark:to-[hsl(220,42%,8%)] p-4 relative overflow-hidden">
      {/* Maritime ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:block hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-[hsl(192,82%,48%)] opacity-[0.03] blur-[120px]" />
        <div className="absolute -bottom-1/3 -left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(200,80%,40%)] opacity-[0.04] blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 dark:bg-primary/15 dark:shadow-[0_0_30px_hsl(192,82%,48%,0.15)]">
            <Ship className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LBH Cura&ccedil;ao</h1>
          <p className="text-muted-foreground mt-1">Maritime Services Dashboard</p>
        </div>

        <Card className="card-premium dark:maritime-glow">
          <CardHeader>
            <CardTitle className="text-center">Inloggen</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="naam@bedrijf.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="dark:bg-[hsl(220,35%,10%)] dark:border-[hsl(220,30%,16%)] dark:focus:border-primary/40"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Wachtwoord
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Wachtwoord vergeten?
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="dark:bg-[hsl(220,35%,10%)] dark:border-[hsl(220,30%,16%)] dark:focus:border-primary/40"
                />
              </div>
              <Button
                type="submit"
                className="w-full dark:shadow-[0_0_20px_hsl(192,82%,48%,0.15)] dark:hover:shadow-[0_0_24px_hsl(192,82%,48%,0.25)]"
                size="lg"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Inloggen
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Subtle footer */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Zenith Hub &middot; Maritime Operations Platform
        </p>
      </div>
    </div>
  );
}
