import { useMemo, useCallback, memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ArrowRight,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  Inbox,
  AlertCircle,
  Globe,
  TrendingUp,
} from 'lucide-react';

// Memoized stat card component
const StatRow = memo(function StatRow({ 
  label, 
  value, 
  className,
  onClick 
}: { 
  label: string; 
  value: number; 
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div 
      className={`flex items-center justify-between p-2 rounded-lg transition-colors ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <span className="text-sm font-medium">{label}</span>
      <Badge variant="secondary" className="font-semibold">{value}</Badge>
    </div>
  );
});

// Fetch all dashboard data in parallel
async function fetchDashboardData() {
  const [
    emailsResult,
    vesselCountResult,
    contactCountResult,
    fdaCreatorCountResult,
    fdaCuracaoCountResult,
    fdaDraftsResult,
    curacaoProjectsResult,
  ] = await Promise.all([
    supabase.from('email').select('id, subject, email_to_person, created_at, status, "Email Type", vessel_name, missing_information'),
    supabase.from('vessels').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('fda_projects').select('*', { count: 'exact', head: true }),
    supabase.from('fda_curacao_projects').select('*', { count: 'exact', head: true }),
    supabase.from('fda_email_drafts').select('id, project_id, status'),
    supabase.from('fda_curacao_projects').select('project_id'),
  ]);

  const emails = emailsResult.data || [];
  const fdaDrafts = fdaDraftsResult.data || [];
  const curacaoProjects = curacaoProjectsResult.data || [];
  
  const curacaoProjectIds = new Set(curacaoProjects.map(p => p.project_id));
  const fdaSentDrafts = fdaDrafts.filter(d => d.status === 'sent');
  const fdaCwSentCount = fdaSentDrafts.filter(d => curacaoProjectIds.has(d.project_id)).length;
  const fdaSentCount = fdaSentDrafts.filter(d => !curacaoProjectIds.has(d.project_id)).length;

  const draftEmails = emails.filter(e => e.status === 'draft');
  
  // Count only drafts with a valid Email Type for the breakdown
  const cargoAgent = draftEmails.filter(e => e['Email Type']?.toUpperCase().includes('CARGO')).length;
  const ownersAgent = draftEmails.filter(e => e['Email Type']?.toUpperCase().includes('OWNER')).length;
  const outOfScope = draftEmails.filter(e => 
    e['Email Type']?.toUpperCase().includes('OUT OF SCOPE') || 
    e['Email Type']?.toUpperCase().includes('OUT_OF_SCOPE')
  ).length;
  const incomplete = emails.filter(e => 
    e.missing_information || 
    e['Email Type']?.toUpperCase().includes('INCOMPLETE') ||
    e['Email Type']?.toLowerCase().includes('pending_info')
  ).length;
  
  // Total ready = only emails with a valid category (not null/empty Email Type)
  const totalReady = cargoAgent + ownersAgent + outOfScope;
  
  return {
    stats: {
      cargoAgent,
      ownersAgent,
      outOfScope,
      incomplete,
      totalReady,
      pdaSent: emails.filter(e => e.status === 'sent').length,
      fdaSent: fdaSentCount,
      fdaCwSent: fdaCwSentCount,
      rejected: emails.filter(e => e.status === 'rejected').length,
      vessels: vesselCountResult.count || 0,
      contacts: contactCountResult.count || 0,
      fdaCreatorCount: fdaCreatorCountResult.count || 0,
      fdaCuracaoCount: fdaCuracaoCountResult.count || 0,
    },
    recentEmails: emails
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
  };
}

export default function Overview() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchDashboardData,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  const stats = data?.stats || {
    cargoAgent: 0, ownersAgent: 0, outOfScope: 0, incomplete: 0, totalReady: 0,
    pdaSent: 0, fdaSent: 0, fdaCwSent: 0, rejected: 0,
    vessels: 0, contacts: 0, fdaCreatorCount: 0, fdaCuracaoCount: 0,
  };
  const recentEmails = data?.recentEmails || [];

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'approved': return <Send className="w-4 h-4" />;
      case 'sent': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  }, []);

  const getStatusBadgeClass = useCallback((status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'approved': return 'bg-info/10 text-info';
      case 'sent': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  }, []);

  const navigateTo = useCallback((path: string) => () => navigate(path), [navigate]);

  if (isLoading) {
    return (
      <DashboardLayout title={t('overview.title')}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('overview.title')}>
      <div className="space-y-8">
        {/* Hero Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nieuwe Aanvragen */}
          <Card 
            className="card-premium bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-lg transition-all cursor-pointer group"
            onClick={navigateTo('/inquiries')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nieuwe Aanvragen</p>
                  <p className="text-4xl font-bold text-primary">{stats.totalReady}</p>
                  <p className="text-xs text-muted-foreground mt-1">Klaar voor review</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Inbox className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <StatRow label="Cargo Agent" value={stats.cargoAgent} className="bg-background/50" />
                <StatRow label="Owners Agent" value={stats.ownersAgent} className="bg-background/50" />
                <StatRow label="Out of Scope" value={stats.outOfScope} className="bg-background/50" />
              </div>
              
              <div className="pt-3 border-t border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{stats.incomplete} Incompleet</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verzonden Status */}
          <Card className="card-premium">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">Verzonden Status</p>
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
              <div className="space-y-3">
                <StatRow 
                  label="PDA's Sent" 
                  value={stats.pdaSent} 
                  className="bg-success/5 hover:bg-success/10" 
                  onClick={navigateTo('/inquiries/sent')} 
                />
                <StatRow 
                  label="FDA's Sent" 
                  value={stats.fdaSent} 
                  className="bg-primary/5 hover:bg-primary/10" 
                  onClick={navigateTo('/fda/history')} 
                />
                <StatRow 
                  label="FDA CW Sent" 
                  value={stats.fdaCwSent} 
                  className="bg-info/5 hover:bg-info/10" 
                  onClick={navigateTo('/fda-curacao/history')} 
                />
                <StatRow 
                  label="Rejected" 
                  value={stats.rejected} 
                  className="bg-destructive/5 hover:bg-destructive/10" 
                  onClick={navigateTo('/inquiries')} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FDA Overview Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="card-premium bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all cursor-pointer group"
            onClick={navigateTo('/fda')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">FDA Creator</p>
                  <p className="text-3xl font-bold mt-1">{stats.fdaCreatorCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Totaal projecten</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="card-premium bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all cursor-pointer group"
            onClick={navigateTo('/fda-curacao')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="p-4 rounded-2xl bg-info/10 group-hover:bg-info/20 transition-colors">
                  <Globe className="w-8 h-8 text-info" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">FDA Curaçao</p>
                  <p className="text-3xl font-bold mt-1">{stats.fdaCuracaoCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Totaal projecten</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Emails */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Recente Aanvragen</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Laatste activiteit in AI Aanvragen</p>
            </div>
            <Button variant="outline" size="sm" onClick={navigateTo('/inquiries')} className="gap-2">
              Bekijk alles <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentEmails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nog geen emails</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEmails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
                    onClick={navigateTo('/inquiries')}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl ${getStatusBadgeClass(email.status)}`}>
                        {getStatusIcon(email.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{email.subject || 'No subject'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{email.email_to_person}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <Badge className={`${getStatusBadgeClass(email.status)} font-medium`} variant="secondary">
                        {email.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground min-w-[80px]">
                        {new Date(email.created_at).toLocaleDateString('nl-NL')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
