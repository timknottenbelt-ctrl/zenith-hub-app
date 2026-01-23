import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';
import {
  Eye,
  RefreshCw,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Ship,
  MapPin,
  Calendar,
  Upload,
  FileText,
  X,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TransitionLink } from '@/components/TransitionLink';

type Email = Tables<'email'>;

interface EmailAttachment {
  id: string;
  email_id: number;
  file_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

const EMAIL_TYPE_MAP: Record<string, string[]> = {
  'CARGO_AGENT': ['CARGO AGENT', 'CARGO_AGENT'],
  'OWNERS_AGENT': ['OWNERS_AGENT', 'OWNERS AGENT'],
  'OUT_OF_SCOPE': ['OUT_OF_SCOPE', 'Out of Scope', 'REFERRAL', 'OUT OF SCOPE'],
  'INCOMPLETE': ['INCOMPLETE'], // special: filters by status instead of Email Type
};

export default function AIInquiries() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('CARGO_AGENT');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Form state for editing
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handlePreviewPdf(attachment: EmailAttachment) {
    const { data } = await supabase.storage
      .from('pdfs')
      .createSignedUrl(attachment.file_path, 3600); // 1 hour
    
    if (data?.signedUrl) {
      setPreviewPdfUrl(data.signedUrl);
    } else {
      toast({ title: 'Error', description: 'Could not load PDF preview', variant: 'destructive' });
    }
  }

  useEffect(() => {
    fetchEmails();
  }, [activeTab]);

  useEffect(() => {
    if (selectedEmail) {
      setEditSubject(selectedEmail.subject || '');
      setEditBody(selectedEmail.body || '');
      fetchEmailAttachments(selectedEmail.id);
    } else {
      setEmailAttachments([]);
    }
  }, [selectedEmail]);

  async function fetchEmails() {
    setLoading(true);
    
    let query = supabase.from('email').select('*');
    
    // Exclude sent/approved emails from all tabs - they belong in Sent PDAs
    query = query.not('status', 'in', '("approved","sent")');
    
    if (activeTab === 'INCOMPLETE') {
      // Filter emails that have missing_information (incomplete emails)
      query = query.not('missing_information', 'is', null);
    } else {
      // Filter by Email Type for other tabs - support multiple variations
      const emailTypes = EMAIL_TYPE_MAP[activeTab];
      query = query.in('Email Type', emailTypes);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setEmails(data || []);
    }
    setLoading(false);
  }

  async function fetchEmailAttachments(emailId: number) {
    const { data } = await supabase
      .from('email_attachments')
      .select('*')
      .eq('email_id', emailId)
      .order('created_at', { ascending: false });
    
    setEmailAttachments((data as EmailAttachment[]) || []);
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!selectedEmail) return;

