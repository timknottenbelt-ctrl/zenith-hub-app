import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSupabaseClient, KnowledgeFile } from '@/lib/supabase';
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
} from 'lucide-react';

type KnowledgeType = 'OWNERS_AGENT_KNOWLEDGE' | 'CARGO_AGENT_KNOWLEDGE' | 'PORT_INFO' | 'TARIFFS';

const categories: { type: KnowledgeType; labelKey: string; icon: typeof BookOpen }[] = [
  { type: 'OWNERS_AGENT_KNOWLEDGE', labelKey: 'knowledge.ownersAgent', icon: Ship },
  { type: 'CARGO_AGENT_KNOWLEDGE', labelKey: 'knowledge.cargoAgent', icon: BookOpen },
  { type: 'PORT_INFO', labelKey: 'knowledge.portInfo', icon: Anchor },
  { type: 'TARIFFS', labelKey: 'knowledge.tariffs', icon: Receipt },
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
      .from('knowledge_files')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      const grouped: Record<KnowledgeType, KnowledgeFile[]> = {
        OWNERS_AGENT_KNOWLEDGE: [],
        CARGO_AGENT_KNOWLEDGE: [],
        PORT_INFO: [],
        TARIFFS: [],
      };
      data?.forEach((file) => {
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      setUploading(null);
      return;
    }

    for (const file of Array.from(fileList)) {
      if (file.type !== 'application/pdf') {
        toast({ title: 'Error', description: 'Only PDF files are allowed', variant: 'destructive' });
        continue;
      }

      const filePath = `${type}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-pdfs')
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
        continue;
      }

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
    toast({ title: t('common.success'), description: 'Files uploaded' });
  }

  async function handleDeleteFile(file: KnowledgeFile) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast({
        title: t('common.error'),
        description: 'Supabase is not configured in this build.',
        variant: 'destructive',
      });
      return;
    }

    await supabase.storage.from('knowledge-pdfs').remove([file.file_path]);
    await supabase.from('knowledge_files').delete().eq('id', file.id);
    await fetchFiles();
    toast({ title: t('common.success'), description: 'File deleted' });
  }

  async function getSignedUrl(filePath: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;

    const { data } = await supabase.storage.from('knowledge-pdfs').createSignedUrl(filePath, 3600);
    return data?.signedUrl;
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map(({ type, labelKey, icon: Icon }) => (
          <Card key={type} className="card-premium">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {t(labelKey)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Zone */}
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">{t('knowledge.uploadFiles')}</span>
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}

              {/* File List */}
              {files[type].length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">{t('knowledge.noFiles')}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {files[type].map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            const url = await getSignedUrl(file.file_path);
                            if (url) window.open(url, '_blank');
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
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
    </DashboardLayout>
  );
}
