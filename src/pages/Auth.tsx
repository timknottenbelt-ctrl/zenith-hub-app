import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTransitionNavigate } from '@/hooks/useTransitionNavigate';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Ship, Mail, Lock, ArrowRight, Check, Anchor } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-[#070b16]">
        <Loader2 className="w-8 h-8 animate-spin text-white/70" />
      </div>
    );
  }

  const features = [
    'AI-triage van inkomende scheepsvragen',
    "EDA's, PDA's & FDA's in seconden, niet uren",
    'Alles voor LBH Curaçao op één plek',
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#070b16] text-white">
      {/* ── Left: brand panel ── */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12"
        style={{ background: 'linear-gradient(150deg, #0c2b63 0%, #0a1c45 42%, #070f24 100%)' }}>
        {/* ambient glows + grid */}
        <div className="absolute -top-24 -left-16 w-[34rem] h-[34rem] rounded-full bg-[#1e63d4]/25 blur-[110px] pointer-events-none" />
        <div className="absolute bottom-[-10rem] right-[-6rem] w-[30rem] h-[30rem] rounded-full bg-[#0bb6c9]/15 blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '46px 46px' }} />

        {/* logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center"
            style={{ boxShadow: '0 8px 24px -6px rgba(30,99,212,0.6)' }}>
            <Ship className="w-[22px] h-[22px] text-white" />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-[15px] tracking-tight">LBH Curaçao</p>
            <p className="text-[11px] text-white/45 font-medium">Maritime Services</p>
          </div>
        </div>

        {/* headline + features */}
        <div className="relative max-w-md">
          <h2 className="text-[2.6rem] leading-[1.08] font-bold tracking-tight">
            Maritiem beheer,<br />volledig <span className="text-[#5fa8ff]">gestroomlijnd.</span>
          </h2>
          <p className="mt-5 text-white/55 text-[15px] leading-relaxed">
            Het operationele portaal van LBH Curaçao — van inkomende aanvraag tot verzonden disbursement account.
          </p>
          <ul className="mt-9 space-y-4">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#5fa8ff]/15 ring-1 ring-[#5fa8ff]/30 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-[#7cbcff]" />
                </span>
                <span className="text-[14.5px] text-white/80">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* footer */}
        <div className="relative flex items-center gap-2 text-white/30">
          <Anchor className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium tracking-[0.18em] uppercase">© 2026 LBH Curaçao N.V.</span>
        </div>
      </div>

      {/* ── Right: auth card ── */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="absolute top-0 right-0 w-[24rem] h-[24rem] rounded-full bg-[#1e63d4]/10 blur-[120px] pointer-events-none" />
        <div className="relative w-full max-w-[400px]">
          {/* mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl bg-[#1e63d4] flex items-center justify-center">
              <Ship className="w-[22px] h-[22px] text-white" />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-[15px]">LBH Curaçao</p>
              <p className="text-[11px] text-white/45">Maritime Services</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold tracking-[0.25em] text-[#5fa8ff]/80 uppercase mb-3">Toegang</p>
          <h1 className="text-[2rem] font-bold tracking-tight">Welkom terug</h1>
          <p className="text-white/45 text-[14.5px] mt-2 mb-8">Log in om verder te gaan in het portaal.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-[13px] font-medium text-white/70">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="naam@lbhcuracao.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="h-12 pl-11 rounded-xl bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus-visible:ring-[#5fa8ff]/40 focus-visible:border-[#5fa8ff]/40"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className="text-[13px] font-medium text-white/70">Wachtwoord</Label>
                <Link to="/forgot-password" className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/35 hover:text-[#7cbcff] transition-colors">
                  Vergeten?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="h-12 pl-11 rounded-xl bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus-visible:ring-[#5fa8ff]/40 focus-visible:border-[#5fa8ff]/40"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="group w-full h-12 rounded-xl bg-white text-[#070b16] font-semibold text-[15px] hover:bg-white/90 transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Inloggen
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-[13px] text-white/40 mt-7">
            Toegang nodig? <span className="text-white/70 font-medium">Neem contact op met je beheerder.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
