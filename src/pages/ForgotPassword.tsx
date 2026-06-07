import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Ship, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().trim().email({ message: "Ongeldig emailadres" });

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({ 
        title: 'Validatiefout', 
        description: validation.error.errors[0].message, 
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ 
        title: 'Niet gelukt', 
        description: 'Het versturen van de reset link is niet gelukt. Controleer je emailadres en probeer het opnieuw.', 
        variant: 'destructive' 
      });
    } else {
      setSent(true);
      toast({ 
        title: 'Email verzonden', 
        description: 'Controleer je inbox voor de reset link' 
      });
    }
    
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b16] text-white p-6">
      <div className="absolute top-0 right-0 w-[26rem] h-[26rem] rounded-full bg-[#1e63d4]/12 blur-[120px] pointer-events-none" />
      <div className="relative w-full max-w-[420px]">
        {/* logo */}
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
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#5fa8ff]/15 ring-1 ring-[#5fa8ff]/30 mx-auto">
                <CheckCircle className="w-7 h-7 text-[#7cbcff]" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">E-mail verzonden</h3>
                <p className="text-white/50 text-sm mt-1.5 leading-relaxed">
                  We hebben een reset link naar <strong className="text-white/80">{email}</strong> gestuurd.
                  Controleer ook je spam folder.
                </p>
              </div>
              <Button variant="outline" onClick={() => setSent(false)}
                className="w-full h-11 rounded-xl bg-transparent border-white/15 text-white hover:bg-white/5 hover:text-white">
                Andere e-mail proberen
              </Button>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-semibold tracking-[0.25em] text-[#5fa8ff]/80 uppercase mb-3">Herstel</p>
              <h1 className="text-[1.6rem] font-bold tracking-tight">Wachtwoord vergeten</h1>
              <p className="text-white/45 text-[14px] mt-2 mb-7">Voer je e-mail in om een reset link te ontvangen.</p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] font-medium text-white/70">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="naam@lbhcuracao.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 pl-11 rounded-xl bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus-visible:ring-[#5fa8ff]/40 focus-visible:border-[#5fa8ff]/40"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl bg-white text-[#070b16] font-semibold text-[15px] hover:bg-white/90">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset link versturen'}
                </Button>
              </form>
            </>
          )}

          <div className="mt-7 text-center">
            <Link to="/auth" className="inline-flex items-center text-[13px] text-white/40 hover:text-white/80 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Terug naar inloggen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
