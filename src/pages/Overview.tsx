import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { SupabaseDebugPanel } from '@/components/SupabaseDebugPanel';
import {
  MessageSquare,
  FileText,
  ArrowRight,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Send,
} from 'lucide-react';

export default function Overview() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Mock data for demonstration
  const inquiryCounts = {
    CARGO_AGENT: 12,
    OWNERS_AGENT: 8,
    OUT_OF_SCOPE: 3,
  };

  const statusCounts = {
    draft: 5,
    ready: 7,
    sent: 15,
    failed: 2,
  };

  const recentInquiries = [
    { id: '1', from: 'john@example.com', subject: 'Vessel inquiry - MV Pacific Star', received_at: '2024-01-15T10:30:00Z', status: 'new' },
    { id: '2', from: 'maria@cargo.com', subject: 'Loading schedule request', received_at: '2024-01-15T09:15:00Z', status: 'draft' },
    { id: '3', from: 'agent@shipping.nl', subject: 'Port arrival notification', received_at: '2024-01-15T08:45:00Z', status: 'sent' },
    { id: '4', from: 'ops@maritime.com', subject: 'Discharge operations update', received_at: '2024-01-14T16:20:00Z', status: 'ready' },
    { id: '5', from: 'captain@vessel.com', subject: 'ETA update for MV Aurora', received_at: '2024-01-14T14:00:00Z', status: 'failed' },
  ];

  const fdaProjects = [
    { id: '1', code: 'FDA-2024-001', ship_name: 'MV Pacific Star', status: 'draft', created_at: '2024-01-15' },
    { id: '2', code: 'FDA-2024-002', ship_name: 'MV Aurora', status: 'sent', created_at: '2024-01-14' },
    { id: '3', code: 'FDA-2024-003', ship_name: 'MV Neptune', status: 'draft', created_at: '2024-01-13' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Mail className="w-4 h-4" />;
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'ready': return <Send className="w-4 h-4" />;
      case 'sent': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'new': return 'badge-new';
      case 'draft': return 'badge-draft';
      case 'ready': return 'badge-ready';
      case 'sent': return 'badge-sent';
      case 'failed': return 'badge-failed';
      default: return '';
    }
  };

  return (
    <DashboardLayout title={t('overview.title')}>
      <div className="space-y-6">
        {/* Debug Panel - only visible in dev/preview */}
        {(import.meta.env.DEV ||
          (typeof window !== 'undefined' &&
            (window.location.hostname.includes('lovable.app') ||
              window.location.hostname.includes('lovableproject.com')))) && <SupabaseDebugPanel />}

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button onClick={() => navigate('/inquiries')} className="gap-2">
            <MessageSquare className="w-4 h-4" />
            {t('overview.openAiInquiries')}
          </Button>
          <Button onClick={() => navigate('/fda')} variant="outline" className="gap-2">
            <FileText className="w-4 h-4" />
            {t('overview.newFdaProject')}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* New Inquiries by Category */}
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
                  <span className="font-semibold">{inquiryCounts.CARGO_AGENT}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Owners Agent</span>
                  <span className="font-semibold">{inquiryCounts.OWNERS_AGENT}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Out of Scope</span>
                  <span className="font-semibold">{inquiryCounts.OUT_OF_SCOPE}</span>
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
                  <p className="text-2xl font-semibold">{statusCounts.draft}</p>
                  <p className="text-xs text-muted-foreground">{t('overview.draft')}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-info/10">
                  <p className="text-2xl font-semibold text-info">{statusCounts.ready}</p>
                  <p className="text-xs text-muted-foreground">{t('overview.ready')}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-success/10">
                  <p className="text-2xl font-semibold text-success">{statusCounts.sent}</p>
                  <p className="text-xs text-muted-foreground">{t('overview.sent')}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-destructive/10">
                  <p className="text-2xl font-semibold text-destructive">{statusCounts.failed}</p>
                  <p className="text-xs text-muted-foreground">{t('overview.failed')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* FDA Projects Preview */}
          <Card className="card-premium lg:col-span-2">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('overview.fdaProjects')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/fda')} className="gap-1 text-xs">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fdaProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{project.code}</p>
                        <p className="text-xs text-muted-foreground">{project.ship_name}</p>
                      </div>
                    </div>
                    <Badge variant={project.status === 'sent' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Inquiries Table */}
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
            <div className="space-y-1">
              {recentInquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate('/inquiries')}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${getStatusBadgeClass(inquiry.status)}`}>
                      {getStatusIcon(inquiry.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inquiry.subject}</p>
                      <p className="text-xs text-muted-foreground">{inquiry.from}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusBadgeClass(inquiry.status)} variant="secondary">
                      {inquiry.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(inquiry.received_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
