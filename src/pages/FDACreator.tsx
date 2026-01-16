import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  Send,
  Ship,
  Building2,
  User,
  Mail,
  Phone,
  Receipt,
  X,
  Plus,
  Edit,
  Clock,
  CheckCircle,
  ArrowLeft,
  FileUp,
  Calendar,
} from 'lucide-react';

interface FDAProject {
  id: string;
  lbh_number: string;
  ship_name: string;
  fda_responsible: string | null;
  client: string | null;
  client_email: string | null;
  client_phone: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

interface FDAInvoice {
  id: string;
  fda_project_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

interface FDAFormData {
  lbh_number: string;
  ship_name: string;
  fda_responsible: string;
  client: string;
  client_email: string;
  client_phone: string;
  billing_company: string;
  billing_address: string;
  billing_email: string;
  billing_phone: string;
}

const WEBHOOK_URL = 'https://lbhcuracao.app.n8n.cloud/webhook-test/invoice-upload';

export default function FDACreator() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<FDAProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<FDAProject | null>(null);
  const [projectInvoices, setProjectInvoices] = useState<FDAInvoice[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [formData, setFormData] = useState<FDAFormData>({
    lbh_number: '',
    ship_name: '',
    fda_responsible: '',
    client: '',
    client_email: '',
    client_phone: '',
    billing_company: '',
    billing_address: '',
    billing_email: '',
    billing_phone: '',
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setFormData({
        lbh_number: selectedProject.lbh_number,
        ship_name: selectedProject.ship_name,
        fda_responsible: selectedProject.fda_responsible || '',
        client: selectedProject.client || '',
        client_email: selectedProject.client_email || '',
        client_phone: selectedProject.client_phone || '',
        billing_company: selectedProject.billing_company || '',
        billing_address: selectedProject.billing_address || '',
        billing_email: selectedProject.billing_email || '',
        billing_phone: selectedProject.billing_phone || '',
      });
      fetchProjectInvoices(selectedProject.id);
    }
  }, [selectedProject]);

