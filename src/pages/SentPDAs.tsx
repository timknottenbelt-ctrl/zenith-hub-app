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
import { preloadGet } from '@/lib/preload';
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

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-600', 'bg-indigo-500', 'bg-teal-500',
];

function initials(name?: string | null) {
  if (!name) return '–';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name?: string | null) {
  const s = name || '?';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function dateBucket(dateStr: string | null): 'Vandaag' | 'Deze week' | 'Ouder' {
  if (!dateStr) return 'Ouder';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Vandaag';
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  if (d >= weekAgo) return 'Deze week';
  return 'Ouder';
}

const BUCKET_ORDER = ['Vandaag', 'Deze week', 'Ouder'] as const;

export default function SentPDAs() {
  const { t } = useLanguage();
  const [sentEmails, setSentEmails] = useState<Email[]>(() => preloadGet<Email[]>('sent:list') ?? []);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewName, setPdfPreviewName] = useState<string>('');
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

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

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let week = 0, month = 0, withDocs = 0;
    for (const e of sentEmails) {
      const d = e.sent_at ? new Date(e.sent_at) : null;
      if (d && d >= weekAgo) week++;
      if (d && d >= monthStart) month++;
      if (e.pdf_url || e.doc_link || e['Google sheet url']) withDocs++;
    }
    return { total: sentEmails.length, week, month, withDocs };
  }, [sentEmails]);

  const grouped = useMemo(() => {
    const map: Record<string, Email[]> = {};
    for (const e of filteredEmails) {
      const b = dateBucket(e.sent_at);
      (map[b] ??= []).push(e);
    }
    return BUCKET_ORDER.map((b) => [b, map[b] || []] as const).filter(([, arr]) => arr.length > 0);
  }, [filteredEmails]);

  async function fetchSentEmails() {
    setLoading(true);

    const { data, error } = await (supabase
      .from('email')
      .select('*') as any)
      .eq('archived', false)
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
        {/* Stats strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('sentPdas.total'), value: stats.total, icon: CheckCircle, tint: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
            { label: t('sentPdas.thisWeek'), value: stats.week, icon: Calendar, tint: 'text-primary', bg: 'bg-primary/8' },
            { label: t('sentPdas.thisMonth'), value: stats.month, icon: Mail, tint: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10' },
            { label: t('sentPdas.withDocs'), value: stats.withDocs, icon: FileText, tint: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
          ].map((s) => (
            <Card key={s.label} className="card-premium">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.tint}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums leading-none">{loading ? '–' : s.value}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mt-1 truncate">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg hover:bg-muted/60" onClick={fetchSentEmails}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content — grouped list + detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Sent Email List */}
          <Card className="card-premium lg:col-span-4 flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="pb-3 pt-4 px-4 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-foreground">{t('sentPdas.title')}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md tabular-nums">{filteredEmails.length}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-[calc(100dvh-360px)] lg:h-[calc(100dvh-320px)]">
                {loading && filteredEmails.length === 0 ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                        <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-muted rounded w-2/3" />
                          <div className="h-2.5 bg-muted/60 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="text-center p-12 text-muted-foreground">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('sentPdas.noSentPdas')}</p>
                  </div>
                ) : (
                  <div className="pb-2">
                    {grouped.map(([bucket, items]) => (
                      <div key={bucket}>
                        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-4 py-1.5 border-b border-border/40">
                          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">
                            {bucket} · {items.length}
                          </span>
                        </div>
                        {items.map((email) => {
                          const name = email.company_name || email.contact_name || email.vessel_name || '—';
                          const active = selectedEmail?.id === email.id;
                          return (
                            <button
                              key={email.id}
                              onClick={() => setSelectedEmail(email)}
                              className={`w-full text-left px-4 py-3 cursor-pointer transition-all duration-75 border-b border-border/40 hover:bg-muted/40 flex gap-3 ${
                                active ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-l-[3px] border-l-emerald-500' : 'border-l-[3px] border-l-transparent'
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-full ${avatarColor(name)} flex items-center justify-center shrink-0 text-white text-[11px] font-bold`}>
                                {initials(name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-foreground leading-snug truncate">{name}</p>
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                                    {email.sent_at ? formatTime(email.sent_at) : ''}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{email.subject || t('inquiries.noSubject')}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  {email.vessel_name && (
                                    <span className="text-[10px] font-medium text-foreground/70 bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <Ship className="w-2.5 h-2.5 text-primary/60" />
                                      {email.vessel_name}
                                    </span>
                                  )}
                                  {email.port && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <MapPin className="w-2.5 h-2.5" />
                                      {email.port}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
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
                  <p className="text-xs text-muted-foreground/60 mt-1">{t('sentPdas.pickFromList')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
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
              <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
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
              <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
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
              <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
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
              <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
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
              <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
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
              <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
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
              <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
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
                    className="flex items-center gap-2 px-3 py-2 bg-black/[0.02] rounded-xl border border-border/40"
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
            <div className="p-3 bg-black/[0.02] rounded-xl text-sm border border-border/40">
              {email.subject || t('inquiries.noSubject')}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">{t('inquiries.emailBody')}</Label>
            <div className="p-4 bg-black/[0.02] rounded-xl text-sm font-sans leading-relaxed whitespace-pre-wrap border border-border/40">
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-black/[0.02] rounded-xl">
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
        <div className="p-4 bg-black/[0.02] rounded-xl border border-border/60">
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
              <div key={attachment.id} className="flex items-center gap-2 px-3 py-2 bg-black/[0.02] rounded-xl border border-border/40">
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
          <div className="p-3 bg-black/[0.02] rounded-xl text-sm border border-border/40">
            {email.subject || t('inquiries.noSubject')}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">{t('inquiries.emailBody')}</Label>
          <div className="p-4 bg-black/[0.02] rounded-xl text-sm font-sans leading-relaxed whitespace-pre-wrap border border-border/40">
            {email.body || t('common.noData')}
          </div>
        </div>
      </div>
    </div>
  );
}
