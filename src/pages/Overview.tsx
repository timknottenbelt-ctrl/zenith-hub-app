import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  MessageSquare,
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
} from 'lucide-react';

export default function Overview() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    cargoAgent: 0,
    ownersAgent: 0,
    outOfScope: 0,
    draft: 0,
    approved: 0,
    sent: 0,
    rejected: 0,
    vessels: 0,
    contacts: 0,
  });
  const [recentEmails, setRecentEmails] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    
    // Fetch email counts by type
    const { data: emails } = await supabase
      .from('email')
      .select('id, subject, email_to_person, created_at, status, "Email Type", vessel_name');

    // Fetch vessel count
    const { count: vesselCount } = await supabase
      .from('vessels')
      .select('*', { count: 'exact', head: true });

    // Fetch contact count
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    if (emails) {
      const cargoAgent = emails.filter(e => e['Email Type'] === 'Cargo Agent').length;
      const ownersAgent = emails.filter(e => e['Email Type'] === 'Owners Agent').length;
      const outOfScope = emails.filter(e => e['Email Type'] === 'Out of Scope').length;
      const draft = emails.filter(e => e.status === 'draft').length;
      const approved = emails.filter(e => e.status === 'approved').length;
      const sent = emails.filter(e => e.status === 'sent').length;
      const rejected = emails.filter(e => e.status === 'rejected').length;

      setStats({
        cargoAgent,
        ownersAgent,
        outOfScope,
        draft,
        approved,
        sent,
        rejected,
        vessels: vesselCount || 0,
        contacts: contactCount || 0,
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
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button onClick={() => navigate('/inquiries')} className="gap-2">
            <MessageSquare className="w-4 h-4" />
            {t('overview.openAiInquiries')}
          </Button>
          <Button onClick={() => navigate('/vessels')} variant="outline" className="gap-2">
            <Ship className="w-4 h-4" />
            View Vessels
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Inquiries by Category */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('overview.newInquiries')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cargo Agent</span>
                  <span className="font-semibold">{stats.cargoAgent}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Owners Agent</span>
                  <span className="font-semibold">{stats.ownersAgent}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Out of Scope</span>
                  <span className="font-semibold">{stats.outOfScope}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Overview */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('overview.inquiryStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-2xl font-semibold">{stats.draft}</p>
                  <p className="text-xs text-muted-foreground">{t('overview.draft')}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-info/10">
                  <p className="text-2xl font-semibold text-info">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-success/10">
                  <p className="text-2xl font-semibold text-success">{stats.sent}</p>
                  <p className="text-xs text-muted-foreground">{t('overview.sent')}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-destructive/10">
                  <p className="text-2xl font-semibold text-destructive">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vessels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Ship className="w-10 h-10 text-primary" />
                <div>
                  <p className="text-3xl font-semibold">{stats.vessels}</p>
                  <p className="text-xs text-muted-foreground">Total vessels</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Users className="w-10 h-10 text-primary" />
                <div>
                  <p className="text-3xl font-semibold">{stats.contacts}</p>
                  <p className="text-xs text-muted-foreground">Total contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Emails */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('overview.recentInquiries')}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inquiries')} className="gap-1 text-xs">
              View all <ArrowRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentEmails.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                No emails yet
              </div>
            ) : (
              <div className="space-y-1">
                {recentEmails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/inquiries')}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${getStatusBadgeClass(email.status)}`}>
                        {getStatusIcon(email.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{email.subject || 'No subject'}</p>
                        <p className="text-xs text-muted-foreground">{email.email_to_person}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusBadgeClass(email.status)} variant="secondary">
                        {email.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(email.created_at).toLocaleDateString()}
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
