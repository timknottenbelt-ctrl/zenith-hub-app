import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  FileSpreadsheet,
  X,
  PlusCircle,
  Trash2,
  Building2,
  User,
  Search,
  Sparkles,
  ArrowLeftRight,
  Copy,
  Check,
  Send,
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
import { preloadGet } from '@/lib/preload';
import { InquiryDAPanel } from '@/components/inquiries/InquiryDAPanel';

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
  // The classifier writes cargo inquiries as 'LOADING_DISCHARGE_AGENT' — that is
  // the Cargo Agent category. (Without it this tab showed 0 messages.)
  'CARGO_AGENT': ['CARGO AGENT', 'CARGO_AGENT', 'CARGO AGENT 2', 'LOADING_DISCHARGE_AGENT', 'LOADING DISCHARGE AGENT'],
  'OWNERS_AGENT': ['OWNERS_AGENT', 'OWNERS AGENT'],
  'OUT_OF_SCOPE': ['OUT_OF_SCOPE', 'Out of Scope', 'REFERRAL', 'OUT OF SCOPE'],
  'INCOMPLETE': ['INCOMPLETE'], // special: filters by status instead of Email Type
};

// Light column set for the list query — never pull the big body/original_email
// HTML for hundreds of rows (that made the page slow). Full row is fetched on click.
const LIST_COLS =
  'id, subject, company_name, contact_name, vessel_name, port, status, created_at, email_to_person, missing_information, "Email Type", classification_confidence';

// Canonical category each tab moves an email *into* (writes to the "Email Type" column).
const MOVE_TARGETS = [
  { key: 'LOADING_DISCHARGE_AGENT', tab: 'CARGO_AGENT' },
  { key: 'OWNERS_AGENT', tab: 'OWNERS_AGENT' },
  { key: 'OUT_OF_SCOPE', tab: 'OUT_OF_SCOPE' },
] as const;

