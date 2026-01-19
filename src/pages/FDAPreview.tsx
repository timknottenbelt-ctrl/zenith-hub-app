import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import {
  Ship,
  User,
  Building2,
  Mail,
  Phone,
  FileText,
  ArrowLeft,
  Loader2,
  ExternalLink,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface FDAProject {
  id: string;
  project_id: string;
  lbh_number: string;
  ship_name: string;
  fda_responsible: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  status: string | null;
  google_sheet_url: string | null;
  front_page_url: string | null;
  agency_cost_url: string | null;
  email_sent_at: string | null;
}

interface FDAInvoice {
  id: string;
  file_name: string;
  invoice_number: string | null;
}

export default function FDAPreview() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<FDAProject | null>(null);
  const [invoices, setInvoices] = useState<FDAInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  // Poll for Google Sheet URL
  useEffect(() => {
    if (!project?.google_sheet_url && project) {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('fda_projects')
          .select('google_sheet_url')
          .eq('project_id', projectId)
          .single();

        if (data?.google_sheet_url) {
          setProject((prev) => prev ? { ...prev, google_sheet_url: data.google_sheet_url } : null);
          setCheckingStatus(false);
          clearInterval(interval);
        }
      }, 3000);

      return () => clearInterval(interval);
    } else if (project?.google_sheet_url) {
      setCheckingStatus(false);
    }
  }, [project, projectId]);

  async function fetchData() {
    setLoading(true);

    // Fetch project
    const { data: projectData } = await supabase
      .from('fda_projects')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (projectData) {
      setProject(projectData);
      if (projectData.google_sheet_url) {
        setCheckingStatus(false);
      }
    }

    // Fetch invoices
    if (projectData?.id) {
      const { data: invoiceData } = await supabase
        .from('fda_invoices')
        .select('id, file_name, invoice_number')
        .eq('fda_project_id', projectData.id)
        .order('created_at', { ascending: true });

      setInvoices(invoiceData || []);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <DashboardLayout title="FDA Preview">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout title="FDA Preview">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Project not found</p>
          <Button onClick={() => navigate('/fda')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to FDA Creator
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="FDA Preview">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/fda')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project.ship_name}</h1>
              <p className="text-muted-foreground">LBH {project.lbh_number}</p>
            </div>
          </div>
          <Badge variant={project.status === 'sent' ? 'default' : 'secondary'}>
            {project.status || 'Draft'}
          </Badge>
        </div>

        {/* AI Checking Status */}
        {checkingStatus && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <div className="relative bg-primary rounded-full p-4">
                    <Sparkles className="w-8 h-8 text-primary-foreground animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">AI is processing invoices...</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    This usually takes 30-60 seconds. The Google Sheet link will appear automatically.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking status...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Google Sheet Link */}
        {project.google_sheet_url && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-success rounded-full p-2">
                    <CheckCircle className="w-5 h-5 text-success-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Google Sheet Ready</h3>
                    <p className="text-sm text-muted-foreground">Invoice data has been processed</p>
                  </div>
                </div>
                <Button asChild>
                  <a href={project.google_sheet_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Google Sheet
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="w-5 h-5" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">LBH Number</p>
                  <p className="font-medium">{project.lbh_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ship Name</p>
                  <p className="font-medium">{project.ship_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">FDA Responsible</p>
                  <p className="font-medium">{project.fda_responsible || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sent At</p>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {project.email_sent_at
                      ? new Date(project.email_sent_at).toLocaleString()
                      : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{project.client_name || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{project.client_email || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{project.client_phone || '-'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Billing Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Billing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{project.billing_company || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{project.billing_address || '-'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{project.billing_email || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{project.billing_phone || '-'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Uploaded Invoices ({invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-muted-foreground text-sm">No invoices uploaded</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice, index) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[200px]">{invoice.file_name}</span>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        #{invoice.invoice_number || String(index + 1).padStart(3, '0')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Next Steps */}
        {project.google_sheet_url && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Ready for next step?</h3>
                  <p className="text-sm text-muted-foreground">
                    Continue to upload Front Page and Agency Cost PDFs
                  </p>
                </div>
                <Button onClick={() => navigate(`/fda-front-page/${project.project_id}`)}>
                  Continue to FDA Front Page
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
