import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  Ship,
  Package,
  Database,
  Cpu,
  Loader2,
  CheckCircle,
} from 'lucide-react';

export default function KnowledgeBase() {
  const { t } = useLanguage();
  const [ownersCount, setOwnersCount] = useState(0);
  const [cargoCount, setCargoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCounts();
  }, []);

  async function loadCounts() {
    setLoading(true);
    
    try {
      // Count Owners Agent entries (entries WITHOUT 'CARGO_AGENT' keyword)
      const { count: ownersTotal, error: ownersError } = await supabase
        .from('curacao_knowledge')
        .select('*', { count: 'exact', head: true })
        .not('keywords', 'cs', '{"CARGO_AGENT"}');
      
      if (ownersError) throw ownersError;
      setOwnersCount(ownersTotal || 0);
      
      // Count Cargo Agent entries (entries WITH 'CARGO_AGENT' keyword)
      const { count: cargoTotal, error: cargoError } = await supabase
        .from('curacao_knowledge')
        .select('*', { count: 'exact', head: true })
        .contains('keywords', ['CARGO_AGENT']);
      
      if (cargoError) throw cargoError;
      setCargoCount(cargoTotal || 0);
      
    } catch (error) {
      console.error('Failed to load KB counts:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout title={t('knowledge.title')}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{t('knowledge.title')}</h1>
          <p className="text-muted-foreground">
            Knowledge base voor AI agents - gebruikt door n8n workflows
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Owners Agent Section */}
          <Card className="card-premium">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Ship className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Owners Agent Kennis</h3>
                  <p className="text-sm text-muted-foreground">
                    Crew change, hotels, provisions, spares
                  </p>
                </div>
              </div>
              
              <div className="text-center py-6 bg-muted/30 rounded-xl mb-4">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <>
                    <span className="text-5xl font-bold text-primary">
                      {ownersCount}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">knowledge entries</p>
                  </>
                )}
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Stored in Supabase
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Used by n8n AI agents
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cargo Agent Section */}
          <Card className="card-premium">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Cargo Agent Kennis</h3>
                  <p className="text-sm text-muted-foreground">
                    Port restrictions, terminals, loading rates, ISLA
                  </p>
                </div>
              </div>
              
              <div className="text-center py-6 bg-muted/30 rounded-xl mb-4">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <>
                    <span className="text-5xl font-bold text-success">
                      {cargoCount}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">knowledge entries</p>
                  </>
                )}
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Stored in Supabase
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Used by n8n AI agents
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* How It Works Section */}
        <Card className="card-premium">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">How It Works</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">1</span>
                <p className="text-sm text-muted-foreground">Knowledge entries are stored in Supabase database</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">2</span>
                <p className="text-sm text-muted-foreground">N8N workflows query this knowledge base when processing emails</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">3</span>
                <p className="text-sm text-muted-foreground">AI uses relevant knowledge to answer client questions</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">4</span>
                <p className="text-sm text-muted-foreground">Results in accurate, professional email responses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Section */}
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle className="w-4 h-4" />
          Knowledge base active and operational
        </div>
      </div>
    </DashboardLayout>
  );
}
