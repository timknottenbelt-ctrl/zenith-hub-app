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
  Send,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Email = Tables<'email'>;

interface EmailAttachment {
  id: string;
  email_id: number;
  file_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

const EMAIL_TYPE_MAP: Record<string, string> = {
  'CARGO_AGENT': 'CARGO AGENT',
  'OWNERS_AGENT': 'OWNERS_AGENT',
  'OUT_OF_SCOPE': 'Out of Scope',
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
  
  // Form state for editing
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Manual email creation state
  const [manualEmailContent, setManualEmailContent] = useState('');
  const [manualAgentType, setManualAgentType] = useState<'OWNERS_AGENT' | 'CARGO_AGENT'>('CARGO_AGENT');
  const [manualPdfFile, setManualPdfFile] = useState<File | null>(null);
  const [manualSending, setManualSending] = useState(false);

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
    const emailType = EMAIL_TYPE_MAP[activeTab];
    
    const { data, error } = await supabase
      .from('email')
      .select('*')
      .eq('Email Type', emailType)
      .order('created_at', { ascending: false });

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

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !selectedEmail) return;

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
    e.target.value = '';
  }

  async function handleDeleteAttachment(attachment: EmailAttachment) {
    await supabase.storage.from('pdfs').remove([attachment.file_path]);
    await supabase.from('email_attachments').delete().eq('id', attachment.id);
    if (selectedEmail) {
      await fetchEmailAttachments(selectedEmail.id);
    }
    toast({ title: 'Success', description: 'Attachment deleted' });
  }

  async function handleUpdateStatus(status: 'approved' | 'rejected') {
    if (!selectedEmail) return;
    setSending(true);

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
      toast({ title: t('common.success'), description: `Email ${status}` });
      fetchEmails();
      setSelectedEmail(null);
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

  async function handleManualSubmit() {
    if (!manualEmailContent.trim()) {
      toast({ title: 'Error', description: 'Please paste an email message', variant: 'destructive' });
      return;
    }

    setManualSending(true);

    try {
      const formData = new FormData();
      formData.append('email_content', manualEmailContent);
      formData.append('agent_type', manualAgentType);
      
      if (manualPdfFile) {
        formData.append('pdf', manualPdfFile);
      }

      const response = await fetch('https://lbhcuracao.app.n8n.cloud/webhook-test/MANUAL-EMAIL-CREATION', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Webhook request failed');
      }

      toast({ title: 'Success', description: 'Email sent to webhook successfully!' });
      setManualEmailContent('');
      setManualPdfFile(null);
      // Reset file input
      const fileInput = document.getElementById('manual-pdf-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send email to webhook', variant: 'destructive' });
    } finally {
      setManualSending(false);
    }
  }

  return (
    <DashboardLayout title={t('inquiries.title')}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="CARGO_AGENT">{t('inquiries.cargoAgent')}</TabsTrigger>
          <TabsTrigger value="OWNERS_AGENT">{t('inquiries.ownersAgent')}</TabsTrigger>
          <TabsTrigger value="OUT_OF_SCOPE">{t('inquiries.outOfScope')}</TabsTrigger>
          <TabsTrigger value="MANUAL" className="flex items-center gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />
            Manual
          </TabsTrigger>
        </TabsList>

        {/* Manual Email Creation Tab */}
        <TabsContent value="MANUAL" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manual Creation Form */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary" />
                  Manual Email Creation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agent Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="agent-type">Agent Type</Label>
                  <Select 
                    value={manualAgentType} 
                    onValueChange={(value: 'OWNERS_AGENT' | 'CARGO_AGENT') => setManualAgentType(value)}
                  >
                    <SelectTrigger id="agent-type">
                      <SelectValue placeholder="Select agent type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CARGO_AGENT">Cargo Agent</SelectItem>
                      <SelectItem value="OWNERS_AGENT">Owners Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Email Content */}
                <div className="space-y-2">
                  <Label htmlFor="email-content">Email Content</Label>
                  <Textarea
                    id="email-content"
                    placeholder="Paste email content here..."
                    value={manualEmailContent}
                    onChange={(e) => setManualEmailContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label htmlFor="manual-pdf-input">PDF Attachment (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer flex-1">
                      <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {manualPdfFile ? manualPdfFile.name : 'Click to upload PDF'}
                        </span>
                      </div>
                      <input
                        id="manual-pdf-input"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && file.type === 'application/pdf') {
                            setManualPdfFile(file);
                          } else if (file) {
                            toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
                          }
                        }}
                      />
                    </label>
                    {manualPdfFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setManualPdfFile(null);
                          const fileInput = document.getElementById('manual-pdf-input') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  className="w-full" 
                  onClick={handleManualSubmit}
                  disabled={manualSending || !manualEmailContent.trim()}
                >
                  {manualSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send to Webhook
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview / Instructions */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <h4 className="font-medium">How to use Manual Email Creation:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Select the agent type (Cargo Agent or Owners Agent)</li>
                    <li>Copy and paste the email content into the text area</li>
                    <li>Optionally attach a PDF document</li>
                    <li>Click "Send to Webhook" to process the email</li>
                  </ol>
                </div>

                {manualEmailContent && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="p-4 bg-muted/50 rounded-lg border max-h-[300px] overflow-auto">
                      <pre className="whitespace-pre-wrap text-sm">{manualEmailContent}</pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Other Tabs Content */}
        {activeTab !== 'MANUAL' && (
          <TabsContent value={activeTab} className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Email List - Smaller */}
              <Card className="card-premium lg:col-span-1">
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
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-280px)]">
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
                          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                            <Eye className="w-4 h-4 mr-1" />
                            {showPreview ? 'Hide' : 'Show'} Original
                          </Button>
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

                        {showPreview && selectedEmail.original_email && (
                          <div className="p-4 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Original Email:</p>
                            <pre className="whitespace-pre-wrap text-sm max-h-48 overflow-auto">{selectedEmail.original_email}</pre>
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
                          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No PDFs attached yet</p>
                            <p className="text-xs">Click "Upload PDF" to add attachments</p>
                          </div>
                        ) : (
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
        )}
      </Tabs>
    </DashboardLayout>
  );
}