export default function AIInquiries() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('CARGO_AGENT');
  // Seed from the login preload cache so the default tab paints instantly.
  const [emails, setEmails] = useState<Email[]>(() => preloadGet<Email[]>('inq:CARGO_AGENT') ?? []);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [moving, setMoving] = useState(false);
  const [composing, setComposing] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form state for editing the AI draft
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyDraft() {
    const text = [editSubject ? `Subject: ${editSubject}` : '', editBody].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [counts, setCounts] = useState<Record<string, number>>({});

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
      selectEmail(id);
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
          case 'today': return createdDate >= startOfToday;
          case 'thisWeek': return createdDate >= startOfWeek && createdDate < startOfToday;
          case 'older': return createdDate < startOfWeek;
          default: return true;
        }
      });
    }

    return filtered;
  }, [emails, searchQuery, dateFilter]);

  function getAttachmentKind(fileName: string): 'pdf' | 'excel' | 'word' | 'csv' | 'text' | 'other' {
    const ext = fileName.toLowerCase().split('.').pop() ?? '';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'xlsx' || ext === 'xls') return 'excel';
    if (ext === 'docx' || ext === 'doc') return 'word';
    if (ext === 'csv') return 'csv';
    if (ext === 'txt') return 'text';
    return 'other';
  }

  async function handlePreviewAttachment(attachment: EmailAttachment) {
    const { data } = await supabase.storage
      .from('pdfs')
      .createSignedUrl(attachment.file_path, 3600);

    if (!data?.signedUrl) {
      toast({ title: t('common.error'), description: t('common.error_occurred'), variant: 'destructive' });
      return;
    }

    const kind = getAttachmentKind(attachment.file_name);
    if (kind === 'pdf' || kind === 'text') {
      setPreviewPdfUrl(data.signedUrl);
    } else {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }
  }

  useEffect(() => {
    fetchEmails();
  }, [activeTab]);

  useEffect(() => {
    if (selectedEmail) {
      setEditSubject(selectedEmail.subject || '');
      // Only load `body` as the editable draft if it's a REAL AI reply — not raw
      // Outlook HTML and not just a copy of the original email.
      setEditBody(isRealAiReply(selectedEmail) ? (selectedEmail.body || '') : '');
      fetchEmailAttachments(selectedEmail.id);
      setPreviewPdfUrl(null);
    } else {
      setEmailAttachments([]);
    }
  }, [selectedEmail]);

  async function fetchEmails() {
    setLoading(true);

    let query = supabase.from('email').select(LIST_COLS);

    // Never show archived rows (out-of-scope + non-inquiry thread noise).
    query = (query as any).eq('archived', false);

    // Exclude sent/approved emails from all tabs - they belong in Sent PDAs
    query = query.not('status', 'in', '("approved","sent")');

    if (activeTab === 'INCOMPLETE') {
      query = query.not('missing_information', 'is', null);
    } else if (activeTab === 'OUT_OF_SCOPE') {
      // Out of Scope = anything the system flagged out_of_scope (regardless of the
      // AI's category guess) OR explicitly typed as out-of-scope. This catches the
      // rows whose status is out_of_scope but whose Email Type still says OWNERS_AGENT.
      query = query.or('status.eq.out_of_scope,"Email Type".in.("OUT_OF_SCOPE","Out of Scope","REFERRAL","OUT OF SCOPE")');
    } else {
      // Service tabs (Cargo/Owners): match the category BUT never show rows the
      // system already flagged out_of_scope — that was the leak into Owners Agent.
      const emailTypes = EMAIL_TYPE_MAP[activeTab];
      query = query.in('Email Type', emailTypes).neq('status', 'out_of_scope');
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(300);

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setEmails((data || []) as unknown as Email[]);
    }
    setLoading(false);
    fetchCounts();
  }

  // Fetch the FULL row (body, original_email, links…) only when an email is opened.
  async function selectEmail(emailId: number) {
    setEmailIdInUrl(emailId);
    const { data } = await supabase.from('email').select('*').eq('id', emailId).single();
    if (data) setSelectedEmail(data as Email);
  }

  // Per-tab counts for the tab badges (kept in sync after every fetch/action).
  async function fetchCounts() {
    const base = () =>
      (supabase.from('email').select('*', { count: 'exact', head: true }) as any)
        .eq('archived', false)
        .not('status', 'in', '("approved","sent")');
    const [cargo, owners, incomplete] = await Promise.all([
      base().in('Email Type', EMAIL_TYPE_MAP['CARGO_AGENT']).neq('status', 'out_of_scope'),
      base().in('Email Type', EMAIL_TYPE_MAP['OWNERS_AGENT']).neq('status', 'out_of_scope'),
      base().not('missing_information', 'is', null),
    ]);
    setCounts({
      CARGO_AGENT: cargo.count ?? 0,
      OWNERS_AGENT: owners.count ?? 0,
      OUT_OF_SCOPE: 0,
      INCOMPLETE: incomplete.count ?? 0,
    });
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
      const { error: uploadError } = await supabase.storage.from('pdfs').upload(filePath, file);
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

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFiles(files);
  }

  async function handleDeleteAttachment(attachment: EmailAttachment) {
    await supabase.storage.from('pdfs').remove([attachment.file_path]);
    await supabase.from('email_attachments').delete().eq('id', attachment.id);
    if (selectedEmail) await fetchEmailAttachments(selectedEmail.id);
    toast({ title: t('common.success'), description: t('inquiries.attachmentDeleted') });
  }

  const getWebhookUrl = (emailType: string | null): string | null => {
    if (!emailType) return null;
    const tt = emailType.toUpperCase().replace(/[\s-]+/g, '_');
    if (['CARGO_AGENT', 'CARGO_AGENT_2', 'LOADING_DISCHARGE_AGENT'].includes(tt)) {
      return WEBHOOKS.SEND_EMAIL_LOADING_DISCHARGE;
    }
    if (tt === 'OWNERS_AGENT') return WEBHOOKS.SEND_EMAIL_OWNERS_AGENT;
    if (['OUT_OF_SCOPE', 'REFERRAL'].includes(tt)) return WEBHOOKS.SEND_REFERRAL_EMAIL;
    return null;
  };

  // Manually move an email into another category (fixes mis-classifications).
  async function handleMoveCategory(target: string) {
    if (!selectedEmail || target === categoryKey(selectedEmail['Email Type'])) return;
    setMoving(true);
    const { error } = await supabase
      .from('email')
      .update({ 'Email Type': target })
      .eq('id', selectedEmail.id);
    setMoving(false);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      return;
    }
    const label = categoryLabel(target);
    toast({ title: t('inquiries.moved'), description: label });
    setSelectedEmail(null);
    setEmailIdInUrl(null);
    fetchEmails();
  }

  // Generate (or regenerate) a clean, well-formatted AI reply for the open email.
  async function handleCompose() {
    if (!selectedEmail) return;
    setComposing(true);
    try {
      const { data, error } = await supabase.functions.invoke('compose-reply', {
        body: { email_id: selectedEmail.id },
      });
      if (error) throw error;
      if (data?.email) {
        setSelectedEmail(data.email as Email);
        toast({ title: t('common.success'), description: t('inquiries.replyGenerated') });
        fetchEmails();
      } else {
        throw new Error(data?.error || 'compose failed');
      }
    } catch (e: any) {
      toast({ title: t('common.error'), description: e.message || t('common.error_occurred'), variant: 'destructive' });
    } finally {
      setComposing(false);
    }
  }

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
              attachmentUrls.push({ file_name: attachment.file_name, url: signedUrlData.signedUrl });
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

          const response = await webhookPostJSON(webhookUrl, payload);
          if (!response.ok) throw new Error(`Webhook failed: ${response.statusText}`);
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
      draft: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      out_of_scope: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      sent: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
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
    if (vesselDeleteError) console.warn('Could not delete vessel_pda_data', vesselDeleteError);

    if (emailAttachments.length) {
      const paths = emailAttachments.map((a) => a.file_path);
      const { error: storageError } = await supabase.storage.from('pdfs').remove(paths);
      if (storageError) console.warn('Could not remove attachment files', storageError);
      const { error: attachmentsError } = await supabase.from('email_attachments').delete().eq('email_id', selectedEmail.id);
      if (attachmentsError) console.warn('Could not delete attachment records', attachmentsError);
    }

    const { error } = await supabase.from('email').delete().eq('id', selectedEmail.id);
    if (error) {
      toast({ title: t('common.error'), description: error.message || t('common.error_occurred'), variant: 'destructive' });
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
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const originalText = selectedEmail
    ? prettifyOriginal(selectedEmail.original_email || selectedEmail.orignal_email || '')
    : '';
  const confidence = selectedEmail ? (selectedEmail as any).classification_confidence as number | null : null;
  const reasoning = selectedEmail ? (selectedEmail as any).classification_reasoning as string | null : null;
  const currentCategory = selectedEmail ? categoryKey(selectedEmail['Email Type']) : null;
  const hasAiReply = selectedEmail ? isRealAiReply(selectedEmail) : false;

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
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedEmail(null); }} className="space-y-5">
        <TabsList className="bg-card/60 backdrop-blur-sm p-1 h-auto inline-flex flex-wrap gap-1 rounded-xl" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {([
            ['CARGO_AGENT', t('inquiries.cargoAgent')],
            ['OWNERS_AGENT', t('inquiries.ownersAgent')],
            ['INCOMPLETE', t('inquiries.incomplete')],
          ] as const).map(([key, label]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="text-sm px-3.5 py-2 rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              {label}
              <span className={`min-w-[20px] text-center text-[11px] font-semibold px-1.5 py-0 rounded-full transition-colors ${
                activeTab === key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {counts[key] ?? '·'}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* ── Email List ── */}
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
                  {loading && filteredEmails.length === 0 ? (
                    <div className="divide-y divide-border/40">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="px-3 py-2.5 flex gap-3 animate-pulse">
                          <div className="w-9 h-9 rounded-xl bg-muted shrink-0" />
                          <div className="flex-1 space-y-2 py-0.5">
                            <div className="h-3 bg-muted rounded w-2/3" />
                            <div className="h-2.5 bg-muted/60 rounded w-1/2" />
                            <div className="h-2.5 bg-muted/40 rounded w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{searchQuery || dateFilter !== 'all' ? t('common.noResultsFound') : t('common.noData')}</p>
                    </div>
                  ) : (
                    <div>
                      {groupByDate(filteredEmails).map((group) => (
                        <div key={group.label}>
                          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/30">
                            {group.label} <span className="text-muted-foreground/40">· {group.emails.length}</span>
                          </div>
                          {group.emails.map((email) => {
                            const who = email.company_name || email.contact_name || t('inquiries.noSubject');
                            const conf = (email as any).classification_confidence as number | null;
                            const selected = selectedEmail?.id === email.id;
                            return (
                              <button
                                key={email.id}
                                onClick={() => selectEmail(email.id)}
                                className={`w-full text-left px-3 py-2.5 flex gap-3 cursor-pointer transition-colors border-b border-border/40 border-l-[3px] ${
                                  selected ? 'bg-primary/5 border-l-primary' : 'border-l-transparent hover:bg-muted/40'
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-[11px] font-bold ${avatarColor(who)}`}>
                                  {initials(who)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-foreground leading-snug truncate">{who}</p>
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{formatTime(email.created_at)}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{email.subject || t('inquiries.noSubject')}</p>
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <Badge className={`${getStatusBadge(email.status)} text-[10px] px-1.5 py-0 h-[18px] border`} variant="secondary">
                                      {getStatusIcon(email.status)}<span className="ml-1">{email.status}</span>
                                    </Badge>
                                    {email.vessel_name && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground/70 bg-muted/60 px-1.5 h-[18px] rounded-md max-w-[130px]">
                                        <Ship className="w-2.5 h-2.5 text-primary/60 shrink-0" /><span className="truncate">{email.vessel_name}</span>
                                      </span>
                                    )}
                                    {email.port && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                        <MapPin className="w-2.5 h-2.5" />{email.port}
                                      </span>
                                    )}
                                    {typeof conf === 'number' && conf < 0.6 && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400" title="Lage AI-zekerheid — controleer classificatie">
                                        <Sparkles className="w-2.5 h-2.5" />{Math.round(conf * 100)}%
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

            {/* ── Email Detail ── */}
            <div className="lg:col-span-8 min-w-0">
              {selectedEmail ? (
                <Card className="card-premium overflow-hidden flex flex-col">
                  {/* Header: subject + classification + actions */}
                  <div className="px-5 pt-4 pb-3 border-b border-border/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold leading-snug truncate">{selectedEmail.subject || t('inquiries.noSubject')}</h2>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge className={`${getStatusBadge(selectedEmail.status)} text-[10px] px-1.5 py-0 h-5 border`} variant="secondary">
                            {getStatusIcon(selectedEmail.status)}
                            <span className="ml-1">{selectedEmail.status}</span>
                          </Badge>
                          {/* AI classification chip with reasoning tooltip */}
                          {currentCategory && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0 h-5 rounded-md bg-primary/8 text-primary border border-primary/15 cursor-default">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {categoryLabel(currentCategory)}
                                    {typeof confidence === 'number' && (
                                      <span className="opacity-70">· {Math.round(confidence * 100)}%</span>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                {reasoning && (
                                  <TooltipContent className="max-w-xs text-xs">
                                    <p className="font-medium mb-0.5">{t('inquiries.aiClassification')}</p>
                                    <p className="text-muted-foreground">{reasoning}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Move / reclassify */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg gap-1.5" disabled={moving}>
                              {moving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                              <span className="hidden sm:inline">{t('inquiries.moveTo')}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs">{t('inquiries.moveTo')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {MOVE_TARGETS.map((m) => (
                              <DropdownMenuItem
                                key={m.key}
                                disabled={m.key === currentCategory}
                                onClick={() => handleMoveCategory(m.key)}
                                className="text-sm gap-2"
                              >
                                {m.key === currentCategory && <CheckCircle className="w-3.5 h-3.5 text-primary" />}
                                <span className={m.key === currentCategory ? 'text-primary font-medium' : ''}>{categoryLabel(m.key)}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('inquiries.deleteEmail')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('inquiries.deleteConfirm')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteEmail} disabled={deleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                {t('common.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Meta strip */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs">
                      {(selectedEmail.contact_name || selectedEmail.company_name) && (
                        <MetaItem icon={<User className="w-3 h-3" />}>
                          {selectedEmail.contact_name}
                          {selectedEmail.contact_name && selectedEmail.company_name && ' · '}
                          {selectedEmail.company_name && <span className="text-muted-foreground">{selectedEmail.company_name}</span>}
                        </MetaItem>
                      )}
                      {selectedEmail.email_to_person && (
                        <MetaItem icon={<Mail className="w-3 h-3" />}>{selectedEmail.email_to_person}</MetaItem>
                      )}
                      {selectedEmail.vessel_name && (
                        <MetaItem icon={<Ship className="w-3 h-3" />}>
                          {selectedEmail.vessel_name}{selectedEmail.imo ? ` (IMO ${selectedEmail.imo})` : ''}
                          {selectedEmail.vessel_2_name ? ` + ${selectedEmail.vessel_2_name}` : ''}
                        </MetaItem>
                      )}
                      {selectedEmail.port && <MetaItem icon={<MapPin className="w-3 h-3" />}>{selectedEmail.port}</MetaItem>}
                      {selectedEmail.eta && <MetaItem icon={<Calendar className="w-3 h-3" />}>{selectedEmail.eta}</MetaItem>}
                      <MetaItem icon={<Clock className="w-3 h-3" />}>
                        {new Date(selectedEmail.created_at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Curacao' })}
                      </MetaItem>
                    </div>

                    {/* Document links */}
                    {(selectedEmail.pdf_url || selectedEmail.doc_link || selectedEmail.dock_link_2 || selectedEmail['Google sheet url']) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {selectedEmail.pdf_url && (
                          <DocLink href={selectedEmail.pdf_url} icon={<FileText className="w-3 h-3" />} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400">DA (PDF)</DocLink>
                        )}
                        {selectedEmail.doc_link && (
                          <DocLink href={selectedEmail.doc_link} icon={<FileSpreadsheet className="w-3 h-3" />} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">DA (Excel)</DocLink>
                        )}
                        {selectedEmail.dock_link_2 && (
                          <DocLink href={selectedEmail.dock_link_2} icon={<ExternalLink className="w-3 h-3" />} className="bg-primary/8 text-primary hover:bg-primary/15">{t('inquiries.docLink')} 2</DocLink>
                        )}
                        {selectedEmail['Google sheet url'] && (
                          <DocLink href={selectedEmail['Google sheet url']} icon={<ExternalLink className="w-3 h-3" />} className="bg-primary/8 text-primary hover:bg-primary/15">{t('inquiries.googleSheet')}</DocLink>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Side-by-side compare: Original request | AI draft ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
                    {/* Original */}
                    <div className="flex flex-col min-h-0">
                      <div className="flex items-center gap-2 px-5 py-2.5 bg-muted/30">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('inquiries.originalRequest')}</span>
                      </div>
                      <ScrollArea className="h-[340px]">
                        <div className="px-5 py-4">
                          {originalText ? (
                            <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground/80">{originalText}</pre>
                          ) : (
                            <p className="text-sm text-muted-foreground/60 italic">{t('inquiries.noOriginal')}</p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* AI draft editor */}
                    <div className="flex flex-col min-h-0">
                      <div className="flex items-center justify-between gap-2 px-5 py-2 bg-primary/[0.04]">
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t('inquiries.aiDraft')}</span>
                          {hasAiReply ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                              <Check className="w-2.5 h-2.5" />{t('inquiries.draftReady')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                              {t('inquiries.draftPending')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs rounded-lg gap-1.5 px-2"
                            onClick={copyDraft}
                            disabled={!editBody}
                            title={t('inquiries.copyDraft')}
                          >
                            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span className="hidden sm:inline">{copied ? t('inquiries.copied') : t('inquiries.copyDraft')}</span>
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-xs rounded-lg gap-1.5"
                            onClick={handleCompose}
                            disabled={composing}
                          >
                            {composing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {hasAiReply ? t('inquiries.regenerate') : t('inquiries.generateReply')}
                          </Button>
                        </div>
                      </div>
                      {selectedEmail.email_to_person && (
                        <div className="flex items-center gap-1.5 px-5 py-1.5 border-b border-border/40 bg-card">
                          <Send className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                          <span className="text-[11px] text-muted-foreground">{t('inquiries.toEmail')}:</span>
                          <span className="text-[11px] font-medium text-foreground/80 truncate">{selectedEmail.email_to_person}</span>
                        </div>
                      )}
                      <div className="px-5 py-4 space-y-3">
                        {!hasAiReply && !editBody && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-xs">
                            <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{t('inquiries.noDraftYet')}</span>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label htmlFor="subject" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('inquiries.emailSubject')}</Label>
                          <Input
                            id="subject"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            placeholder={t('inquiries.emailSubject')}
                            className="h-9 rounded-lg bg-muted/20 border-border/60 focus:bg-card text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="body" className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t('inquiries.emailBody')}</Label>
                            {editBody && (
                              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{editBody.length.toLocaleString()} tekens</span>
                            )}
                          </div>
                          <Textarea
                            id="body"
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            placeholder={composing ? t('inquiries.generating') : t('inquiries.emailBody')}
                            className="h-[240px] text-sm rounded-lg bg-muted/20 border-border/60 focus:bg-card leading-relaxed resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Disbursement Account (generate + attach) ── */}
                  <InquiryDAPanel email={selectedEmail} onAttached={() => selectEmail(selectedEmail.id)} />

                  {/* ── Attachments ── */}
                  <div className="px-5 py-3 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('inquiries.documents')}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{emailAttachments.length}</span>
                      </div>
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" asChild disabled={uploadingPdf}>
                          <span>
                            {uploadingPdf ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Upload className="w-3 h-3 mr-1.5" />}
                            {t('inquiries.uploadPdf')}
                          </span>
                        </Button>
                        <input id="pdf-upload-input" type="file" multiple accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
                      </label>
                    </div>
                    {emailAttachments.length === 0 ? (
                      <div
                        className={`text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                          isDragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                        }`}
                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                        onClick={() => document.getElementById('pdf-upload-input')?.click()}
                      >
                        <p className="text-xs">{isDragging ? t('inquiries.dropToAdd') : t('inquiries.dropPdfs')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                        {emailAttachments.map((attachment) => {
                          const kind = getAttachmentKind(attachment.file_name);
                          const iconClass =
                            kind === 'pdf' ? 'text-red-500' :
                            kind === 'excel' ? 'text-emerald-600' :
                            kind === 'word' ? 'text-blue-600' :
                            kind === 'csv' ? 'text-amber-600' : 'text-muted-foreground';
                          return (
                            <div key={attachment.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/40">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className={`w-4 h-4 shrink-0 ${iconClass}`} />
                                <span className="text-xs truncate">{attachment.file_name}</span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => handlePreviewAttachment(attachment)}>
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md text-destructive" onClick={() => handleDeleteAttachment(attachment)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {previewPdfUrl && (
                      <div className="mt-3 relative">
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 rounded-md bg-card/80 z-10" onClick={() => setPreviewPdfUrl(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <iframe src={previewPdfUrl} className="w-full h-[400px] rounded-lg border border-border/60" />
                      </div>
                    )}
                  </div>

                  {/* ── Sticky action footer ── */}
                  <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex flex-col sm:flex-row items-center gap-3">
                    <p className="text-[11px] text-muted-foreground hidden sm:block flex-1">{t('inquiries.reviewHint')}</p>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="h-10 text-sm font-semibold rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:hover:bg-red-500/10"
                        onClick={() => handleUpdateStatus('rejected')}
                        disabled={sending}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {t('common.reject')}
                      </Button>
                      <Button
                        className="flex-1 sm:flex-initial h-10 px-6 text-sm font-semibold rounded-lg shadow-sm bg-primary hover:bg-primary/90"
                        onClick={() => handleUpdateStatus('approved')}
                        disabled={sending}
                      >
                        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        {t('inquiries.approveAndSend')}
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="card-premium h-[calc(100vh-280px)] flex items-center justify-center">
                  <CardContent className="text-center text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-7 h-7 opacity-30" />
                    </div>
                    <p className="text-sm font-medium">{t('inquiries.selectEmail')}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{t('inquiries.reviewHint')}</p>
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

/** Is the email's `body` a genuine AI-written reply (vs raw HTML or a copy of the original)? */
function isRealAiReply(email: Email): boolean {
  const b = (email.body || '').trim();
  if (!b) return false;
  if (/<(div|html|table|p |span|body|head)/i.test(b)) return false; // raw Outlook HTML
  if (b === (email.original_email || '').trim() || b === (email.orignal_email || '').trim()) return false;
  return true;
}

/** Initials (max 2) from a company/contact name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
];
/** Stable colour per sender so the same company always looks the same. */
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Group emails into Today / This week / Older buckets (input already newest-first). */
function groupByDate(emails: Email[]): { label: string; emails: Email[] }[] {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startWeek = startToday - now.getDay() * 86400000;
  const buckets: Record<string, Email[]> = { Vandaag: [], 'Deze week': [], Ouder: [] };
  for (const e of emails) {
    const ts = new Date(e.created_at).getTime();
    if (ts >= startToday) buckets['Vandaag'].push(e);
    else if (ts >= startWeek) buckets['Deze week'].push(e);
    else buckets['Ouder'].push(e);
  }
  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, emails: list }));
}

/** Display-only: make a flattened / HTML email body readable. Never mutates stored data. */
function prettifyOriginal(raw: string): string {
  if (!raw) return '';
  let t = raw;
  // HTML -> text: turn structural tags into line breaks, drop the rest, decode entities.
  if (/<[a-z/][^>]*>/i.test(t)) {
    t = t
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/\s*(p|div|tr|li|h[1-6]|table)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>').replace(/&#39;/gi, "'").replace(/&quot;/gi, '"');
  }
  // Wall of text with no breaks: insert breaks before thread headers and sign-offs.
  if (!t.includes('\n')) {
    t = t
      .replace(/\s+(From:|Van:|Sent:|Verzonden:|To:|Aan:|Subject:|Onderwerp:|Cc:|Date:)\s*/g, '\n$1 ')
      .replace(/\s+(Best regards|Kind regards|Best Regards|Kind Regards|Regards,|Thanks and regards|Met vriendelijke groet|Good day|Good Day)\b/g, '\n\n$1');
  }
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Map a raw "Email Type" value to one of the three canonical category keys. */
function categoryKey(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (['CARGO_AGENT', 'CARGO_AGENT_2', 'LOADING_DISCHARGE_AGENT'].includes(t)) return 'LOADING_DISCHARGE_AGENT';
  if (t === 'OWNERS_AGENT') return 'OWNERS_AGENT';
  if (['OUT_OF_SCOPE', 'REFERRAL'].includes(t)) return 'OUT_OF_SCOPE';
  return raw;
}

function categoryLabel(key: string): string {
  switch (key) {
    case 'LOADING_DISCHARGE_AGENT': return 'Cargo Agent';
    case 'OWNERS_AGENT': return 'Owners Agent';
    case 'OUT_OF_SCOPE': return 'Out of Scope';
    default: return key;
  }
}

function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground/80">
      <span className="text-muted-foreground/60">{icon}</span>
      <span className="min-w-0 truncate max-w-[260px]">{children}</span>
    </span>
  );
}

function DocLink({ href, icon, className, children }: { href: string; icon: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${className}`}>
      {icon} {children}
    </a>
  );
}
