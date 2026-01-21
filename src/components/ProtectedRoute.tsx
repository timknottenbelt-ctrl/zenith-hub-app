import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const t = window.setTimeout(() => setTimedOut(true), 4000);
    return () => window.clearTimeout(t);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {timedOut ? (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <div className="text-sm text-muted-foreground">
              Laden duurt te lang. Je sessie kan zijn verlopen.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Ververs
              </Button>
              <Button onClick={() => (window.location.href = '/auth')}>Naar login</Button>
            </div>
          </div>
        ) : (
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}