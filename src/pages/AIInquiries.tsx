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
  ChevronDown,
  ChevronUp,
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
import { WEBHOOKS, webhookPostJSON } from '@/lib/webhooks';

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
  const [showOriginal, setShowOriginal] = useState(false);
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

  const setEmailIdInUrl = (emailId: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (emailId) next.set('emailId', String(emailId));
    else next.delete('emailId');
    setSearchParams(next, { replace: true });
  };

  // When navigating here with ?emailId=..., auto-select that email (if present in current tab)
  useEffect(() => {
    const raw = searchParams.get('emailId');
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    const found = emails.find((e) => e.id === id);
    if (found && selectedEmail?.id !== id) {
      setSelectedEmail(found);
    }
  }, [searchParams, emails, selectedEmail?.id]);

  // Filter emails based on search and date
  const filteredEmails = useMemo(() => {
    let filtered = emails;

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
      .createSignedUrl(attachment.file_path, 3600);

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
      setShowOriginal(false);
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
      query = query.not('missing_information', 'is', null);
    } else {
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
        return WEBHOOKS.SEND_EMAIL_LOADING_DISCHARGE;
      case 'OWNERS_AGENT':
        return WEBHOOKS.SEND_EMAIL_OWNERS_AGENT;
      case 'Out of Scope':
        return WEBHOOKS.SEND_REFERRAL_EMAIL;
      default:
        return null;
    }
  };

  async function handleUpdateStatus(status: 'approved' | 'rejected') {
    if (!selectedEmail) return;
    setSending(true);

    try {
      if (status === 'approved') {
        const webhookUrl = getWebhookUrl(selectedEmail['Email Type']);

        if (webhookUrl) {
          const attachmentUrls: { file_name: string; url: string }[] = [];
          for (const attachment of emailAttachments) {
            const { data: signedUrlData } = await supabase.storage
              .from('pdfs')
              .createSignedUrl(attachment.file_path, 60 * 60 * 24 * 7);

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

          const response = await webhookPostJSON(webhookUrl, payload);

          if (!response.ok) {
            throw new Error(`Webhook failed: ${response.statusText}`);
          }

          console.log('Webhook response:', await response.text());
        }
      }

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
        setEmailIdInUrl(null);
      }
    } catch (error: any) {
      console.error('Error in handleUpdateStatus:', error);
      toast({ title: t('common.error'), description: error.message || t('common.error_occurred'), variant: 'destructive' });
    }

    setSending(false);
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-amber-50 text-amber-700 border-amber-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
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

    const { error: vesselDeleteError } = await supabase
      .from('vessel_pda_data')
      .delete()
      .eq('supabase_email_id', selectedEmail.id);

    if (vesselDeleteError) {
      console.warn('Could not delete vessel_pda_data for email', selectedEmail.id, vesselDeleteError);
    }

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
      setEmailIdInUrl(null);
      fetchEmails();
    }

    setDeleting(false);
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <DashboardLayout title={t('inquiries.title')}>
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 mb-5">
        <TransitionLink to="/inquiries/manual?tab=history">
          <Button variant="outline" size="sm" className="gap-2 h-9 w-full sm:w-auto rounded-lg">
            <Mail className="w-4 h-4" />
            <span className="sm:inline">{t('common.history')}</span>
          </Button>
        </TransitionLink>
        <TransitionLink to="/inquiries/manual">
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white gap-2 h-9 w-full sm:w-auto rounded-lg shadow-sm">
            <PlusCircle className="w-4 h-4" />
            <span className="sm:inline">{t('inquiries.manual')}</span>
          </Button>
        </TransitionLink>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="bg-white/60 backdrop-blur-sm p-1 h-auto inline-flex gap-1 rounded-xl" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <TabsTrigger value="CARGO_AGENT" className="text-sm px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">{t('inquiries.cargoAgent')}</TabsTrigger>
          <TabsTrigger value="OWNERS_AGENT" className="text-sm px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">{t('inquiries.ownersAgent')}</TabsTrigger>
          <TabsTrigger value="OUT_OF_SCOPE" className="text-sm px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">{t('inquiries.outOfScope')}</TabsTrigger>
          <TabsTrigger value="INCOMPLETE" className="text-sm px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">{t('inquiries.incomplete')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Email List */}
            <Card className="card-premium lg:col-span-4 flex flex-col min-h-0 overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{t('common.email')}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{filteredEmails.length}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted/60 rounded-lg" onClick={fetchEmails}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                    <Input
                      placeholder={t('sentPdas.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setQueryAndUrl(e.target.value)}
                      className="pl-8 h-8 text-sm bg-muted/40 border-transparent focus:border-primary/30 rounded-lg"
                    />
                  </div>
                  <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                    <SelectTrigger className="h-8 w-[100px] text-xs bg-muted/40 border-transparent rounded-lg">
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
              <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  {loading ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{searchQuery || dateFilter !== 'all' ? t('common.noResultsFound') : t('common.noData')}</p>
                    </div>
                  ) : (
                    <div>
                      {filteredEmails.map((email) => (
                        <div
                          key={email.id}
                          onClick={() => {
                            setSelectedEmail(email);
                            setEmailIdInUrl(email.id);
                          }}
                          className={`px-4 py-3 cursor-pointer transition-all duration-75 border-b border-border/40 hover:bg-muted/40 ${
                            selectedEmail?.id === email.id
                              ? 'bg-primary/5 border-l-[3px] border-l-primary'
                              : 'border-l-[3px] border-l-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                              {email.company_name || email.contact_name || t('inquiries.noSubject')}
                            </p>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatTime(email.created_at)}</span>
                          </div>
                          {email.vessel_name && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Ship className="w-3 h-3 text-primary/60" />
                              <span className="text-xs font-medium text-foreground/80">{email.vessel_name}</span>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-1">{email.subject || t('inquiries.noSubject')}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge className={`${getStatusBadge(email.status)} text-[10px] px-1.5 py-0 h-5 border`} variant="secondary">
                              {getStatusIcon(email.status)}
                              <span className="ml-1">{email.status}</span>
                            </Badge>
                            {email.port && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />
                                {email.port}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Email Detail */}
            <div className="lg:col-span-8 space-y-4 min-w-0">
              {selectedEmail ? (
                <>
                  {/* Header & Meta */}
                  <Card className="card-premium overflow-hidden">
                    <CardHeader className="pb-3 pt-4 px-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <CardTitle className="text-base font-semibold leading-snug">{selectedEmail.subject || t('inquiries.noSubject')}</CardTitle>
                          <p className="text-sm text-muted-foreground">To: {selectedEmail.email_to_person}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg gap-1.5" onClick={() => setShowPreview(!showPreview)}>
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{showPreview ? t('inquiries.hideOriginal') : t('inquiries.showOriginal')}</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg">
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
                    <CardContent className="px-5 pb-5">
                      {/* Meta Info Chips */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                        {selectedEmail.company_name && (
                          <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.company')}</p>
                              <p className="text-sm font-medium truncate">{selectedEmail.company_name}</p>
                            </div>
                          </div>
                        )}
                        {selectedEmail.contact_name && (
                          <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.contact')}</p>
                              <p className="text-sm font-medium truncate">{selectedEmail.contact_name}</p>
                            </div>
                          </div>
                        )}
                        {selectedEmail.vessel_name && (
                          <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                              <Ship className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.vessel')} 1</p>
                              <p className="text-sm font-medium truncate">{selectedEmail.vessel_name}</p>
                              {selectedEmail.imo && <p className="text-[10px] text-muted-foreground">IMO: {selectedEmail.imo}</p>}
                            </div>
                          </div>
                        )}
                        {selectedEmail.vessel_2_name && (
                          <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                              <Ship className="w-4 h-4 text-secondary-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.vessel')} 2</p>
                              <p className="text-sm font-medium truncate">{selectedEmail.vessel_2_name}</p>
                              {selectedEmail.vessel_2_imo && <p className="text-[10px] text-muted-foreground">IMO: {selectedEmail.vessel_2_imo}</p>}
                            </div>
                          </div>
                        )}
                        {selectedEmail.port && (
                          <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                              <MapPin className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.port')}</p>
                              <p className="text-sm font-medium truncate">{selectedEmail.port}</p>
                            </div>
                          </div>
                        )}
                        {selectedEmail.eta && (
                          <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.eta')}</p>
                              <p className="text-sm font-medium">{selectedEmail.eta}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Links */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {selectedEmail.doc_link && (
                          <a href={selectedEmail.doc_link} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
                            <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 1
                          </a>
                        )}
                        {selectedEmail.dock_link_2 && (
                          <a href={selectedEmail.dock_link_2} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
                            <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 2
                          </a>
                        )}
                        {selectedEmail['Google sheet url'] && (
                          <a href={selectedEmail['Google sheet url']} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
                            <ExternalLink className="w-3 h-3" /> {t('inquiries.googleSheet')}
                          </a>
                        )}
                        {selectedEmail.pdf_url && (
                          <a href={selectedEmail.pdf_url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">
                            <ExternalLink className="w-3 h-3" /> {t('inquiries.pdf')}
                          </a>
                        )}
                      </div>

                      {/* Original Email — collapsible */}
                      {showPreview && (selectedEmail.original_email || selectedEmail.orignal_email) && (
                        <div className="rounded-lg border border-border/60 overflow-hidden">
                          <button
                            onClick={() => setShowOriginal(!showOriginal)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                          >
                            <span className="text-xs font-medium text-muted-foreground">{t('inquiries.originalEmail')}</span>
                            {showOriginal ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                          {showOriginal && (
                            <div className="px-4 py-3 max-h-60 overflow-y-auto">
                              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground/80">{selectedEmail.original_email || selectedEmail.orignal_email}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* PDF Attachments */}
                  <Card className="card-premium overflow-hidden">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold">{t('inquiries.pdfAttachments')}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{emailAttachments.length}</span>
                        </div>
                        <label className="cursor-pointer">
                          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" asChild disabled={uploadingPdf}>
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
                    <CardContent className="px-5 pb-4">
                      {emailAttachments.length === 0 ? (
                        <div
                          className={`text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                            isDragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById('pdf-upload-input')?.click()}
                        >
                          <FileText className={`w-6 h-6 mx-auto mb-2 ${isDragging ? 'text-primary' : 'opacity-40'}`} />
                          <p className="text-xs">{isDragging ? t('inquiries.dropToAdd') : t('inquiries.noPdfsYet')}</p>
                          <p className="text-xs mt-0.5 text-muted-foreground/60">{isDragging ? '' : t('inquiries.dropPdfs')}</p>
                        </div>
                      ) : (
                        <div
                          className={`rounded-lg transition-colors ${isDragging ? 'border-2 border-dashed border-primary bg-primary/5 p-2' : ''}`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {emailAttachments.map((attachment) => (
                              <div key={attachment.id} className="flex items-center justify-between p-2.5 bg-black/[0.02] rounded-xl border border-border/40">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                  <span className="text-sm truncate">{attachment.file_name}</span>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => handlePreviewPdf(attachment)}>
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-destructive" onClick={() => handleDeleteAttachment(attachment)}>
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          {isDragging && (
                            <div className="text-center py-2 text-xs text-primary mt-2">{t('inquiries.dropToAdd')}</div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* PDF Preview */}
                  {previewPdfUrl && (
                    <Card className="card-premium overflow-hidden">
                      <CardHeader className="pb-2 pt-3 px-5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{t('inquiries.pdfPreview')}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setPreviewPdfUrl(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 pb-4">
                        <iframe src={previewPdfUrl} className="w-full h-[400px] rounded-lg border border-border/60" />
                      </CardContent>
                    </Card>
                  )}

                  {/* Response Editor */}
                  <Card className="card-premium overflow-hidden">
                    <CardHeader className="pb-3 pt-4 px-5">
                      <span className="text-sm font-semibold">{t('inquiries.editResponse')}</span>
                    </CardHeader>
                    <CardContent className="space-y-4 px-5 pb-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="subject" className="text-xs font-medium text-muted-foreground">{t('inquiries.emailSubject')}</Label>
                        <Input
                          id="subject"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          placeholder={t('inquiries.emailSubject')}
                          className="h-10 rounded-lg bg-muted/20 border-border/60 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="body" className="text-xs font-medium text-muted-foreground">{t('inquiries.emailBody')}</Label>
                        <Textarea
                          id="body"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          placeholder={t('inquiries.emailBody')}
                          className="min-h-[180px] text-sm rounded-lg bg-muted/20 border-border/60 focus:bg-white leading-relaxed"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                          className="flex-1 h-11 text-sm font-semibold rounded-lg shadow-sm bg-primary hover:bg-primary/90"
                          onClick={() => handleUpdateStatus('approved')}
                          disabled={sending}
                        >
                          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          {t('inquiries.approveAndSend')}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 text-sm font-semibold rounded-lg sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
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
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-7 h-7 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">{t('inquiries.selectEmail')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Kies een email uit de lijst om te bekijken</p>
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
