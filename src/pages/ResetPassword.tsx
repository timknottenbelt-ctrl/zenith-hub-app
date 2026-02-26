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
  const [isRecovery, setIsRecovery] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const getAuthParamsFromUrl = () => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const access_token = hashParams.get('access_token');
    const refresh_token = hashParams.get('refresh_token');
    const type = hashParams.get('type') || url.searchParams.get('type');
    const code = url.searchParams.get('code');
    return { access_token, refresh_token, type, code };
  };

  useEffect(() => {
    const readMustChangePassword = async (userId: string) => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error);
        return { mustChangePassword: false };
      }

      return { mustChangePassword: Boolean(profile?.must_change_password) };
    };

    const init = async () => {
      // 1) Ensure we actually have a session (recovery links can arrive as ?code=... or #access_token=...)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      // If we have a broken/stale refresh token in storage, clear it.
      if (sessionError?.message?.toLowerCase().includes('refresh token')) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }

      if (!sessionData.session) {
        const { access_token, refresh_token, type, code } = getAuthParamsFromUrl();

        // implicit flow
        if (access_token && refresh_token && (supabase.auth as any).setSession) {
          const { error } = await (supabase.auth as any).setSession({ access_token, refresh_token });
          if (!error && type === 'recovery') setIsRecovery(true);
        }

        // PKCE flow
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) setIsRecovery(true);
        }
      }

      // 2) Now check the (possibly restored) session
      const { data: afterData } = await supabase.auth.getSession();
      const afterSession = afterData.session;
      if (afterSession?.user) {
        const { mustChangePassword: mustChange } = await readMustChangePassword(afterSession.user.id);
        if (mustChange) {
          setMustChangePassword(true);
        } else if (!isRecovery) {
          navigate('/');
        }
      }
    };

    init();

    // 3) Listen for changes (keep callback sync; defer Supabase calls)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        return;
      }

      if (session?.user) {
        setTimeout(async () => {
          const { mustChangePassword: mustChange } = await readMustChangePassword(session.user.id);
          if (mustChange) {
            setMustChangePassword(true);
          } else if (!isRecovery) {
            navigate('/');
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isRecovery]);

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

    // updateUser requires an active auth session (recovery link/session must be established first)
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      toast({
        title: 'Sessie verlopen',
        description: 'De reset link is niet meer geldig. Vraag een nieuwe link aan via "Wachtwoord vergeten".',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        const msg = updateError.message?.toLowerCase().includes('same password')
          ? 'Je nieuwe wachtwoord mag niet hetzelfde zijn als je huidige wachtwoord.'
          : 'Het wijzigen van je wachtwoord is niet gelukt. Probeer het opnieuw of vraag een nieuwe reset link aan.';
        toast({ 
          title: 'Niet gelukt', 
          description: msg, 
          variant: 'destructive' 
        });
        setLoading(false);
        return;
      }

      // Clear the must_change_password flag (don't block redirect on failure)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ must_change_password: false })
            .eq('id', user.id);
        }
      } catch (profileErr) {
        console.error('Profile update error:', profileErr);
        // Continue anyway - password was changed successfully
      }

      toast({ 
        title: 'Wachtwoord gewijzigd', 
        description: 'Je wachtwoord is succesvol gewijzigd' 
      });
      
      // Reset loading before redirect
      setLoading(false);
      
      // Small delay to show success toast, then redirect
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error) {
      console.error('Password reset error:', error);
      toast({ 
        title: 'Fout', 
        description: 'Er is iets misgegaan. Probeer opnieuw.', 
        variant: 'destructive' 
      });
      setLoading(false);
    }
  }

  const title = mustChangePassword 
    ? 'Wachtwoord instellen' 
    : 'Nieuw wachtwoord';
  
  const description = mustChangePassword
    ? 'Dit is je eerste login. Stel een nieuw wachtwoord in.'
    : 'Voer je nieuwe wachtwoord in.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Ship className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">LBH Curaçao</h1>
          <p className="text-muted-foreground">Maritime Services Dashboard</p>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-center">{title}</CardTitle>
            <CardDescription className="text-center">{description}</CardDescription>
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
