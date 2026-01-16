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
} from 'lucide-react';

type Email = Tables<'email'>;

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
  
  // Form state for editing
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, [activeTab]);

  useEffect(() => {
    if (selectedEmail) {
      setEditSubject(selectedEmail.subject || '');
      setEditBody(selectedEmail.body || '');
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

  return (
    <DashboardLayout title={t('inquiries.title')}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="CARGO_AGENT">{t('inquiries.cargoAgent')}</TabsTrigger>
          <TabsTrigger value="OWNERS_AGENT">{t('inquiries.ownersAgent')}</TabsTrigger>
          <TabsTrigger value="OUT_OF_SCOPE">{t('inquiries.outOfScope')}</TabsTrigger>
        </TabsList>

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

                  {/* Edit Response - Full Height */}
                  <Card className="card-premium">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Edit Response</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t('inquiries.subject')}</Label>
                        <Input
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Message Body</Label>
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={16}
                          className="resize-none font-mono text-sm"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={() => handleUpdateStatus('approved')}
                          disabled={sending}
                          className="flex-1 gap-2"
                          size="lg"
                        >
                          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Approve & Send
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleUpdateStatus('rejected')}
                          disabled={sending}
                          className="gap-2"
                          size="lg"
                        >
                          <XCircle className="w-4 h-4" />
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
