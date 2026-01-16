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
  Send,
  RefreshCw,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email List */}
            <Card className="card-premium">
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
                              <p className="text-sm font-medium truncate">{email.subject || 'No subject'}</p>
                              <p className="text-xs text-muted-foreground truncate">{email.email_to_person}</p>
                              {email.vessel_name && (
                                <p className="text-xs text-muted-foreground mt-1">🚢 {email.vessel_name}</p>
                              )}
                            </div>
                            <Badge className={getStatusBadge(email.status)} variant="secondary">
                              {getStatusIcon(email.status)}
                              <span className="ml-1">{email.status}</span>
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(email.created_at).toLocaleString()}
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
                  {/* Email Info */}
                  <Card className="card-premium">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Email Details</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                          <Eye className="w-4 h-4 mr-1" />
                          {showPreview ? 'Hide' : 'Show'} Original
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">To:</span>
                          <p className="font-medium">{selectedEmail.email_to_person}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>
                          <p className="font-medium">{new Date(selectedEmail.created_at).toLocaleString()}</p>
                        </div>
                        {selectedEmail.vessel_name && (
                          <div>
                            <span className="text-muted-foreground">Vessel:</span>
                            <p className="font-medium">{selectedEmail.vessel_name}</p>
                          </div>
                        )}
                        {selectedEmail.port && (
                          <div>
                            <span className="text-muted-foreground">Port:</span>
                            <p className="font-medium">{selectedEmail.port}</p>
                          </div>
                        )}
                        {selectedEmail.eta && (
                          <div>
                            <span className="text-muted-foreground">ETA:</span>
                            <p className="font-medium">{selectedEmail.eta}</p>
                          </div>
                        )}
                        {selectedEmail.imo && (
                          <div>
                            <span className="text-muted-foreground">IMO:</span>
                            <p className="font-medium">{selectedEmail.imo}</p>
                          </div>
                        )}
                      </div>

                      {/* Links */}
                      <div className="flex flex-wrap gap-2">
                        {selectedEmail.doc_link && (
                          <a href={selectedEmail.doc_link} target="_blank" rel="noopener noreferrer" 
                             className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" /> Doc Link
                          </a>
                        )}
                        {selectedEmail['Google sheet url'] && (
                          <a href={selectedEmail['Google sheet url']} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" /> Google Sheet
                          </a>
                        )}
                        {selectedEmail.pdf_url && (
                          <a href={selectedEmail.pdf_url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" /> PDF
                          </a>
                        )}
                      </div>

                      {showPreview && selectedEmail.original_email && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg max-h-64 overflow-auto">
                          <p className="text-xs font-medium mb-2 text-muted-foreground">Original Email:</p>
                          <pre className="whitespace-pre-wrap text-sm">{selectedEmail.original_email}</pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Edit Email */}
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
                          rows={8}
                          className="resize-none"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleUpdateStatus('approved')}
                          disabled={sending}
                          className="flex-1 gap-2"
                        >
                          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Approve & Send
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleUpdateStatus('rejected')}
                          disabled={sending}
                          className="gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="card-premium">
                  <CardContent className="flex items-center justify-center h-96 text-muted-foreground">
                    Select an email to view details
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
