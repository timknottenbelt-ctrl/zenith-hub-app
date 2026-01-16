import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { getSupabaseClient } from '@/lib/supabase';
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
  FileUp,
  CheckCircle,
} from 'lucide-react';

interface FDAFormData {
  lbh_number: string;
  ship_name: string;
  shipper: string;
  shipper_email: string;
  shipper_phone: string;
  consignee: string;
  consignee_email: string;
  consignee_phone: string;
  client: string;
  client_email: string;
  client_phone: string;
  billing_company: string;
  billing_address: string;
  billing_email: string;
  billing_phone: string;
  fda_responsible: string;
}

interface UploadedFile {
  file: File;
  id: string;
}

const WEBHOOK_URL = 'https://lbhcuracao.app.n8n.cloud/webhook-test/invoice-upload';

export default function FDACreator() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<FDAFormData>({
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [sending, setSending] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const handleInputChange = (field: keyof FDAFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadingFiles(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        continue;
      }
      newFiles.push({ file, id: `${Date.now()}-${file.name}` });
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setUploadingFiles(false);
    e.target.value = ''; // Reset input
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.lbh_number || !formData.ship_name) {
      toast({ title: 'Error', description: 'LBH Number and Ship Name are required', variant: 'destructive' });
      return;
    }

    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: 'Please upload at least one invoice PDF', variant: 'destructive' });
      return;
    }

    setSending(true);

    try {
      // Upload files to Supabase Storage first
      const supabase = getSupabaseClient();
      const fileUrls: string[] = [];

      if (supabase) {
        for (const { file } of uploadedFiles) {
          const filePath = `fda/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('fda-invoices')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast({ title: 'Upload Error', description: uploadError.message, variant: 'destructive' });
          } else {
            const { data } = supabase.storage.from('fda-invoices').getPublicUrl(filePath);
            if (data.publicUrl) {
              fileUrls.push(data.publicUrl);
            }
          }
        }
      }

      // Prepare webhook payload
      const payload = {
        ...formData,
        invoice_files: fileUrls,
        file_count: uploadedFiles.length,
        created_at: new Date().toISOString(),
      };

      // Send to webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`);
      }

      toast({ 
        title: 'Success!', 
        description: 'FDA data sent successfully to n8n workflow' 
      });

      // Reset form
      setFormData({
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
      setUploadedFiles([]);
    } catch (error) {
      console.error('Submit error:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to send FDA data',
        variant: 'destructive' 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout title={t('fda.title')}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('fda.title')}</h1>
            <p className="text-muted-foreground">Create and submit FDA documents with invoices</p>
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={sending} 
            size="lg"
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send FDA
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
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
                <div className="space-y-2 col-span-2">
                  <Label>FDA Responsible</Label>
                  <Input
                    value={formData.fda_responsible}
                    onChange={(e) => handleInputChange('fda_responsible', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Shipper Info */}
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Shipper Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <User className="w-3 h-3" /> Company Name
                  </Label>
                  <Input
                    value={formData.shipper}
                    onChange={(e) => handleInputChange('shipper', e.target.value)}
                    placeholder="Shipping Company Ltd"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={formData.shipper_email}
                      onChange={(e) => handleInputChange('shipper_email', e.target.value)}
                      placeholder="shipper@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <Input
                      value={formData.shipper_phone}
                      onChange={(e) => handleInputChange('shipper_phone', e.target.value)}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consignee Info */}
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Consignee Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <User className="w-3 h-3" /> Company Name
                  </Label>
                  <Input
                    value={formData.consignee}
                    onChange={(e) => handleInputChange('consignee', e.target.value)}
                    placeholder="Consignee Company Ltd"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={formData.consignee_email}
                      onChange={(e) => handleInputChange('consignee_email', e.target.value)}
                      placeholder="consignee@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <Input
                      value={formData.consignee_phone}
                      onChange={(e) => handleInputChange('consignee_phone', e.target.value)}
                      placeholder="+1 234 567 890"
                    />
                  </div>
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
                  <Input
                    value={formData.client}
                    onChange={(e) => handleInputChange('client', e.target.value)}
                    placeholder="Client Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      type="email"
                      value={formData.client_email}
                      onChange={(e) => handleInputChange('client_email', e.target.value)}
                      placeholder="client@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <Input
                      value={formData.client_phone}
                      onChange={(e) => handleInputChange('client_phone', e.target.value)}
                      placeholder="+1 234 567 890"
                    />
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
                    <Input
                      value={formData.billing_company}
                      onChange={(e) => handleInputChange('billing_company', e.target.value)}
                      placeholder="Billing Company Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
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
                    placeholder="123 Business Street, City, Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </Label>
                  <Input
                    value={formData.billing_phone}
                    onChange={(e) => handleInputChange('billing_phone', e.target.value)}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - File Upload */}
          <div className="space-y-6">
            <Card className="card-premium sticky top-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Invoice PDFs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Zone */}
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all group">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Upload PDFs</span>
                  <span className="text-xs text-muted-foreground mt-1">Click or drag files here</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                  />
                </label>

                {uploadingFiles && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </div>
                )}

                <Separator />

                {/* File List */}
                {uploadedFiles.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No files uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} ready
                    </p>
                    {uploadedFiles.map(({ file, id }) => (
                      <div
                        key={id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle className="w-4 h-4 text-success shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeFile(id)}
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Submit Button (Mobile) */}
                <Button 
                  onClick={handleSubmit} 
                  disabled={sending} 
                  className="w-full gap-2 lg:hidden"
                  size="lg"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send FDA
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
