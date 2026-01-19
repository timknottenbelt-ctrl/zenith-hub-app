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
import { Input } from '@/components/ui/input';
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
  Eye,
  Pencil,
  Check,
  X,
  Sparkles,
  CheckCircle,
  GripVertical,
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
  const [checkingGoogleSheet, setCheckingGoogleSheet] = useState(true);
  const [uploadingFrontPage, setUploadingFrontPage] = useState(false);
  const [uploadingAgencyCost, setUploadingAgencyCost] = useState(false);
  const [merging, setMerging] = useState(false);
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'front_page' | 'agency_cost' | null; invoiceId?: string }>({
    open: false,
    type: null,
    invoiceId: undefined,
  });
  const [mergeDialog, setMergeDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [fdaFilename, setFdaFilename] = useState('');

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

  // Set default FDA filename when project loads
  useEffect(() => {
    if (project && !fdaFilename) {
      setFdaFilename(`FDA - ${project.ship_name} - ${project.lbh_number} - LBH Curacao`);
    }
  }, [project, fdaFilename]);

  // Poll for Google Sheet URL if not yet available
  useEffect(() => {
    if (!project?.google_sheet_url && project && !loading) {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('fda_projects')
          .select('google_sheet_url')
          .eq('project_id', projectId)
          .single();

        if (data?.google_sheet_url) {
          setProject((prev) => prev ? { ...prev, google_sheet_url: data.google_sheet_url } : null);
          setCheckingGoogleSheet(false);
          clearInterval(interval);
        }
      }, 3000);

      return () => clearInterval(interval);
    } else if (project?.google_sheet_url) {
      setCheckingGoogleSheet(false);
    }
  }, [project, projectId, loading]);

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

    setDeleteDialog({ open: false, type: null, invoiceId: undefined });
  }

  async function handleDeleteInvoice(invoiceId: string) {
    try {
      const { error } = await supabase
        .from('fda_processed_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      await fetchInvoices();
      toast({ title: 'Success', description: 'Invoice deleted' });
    } catch (error) {
      console.error('Delete invoice error:', error);
      toast({ title: 'Error', description: 'Failed to delete invoice', variant: 'destructive' });
    }
    setDeleteDialog({ open: false, type: null, invoiceId: undefined });
  }

  async function handleUpdateInvoiceNumber(invoiceId: string, newNumber: string) {
    try {
      const { error } = await supabase
        .from('fda_processed_invoices')
        .update({ invoice_number: newNumber })
        .eq('id', invoiceId);

      if (error) throw error;

      await fetchInvoices();
      setEditingInvoice(null);
      toast({ title: 'Success', description: 'Invoice number updated' });
    } catch (error) {
      console.error('Update invoice error:', error);
      toast({ title: 'Error', description: 'Failed to update invoice number', variant: 'destructive' });
    }
  }

  function startEditInvoice(invoice: ProcessedInvoice) {
    setEditingInvoice(invoice.id);
    setEditValue(invoice.invoice_number);
  }

  function cancelEdit() {
    setEditingInvoice(null);
    setEditValue('');
  }

  // Drag and drop handlers
  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(index: number) {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newInvoices = [...invoices];
    const [draggedItem] = newInvoices.splice(draggedIndex, 1);
    newInvoices.splice(index, 0, draggedItem);
    setInvoices(newInvoices);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  async function handleMergePDFs() {
    if (!project) return;

    setMerging(true);
    setMergeDialog(false);

    try {
      // Include invoices in the payload
      const invoicesPayload = invoices.map((inv, index) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        file_name: inv.file_name,
        file_url: inv.file_url,
        description: inv.description,
        total_amount: inv.total_amount,
        currency: inv.currency,
        order: index + 1,
      }));

      const payload = {
        project_id: projectId,
        fda_name: fdaFilename,
        ship_name: project.ship_name,
        lbh_number: project.lbh_number,
        front_page_url: project.front_page_url,
        agency_cost_url: project.agency_cost_url,
        google_sheet_url: project.google_sheet_url,
        invoices: invoicesPayload,
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

        {/* AI Processing Status */}
        {checkingGoogleSheet && !project.google_sheet_url && (
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

        {/* Section 1: Google Sheet Link */}
        <Card className={project.google_sheet_url ? "card-premium border-green-500/50 bg-green-500/5" : "card-premium"}>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {project.google_sheet_url ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-primary" />
              )}
              Google Sheet
              {project.google_sheet_url && (
                <Badge variant="outline" className="text-green-600 border-green-200 ml-2">Ready</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.google_sheet_url ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground truncate flex-1">
                  Invoice data has been processed successfully
                </span>
                <Button
                  size="sm"
                  onClick={() => window.open(project.google_sheet_url!, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Google Sheet
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for AI to process invoices...</p>
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
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Drag to reorder invoices</p>
                {invoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-4 p-4 bg-muted/30 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                      draggedIndex === index ? 'opacity-50 border-primary' : 
                      dragOverIndex === index ? 'border-primary bg-primary/10' : 'border-border/50'
                    }`}
                  >
                    {/* Drag handle */}
                    <div className="text-muted-foreground hover:text-foreground">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    {/* Invoice Number - Editable */}
                    <div className="flex items-center gap-2 min-w-[100px]">
                      {editingInvoice === invoice.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 h-8 text-sm"
                            placeholder="001"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleUpdateInvoiceNumber(invoice.id, editValue)}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={cancelEdit}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            #{invoice.invoice_number || String(index + 1).padStart(3, '0')}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => startEditInvoice(invoice)}
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* File name and details */}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">{invoice.file_name}</span>
                      {invoice.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {invoice.description}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    {invoice.total_amount && (
                      <div className="text-sm font-medium whitespace-nowrap">
                        {invoice.currency || 'USD'} {invoice.total_amount.toLocaleString()}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {invoice.file_url && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(invoice.file_url!, '_blank')}
                            title="View PDF"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = invoice.file_url!;
                              link.download = invoice.file_name;
                              link.click();
                            }}
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteDialog({ open: true, type: null, invoiceId: invoice.id })}
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Upload Agency Cost */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Agency Cost
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
                        Click to upload <span className="font-medium">Agency Cost</span>
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

        {/* Section 5: FDA Filename */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              FDA Filename
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={fdaFilename}
              onChange={(e) => setFdaFilename(e.target.value)}
              placeholder="Enter FDA filename..."
              className="font-medium"
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Sticky Bottom Bar - starts after sidebar */}
      <div className="fixed bottom-0 left-64 right-0 p-4 bg-background/95 backdrop-blur border-t z-40">
        <div className="flex items-center justify-end gap-4 pr-4">
          {!canMerge && (
            <span className="text-sm text-muted-foreground">Upload both Front Page and Agency Cost PDFs to continue</span>
          )}
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
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, type: deleteDialog.type, invoiceId: deleteDialog.invoiceId })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog.invoiceId ? 'Weet je zeker dat je deze factuur wilt verwijderen?' : 'Weet je zeker dat je deze PDF wilt verwijderen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The file will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.invoiceId) {
                  handleDeleteInvoice(deleteDialog.invoiceId);
                } else if (deleteDialog.type) {
                  handleDeleteFile(deleteDialog.type);
                }
              }}
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
