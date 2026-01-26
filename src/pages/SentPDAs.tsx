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

  // Filter emails based on search and date
  const filteredEmails = useMemo(() => {
    let filtered = sentEmails;

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

  return (
    <DashboardLayout title={t('sentPdas.title')}>
      <div className="space-y-4">
        {/* Search and Filter Bar */}
        <Card className="card-premium">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('sentPdas.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex gap-2 items-center">
                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('sentPdas.all')}</SelectItem>
                    <SelectItem value="thisWeek">{t('sentPdas.thisWeek')}</SelectItem>
                    <SelectItem value="thisMonth">{t('sentPdas.thisMonth')}</SelectItem>
                    <SelectItem value="older">{t('sentPdas.older')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-9 px-2 rounded-r-none"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-9 px-2 rounded-l-none"
                    onClick={() => setViewMode('table')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={fetchSentEmails}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        {viewMode === 'table' ? (
          /* Table View */
          <Card className="card-premium">
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100dvh-260px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('inquiries.subject')}</TableHead>
                      <TableHead>{t('inquiries.vessel')}</TableHead>
                      <TableHead>{t('inquiries.port')}</TableHead>
                      <TableHead>{t('inquiries.toEmail')}</TableHead>
                      <TableHead>{t('sentPdas.sentOn')}</TableHead>
                      <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : filteredEmails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">{t('sentPdas.noSentPdas')}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmails.map((email) => (
                        <TableRow 
                          key={email.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <TableCell className="font-medium max-w-[250px] truncate">
                            {email.subject || t('inquiries.noSubject')}
                          </TableCell>
                          <TableCell>
                            {email.vessel_name && (
                              <span className="flex items-center gap-1">
                                <Ship className="w-3 h-3" />
                                {email.vessel_name}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{email.port || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{email.email_to_person}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(email.sent_at)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
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
          /* List View - Original Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Sent Email List */}
            <Card className="card-premium lg:col-span-1 flex flex-col min-h-0">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    {t('sentPdas.title')} ({filteredEmails.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <ScrollArea className="h-[calc(100dvh-300px)]">
                  {loading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">{t('sentPdas.noSentPdas')}</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredEmails.map((email) => (
                        <div
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className={`p-3 cursor-pointer transition-all hover:bg-muted/50 ${
                            selectedEmail?.id === email.id ? 'bg-success/5 border-l-2 border-success' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium line-clamp-2">{email.subject || t('inquiries.noSubject')}</p>
                            <Badge className="bg-success/10 text-success text-xs shrink-0" variant="secondary">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {t('overview.sent')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{email.email_to_person}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            {email.vessel_name && (
                              <span className="flex items-center gap-1">
                                <Ship className="w-3 h-3" />
                                {email.vessel_name}
                              </span>
                            )}
                            {email.sent_at && (
                              <span>{t('sentPdas.sentOn')}: {formatDate(email.sent_at)}</span>
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
            <div className="lg:col-span-2 space-y-4">
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
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">{t('sentPdas.selectToView')}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={!!pdfPreviewUrl} onOpenChange={(open) => !open && closePdfPreview()}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4" />
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
                className="w-full h-full rounded-lg border"
                title={pdfPreviewName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Detail Dialog for Table View */}
      {viewMode === 'table' && selectedEmail && (
        <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedEmail.subject || t('inquiries.noSubject')}</DialogTitle>
              <DialogDescription>{selectedEmail.email_to_person}</DialogDescription>
            </DialogHeader>
            <EmailDetailContent 
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

// Extracted Email Detail View Component
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
  return (
    <>
      <Card className="card-premium">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-base font-semibold">{email.subject || t('inquiries.noSubject')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('inquiries.toEmail')}: {email.email_to_person}</p>
            </div>
            <Badge className="bg-success/10 text-success shrink-0" variant="secondary">
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('overview.sent')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <EmailDetailContent 
            email={email}
            attachments={attachments}
            onViewPdf={onViewPdf}
            onDownloadPdf={onDownloadPdf}
            t={t}
          />
        </CardContent>
      </Card>

      {/* Email Content - Full Display */}
      <Card className="card-premium">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('sentPdas.emailContent')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('inquiries.emailSubject')}</Label>
            <div className="p-3 bg-muted/30 rounded-lg text-sm">
              {email.subject || t('inquiries.noSubject')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('inquiries.emailBody')}</Label>
            <ScrollArea className="max-h-[400px]">
              <div className="p-4 bg-muted/30 rounded-lg text-sm font-sans leading-relaxed whitespace-pre-wrap">
                {email.body || t('common.noData')}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Shared Email Detail Content Component
function EmailDetailContent({ 
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
  return (
    <>
      {/* Quick Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg mb-4">
        {email.vessel_name && (
          <div className="flex items-center gap-2">
            <Ship className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('inquiries.vessel')}</p>
              <p className="text-sm font-medium">{email.vessel_name}</p>
            </div>
          </div>
        )}
        {email.port && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('inquiries.port')}</p>
              <p className="text-sm font-medium">{email.port}</p>
            </div>
          </div>
        )}
        {email.eta && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t('inquiries.eta')}</p>
              <p className="text-sm font-medium">{email.eta}</p>
            </div>
          </div>
        )}
        {email.sent_at && (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">{t('sentPdas.sentOn')}</p>
              <p className="text-sm font-medium">{new Date(email.sent_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-2 mb-4">
        {email.doc_link && (
          <a href={email.doc_link} target="_blank" rel="noopener noreferrer" 
             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
            <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 1
          </a>
        )}
        {email.dock_link_2 && (
          <a href={email.dock_link_2} target="_blank" rel="noopener noreferrer" 
             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
            <ExternalLink className="w-3 h-3" /> {t('inquiries.docLink')} 2
          </a>
        )}
        {email['Google sheet url'] && (
          <a href={email['Google sheet url']} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors">
            <ExternalLink className="w-3 h-3" /> {t('inquiries.googleSheet')}
          </a>
        )}
        {email.pdf_url && (
          <a href={email.pdf_url} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-warning/10 text-warning rounded-lg hover:bg-warning/20 transition-colors">
            <ExternalLink className="w-3 h-3" /> {t('inquiries.pdf')}
          </a>
        )}
      </div>

      {/* PDF Attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            {t('sentPdas.pdfAttachments')} ({attachments.length})
          </Label>
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border"
              >
                <FileText className="w-4 h-4 text-destructive" />
                <span className="text-xs truncate max-w-[180px]">{attachment.file_name}</span>
                <div className="flex items-center gap-1 ml-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onViewPdf(attachment)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onDownloadPdf(attachment)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
