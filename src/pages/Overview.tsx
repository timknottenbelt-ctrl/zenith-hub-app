import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText,
  ArrowRight,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Ship,
  Users,
  Loader2,
  Inbox,
  AlertCircle,
  FileStack,
  Globe,
  TrendingUp,
} from 'lucide-react';

export default function Overview() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    // New Inquiries
    totalReady: 0,
    incomplete: 0,
    // Sent stats
    pdaSent: 0,
    fdaSent: 0,
    fdaCwSent: 0,
    rejected: 0,
    // General
    vessels: 0,
    contacts: 0,
    // FDA counts
    fdaCreatorCount: 0,
    fdaCuracaoCount: 0,
  });
  const [recentEmails, setRecentEmails] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    
    // Fetch email counts
    const { data: emails } = await supabase
      .from('email')
      .select('id, subject, email_to_person, created_at, status, "Email Type", vessel_name, missing_information');

    // Fetch vessel count
    const { count: vesselCount } = await supabase
      .from('vessels')
      .select('*', { count: 'exact', head: true });

    // Fetch contact count
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    // Fetch FDA Creator project count
    const { count: fdaCreatorCount } = await supabase
      .from('fda_projects')
      .select('*', { count: 'exact', head: true });

    // Fetch FDA Curacao project count
    const { count: fdaCuracaoCount } = await supabase
      .from('fda_curacao_projects')
      .select('*', { count: 'exact', head: true });

    // Fetch FDA email drafts that have been sent
    const { data: fdaDrafts } = await supabase
      .from('fda_email_drafts')
      .select('id, project_id, status');

    // Check which FDA drafts are for FDA Creator vs FDA Curacao
    const fdaSentDrafts = fdaDrafts?.filter(d => d.status === 'sent') || [];
    
    // Count FDA Curacao sent emails
    const { data: curacaoProjects } = await supabase
      .from('fda_curacao_projects')
      .select('project_id');
    const curacaoProjectIds = new Set(curacaoProjects?.map(p => p.project_id) || []);
    
    const fdaCwSentCount = fdaSentDrafts.filter(d => curacaoProjectIds.has(d.project_id)).length;
    const fdaSentCount = fdaSentDrafts.filter(d => !curacaoProjectIds.has(d.project_id)).length;

    if (emails) {
      // Total ready = all draft emails (ready for review)
      const totalReady = emails.filter(e => e.status === 'draft').length;
      
      // Incomplete = has missing_information or Email Type is INCOMPLETE
      const incomplete = emails.filter(e => 
        e.missing_information || e['Email Type'] === 'INCOMPLETE'
      ).length;
      
      // PDA sent
      const pdaSent = emails.filter(e => e.status === 'sent').length;
      
      // Rejected
      const rejected = emails.filter(e => e.status === 'rejected').length;

      setStats({
        totalReady,
        incomplete,
        pdaSent,
        fdaSent: fdaSentCount,
        fdaCwSent: fdaCwSentCount,
        rejected,
        vessels: vesselCount || 0,
        contacts: contactCount || 0,
        fdaCreatorCount: fdaCreatorCount || 0,
        fdaCuracaoCount: fdaCuracaoCount || 0,
      });

      // Get 5 most recent emails
      setRecentEmails(
        emails
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
    }

    setLoading(false);
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'approved': return <Send className="w-4 h-4" />;
      case 'sent': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'approved': return 'bg-info/10 text-info';
      case 'sent': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
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
          {/* Nieuwe Aanvragen - Clickable */}
          <Card 
            className="card-premium bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => navigate('/inquiries')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nieuwe Aanvragen</p>
                  <p className="text-4xl font-bold text-primary">{stats.totalReady}</p>
                  <p className="text-xs text-muted-foreground mt-1">Klaar voor review</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Inbox className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-primary/10">
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
                <div className="flex items-center justify-between p-2 rounded-lg bg-success/5 hover:bg-success/10 transition-colors cursor-pointer" onClick={() => navigate('/inquiries/sent')}>
                  <span className="text-sm font-medium">PDA's Sent</span>
                  <Badge variant="secondary" className="bg-success/10 text-success font-semibold">{stats.pdaSent}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer" onClick={() => navigate('/fda/history')}>
                  <span className="text-sm font-medium">FDA's Sent</span>
                  <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold">{stats.fdaSent}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-info/5 hover:bg-info/10 transition-colors cursor-pointer" onClick={() => navigate('/fda-curacao/history')}>
                  <span className="text-sm font-medium">FDA CW Sent</span>
                  <Badge variant="secondary" className="bg-info/10 text-info font-semibold">{stats.fdaCwSent}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer" onClick={() => navigate('/inquiries')}>
                  <span className="text-sm font-medium">Rejected</span>
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive font-semibold">{stats.rejected}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FDA Overview Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FDA Creator */}
          <Card 
            className="card-premium bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => navigate('/fda')}
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

          {/* FDA Curacao */}
          <Card 
            className="card-premium bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => navigate('/fda-curacao')}
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
            <Button variant="outline" size="sm" onClick={() => navigate('/inquiries')} className="gap-2">
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
                    onClick={() => navigate('/inquiries')}
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
