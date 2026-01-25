import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, ShieldX, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, role, isApproved, isAdmin, signOut } = useAuth();
  const { t } = useLanguage();

  // Still loading auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Role is still being fetched - show loading state instead of pending screen
  if (role === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // User is explicitly pending approval (role is 'pending')
  if (role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-warning" />
            </div>
            <CardTitle className="text-xl">{t('auth.pendingApproval') || 'Account Pending Approval'}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t('auth.pendingDescription') || 'Your account has been created but needs to be approved by an administrator before you can access the application.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">{t('auth.whatNow') || 'What now?'}</p>
              <p>{t('auth.contactAdmin') || 'Contact your administrator to have your account approved. You will receive access once this has been done.'}</p>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={signOut}
            >
              {t('common.logout')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Route requires admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <ShieldX className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">{t('auth.noAccess') || 'No Access'}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t('auth.adminOnly') || 'You do not have access to this page. It is only available for administrators.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => window.history.back()}
            >
              {t('common.back')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
