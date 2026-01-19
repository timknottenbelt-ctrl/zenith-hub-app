import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Mail,
  Plus,
  X,
  FileText,
  Download,
  Eye,
  Loader2,
  Send,
  Upload,
  Trash2,
  Paperclip,
} from 'lucide-react';

interface FDAProject {
  project_id: string;
  lbh_number: string;
  ship_name: string;
  client_email: string | null;
  client_name: string | null;
  billing_email: string | null;
  email_subject: string | null;
  email_body: string | null;
  final_pdf_url: string | null;
  fda_responsible: string | null;
  total_invoices: number | null;
  total_amount: number | null;
}

const SUPABASE_URL = 'https://oxkshjaombffbdemqrqb.supabase.co';

// Helper to ensure final_pdf_url is a full URL
function getFullPdfUrl(url: string | null): string | null {
  if (!url) return null;
  // If it's already a full URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If it starts with /object/sign, prepend the Supabase storage URL
  if (url.startsWith('/object/sign') || url.startsWith('/storage/v1')) {
    return `${SUPABASE_URL}/storage/v1${url.replace('/storage/v1', '')}`;
  }
  return url;
}

interface ExtraAttachment {
  id: string;
  name: string;
  url: string;
}

const SEND_WEBHOOK_URL = 'https://lbhcuracao.app.n8n.cloud/webhook-test/Send-FDA';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FDAEmailPreview() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<FDAProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingPdf, setCheckingPdf] = useState(true);
  const [sending, setSending] = useState(false);

  // Email form state
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newToEmail, setNewToEmail] = useState('');
  const [newCcEmail, setNewCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [extraAttachments, setExtraAttachments] = useState<ExtraAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from('fda_projects')
      .select(`
        project_id,
        lbh_number,
        ship_name,
        client_email,
        client_name,
        billing_email,
        email_subject,
        email_body,
        final_pdf_url,
        fda_responsible,
        total_invoices,
        total_amount
      `)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      toast({ title: 'Error', description: 'Project not found', variant: 'destructive' });
      navigate('/fda');
      return;
    }

    setProject(data);

    // Set default values from project
    if (data.client_email) {
      setToEmails([data.client_email]);
    }
    if (data.billing_email) {
      setCcEmails([data.billing_email]);
    }
    if (data.email_subject) {
      setSubject(data.email_subject);
    } else {
      setSubject(`FDA Invoices - ${data.lbh_number} - ${data.ship_name}`);
    }
    if (data.email_body) {
      setBody(data.email_body);
    } else {
      // Generate default body
      const defaultBody = `Dear ${data.client_name || 'Client'},

Please find attached the invoices for project ${data.lbh_number} - ${data.ship_name}.

Total number of invoices: ${data.total_invoices || 'N/A'}
Total amount: ${data.total_amount ? `USD ${data.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A'}

You can download the complete FDA package via the attachment.

Best regards,
${data.fda_responsible || 'LBH Team'}
LBH Curaçao`;
      setBody(defaultBody);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await fetchProject();
      setLoading(false);
    }
    loadData();
  }, [fetchProject]);

  // Poll for final_pdf_url if not yet available
  useEffect(() => {
    if (!project || loading) return;

    if (project.final_pdf_url) {
      setCheckingPdf(false);
      return;
    }

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('fda_projects')
        .select('final_pdf_url')
        .eq('project_id', projectId)
        .limit(1);

      const polledProject = data?.[0];
      if (polledProject?.final_pdf_url) {
        setProject((prev) =>
          prev ? { ...prev, final_pdf_url: polledProject.final_pdf_url } : prev
        );
        setCheckingPdf(false);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [projectId, project, loading]);

  // Email validation
  function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email.trim());
  }

  // Add TO email
  function addToEmail() {
    const email = newToEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    if (toEmails.includes(email)) {
      toast({ title: 'Duplicate', description: 'This email is already added', variant: 'destructive' });
      return;
    }
    setToEmails([...toEmails, email]);
    setNewToEmail('');
  }

  // Remove TO email
  function removeToEmail(index: number) {
    setToEmails(toEmails.filter((_, i) => i !== index));
  }

  // Add CC email
  function addCcEmail() {
    const email = newCcEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    if (ccEmails.includes(email)) {
      toast({ title: 'Duplicate', description: 'This email is already added', variant: 'destructive' });
      return;
    }
    setCcEmails([...ccEmails, email]);
    setNewCcEmail('');
  }

  // Remove CC email
  function removeCcEmail(index: number) {
    setCcEmails(ccEmails.filter((_, i) => i !== index));
  }

  // Handle keyboard for adding emails
  function handleToKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToEmail();
    }
  }

  function handleCcKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCcEmail();
    }
  }

  // Upload extra attachment
  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File must be less than 10MB', variant: 'destructive' });
      return;
    }

    setUploadingAttachment(true);

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${projectId}/extra/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fda-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('fda-attachments')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (!urlData?.signedUrl) throw new Error('Failed to get URL');

      setExtraAttachments([
        ...extraAttachments,
        { id: fileName, name: file.name, url: urlData.signedUrl }
      ]);

      toast({ title: 'Success', description: 'Attachment uploaded' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Error', description: 'Failed to upload attachment', variant: 'destructive' });
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  }

  // Remove extra attachment
  function removeAttachment(id: string) {
    setExtraAttachments(extraAttachments.filter(a => a.id !== id));
  }

  // Send email
  async function handleSendEmail() {
    if (toEmails.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one recipient', variant: 'destructive' });
      return;
    }

    if (!subject.trim()) {
      toast({ title: 'Error', description: 'Please enter a subject', variant: 'destructive' });
      return;
    }

    if (!body.trim()) {
      toast({ title: 'Error', description: 'Please enter email body', variant: 'destructive' });
      return;
    }

    setSending(true);

    try {
      const pdfUrl = getFullPdfUrl(project?.final_pdf_url);
      const payload = {
        project_id: projectId,
        email_to: toEmails.join(','),
        email_cc: ccEmails.join(','),
        email_subject: subject,
        email_body: body,
        attachment_url: pdfUrl || '',
        extra_attachments: extraAttachments.map(a => a.url),
      };

      const response = await fetch(SEND_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Send failed: ${response.status}`);
      }

      toast({ title: 'Success!', description: 'Email sent successfully!' });
      navigate('/fda');
    } catch (error) {
      console.error('Send error:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to send email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  // Get filename from URL
  function getFilenameFromUrl(url: string): string {
    try {
      const urlParts = url.split('/');
      const fileNameWithParams = urlParts[urlParts.length - 1];
      return fileNameWithParams.split('?')[0] || 'FDA_Package.pdf';
    } catch {
      return 'FDA_Package.pdf';
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="FDA Email">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout title="FDA Email">
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
    <DashboardLayout title="FDA Email">
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/fda-front-page/${projectId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="w-6 h-6" />
              FDA Email
            </h1>
            <p className="text-muted-foreground">{project.lbh_number} - {project.ship_name}</p>
          </div>
        </div>

        {/* Recipients Section */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TO Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[48px] bg-background">
                {toEmails.map((email, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeToEmail(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Input
                    type="email"
                    placeholder="Add recipient..."
                    value={newToEmail}
                    onChange={(e) => setNewToEmail(e.target.value)}
                    onKeyDown={handleToKeyDown}
                    className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addToEmail}
                    disabled={!newToEmail.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* CC Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">CC</label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[48px] bg-background">
                {ccEmails.map((email, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1 py-1 px-2">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeCcEmail(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Input
                    type="email"
                    placeholder="Add CC recipient..."
                    value={newCcEmail}
                    onChange={(e) => setNewCcEmail(e.target.value)}
                    onKeyDown={handleCcKeyDown}
                    className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addCcEmail}
                    disabled={!newCcEmail.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subject Section */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="text-base"
            />
          </CardContent>
        </Card>

        {/* Body Section */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">Email Body</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter email body..."
              className="min-h-[300px] font-mono text-sm resize-y"
            />
          </CardContent>
        </Card>

        {/* Attachments Section */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main PDF Attachment */}
            {project.final_pdf_url ? (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{getFilenameFromUrl(project.final_pdf_url)}</p>
                    <p className="text-xs text-muted-foreground">Main FDA Package</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = getFullPdfUrl(project.final_pdf_url);
                      if (url) window.open(url, '_blank');
                    }}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            ) : checkingPdf ? (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/30 flex items-center justify-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Waiting for PDF to be generated...</p>
              </div>
            ) : (
              <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-center">
                <p className="text-muted-foreground">No PDF generated yet</p>
              </div>
            )}

            {/* Extra Attachments */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Extra Attachments (Optional)</p>
              
              {extraAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 bg-background border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{attachment.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(attachment.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadAttachment}
                  disabled={uploadingAttachment}
                />
                {uploadingAttachment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploadingAttachment ? 'Uploading...' : 'Add extra attachment'}
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - Sticky Bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-50">
          <div className="max-w-4xl mx-auto flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/fda-front-page/${projectId}`)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sending || toEmails.length === 0}
              className="min-w-[140px]"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
            <DialogDescription>
              Preview of the FDA package PDF document
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-full">
            {project.final_pdf_url ? (
              <iframe
                src={getFullPdfUrl(project.final_pdf_url) || ''}
                className="w-full h-full min-h-[60vh] rounded-lg border"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No PDF available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
