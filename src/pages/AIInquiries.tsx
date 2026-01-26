import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Building2,
  User,
  Search,
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

type DateFilter = 'all' | 'today' | 'thisWeek' | 'older';

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
  'CARGO_AGENT': ['CARGO AGENT', 'CARGO_AGENT', 'CARGO AGENT 2'],
  'OWNERS_AGENT': ['OWNERS_AGENT', 'OWNERS AGENT'],
  'OUT_OF_SCOPE': ['OUT_OF_SCOPE', 'Out of Scope', 'REFERRAL', 'OUT OF SCOPE'],
  'INCOMPLETE': ['INCOMPLETE'], // special: filters by status instead of Email Type
};

export default function AIInquiries() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
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
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Sync /inquiries?q=... with the local search (Topbar can write this param)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setSearchQuery((prev) => (prev === q ? prev : q));
  }, [searchParams]);

  const setQueryAndUrl = (value: string) => {
    setSearchQuery(value);
    const next = new URLSearchParams(searchParams);
    const trimmed = value.trim();
    if (trimmed) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  // Filter emails based on search and date
  const filteredEmails = useMemo(() => {
    let filtered = emails;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(email => 
        email.subject?.toLowerCase().includes(query) ||
        email.vessel_name?.toLowerCase().includes(query) ||
        email.email_to_person?.toLowerCase().includes(query) ||
        email.port?.toLowerCase().includes(query) ||
        email.company_name?.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      filtered = filtered.filter(email => {
        const createdDate = new Date(email.created_at);
        
        switch (dateFilter) {
          case 'today':
            return createdDate >= startOfToday;
          case 'thisWeek':
            return createdDate >= startOfWeek && createdDate < startOfToday;
          case 'older':
            return createdDate < startOfWeek;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [emails, searchQuery, dateFilter]);

  async function handlePreviewPdf(attachment: EmailAttachment) {
    const { data } = await supabase.storage
      .from('pdfs')
      .createSignedUrl(attachment.file_path, 3600); // 1 hour
    
    if (data?.signedUrl) {
      setPreviewPdfUrl(data.signedUrl);
    } else {
      toast({ title: t('common.error'), description: t('common.error_occurred'), variant: 'destructive' });
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
        toast({ title: t('common.error'), description: t('inquiries.onlyPdf'), variant: 'destructive' });
        continue;
      }

      const filePath = `email-attachments/${selectedEmail.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: t('common.error'), description: uploadError.message, variant: 'destructive' });
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
    toast({ title: t('common.success'), description: t('inquiries.pdfUploaded') });
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
    toast({ title: t('common.success'), description: t('inquiries.attachmentDeleted') });
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
        toast({ title: t('common.success'), description: status === 'approved' ? t('inquiries.emailSent') : t('inquiries.emailRejected') });
        fetchEmails();
        setSelectedEmail(null);
      }
    } catch (error: any) {
      console.error('Error in handleUpdateStatus:', error);
      toast({ title: t('common.error'), description: error.message || t('common.error_occurred'), variant: 'destructive' });
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
        description: error.message || t('common.error_occurred'),
        variant: 'destructive',
      });
    } else {
      toast({ title: t('common.success'), description: t('inquiries.emailDeleted') });
      setSelectedEmail(null);
      fetchEmails();
    }

    setDeleting(false);
  }


  return (
    <DashboardLayout title={t('inquiries.title')}>
      <div className="flex items-center justify-end gap-2 mb-4">
        <TransitionLink to="/inquiries/manual?tab=history">
          <Button variant="outline" size="sm" className="gap-2 h-9">
            <Mail className="w-4 h-4" />
            {t('common.history')}
          </Button>
        </TransitionLink>
        <TransitionLink to="/inquiries/manual">
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-9">
            <PlusCircle className="w-4 h-4" />
            {t('inquiries.manual')}
          </Button>
        </TransitionLink>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="CARGO_AGENT" className="text-sm">{t('inquiries.cargoAgent')}</TabsTrigger>
          <TabsTrigger value="OWNERS_AGENT" className="text-sm">{t('inquiries.ownersAgent')}</TabsTrigger>
          <TabsTrigger value="OUT_OF_SCOPE" className="text-sm">{t('inquiries.outOfScope')}</TabsTrigger>
          <TabsTrigger value="INCOMPLETE" className="text-sm">{t('inquiries.incomplete')}</TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <TabsContent value={activeTab} className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Email List - Smaller */}
            <Card className="card-premium lg:col-span-1 flex flex-col min-h-0">
              <CardHeader className="pb-2 pt-4 px-4 space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    {t('common.email')} ({filteredEmails.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={fetchEmails}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                {/* Search and Filter integrated in card */}
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('sentPdas.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setQueryAndUrl(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('sentPdas.all')}</SelectItem>
                      <SelectItem value="today">{t('overview.today') || 'Today'}</SelectItem>
                      <SelectItem value="thisWeek">{t('sentPdas.thisWeek')}</SelectItem>
                      <SelectItem value="older">{t('sentPdas.older')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <ScrollArea className="h-[calc(100dvh-400px)]">
                  {loading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      {searchQuery || dateFilter !== 'all' ? t('common.noResultsFound') : t('common.noData')}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredEmails.map((email) => (
                        <div
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedEmail?.id === email.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium line-clamp-2">{email.subject || t('inquiries.noSubject')}</p>
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
                            <span>{new Date(email.created_at).toLocaleDateString()} {new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">{selectedEmail.subject || t('inquiries.noSubject')}</CardTitle>
                            <p className="text-sm text-muted-foreground">To: {selectedEmail.email_to_person}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowPreview(!showPreview)}>
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              {showPreview ? t('inquiries.hideOriginal') : t('inquiries.showOriginal')}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('inquiries.deleteEmail')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('inquiries.deleteConfirm')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={handleDeleteEmail}
                                    disabled={deleting}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    {t('common.delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        {/* Quick Info Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg mb-4">
                          {/* Company & Contact */}
                          {selectedEmail.company_name && (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('inquiries.company')}</p>
                                <p className="text-sm font-medium">{selectedEmail.company_name}</p>
                              </div>
                            </div>
                          )}
                          {selectedEmail.contact_name && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('inquiries.contact')}</p>
                                <p className="text-sm font-medium">{selectedEmail.contact_name}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Vessel 1 */}
                          {selectedEmail.vessel_name && (
                            <div className="flex items-center gap-2">
                              <Ship className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('inquiries.vessel')} 1</p>
                                <p className="text-sm font-medium">{selectedEmail.vessel_name}</p>
                                {selectedEmail.imo && <p className="text-xs text-muted-foreground">IMO: {selectedEmail.imo}</p>}
                              </div>
                            </div>
                          )}
                          
                          {/* Vessel 2 */}
                          {selectedEmail.vessel_2_name && (
                            <div className="flex items-center gap-2">
                              <Ship className="w-4 h-4 text-secondary-foreground" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('inquiries.vessel')} 2</p>
                                <p className="text-sm font-medium">{selectedEmail.vessel_2_name}</p>
                                {selectedEmail.vessel_2_imo && <p className="text-xs text-muted-foreground">IMO: {selectedEmail.vessel_2_imo}</p>}
                              </div>
                            </div>
                          )}
                          
                          {selectedEmail.port && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('inquiries.port')}</p>
                                <p className="text-sm font-medium">{selectedEmail.port}</p>
                              </div>
                            </div>
                          )}
                          {selectedEmail.eta && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              <div>
                                <p className="text-xs text-muted-foreground">{t('inquiries.eta')}</p>
                                <p className="text-sm font-medium">{selectedEmail.eta}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Links */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {selectedEmail.doc_link && (
                            <a href={selectedEmail.doc_link} target="_blank" rel="noopener noreferrer" 
                               className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors">
                              <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 1
                            </a>
                          )}
                          {selectedEmail.dock_link_2 && (
                            <a href={selectedEmail.dock_link_2} target="_blank" rel="noopener noreferrer" 
                               className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors">
                              <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 2
                            </a>
                          )}
                          {selectedEmail['Google sheet url'] && (
                            <a href={selectedEmail['Google sheet url']} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-success/10 text-success rounded-md hover:bg-success/20 transition-colors">
                              <ExternalLink className="w-3 h-3" /> {t('inquiries.googleSheet')}
                            </a>
                          )}
                          {selectedEmail.pdf_url && (
                            <a href={selectedEmail.pdf_url} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-warning/10 text-warning rounded-md hover:bg-warning/20 transition-colors">
                              <ExternalLink className="w-3 h-3" /> {t('inquiries.pdf')}
                            </a>
                          )}
                        </div>

                        {showPreview && (selectedEmail.original_email || selectedEmail.orignal_email) && (
                          <div className="p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-medium mb-2 text-muted-foreground">{t('inquiries.originalEmail')}:</p>
                            <div className="whitespace-pre-wrap text-sm font-sans leading-relaxed max-h-40 overflow-auto">{selectedEmail.original_email || selectedEmail.orignal_email}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* PDF Attachments */}
                    <Card className="card-premium">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            {t('inquiries.pdfAttachments')} ({emailAttachments.length})
                          </CardTitle>
                          <label className="cursor-pointer">
                            <Button variant="outline" size="sm" className="h-8 text-xs" asChild disabled={uploadingPdf}>
                              <span>
                                {uploadingPdf ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                {t('inquiries.uploadPdf')}
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
                      <CardContent className="px-4 pb-4">
                        {emailAttachments.length === 0 ? (
                          <div 
                            className={`text-center py-5 text-muted-foreground border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                              isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('pdf-upload-input')?.click()}
                          >
                            <FileText className={`w-7 h-7 mx-auto mb-2 transition-opacity ${isDragging ? 'opacity-100 text-primary' : 'opacity-50'}`} />
                            <p className="text-xs">{isDragging ? t('inquiries.dropToAdd') : t('inquiries.noPdfsYet')}</p>
                            <p className="text-xs mt-1">{isDragging ? '' : t('inquiries.dropPdfs')}</p>
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
                              <div className="text-center py-2 text-xs text-primary mt-2">
                                {t('inquiries.dropToAdd')}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* PDF Preview Modal */}
                    {previewPdfUrl && (
                      <Card className="card-premium">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{t('inquiries.pdfPreview')}</CardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewPdfUrl(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                          <iframe src={previewPdfUrl} className="w-full h-[400px] rounded-lg border" />
                        </CardContent>
                      </Card>
                    )}

                    {/* Response Editor */}
                    <Card className="card-premium">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-medium">{t('inquiries.editResponse')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 px-4 pb-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="subject" className="text-xs">{t('inquiries.emailSubject')}</Label>
                          <Input 
                            id="subject" 
                            value={editSubject} 
                            onChange={(e) => setEditSubject(e.target.value)}
                            placeholder={t('inquiries.emailSubject')}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="body" className="text-xs">{t('inquiries.emailBody')}</Label>
                          <Textarea 
                            id="body" 
                            value={editBody} 
                            onChange={(e) => setEditBody(e.target.value)}
                            placeholder={t('inquiries.emailBody')}
                            className="min-h-[160px] text-sm"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button 
                            className="flex-1 h-9 text-sm" 
                            onClick={() => handleUpdateStatus('approved')}
                            disabled={sending}
                          >
                            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            {t('inquiries.approveAndSend')}
                          </Button>
                          <Button 
                            variant="destructive"
                            className="h-9 text-sm"
                            onClick={() => handleUpdateStatus('rejected')}
                            disabled={sending}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {t('common.reject')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="card-premium h-[calc(100vh-280px)] flex items-center justify-center">
                    <CardContent className="text-center text-muted-foreground">
                      <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">{t('inquiries.selectEmail')}</p>
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
