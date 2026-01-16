import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Upload,
  Download,
  Trash2,
  Loader2,
  BookOpen,
  Ship,
  Anchor,
  Receipt,
  FileText,
  CheckCircle,
} from 'lucide-react';

type KnowledgeType = 'OWNERS_AGENT_KNOWLEDGE' | 'CARGO_AGENT_KNOWLEDGE' | 'PORT_INFO' | 'TARIFFS';

interface KnowledgeFile {
  id: string;
  type: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

const categories: { type: KnowledgeType; labelKey: string; icon: typeof BookOpen; description: string }[] = [
  { type: 'OWNERS_AGENT_KNOWLEDGE', labelKey: 'knowledge.ownersAgent', icon: Ship, description: 'Documents for owners agent operations' },
  { type: 'CARGO_AGENT_KNOWLEDGE', labelKey: 'knowledge.cargoAgent', icon: BookOpen, description: 'Cargo agent procedures and guidelines' },
  { type: 'PORT_INFO', labelKey: 'knowledge.portInfo', icon: Anchor, description: 'Port information and specifications' },
  { type: 'TARIFFS', labelKey: 'knowledge.tariffs', icon: Receipt, description: 'Tariff sheets and pricing documents' },
];

export default function KnowledgeBase() {
  const { t } = useLanguage();
  const [files, setFiles] = useState<Record<KnowledgeType, KnowledgeFile[]>>({
    OWNERS_AGENT_KNOWLEDGE: [],
    CARGO_AGENT_KNOWLEDGE: [],
    PORT_INFO: [],
    TARIFFS: [],
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<KnowledgeType | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
    setLoading(true);

    const { data, error } = await supabase
      .from('knowledge_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet, that's okay
      console.log('Knowledge files fetch:', error.message);
    } else {
      const grouped: Record<KnowledgeType, KnowledgeFile[]> = {
        OWNERS_AGENT_KNOWLEDGE: [],
        CARGO_AGENT_KNOWLEDGE: [],
        PORT_INFO: [],
        TARIFFS: [],
      };
      data?.forEach((file: KnowledgeFile) => {
        if (grouped[file.type as KnowledgeType]) {
          grouped[file.type as KnowledgeType].push(file);
        }
      });
      setFiles(grouped);
    }
    setLoading(false);
  }

  async function handleFileUpload(type: KnowledgeType, fileList: FileList) {
    setUploading(type);

    for (const file of Array.from(fileList)) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        continue;
      }

      const filePath = `${type}/${Date.now()}-${file.name}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('knowledge-pdfs')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }

      // Save to database
      const { error: insertError } = await supabase.from('knowledge_files').insert({
        type,
        file_path: filePath,
        file_name: file.name,
      });

      if (insertError) {
        toast({ title: 'Error saving file', description: insertError.message, variant: 'destructive' });
      }
    }

    await fetchFiles();
    setUploading(null);
    toast({ title: t('common.success'), description: 'Files uploaded successfully' });
  }

  async function handleDeleteFile(file: KnowledgeFile) {
    // Delete from storage
    await supabase.storage.from('knowledge-pdfs').remove([file.file_path]);
    
    // Delete from database
    await supabase.from('knowledge_files').delete().eq('id', file.id);
    
    await fetchFiles();
    toast({ title: t('common.success'), description: 'File deleted' });
  }

  async function handleDownload(file: KnowledgeFile) {
    const { data } = await supabase.storage
      .from('knowledge-pdfs')
      .createSignedUrl(file.file_path, 3600);
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  }

  if (loading) {
    return (
      <DashboardLayout title={t('knowledge.title')}>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('knowledge.title')}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('knowledge.title')}</h1>
          <p className="text-muted-foreground">Upload and manage knowledge base documents</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map(({ type, labelKey, icon: Icon, description }) => (
            <Card key={type} className="card-premium">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-medium">{t(labelKey)}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {files[type].length} files
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Zone */}
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2 group-hover:bg-primary/10 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm font-medium">Upload PDF</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{t('knowledge.uploadFiles')}</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(type, e.target.files)}
                    disabled={uploading === type}
                  />
                </label>

                {uploading === type && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </div>
                )}

                {/* File List */}
                {files[type].length === 0 ? (
                  <div className="text-center py-4">
                    <FileText className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">{t('knowledge.noFiles')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {files[type].map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle className="w-4 h-4 text-success shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm truncate font-medium">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteFile(file)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