  async function fetchProjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from('fda_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  }

  async function fetchProjectInvoices(projectId: string) {
    const { data } = await supabase
      .from('fda_invoices')
      .select('*')
      .eq('fda_project_id', projectId)
      .order('created_at', { ascending: false });

    setProjectInvoices(data || []);
  }

  const handleInputChange = (field: keyof FDAFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  async function handleCreateProject() {
    if (!formData.lbh_number || !formData.ship_name) {
      toast({ title: 'Error', description: 'LBH Number and Ship Name are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('fda_projects')
      .insert({
        lbh_number: formData.lbh_number,
        ship_name: formData.ship_name,
        fda_responsible: formData.fda_responsible || null,
        client: formData.client || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        billing_company: formData.billing_company || null,
        billing_address: formData.billing_address || null,
        billing_email: formData.billing_email || null,
        billing_phone: formData.billing_phone || null,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'FDA project created' });
      setShowCreateDialog(false);
      resetForm();
      await fetchProjects();
      if (data) {
        setSelectedProject(data);
      }
    }
    setSaving(false);
  }

  async function handleUpdateProject() {
    if (!selectedProject) return;

    setSaving(true);
    const { error } = await supabase
      .from('fda_projects')
      .update({
        lbh_number: formData.lbh_number,
        ship_name: formData.ship_name,
        fda_responsible: formData.fda_responsible || null,
        client: formData.client || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        billing_company: formData.billing_company || null,
        billing_address: formData.billing_address || null,
        billing_email: formData.billing_email || null,
        billing_phone: formData.billing_phone || null,
      })
      .eq('id', selectedProject.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Project saved' });
      await fetchProjects();
    }
    setSaving(false);
  }

  async function handleDeleteProject(id: string) {
    const { error } = await supabase.from('fda_projects').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Project deleted' });
      setSelectedProject(null);
      await fetchProjects();
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !selectedProject) return;

    setUploadingFiles(true);

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        continue;
      }

      const filePath = `${selectedProject.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('fda-invoices')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      const { error: insertError } = await supabase.from('fda_invoices').insert({
        fda_project_id: selectedProject.id,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
      });

      if (insertError) {
        toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
      }
    }

    await fetchProjectInvoices(selectedProject.id);
    setUploadingFiles(false);
    toast({ title: 'Success', description: 'Files uploaded' });
    e.target.value = '';
  }

  async function handleDeleteInvoice(invoice: FDAInvoice) {
    await supabase.storage.from('fda-invoices').remove([invoice.file_path]);
    await supabase.from('fda_invoices').delete().eq('id', invoice.id);
    if (selectedProject) {
      await fetchProjectInvoices(selectedProject.id);
    }
    toast({ title: 'Success', description: 'File deleted' });
  }

  async function handleSendToWebhook() {
    if (!selectedProject || projectInvoices.length === 0) {
      toast({ title: 'Error', description: 'Upload at least one invoice before sending', variant: 'destructive' });
      return;
    }

    setSending(true);

    try {
      // Get signed URLs for all files
      const fileUrls: string[] = [];
      for (const invoice of projectInvoices) {
        const { data } = await supabase.storage
          .from('fda-invoices')
          .createSignedUrl(invoice.file_path, 86400); // 24 hours
        if (data?.signedUrl) {
          fileUrls.push(data.signedUrl);
        }
      }

      // Prepare payload
      const payload = {
        project_id: selectedProject.id,
        lbh_number: formData.lbh_number,
        ship_name: formData.ship_name,
        fda_responsible: formData.fda_responsible,
        client: formData.client,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        billing_company: formData.billing_company,
        billing_address: formData.billing_address,
        billing_email: formData.billing_email,
        billing_phone: formData.billing_phone,
        invoice_files: fileUrls,
        invoice_count: projectInvoices.length,
        sent_at: new Date().toISOString(),
      };

      // Send to webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      // Update project status
      await supabase
        .from('fda_projects')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', selectedProject.id);

      toast({ title: 'Success!', description: 'FDA sent to n8n workflow' });
      await fetchProjects();
      setSelectedProject(null);
    } catch (error) {
      console.error('Send error:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to send', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setFormData({
      lbh_number: '',
      ship_name: '',
      fda_responsible: '',
      client: '',
      client_email: '',
      client_phone: '',
      billing_company: '',
      billing_address: '',
      billing_email: '',
      billing_phone: '',
    });
  }

  const getStatusBadge = (status: string) => {
    if (status === 'sent') {
      return <Badge className="bg-success/10 text-success border-success/20" variant="outline"><CheckCircle className="w-3 h-3 mr-1" /> Sent</Badge>;
    }
    return <Badge className="bg-muted text-muted-foreground" variant="outline"><Clock className="w-3 h-3 mr-1" /> Draft</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout title={t('fda.title')}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Detail View
  if (selectedProject) {
    return (
      <DashboardLayout title={t('fda.title')}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedProject(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{formData.ship_name}</h1>
                <p className="text-muted-foreground">{formData.lbh_number}</p>
              </div>
              {getStatusBadge(selectedProject.status)}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleUpdateProject} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
                <span className="ml-2">Save</span>
              </Button>
              {selectedProject.status !== 'sent' && (
                <Button onClick={handleSendToWebhook} disabled={sending || projectInvoices.length === 0}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span className="ml-2">Send FDA</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Vessel Info */}
              <Card className="card-premium">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Ship className="w-4 h-4 text-primary" />
                    Vessel Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>LBH Number *</Label>
                    <Input value={formData.lbh_number} onChange={(e) => handleInputChange('lbh_number', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ship Name *</Label>
                    <Input value={formData.ship_name} onChange={(e) => handleInputChange('ship_name', e.target.value)} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>FDA Responsible</Label>
                    <Input value={formData.fda_responsible} onChange={(e) => handleInputChange('fda_responsible', e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              {/* Client Info */}
              <Card className="card-premium">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Client Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input value={formData.client} onChange={(e) => handleInputChange('client', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input type="email" value={formData.client_email} onChange={(e) => handleInputChange('client_email', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                      <Input value={formData.client_phone} onChange={(e) => handleInputChange('client_phone', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing Info */}
              <Card className="card-premium">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    Billing Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input value={formData.billing_company} onChange={(e) => handleInputChange('billing_company', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input type="email" value={formData.billing_email} onChange={(e) => handleInputChange('billing_email', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Address</Label>
                    <Input value={formData.billing_address} onChange={(e) => handleInputChange('billing_address', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                    <Input value={formData.billing_phone} onChange={(e) => handleInputChange('billing_phone', e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Files */}
            <div className="space-y-6">
              <Card className="card-premium sticky top-6">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Invoice PDFs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedProject.status !== 'sent' && (
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all group">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                        <Upload className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Upload PDFs</span>
                      <span className="text-xs text-muted-foreground mt-1">Click or drag files</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFiles}
                      />
                    </label>
                  )}

                  {uploadingFiles && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </div>
                  )}

                  <Separator />

                  {projectInvoices.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No files uploaded</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        {projectInvoices.length} file{projectInvoices.length !== 1 ? 's' : ''}
                      </p>
                      {projectInvoices.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle className="w-4 h-4 text-success shrink-0" />
                            <span className="text-sm truncate">{invoice.file_name}</span>
                          </div>
                          {selectedProject.status !== 'sent' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 opacity-0 group-hover:opacity-100"
                              onClick={() => handleDeleteInvoice(invoice)}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Danger Zone */}
              {selectedProject.status !== 'sent' && (
                <Card className="border-destructive/30">
                  <CardContent className="pt-6">
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleDeleteProject(selectedProject.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Project
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Overview View
  return (
    <DashboardLayout title={t('fda.title')}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('fda.title')}</h1>
            <p className="text-muted-foreground">Manage your FDA projects</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Create FDA
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New FDA Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                {/* Vessel Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Ship className="w-4 h-4 text-primary" /> Vessel Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>LBH Number *</Label>
                      <Input
                        value={formData.lbh_number}
                        onChange={(e) => handleInputChange('lbh_number', e.target.value)}
                        placeholder="LBH-2024-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ship Name *</Label>
                      <Input
                        value={formData.ship_name}
                        onChange={(e) => handleInputChange('ship_name', e.target.value)}
                        placeholder="MV Ocean King"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>FDA Responsible</Label>
                    <Input
                      value={formData.fda_responsible}
                      onChange={(e) => handleInputChange('fda_responsible', e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <Separator />

                {/* Client Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Client Details
                  </h3>
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input
                      value={formData.client}
                      onChange={(e) => handleInputChange('client', e.target.value)}
                      placeholder="Client Name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input
                        type="email"
                        value={formData.client_email}
                        onChange={(e) => handleInputChange('client_email', e.target.value)}
                        placeholder="client@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                      <Input
                        value={formData.client_phone}
                        onChange={(e) => handleInputChange('client_phone', e.target.value)}
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Billing Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" /> Billing Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input
                        value={formData.billing_company}
                        onChange={(e) => handleInputChange('billing_company', e.target.value)}
                        placeholder="Billing Company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input
                        type="email"
                        value={formData.billing_email}
                        onChange={(e) => handleInputChange('billing_email', e.target.value)}
                        placeholder="billing@company.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Address</Label>
                    <Input
                      value={formData.billing_address}
                      onChange={(e) => handleInputChange('billing_address', e.target.value)}
                      placeholder="123 Business Street, City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                    <Input
                      value={formData.billing_phone}
                      onChange={(e) => handleInputChange('billing_phone', e.target.value)}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>

                <Button onClick={handleCreateProject} disabled={saving} className="w-full" size="lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Project
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="card-premium">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No FDA Projects</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Create your first FDA project to get started with document management.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Create FDA
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="card-premium cursor-pointer transition-all hover:shadow-lg hover:border-primary/30"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Ship className="w-6 h-6 text-primary" />
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{project.ship_name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{project.lbh_number}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                    {project.fda_responsible && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {project.fda_responsible}
                      </span>
                    )}
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
