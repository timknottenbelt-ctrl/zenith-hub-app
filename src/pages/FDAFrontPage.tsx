import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  ExternalLink,
  Upload,
  FileText,
  Trash2,
  Download,
  Loader2,
  FileSpreadsheet,
  Receipt,
  FileCheck,
  Merge,
} from 'lucide-react';

interface FDAProject {
  id: string;
  project_id: string;
  lbh_number: string;
  ship_name: string;
  google_sheet_url: string | null;
  front_page_url: string | null;
  agency_cost_url: string | null;
}

interface ProcessedInvoice {
  id: string;
  invoice_number: string;
  file_name: string;
  description: string | null;
  total_amount: number | null;
  currency: string | null;
  file_url: string | null;
}

const MERGE_WEBHOOK_URL = 'https://lbhcuracao.app.n8n.cloud/webhook-test/Merge-PDF';

export default function FDAFrontPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<FDAProject | null>(null);
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFrontPage, setUploadingFrontPage] = useState(false);
  const [uploadingAgencyCost, setUploadingAgencyCost] = useState(false);
  const [merging, setMerging] = useState(false);
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'front_page' | 'agency_cost' | null }>({
    open: false,
    type: null,
  });
  const [mergeDialog, setMergeDialog] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    
    const { data, error } = await supabase
      .from('fda_projects')
      .select('id, project_id, lbh_number, ship_name, google_sheet_url, front_page_url, agency_cost_url')
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      toast({ title: 'Error', description: 'Project not found', variant: 'destructive' });
      navigate('/fda');
      return;
    }

    setProject(data);
  }, [projectId, navigate]);

  const fetchInvoices = useCallback(async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from('fda_processed_invoices')
      .select('id, invoice_number, file_name, description, total_amount, currency, file_url')
      .eq('project_id', projectId)
      .order('invoice_number', { ascending: true });

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
  }, [projectId]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchProject(), fetchInvoices()]);
      setLoading(false);
    }
    loadData();
  }, [fetchProject, fetchInvoices]);

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'front_page' | 'agency_cost'
  ) {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    if (file.type !== 'application/pdf') {
      toast({ title: 'Error', description: 'Only PDF files allowed', variant: 'destructive' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File must be less than 10MB', variant: 'destructive' });
      return;
    }

    const bucket = type === 'front_page' ? 'fda-front-pages' : 'fda-agency-costs';
    const fileName = type === 'front_page' ? 'front_page.pdf' : 'agency_cost.pdf';
    const filePath = `${projectId}/${fileName}`;
    const setUploading = type === 'front_page' ? setUploadingFrontPage : setUploadingAgencyCost;

    setUploading(true);

    try {
      // Delete existing file first
      await supabase.storage.from(bucket).remove([filePath]);

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL
      const { data: urlData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      if (!urlData?.signedUrl) throw new Error('Failed to get signed URL');

      // Update project
      const updateField = type === 'front_page' ? 'front_page_url' : 'agency_cost_url';
      const { error: updateError } = await supabase
        .from('fda_projects')
        .update({ [updateField]: urlData.signedUrl })
        .eq('project_id', projectId);

      if (updateError) throw updateError;

      await fetchProject();
      toast({ title: 'Success', description: 'File uploaded successfully' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteFile(type: 'front_page' | 'agency_cost') {
    if (!project) return;

    const bucket = type === 'front_page' ? 'fda-front-pages' : 'fda-agency-costs';
    const fileName = type === 'front_page' ? 'front_page.pdf' : 'agency_cost.pdf';
    const filePath = `${projectId}/${fileName}`;

    try {
      await supabase.storage.from(bucket).remove([filePath]);

      const updateField = type === 'front_page' ? 'front_page_url' : 'agency_cost_url';
      await supabase
        .from('fda_projects')
        .update({ [updateField]: null })
        .eq('project_id', projectId);

      await fetchProject();
      toast({ title: 'Success', description: 'File deleted' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete file', variant: 'destructive' });
    }

    setDeleteDialog({ open: false, type: null });
  }

  async function handleMergePDFs() {
    if (!project) return;

    setMerging(true);
    setMergeDialog(false);

    try {
      const payload = {
        project_id: projectId,
        front_page_url: project.front_page_url,
        agency_cost_url: project.agency_cost_url,
        google_sheet_url: project.google_sheet_url,
      };

      const response = await fetch(MERGE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Merge failed: ${response.status}`);
      }

      toast({ title: 'Success!', description: 'PDFs succesvol samengevoegd!' });
      navigate(`/fda-email-preview/${projectId}`);
    } catch (error) {
      console.error('Merge error:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Merge failed', variant: 'destructive' });
    } finally {
      setMerging(false);
    }
  }

  const canMerge = project?.front_page_url && project?.agency_cost_url;

  if (loading) {
    return (
      <DashboardLayout title="FDA Front Page">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout title="FDA Front Page">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Project not found</p>
          <Button onClick={() => navigate('/fda')} className="mt-4">
            Back to FDA Creator
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="FDA Front Page">
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/fda')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">FDA Front Page</h1>
            <p className="text-muted-foreground">{project.lbh_number} - {project.ship_name}</p>
          </div>
        </div>

        {/* Section 1: Google Sheet Link */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              Google Sheet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.google_sheet_url ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {project.google_sheet_url}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(project.google_sheet_url!, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Sheet
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No Google Sheet linked yet</p>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Upload Front Page PDF */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Upload FDA Front Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.front_page_url ? (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-green-500" />
                  <span className="font-medium">front_page.pdf</span>
                  <Badge variant="outline" className="text-green-600 border-green-200">Uploaded</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(project.front_page_url!, '_blank')}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialog({ open: true, type: 'front_page' })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploadingFrontPage ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload <span className="font-medium">Front Page PDF</span>
                      </p>
                      <p className="text-xs text-muted-foreground">PDF, max 10MB</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'front_page')}
                  disabled={uploadingFrontPage}
                />
              </label>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Uploaded Invoices List */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Geüploade Facturen
              <Badge variant="secondary" className="ml-2">{invoices.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No invoices processed yet
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          #{invoice.invoice_number}
                        </Badge>
                        <span className="font-medium truncate">{invoice.file_name}</span>
                      </div>
                      {invoice.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {invoice.description}
                        </p>
                      )}
                      {invoice.total_amount && (
                        <p className="text-sm font-medium mt-1">
                          {invoice.currency || 'USD'} {invoice.total_amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {invoice.file_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.file_url!, '_blank')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Upload Agency Cost PDF */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Agency Cost PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.agency_cost_url ? (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-green-500" />
                  <span className="font-medium">agency_cost.pdf</span>
                  <Badge variant="outline" className="text-green-600 border-green-200">Uploaded</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(project.agency_cost_url!, '_blank')}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialog({ open: true, type: 'agency_cost' })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploadingAgencyCost ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload <span className="font-medium">Agency Cost PDF</span>
                      </p>
                      <p className="text-xs text-muted-foreground">PDF, max 10MB</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'agency_cost')}
                  disabled={uploadingAgencyCost}
                />
              </label>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {!canMerge && (
              <span>Upload both Front Page and Agency Cost PDFs to continue</span>
            )}
          </div>
          <Button
            size="lg"
            disabled={!canMerge || merging}
            onClick={() => setMergeDialog(true)}
          >
            {merging ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Merge className="w-4 h-4 mr-2" />
            )}
            Merge PDFs & Create Email Draft
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, type: deleteDialog.type })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je zeker dat je deze PDF wilt verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The file will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.type && handleDeleteFile(deleteDialog.type)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={mergeDialog} onOpenChange={setMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je zeker dat je alle PDFs wilt samenvoegen?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge the Front Page, processed invoices, and Agency Cost PDFs into a single document
              and create an email draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergePDFs}>
              <Merge className="w-4 h-4 mr-2" />
              Merge & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
