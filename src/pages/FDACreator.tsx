import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getSupabaseClient, FdaProject, FdaInvoice } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  FileText,
  Upload,
  Download,
  Trash2,
  ArrowLeft,
  Send,
  Loader2,
} from 'lucide-react';

const FDA_WEBHOOK = 'https://lbhcuracao.app.n8n.cloud/webhook-test/invoice-upload';

export default function FDACreator() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<FdaProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<FdaProject | null>(null);
  const [invoices, setInvoices] = useState<FdaInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  
  // New project form
  const [newProject, setNewProject] = useState({
    code: '',
    lbh_number: '',
    ship_name: '',
    shipper: '',
    shipper_email: '',
    shipper_phone: '',
    consignee: '',
    consignee_email: '',
    consignee_phone: '',
    client: '',
    client_email: '',
    client_phone: '',
    billing_company: '',
    billing_address: '',
    billing_email: '',
    billing_phone: '',
    fda_responsible: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<FdaProject>>({});

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setEditForm(selectedProject);
      fetchInvoices(selectedProject.id);
    }
  }, [selectedProject]);

  async function fetchProjects() {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('fda_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  }

  async function fetchInvoices(projectId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data, error } = await supabase.from('fda_invoices').select('*').eq('fda_project_id', projectId);

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
  }

  async function handleCreateProject() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase.from('fda_projects').insert(newProject).select().single();

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: 'Project created' });
      setShowNewDialog(false);
      setNewProject({
        code: '',
        lbh_number: '',
        ship_name: '',
        shipper: '',
        shipper_email: '',
        shipper_phone: '',
        consignee: '',
        consignee_email: '',
        consignee_phone: '',
        client: '',
        client_email: '',
        client_phone: '',
        billing_company: '',
        billing_address: '',
        billing_email: '',
        billing_phone: '',
        fda_responsible: '',
      });
      fetchProjects();
      if (data) setSelectedProject(data);
    }
  }

  async function handleDeleteProject(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('fda_projects').delete().eq('id', id);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: 'Project deleted' });
      fetchProjects();
      setSelectedProject(null);
    }
  }

  async function handleFileUpload(files: FileList) {
    if (!selectedProject) return;
    setUploading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      setUploading(false);
      return;
    }

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        continue;
      }

      const filePath = `${selectedProject.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from('fda-invoices').upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      const { error: insertError } = await supabase.from('fda_invoices').insert({
        fda_project_id: selectedProject.id,
        file_path: filePath,
        file_name: file.name,
      });

      if (insertError) {
        toast({ title: 'Error saving invoice', description: insertError.message, variant: 'destructive' });
      }
    }

    await fetchInvoices(selectedProject.id);
    setUploading(false);
    toast({ title: t('common.success'), description: 'Invoices uploaded' });
  }

  async function handleDeleteInvoice(invoice: FdaInvoice) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      return;
    }

    await supabase.storage.from('fda-invoices').remove([invoice.file_path]);
    await supabase.from('fda_invoices').delete().eq('id', invoice.id);
    await fetchInvoices(selectedProject!.id);
    toast({ title: t('common.success'), description: 'Invoice deleted' });
  }

  async function getSignedUrl(filePath: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;

    const { data } = await supabase.storage.from('fda-invoices').createSignedUrl(filePath, 3600);
    return data?.signedUrl;
  }

  async function handleCreateFDA() {
    if (!selectedProject) return;
    setSending(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      setSending(false);
      return;
    }

    const invoiceUrls = await Promise.all(
      invoices.map(async (inv) => ({
        url: await getSignedUrl(inv.file_path),
        filename: inv.file_name,
      }))
    );

    const payload = {
      fda_project_id: selectedProject.id,
      code: editForm.code,
      lbh_number: editForm.lbh_number,
      ship_name: editForm.ship_name,
      shipper: editForm.shipper,
      consignee: editForm.consignee,
      client: editForm.client,
      fda_responsible: editForm.fda_responsible,
      invoices: invoiceUrls,
    };

    try {
      const response = await fetch(FDA_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Webhook failed');

      await supabase
        .from('fda_projects')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', selectedProject.id);

      toast({ title: t('common.success'), description: 'FDA created and sent' });
      fetchProjects();
    } catch (error) {
      toast({ title: t('common.error'), description: 'Failed to create FDA', variant: 'destructive' });
    }

    setSending(false);
  }

  if (selectedProject) {
    return (
      <DashboardLayout title={`${t('fda.title')} - ${editForm.code}`}>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedProject(null)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </Button>

          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{editForm.code}</h2>
            <Badge variant={selectedProject.status === 'sent' ? 'default' : 'secondary'}>
              {selectedProject.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Details */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t('fda.projectDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('fda.lbhNumber')}</Label>
                    <Input
                      value={editForm.lbh_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, lbh_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('fda.shipName')}</Label>
                    <Input
                      value={editForm.ship_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, ship_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('fda.shipper')}</Label>
                    <Input
                      value={editForm.shipper || ''}
                      onChange={(e) => setEditForm({ ...editForm, shipper: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('fda.consignee')}</Label>
                    <Input
                      value={editForm.consignee || ''}
                      onChange={(e) => setEditForm({ ...editForm, consignee: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('fda.client')}</Label>
                    <Input
                      value={editForm.client || ''}
                      onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('fda.responsible')}</Label>
                    <Input
                      value={editForm.fda_responsible || ''}
                      onChange={(e) => setEditForm({ ...editForm, fda_responsible: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoices */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t('fda.uploadInvoices')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Drop PDF invoices here</span>
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

                {invoices.length > 0 && (
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <span className="text-sm truncate flex-1">{inv.file_name}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              const url = await getSignedUrl(inv.file_path);
                              if (url) window.open(url, '_blank');
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteInvoice(inv)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={handleCreateFDA}
                  disabled={sending || invoices.length === 0}
                  className="w-full gap-2"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {t('fda.createFda')}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('fda.title')}>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t('fda.newProject')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('fda.newProject')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('fda.code')} *</Label>
                      <Input
                        value={newProject.code}
                        onChange={(e) => setNewProject({ ...newProject, code: e.target.value })}
                        placeholder="FDA-2024-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('fda.lbhNumber')}</Label>
                      <Input
                        value={newProject.lbh_number}
                        onChange={(e) => setNewProject({ ...newProject, lbh_number: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('fda.shipName')}</Label>
                      <Input
                        value={newProject.ship_name}
                        onChange={(e) => setNewProject({ ...newProject, ship_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('fda.responsible')}</Label>
                      <Input
                        value={newProject.fda_responsible}
                        onChange={(e) => setNewProject({ ...newProject, fda_responsible: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Shipper */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('fda.shipper')}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={newProject.shipper}
                        onChange={(e) => setNewProject({ ...newProject, shipper: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newProject.shipper_email}
                        onChange={(e) => setNewProject({ ...newProject, shipper_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        value={newProject.shipper_phone}
                        onChange={(e) => setNewProject({ ...newProject, shipper_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Consignee */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('fda.consignee')}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={newProject.consignee}
                        onChange={(e) => setNewProject({ ...newProject, consignee: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newProject.consignee_email}
                        onChange={(e) => setNewProject({ ...newProject, consignee_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        value={newProject.consignee_phone}
                        onChange={(e) => setNewProject({ ...newProject, consignee_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Client */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('fda.client')}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={newProject.client}
                        onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newProject.client_email}
                        onChange={(e) => setNewProject({ ...newProject, client_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        value={newProject.client_phone}
                        onChange={(e) => setNewProject({ ...newProject, client_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Billing Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Billing Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input
                        value={newProject.billing_company}
                        onChange={(e) => setNewProject({ ...newProject, billing_company: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newProject.billing_email}
                        onChange={(e) => setNewProject({ ...newProject, billing_email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input
                        value={newProject.billing_address}
                        onChange={(e) => setNewProject({ ...newProject, billing_address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        value={newProject.billing_phone}
                        onChange={(e) => setNewProject({ ...newProject, billing_phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleCreateProject} className="w-full" disabled={!newProject.code}>
                  Create Project
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="card-premium p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('common.noData')}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="card-premium cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{project.code}</p>
                      <p className="text-sm text-muted-foreground">{project.ship_name || 'No vessel'}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={project.status === 'sent' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
