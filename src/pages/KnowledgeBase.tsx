import { useEffect, useState, useMemo } from 'react';
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
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

interface KnowledgeEntry {
  id: string;
  category: string;
  topic: string;
  content: string;
  keywords: string[] | null;
}

export default function KnowledgeBase() {
  const { t } = useLanguage();
  const [ownersCount, setOwnersCount] = useState(0);
  const [cargoCount, setCargoCount] = useState(0);
  const [ownersEntries, setOwnersEntries] = useState<KnowledgeEntry[]>([]);
  const [cargoEntries, setCargoEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownersOpen, setOwnersOpen] = useState(false);
  const [cargoOpen, setCargoOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    
    try {
      // Get Owners Agent entries (entries WITHOUT 'CARGO_AGENT' keyword)
      const { data: ownersData, count: ownersTotal, error: ownersError } = await supabase
        .from('curacao_knowledge')
        .select('id, category, topic, content, keywords', { count: 'exact' })
        .not('keywords', 'cs', '{"CARGO_AGENT"}')
        .order('category', { ascending: true });
      
      if (ownersError) throw ownersError;
      setOwnersCount(ownersTotal || 0);
      setOwnersEntries(ownersData || []);
      
      // Get Cargo Agent entries (entries WITH 'CARGO_AGENT' keyword)
      const { data: cargoData, count: cargoTotal, error: cargoError } = await supabase
        .from('curacao_knowledge')
        .select('id, category, topic, content, keywords', { count: 'exact' })
        .contains('keywords', ['CARGO_AGENT'])
        .order('category', { ascending: true });
      
      if (cargoError) throw cargoError;
      setCargoCount(cargoTotal || 0);
      setCargoEntries(cargoData || []);
      
    } catch (error) {
      console.error('Failed to load KB data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter entries based on search query
  const filterEntries = (entries: KnowledgeEntry[]) => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter(entry => 
      entry.topic.toLowerCase().includes(query) ||
      entry.content.toLowerCase().includes(query) ||
      entry.category.toLowerCase().includes(query) ||
      (entry.keywords && entry.keywords.some(k => k.toLowerCase().includes(query)))
    );
  };

  const filteredOwnersEntries = useMemo(() => filterEntries(ownersEntries), [ownersEntries, searchQuery]);
  const filteredCargoEntries = useMemo(() => filterEntries(cargoEntries), [cargoEntries, searchQuery]);

  // Auto-open sections when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      if (filteredOwnersEntries.length > 0) setOwnersOpen(true);
      if (filteredCargoEntries.length > 0) setCargoOpen(true);
    }
  }, [searchQuery, filteredOwnersEntries.length, filteredCargoEntries.length]);

  // Group entries by category
  function groupByCategory(entries: KnowledgeEntry[]) {
    return entries.reduce((acc, entry) => {
      const category = entry.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(entry);
      return acc;
    }, {} as Record<string, KnowledgeEntry[]>);
  }

  function formatCategory(category: string) {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  const EntriesView = ({ entries, isOpen, onToggle, accentColor, searchQuery }: { 
    entries: KnowledgeEntry[]; 
    isOpen: boolean; 
    onToggle: () => void;
    accentColor: 'primary' | 'success';
    searchQuery: string;
  }) => {
    const grouped = groupByCategory(entries);
    const colorClass = accentColor === 'primary' ? 'text-primary' : 'text-success';
    const bgClass = accentColor === 'primary' ? 'bg-primary/10' : 'bg-success/10';

    // Highlight search matches in text
    const highlightText = (text: string) => {
      if (!searchQuery.trim()) return text;
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, i) => 
        regex.test(part) ? <mark key={i} className="bg-warning/30 text-foreground rounded px-0.5">{part}</mark> : part
      );
    };
    
    return (
      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {isOpen ? 'Verberg entries' : `Bekijk entries (${entries.length})`}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        
        {isOpen && (
          <div className="mt-4 space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {Object.entries(grouped).map(([category, categoryEntries]) => (
              <div key={category} className="space-y-2">
                <h4 className={`text-sm font-semibold ${colorClass} flex items-center gap-2`}>
                  <span className={`w-2 h-2 rounded-full ${bgClass}`}></span>
                  {formatCategory(category)}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {categoryEntries.length}
                  </Badge>
                </h4>
                <div className="space-y-2 pl-4">
                  {categoryEntries.map((entry) => (
                    <Collapsible key={entry.id}>
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                          <ChevronDown className="w-4 h-4 mt-0.5 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{highlightText(entry.topic)}</p>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                          <p className="whitespace-pre-wrap">{highlightText(entry.content)}</p>
                          {entry.keywords && entry.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                              {entry.keywords.filter(k => k !== 'CARGO_AGENT').slice(0, 5).map((keyword, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout title={t('knowledge.title')}>
      <div className="space-y-6">
        {/* Header with Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('knowledge.title')}</h1>
            <p className="text-muted-foreground">
              Knowledge base for AI agents
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek in knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search Results Summary */}
        {searchQuery.trim() && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
            <Search className="w-4 h-4" />
            <span>
              {filteredOwnersEntries.length + filteredCargoEntries.length} resultaten gevonden voor "{searchQuery}"
            </span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Owners Agent Section */}
          <Card className="card-premium h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Ship className="w-6 h-6 text-primary" />
                </div>
                <div className="min-h-[48px]">
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
                  Stored in our database
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Used by our AI agents
                </div>
              </div>

              <div className="mt-auto">
                {!loading && (
                  <EntriesView 
                    entries={filteredOwnersEntries} 
                    isOpen={ownersOpen} 
                    onToggle={() => setOwnersOpen(!ownersOpen)}
                    accentColor="primary"
                    searchQuery={searchQuery}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cargo Agent Section */}
          <Card className="card-premium h-full">
            <CardContent className="p-6 h-full flex flex-col">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-success" />
                </div>
                <div className="min-h-[48px]">
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
                  Stored in our database
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Used by our AI agents
                </div>
              </div>

              <div className="mt-auto">
                {!loading && (
                  <EntriesView 
                    entries={filteredCargoEntries} 
                    isOpen={cargoOpen} 
                    onToggle={() => setCargoOpen(!cargoOpen)}
                    accentColor="success"
                    searchQuery={searchQuery}
                  />
                )}
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
                <p className="text-sm text-muted-foreground">Knowledge entries are stored in our database</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">2</span>
                <p className="text-sm text-muted-foreground">AI workflows query this knowledge base when processing emails</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">3</span>
                <p className="text-sm text-muted-foreground">Our AI uses relevant knowledge to answer client questions</p>
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
