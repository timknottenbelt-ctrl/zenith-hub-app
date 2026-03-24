import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';
import {
  RefreshCw,
  Mail,
  CheckCircle,
  Loader2,
  ExternalLink,
  Ship,
  MapPin,
  Calendar,
  FileText,
  Download,
  Eye,
  Search,
  List,
  LayoutGrid,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type Email = Tables<'email'>;

interface EmailAttachment {
  id: string;
  email_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

type DateFilter = 'all' | 'thisWeek' | 'thisMonth' | 'older';
type ViewMode = 'list' | 'table';

export default function SentPDAs() {
  const { t } = useLanguage();
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewName, setPdfPreviewName] = useState<string>('');
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    fetchSentEmails();
  }, []);

  useEffect(() => {
    if (selectedEmail) {
      fetchEmailAttachments(selectedEmail.id);
    } else {
      setEmailAttachments([]);
    }
  }, [selectedEmail]);

  const filteredEmails = useMemo(() => {
    let filtered = sentEmails;

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
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      filtered = filtered.filter(email => {
        if (!email.sent_at) return false;
        const sentDate = new Date(email.sent_at);

        switch (dateFilter) {
          case 'thisWeek':
            return sentDate >= startOfWeek;
          case 'thisMonth':
            return sentDate >= startOfMonth && sentDate < startOfWeek;
          case 'older':
            return sentDate < startOfMonth;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [sentEmails, searchQuery, dateFilter]);

  async function fetchSentEmails() {
    setLoading(true);

    const { data, error } = await supabase
      .from('email')
      .select('*')
      .in('status', ['approved', 'sent'])
      .order('sent_at', { ascending: false });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setSentEmails(data || []);
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

  async function handleViewPdf(attachment: EmailAttachment) {
    setLoadingPdf(true);
    setPdfPreviewName(attachment.file_name);

    try {
      const { data } = await supabase.storage
        .from('pdfs')
        .download(attachment.file_path);

      if (data) {
        const blobUrl = URL.createObjectURL(data);
        setPdfPreviewUrl(blobUrl);
      }
    } catch (error: any) {
      toast({ title: t('common.error'), description: t('common.error_occurred'), variant: 'destructive' });
    }

    setLoadingPdf(false);
  }

  async function handleDownloadPdf(attachment: EmailAttachment) {
    try {
      const { data } = await supabase.storage
        .from('pdfs')
        .download(attachment.file_path);

      if (data) {
        const blobUrl = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = attachment.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (error: any) {
      toast({ title: t('common.error'), description: t('common.error_occurred'), variant: 'destructive' });
    }
  }

  function closePdfPreview() {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setPdfPreviewUrl(null);
    setPdfPreviewName('');
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
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
    <DashboardLayout title={t('sentPdas.title')}>
      <div className="space-y-5">
        {/* Search and Filter Bar */}
        <Card className="card-premium overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  placeholder={t('sentPdas.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/40 border-transparent hover:border-border focus:border-primary/30 rounded-lg"
                />
              </div>
              <div className="flex gap-2 items-center">
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                  <SelectTrigger className="w-[140px] h-9 rounded-lg bg-muted/40 border-transparent text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('sentPdas.all')}</SelectItem>
                    <SelectItem value="thisWeek">{t('sentPdas.thisWeek')}</SelectItem>
                    <SelectItem value="thisMonth">{t('sentPdas.thisMonth')}</SelectItem>
                    <SelectItem value="older">{t('sentPdas.older')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border border-border/60 rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-9 px-2.5 rounded-none"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-9 px-2.5 rounded-none"
                    onClick={() => setViewMode('table')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg hover:bg-muted/60" onClick={fetchSentEmails}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        {viewMode === 'table' ? (
          <Card className="card-premium overflow-hidden">
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100dvh-260px)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">{t('inquiries.subject')}</TableHead>
                      <TableHead className="text-xs font-semibold">{t('inquiries.vessel')}</TableHead>
                      <TableHead className="text-xs font-semibold">{t('inquiries.port')}</TableHead>
                      <TableHead className="text-xs font-semibold">{t('inquiries.toEmail')}</TableHead>
                      <TableHead className="text-xs font-semibold">{t('sentPdas.sentOn')}</TableHead>
                      <TableHead className="w-[80px] text-xs font-semibold">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : filteredEmails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">{t('sentPdas.noSentPdas')}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmails.map((email) => (
                        <TableRow
                          key={email.id}
                          className="cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <TableCell className="font-medium max-w-[250px] truncate text-sm">
                            {email.subject || t('inquiries.noSubject')}
                          </TableCell>
                          <TableCell>
                            {email.vessel_name && (
                              <span className="flex items-center gap-1.5 text-sm">
                                <Ship className="w-3.5 h-3.5 text-primary/60" />
                                {email.vessel_name}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{email.port || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{email.email_to_person}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(email.sent_at)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmail(email);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Sent Email List */}
            <Card className="card-premium lg:col-span-4 flex flex-col min-h-0 overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-foreground">{t('sentPdas.title')}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{filteredEmails.length}</span>
                  </div>
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
                      <p className="text-sm">{t('sentPdas.noSentPdas')}</p>
                    </div>
                  ) : (
                    <div>
                      {filteredEmails.map((email) => (
                        <div
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className={`px-4 py-3 cursor-pointer transition-all duration-75 border-b border-border/40 hover:bg-muted/40 ${
                            selectedEmail?.id === email.id
                              ? 'bg-emerald-50/50 border-l-[3px] border-l-emerald-500'
                              : 'border-l-[3px] border-l-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                              {email.company_name || email.contact_name || t('inquiries.noSubject')}
                            </p>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {email.sent_at ? formatTime(email.sent_at) : ''}
                            </span>
                          </div>
                          {email.vessel_name && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Ship className="w-3 h-3 text-primary/60" />
                              <span className="text-xs font-medium text-foreground/80">{email.vessel_name}</span>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-1">{email.subject || t('inquiries.noSubject')}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5 border" variant="secondary">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {t('overview.sent')}
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

            {/* Selected Email Detail */}
            <div className="lg:col-span-8 space-y-4 min-w-0">
              {selectedEmail ? (
                <EmailDetailView
                  email={selectedEmail}
                  attachments={emailAttachments}
                  onViewPdf={handleViewPdf}
                  onDownloadPdf={handleDownloadPdf}
                  t={t}
                />
              ) : (
                <Card className="card-premium h-[calc(100vh-340px)] flex items-center justify-center">
                  <CardContent className="text-center text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-7 h-7 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">{t('sentPdas.selectToView')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Kies een email uit de lijst</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={!!pdfPreviewUrl} onOpenChange={(open) => !open && closePdfPreview()}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 rounded-xl">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-red-500" />
              {pdfPreviewName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('sentPdas.viewPdf')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4">
            {loadingPdf ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full rounded-lg border border-border/60"
                title={pdfPreviewName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Detail Dialog for Table View */}
      {viewMode === 'table' && selectedEmail && (
        <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
            <DialogHeader>
              <DialogTitle>{selectedEmail.subject || t('inquiries.noSubject')}</DialogTitle>
              <DialogDescription>{selectedEmail.email_to_person}</DialogDescription>
            </DialogHeader>
            <EmailDialogContent
              email={selectedEmail}
              attachments={emailAttachments}
              onViewPdf={handleViewPdf}
              onDownloadPdf={handleDownloadPdf}
              t={t}
            />
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

function EmailDetailView({
  email,
  attachments,
  onViewPdf,
  onDownloadPdf,
  t
}: {
  email: Email;
  attachments: EmailAttachment[];
  onViewPdf: (attachment: EmailAttachment) => void;
  onDownloadPdf: (attachment: EmailAttachment) => void;
  t: (key: string) => string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalExpanded, setOriginalExpanded] = useState(false);

  return (
    <>
      <Card className="card-premium overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-base font-semibold leading-snug">{email.subject || t('inquiries.noSubject')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('inquiries.toEmail')}: {email.email_to_person}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(email.original_email || email.orignal_email) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs rounded-lg gap-1.5"
                  onClick={() => setShowOriginal(!showOriginal)}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showOriginal ? t('inquiries.hideOriginal') : t('inquiries.showOriginal')}
                </Button>
              )}
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border" variant="secondary">
                <CheckCircle className="w-3 h-3 mr-1" />
                {t('overview.sent')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {/* Meta Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {email.company_name && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.company')}</p>
                  <p className="text-sm font-medium truncate">{email.company_name}</p>
                </div>
              </div>
            )}
            {email.contact_name && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.contact')}</p>
                  <p className="text-sm font-medium truncate">{email.contact_name}</p>
                </div>
              </div>
            )}
            {email.vessel_name && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <Ship className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.vessel')} 1</p>
                  <p className="text-sm font-medium truncate">{email.vessel_name}</p>
                  {email.imo && <p className="text-[10px] text-muted-foreground">IMO: {email.imo}</p>}
                </div>
              </div>
            )}
            {email.vessel_2_name && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                  <Ship className="w-4 h-4 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.vessel')} 2</p>
                  <p className="text-sm font-medium truncate">{email.vessel_2_name}</p>
                  {email.vessel_2_imo && <p className="text-[10px] text-muted-foreground">IMO: {email.vessel_2_imo}</p>}
                </div>
              </div>
            )}
            {email.port && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.port')}</p>
                  <p className="text-sm font-medium truncate">{email.port}</p>
                </div>
              </div>
            )}
            {email.eta && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.eta')}</p>
                  <p className="text-sm font-medium">{email.eta}</p>
                </div>
              </div>
            )}
            {email.sent_at && (
              <div className="flex items-center gap-2.5 p-3 bg-muted/30 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('sentPdas.sentOn')}</p>
                  <p className="text-sm font-medium">{new Date(email.sent_at).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-2 mb-4">
            {email.doc_link && (
              <a href={email.doc_link} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
                <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 1
              </a>
            )}
            {email.dock_link_2 && (
              <a href={email.dock_link_2} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
                <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 2
              </a>
            )}
            {email['Google sheet url'] && (
              <a href={email['Google sheet url']} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
                <ExternalLink className="w-3 h-3" /> {t('inquiries.googleSheet')}
              </a>
            )}
            {email.pdf_url && (
              <a href={email.pdf_url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">
                <ExternalLink className="w-3 h-3" /> {t('inquiries.pdf')}
              </a>
            )}
          </div>

          {/* Original Email */}
          {showOriginal && (email.original_email || email.orignal_email) && (
            <div className="rounded-lg border border-border/60 overflow-hidden mb-4">
              <button
                onClick={() => setOriginalExpanded(!originalExpanded)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-xs font-medium text-muted-foreground">{t('inquiries.originalEmail')}</span>
                {originalExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {originalExpanded && (
                <div className="px-4 py-3 max-h-60 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground/80">{email.original_email || email.orignal_email}</pre>
                </div>
              )}
            </div>
          )}

          {/* PDF Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{t('sentPdas.pdfAttachments')} ({attachments.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border/40"
                  >
                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs truncate max-w-[180px]">{attachment.file_name}</span>
                    <div className="flex items-center gap-0.5 ml-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md" onClick={() => onViewPdf(attachment)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md" onClick={() => onDownloadPdf(attachment)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Generated Email Content */}
      <Card className="card-premium overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{t('sentPdas.emailContent')}</span>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">{t('inquiries.emailSubject')}</Label>
            <div className="p-3 bg-muted/20 rounded-lg text-sm border border-border/40">
              {email.subject || t('inquiries.noSubject')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">{t('inquiries.emailBody')}</Label>
            <div className="p-4 bg-muted/20 rounded-lg text-sm font-sans leading-relaxed whitespace-pre-wrap border border-border/40">
              {email.body || t('common.noData')}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function EmailDialogContent({
  email,
  attachments,
  onViewPdf,
  onDownloadPdf,
  t
}: {
  email: Email;
  attachments: EmailAttachment[];
  onViewPdf: (attachment: EmailAttachment) => void;
  onDownloadPdf: (attachment: EmailAttachment) => void;
  t: (key: string) => string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className="space-y-4">
      {(email.original_email || email.orignal_email) && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs rounded-lg gap-1.5"
            onClick={() => setShowOriginal(!showOriginal)}
          >
            <Eye className="w-3.5 h-3.5" />
            {showOriginal ? t('inquiries.hideOriginal') : t('inquiries.showOriginal')}
          </Button>
        </div>
      )}

      {/* Quick Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-muted/20 rounded-lg">
        {email.company_name && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.company')}</p>
              <p className="text-sm font-medium truncate">{email.company_name}</p>
            </div>
          </div>
        )}
        {email.contact_name && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.contact')}</p>
              <p className="text-sm font-medium truncate">{email.contact_name}</p>
            </div>
          </div>
        )}
        {email.vessel_name && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
              <Ship className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.vessel')} 1</p>
              <p className="text-sm font-medium truncate">{email.vessel_name}</p>
              {email.imo && <p className="text-[10px] text-muted-foreground">IMO: {email.imo}</p>}
            </div>
          </div>
        )}
        {email.vessel_2_name && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
              <Ship className="w-4 h-4 text-secondary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.vessel')} 2</p>
              <p className="text-sm font-medium truncate">{email.vessel_2_name}</p>
              {email.vessel_2_imo && <p className="text-[10px] text-muted-foreground">IMO: {email.vessel_2_imo}</p>}
            </div>
          </div>
        )}
        {email.port && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('inquiries.port')}</p>
              <p className="text-sm font-medium truncate">{email.port}</p>
            </div>
          </div>
        )}
        {email.sent_at && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{t('sentPdas.sentOn')}</p>
              <p className="text-sm font-medium">{new Date(email.sent_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {email.doc_link && (
          <a href={email.doc_link} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
            <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 1
          </a>
        )}
        {email.dock_link_2 && (
          <a href={email.dock_link_2} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
            <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 2
          </a>
        )}
      </div>

      {/* Original Email */}
      {showOriginal && (email.original_email || email.orignal_email) && (
        <div className="p-4 bg-muted/20 rounded-lg border border-border/60">
          <p className="text-xs font-medium mb-2 text-muted-foreground">{t('inquiries.originalEmail')}:</p>
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground/80 max-h-60 overflow-y-auto">{email.original_email || email.orignal_email}</pre>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t('sentPdas.pdfAttachments')} ({attachments.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border/40">
                <FileText className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-xs truncate max-w-[180px]">{attachment.file_name}</span>
                <div className="flex items-center gap-0.5 ml-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md" onClick={() => onViewPdf(attachment)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md" onClick={() => onDownloadPdf(attachment)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Content */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">{t('inquiries.emailSubject')}</Label>
          <div className="p-3 bg-muted/20 rounded-lg text-sm border border-border/40">
            {email.subject || t('inquiries.noSubject')}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">{t('inquiries.emailBody')}</Label>
          <div className="p-4 bg-muted/20 rounded-lg text-sm font-sans leading-relaxed whitespace-pre-wrap border border-border/40">
            {email.body || t('common.noData')}
          </div>
        </div>
      </div>
    </div>
  );
}