    setUploadingPdf(true);

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        continue;
      }

      const filePath = `email-attachments/${selectedEmail.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      const { error: insertError } = await supabase.from('email_attachments').insert({
        email_id: selectedEmail.id,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
      });

      if (insertError) {
        toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
      }
    }

    await fetchEmailAttachments(selectedEmail.id);
    setUploadingPdf(false);
    toast({ title: 'Success', description: 'PDF uploaded' });
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    uploadFiles(files);
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFiles(files);
    }
  }

  async function handleDeleteAttachment(attachment: EmailAttachment) {
    await supabase.storage.from('pdfs').remove([attachment.file_path]);
    await supabase.from('email_attachments').delete().eq('id', attachment.id);
    if (selectedEmail) {
      await fetchEmailAttachments(selectedEmail.id);
    }
    toast({ title: 'Success', description: 'Attachment deleted' });
  }

  const getWebhookUrl = (emailType: string | null): string | null => {
    switch (emailType) {
      case 'CARGO AGENT':
        return 'https://lbhcuracao.app.n8n.cloud/webhook/Send-Email-Loading-Discharge';
      case 'OWNERS_AGENT':
        return 'https://lbhcuracao.app.n8n.cloud/webhook/Send-Email-Owners-Agent';
      case 'Out of Scope':
        return 'https://lbhcuracao.app.n8n.cloud/webhook/SEND-REFERRAL-EMAIL';
      default:
        return null;
    }
  };

  async function handleUpdateStatus(status: 'approved' | 'rejected') {
    if (!selectedEmail) return;
    setSending(true);

    try {
      // If approving, call the appropriate webhook first
      if (status === 'approved') {
        const webhookUrl = getWebhookUrl(selectedEmail['Email Type']);
        
        if (webhookUrl) {
          // Get signed URLs for all attachments
          const attachmentUrls: { file_name: string; url: string }[] = [];
          for (const attachment of emailAttachments) {
            const { data: signedUrlData } = await supabase.storage
              .from('pdfs')
              .createSignedUrl(attachment.file_path, 60 * 60 * 24 * 7); // 7 days expiry
            
            if (signedUrlData?.signedUrl) {
              attachmentUrls.push({
                file_name: attachment.file_name,
                url: signedUrlData.signedUrl,
              });
            }
          }

          const payload = {
            email_id: selectedEmail.id,
            to: selectedEmail.email_to_person,
            subject: editSubject,
            body: editBody,
            doc_link: selectedEmail.doc_link,
            doc_link_2: selectedEmail.dock_link_2,
            vessel_name: selectedEmail.vessel_name,
            imo: selectedEmail.imo,
            port: selectedEmail.port,
            eta: selectedEmail.eta,
            company_name: selectedEmail.company_name,
            contact_name: selectedEmail.contact_name,
            original_email: selectedEmail.original_email || selectedEmail.orignal_email,
            attachments: attachmentUrls,
          };

          console.log('Calling webhook:', webhookUrl, payload);

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(`Webhook failed: ${response.statusText}`);
          }

          console.log('Webhook response:', await response.text());
        }
      }

      // Update the email status in database
      const { error } = await supabase
        .from('email')
        .update({ 
          status,
          subject: editSubject,
          body: editBody,
          sent_at: status === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', selectedEmail.id);

      if (error) {
        toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      } else {
        toast({ title: t('common.success'), description: status === 'approved' ? 'Email verzonden' : 'Email afgewezen' });
        fetchEmails();
        setSelectedEmail(null);
      }
    } catch (error: any) {
      console.error('Error in handleUpdateStatus:', error);
      toast({ title: t('common.error'), description: error.message || 'Er is iets misgegaan', variant: 'destructive' });
    }
    
    setSending(false);
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      approved: 'bg-success/10 text-success',
      sent: 'bg-success/10 text-success',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-3 h-3" />;
      case 'approved': 
      case 'sent': return <CheckCircle className="w-3 h-3" />;
      case 'rejected': return <XCircle className="w-3 h-3" />;
      default: return <Mail className="w-3 h-3" />;
    }
  };

  async function handleDeleteEmail() {
    if (!selectedEmail) return;
    setDeleting(true);

    // Delete dependent data to avoid FK constraint failures
    const { error: vesselDeleteError } = await supabase
      .from('vessel_pda_data')
      .delete()
      .eq('supabase_email_id', selectedEmail.id);

    if (vesselDeleteError) {
      // Non-blocking: if there is no policy / table access, we still try to delete the email
      console.warn('Could not delete vessel_pda_data for email', selectedEmail.id, vesselDeleteError);
    }

    // Delete attachments (storage + rows)
    if (emailAttachments.length) {
      const paths = emailAttachments.map((a) => a.file_path);
      const { error: storageError } = await supabase.storage.from('pdfs').remove(paths);
      if (storageError) {
        console.warn('Could not remove attachment files', storageError);
      }

      const { error: attachmentsError } = await supabase
        .from('email_attachments')
        .delete()
        .eq('email_id', selectedEmail.id);

      if (attachmentsError) {
        console.warn('Could not delete attachment records', attachmentsError);
      }
    }

    const { error } = await supabase.from('email').delete().eq('id', selectedEmail.id);

    if (error) {
      toast({
        title: t('common.error'),
        description: error.message || 'Kon email niet verwijderen',
        variant: 'destructive',
      });
    } else {
      toast({ title: t('common.success'), description: 'Email verwijderd' });
      setSelectedEmail(null);
      fetchEmails();
    }

    setDeleting(false);
  }


  return (
    <DashboardLayout title={t('inquiries.title')}>
      <div className="flex items-center justify-end gap-2 mb-4">
        <TransitionLink to="/inquiries/manual?tab=history">
          <Button variant="outline" className="gap-2">
            <Mail className="w-4 h-4" />
            History
          </Button>
        </TransitionLink>
        <TransitionLink to="/inquiries/manual">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <PlusCircle className="w-4 h-4" />
            Manual
          </Button>
        </TransitionLink>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="CARGO_AGENT">{t('inquiries.cargoAgent')}</TabsTrigger>
          <TabsTrigger value="OWNERS_AGENT">{t('inquiries.ownersAgent')}</TabsTrigger>
          <TabsTrigger value="OUT_OF_SCOPE">{t('inquiries.outOfScope')}</TabsTrigger>
          <TabsTrigger value="INCOMPLETE">Incomplete</TabsTrigger>
        </TabsList>


        {/* Tab Content */}
        <TabsContent value={activeTab} className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Email List - Smaller */}
              <Card className="card-premium lg:col-span-1 flex flex-col min-h-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Emails ({emails.length})
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchEmails}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 min-h-0">
                  <ScrollArea className="h-[calc(100dvh-200px)]">
                    {loading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : emails.length === 0 ? (
                      <div className="text-center p-8 text-muted-foreground">
                        {t('common.noData')}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {emails.map((email) => (
                          <div
                            key={email.id}
                            onClick={() => setSelectedEmail(email)}
                            className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                              selectedEmail?.id === email.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-medium line-clamp-2">{email.subject || 'No subject'}</p>
                              <Badge className={`${getStatusBadge(email.status)} text-xs shrink-0`} variant="secondary">
                                {getStatusIcon(email.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{email.email_to_person}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {email.vessel_name && (
                                <span className="flex items-center gap-1">
                                  <Ship className="w-3 h-3" />
                                  {email.vessel_name}
                                </span>
                              )}
                              <span>{new Date(email.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Email Detail - Larger */}
              <div className="lg:col-span-2 space-y-4">
                {selectedEmail ? (
                  <>
                    {/* Email Meta Info */}
                    <Card className="card-premium">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg font-semibold">{selectedEmail.subject || 'No subject'}</CardTitle>
                            <p className="text-sm text-muted-foreground">To: {selectedEmail.email_to_person}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                              <Eye className="w-4 h-4 mr-1" />
                              {showPreview ? 'Hide' : 'Show'} Original
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Email verwijderen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Weet je zeker dat je deze email wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={handleDeleteEmail}
                                    disabled={deleting}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Verwijderen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Quick Info Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg mb-4">
                          {selectedEmail.vessel_name && (
                            <div className="flex items-center gap-2">
                              <Ship className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Vessel</p>
                                <p className="text-sm font-medium">{selectedEmail.vessel_name}</p>
                              </div>
                            </div>
                          )}
                          {selectedEmail.port && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">Port</p>
                                <p className="text-sm font-medium">{selectedEmail.port}</p>
                              </div>
                            </div>
                          )}
                          {selectedEmail.eta && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">ETA</p>
                                <p className="text-sm font-medium">{selectedEmail.eta}</p>
                              </div>
                            </div>
                          )}
                          {selectedEmail.imo && (
                            <div>
                              <p className="text-xs text-muted-foreground">IMO</p>
                              <p className="text-sm font-medium">{selectedEmail.imo}</p>
                            </div>
                          )}
                        </div>

                        {/* Links */}
                        <div className="flex flex-wrap gap-3 mb-4">
                          {selectedEmail.doc_link && (
                            <a href={selectedEmail.doc_link} target="_blank" rel="noopener noreferrer" 
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" /> Doc Link 1
                            </a>
                          )}
                          {selectedEmail.dock_link_2 && (
                            <a href={selectedEmail.dock_link_2} target="_blank" rel="noopener noreferrer" 
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" /> Doc Link 2
                            </a>
                          )}
                          {selectedEmail['Google sheet url'] && (
                            <a href={selectedEmail['Google sheet url']} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" /> Google Sheet
                            </a>
                          )}
                          {selectedEmail.pdf_url && (
                            <a href={selectedEmail.pdf_url} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-warning/10 text-warning rounded-lg hover:bg-warning/20 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" /> PDF
                            </a>
                          )}
                        </div>

                        {showPreview && (selectedEmail.original_email || selectedEmail.orignal_email) && (
                          <div className="p-4 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Original Email:</p>
                            <div className="whitespace-pre-wrap text-sm font-sans leading-relaxed max-h-48 overflow-auto">{selectedEmail.original_email || selectedEmail.orignal_email}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* PDF Attachments */}
                    <Card className="card-premium">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            PDF Attachments ({emailAttachments.length})
                          </CardTitle>
                          <label className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild disabled={uploadingPdf}>
                              <span>
                                {uploadingPdf ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Upload className="w-4 h-4 mr-2" />
                                )}
                                Upload PDF
                              </span>
                            </Button>
                            <input
                              id="pdf-upload-input"
                              type="file"
                              multiple
                              accept=".pdf"
                              className="hidden"
                              onChange={handlePdfUpload}
                              disabled={uploadingPdf}
                            />
                          </label>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {emailAttachments.length === 0 ? (
                          <div 
                            className={`text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                              isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('pdf-upload-input')?.click()}
                          >
                            <FileText className={`w-8 h-8 mx-auto mb-2 transition-opacity ${isDragging ? 'opacity-100 text-primary' : 'opacity-50'}`} />
                            <p className="text-sm">{isDragging ? 'Drop PDF here' : 'No PDFs attached yet'}</p>
                            <p className="text-xs">{isDragging ? '' : 'Drag & drop or click to upload'}</p>
                          </div>
                        ) : (
                          <div 
                            className={`border-2 border-dashed rounded-lg transition-colors p-2 ${
                              isDragging ? 'border-primary bg-primary/5' : 'border-transparent'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {emailAttachments.map((attachment) => (
                                <div key={attachment.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm truncate">{attachment.file_name}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreviewPdf(attachment)}>
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteAttachment(attachment)}>
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {isDragging && (
                              <div className="text-center py-2 text-sm text-primary mt-2">
                                Drop PDF here to add
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* PDF Preview Modal */}
                    {previewPdfUrl && (
                      <Card className="card-premium">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">PDF Preview</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewPdfUrl(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <iframe src={previewPdfUrl} className="w-full h-[500px] rounded-lg border" />
                        </CardContent>
                      </Card>
                    )}

                    {/* Response Editor */}
                    <Card className="card-premium">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Edit Response</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject</Label>
                          <Input 
                            id="subject" 
                            value={editSubject} 
                            onChange={(e) => setEditSubject(e.target.value)}
                            placeholder="Email subject"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="body">Body</Label>
                          <Textarea 
                            id="body" 
                            value={editBody} 
                            onChange={(e) => setEditBody(e.target.value)}
                            placeholder="Email body"
                            className="min-h-[200px]"
                          />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button 
                            className="flex-1" 
                            onClick={() => handleUpdateStatus('approved')}
                            disabled={sending}
                          >
                            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            Approve & Send
                          </Button>
                          <Button 
                            variant="destructive"
                            onClick={() => handleUpdateStatus('rejected')}
                            disabled={sending}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="card-premium h-[calc(100vh-280px)] flex items-center justify-center">
                    <CardContent className="text-center text-muted-foreground">
                      <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select an email to view details</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
