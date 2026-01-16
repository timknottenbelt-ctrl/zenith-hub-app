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
import { supabase, Email, EmailAttachment } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import {
  Eye,
  Send,
  Upload,
  Download,
  Trash2,
  ExternalLink,
  RefreshCw,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

type Category = 'CARGO_AGENT' | 'OWNERS_AGENT' | 'OUT_OF_SCOPE';

const WEBHOOKS: Record<Category, string> = {
  CARGO_AGENT: 'https://lbhcuracao.app.n8n.cloud/webhook-test/Send-Email-Loading-Discharge',
  OWNERS_AGENT: 'https://lbhcuracao.app.n8n.cloud/webhook-test/Send-Email-Owners-Agent',
  OUT_OF_SCOPE: 'https://lbhcuracao.app.n8n.cloud/webhook-test/SEND-REFERRAL-EMAIL',
};

export default function AIInquiries() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Category>('CARGO_AGENT');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [toName, setToName] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [composedSubject, setComposedSubject] = useState('');
  const [composedMessage, setComposedMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, [activeTab]);

  useEffect(() => {
    if (selectedEmail) {
      setToName(selectedEmail.to_name || '');
      setToEmail(selectedEmail.to_email || '');
      setComposedSubject(selectedEmail.composed_subject || selectedEmail.subject);
      setComposedMessage(selectedEmail.composed_message || '');
      fetchAttachments(selectedEmail.id);
    }
  }, [selectedEmail]);

  async function fetchEmails() {
    setLoading(true);
    const { data, error } = await supabase
      .from('email')
      .select('*')
      .eq('category', activeTab)
      .order('received_at', { ascending: false });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setEmails(data || []);
    }
    setLoading(false);
  }

  async function fetchAttachments(emailId: string) {
    const { data, error } = await supabase
      .from('email_attachments')
      .select('*')
      .eq('email_id', emailId);

    if (error) {
      console.error('Error fetching attachments:', error);
    } else {
      setAttachments(data || []);
    }
  }

  async function handleFileUpload(files: FileList) {
    if (!selectedEmail) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        continue;
      }

      const filePath = `${selectedEmail.id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('email-pdfs')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      const { error: insertError } = await supabase
        .from('email_attachments')
        .insert({
          email_id: selectedEmail.id,
          file_path: filePath,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });

      if (insertError) {
        toast({ title: 'Error saving attachment', description: insertError.message, variant: 'destructive' });
      }
    }

    await fetchAttachments(selectedEmail.id);
    setUploading(false);
    toast({ title: t('common.success'), description: 'Files uploaded successfully' });
  }

  async function handleDeleteAttachment(attachment: EmailAttachment) {
    const { error: deleteStorageError } = await supabase.storage
      .from('email-pdfs')
      .remove([attachment.file_path]);

    if (deleteStorageError) {
      toast({ title: 'Error', description: deleteStorageError.message, variant: 'destructive' });
      return;
    }

    const { error: deleteRecordError } = await supabase
      .from('email_attachments')
      .delete()
      .eq('id', attachment.id);

    if (deleteRecordError) {
      toast({ title: 'Error', description: deleteRecordError.message, variant: 'destructive' });
      return;
    }

    await fetchAttachments(selectedEmail!.id);
    toast({ title: t('common.success'), description: 'Attachment deleted' });
  }

  async function getSignedUrl(filePath: string) {
    const { data } = await supabase.storage
      .from('email-pdfs')
      .createSignedUrl(filePath, 3600);
    return data?.signedUrl;
  }

  async function handleSend() {
    if (!selectedEmail) return;
    setSending(true);

    // Update status to sending
    await supabase
      .from('email')
      .update({ 
        status: 'sending',
        to_name: toName,
        to_email: toEmail,
        composed_subject: composedSubject,
        composed_message: composedMessage,
      })
      .eq('id', selectedEmail.id);

    // Get signed URLs for attachments
    const pdfUrls = await Promise.all(
      attachments.map(async (att) => ({
        url: await getSignedUrl(att.file_path),
        filename: att.file_name,
      }))
    );

    const payload = {
      email_id: selectedEmail.id,
      category: activeTab,
      original_email: {
        subject: selectedEmail.subject,
        from: selectedEmail.from_email,
        received_at: selectedEmail.received_at,
        body_html: selectedEmail.body_html,
        body_text: selectedEmail.body_text,
      },
      composed_email: {
        to_name: toName,
        to_email: toEmail,
        subject: composedSubject,
        message: composedMessage,
      },
      sheet_links: selectedEmail.sheet_links || [],
      pdfs: pdfUrls,
    };

    try {
      const response = await fetch(WEBHOOKS[activeTab], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Webhook failed');

      await supabase
        .from('email')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', selectedEmail.id);

      toast({ title: t('common.success'), description: 'Email sent successfully' });
      fetchEmails();
    } catch (error) {
      await supabase
        .from('email')
        .update({ status: 'failed', error_message: (error as Error).message })
        .eq('id', selectedEmail.id);

      toast({ title: t('common.error'), description: 'Failed to send email', variant: 'destructive' });
    }

    setSending(false);
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      new: 'badge-new',
      draft: 'badge-draft',
      ready: 'badge-ready',
      sending: 'badge-sending',
      sent: 'badge-sent',
      failed: 'badge-failed',
    };
    return styles[status] || '';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Mail className="w-3 h-3" />;
      case 'draft': return <Clock className="w-3 h-3" />;
      case 'sent': return <CheckCircle className="w-3 h-3" />;
      case 'failed': return <XCircle className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <DashboardLayout title={t('inquiries.title')}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Category)} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="CARGO_AGENT">{t('inquiries.cargoAgent')}</TabsTrigger>
          <TabsTrigger value="OWNERS_AGENT">{t('inquiries.ownersAgent')}</TabsTrigger>
          <TabsTrigger value="OUT_OF_SCOPE">{t('inquiries.outOfScope')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email List */}
            <Card className="card-premium">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Emails
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
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
                          className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedEmail?.id === email.id ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{email.subject}</p>
                              <p className="text-xs text-muted-foreground truncate">{email.from_email}</p>
                            </div>
                            <Badge className={getStatusBadge(email.status)} variant="secondary">
                              {getStatusIcon(email.status)}
                              <span className="ml-1">{email.status}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(email.received_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Email Detail */}
            <div className="space-y-4">
              {selectedEmail ? (
                <>
                  {/* Original Email */}
                  <Card className="card-premium">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Original Email</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                          <Eye className="w-4 h-4 mr-1" />
                          {t('inquiries.previewTemplate')}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('inquiries.from')}:</span>
                          <p className="font-medium">{selectedEmail.from_name || selectedEmail.from_email}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('inquiries.receivedAt')}:</span>
                          <p className="font-medium">{new Date(selectedEmail.received_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">{t('inquiries.subject')}:</span>
                        <p className="font-medium">{selectedEmail.subject}</p>
                      </div>
                      {showPreview && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg max-h-64 overflow-auto">
                          {selectedEmail.body_html ? (
                            <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm">{selectedEmail.body_text}</pre>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Template Editor */}
                  <Card className="card-premium">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Compose Reply</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('inquiries.toName')}</Label>
                          <Input
                            value={toName}
                            onChange={(e) => setToName(e.target.value)}
                            placeholder="Recipient name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('inquiries.toEmail')}</Label>
                          <Input
                            value={toEmail}
                            onChange={(e) => setToEmail(e.target.value)}
                            type="email"
                            placeholder="recipient@example.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('inquiries.subject')}</Label>
                        <Input
                          value={composedSubject}
                          onChange={(e) => setComposedSubject(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('inquiries.message')}</Label>
                        <Textarea
                          value={composedMessage}
                          onChange={(e) => setComposedMessage(e.target.value)}
                          rows={6}
                          className="resize-none"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Google Sheets Links */}
                  {selectedEmail.sheet_links && selectedEmail.sheet_links.length > 0 && (
                    <Card className="card-premium">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">{t('inquiries.sheetLinks')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedEmail.sheet_links.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Sheet {i + 1}
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* PDF Attachments */}
                  <Card className="card-premium">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">{t('inquiries.attachments')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Upload Zone */}
                      <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">{t('inquiries.dropPdfs')}</span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                          disabled={uploading}
                        />
                      </label>

                      {uploading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </div>
                      )}

                      {/* Attachment List */}
                      {attachments.length > 0 && (
                        <div className="space-y-2">
                          {attachments.map((att) => (
                            <div key={att.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                              <span className="text-sm truncate flex-1">{att.file_name}</span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={async () => {
                                    const url = await getSignedUrl(att.file_path);
                                    if (url) window.open(url, '_blank');
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteAttachment(att)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Send Button */}
                  <div className="flex justify-end gap-2">
                    {selectedEmail.status === 'failed' && (
                      <Button variant="outline" onClick={handleSend} disabled={sending}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {t('inquiries.retry')}
                      </Button>
                    )}
                    <Button
                      onClick={handleSend}
                      disabled={sending || !toEmail || !composedSubject}
                      className="gap-2"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('inquiries.sending')}
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          {t('inquiries.send')}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <Card className="card-premium h-[600px] flex items-center justify-center">
                  <p className="text-muted-foreground">{t('inquiries.selectEmail')}</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
