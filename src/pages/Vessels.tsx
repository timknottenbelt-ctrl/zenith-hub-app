import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';
import { 
  Search, 
  Ship, 
  Loader2, 
  Anchor, 
  Ruler, 
  Calendar,
  Flag,
  Weight,
  ArrowRight,
  X,
} from 'lucide-react';

type Vessel = Tables<'vessels'>;

export default function Vessels() {
  const { t } = useLanguage();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchVessels();
  }, []);

  useEffect(() => {
    if (search.length >= 2) {
      const lower = search.toLowerCase();
      const results = vessels.filter(
        (v) =>
          v.name.toLowerCase().includes(lower) ||
          v.imo_number?.toLowerCase().includes(lower)
      );
      setSearchResults(results);
      setHasSearched(true);
    } else {
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [search, vessels]);

  async function fetchVessels() {
    setLoading(true);
    const { data, error } = await supabase.from('vessels').select('*').order('name');
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setVessels(data || []);
    }
    setLoading(false);
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'inactive': return 'bg-muted text-muted-foreground border-muted';
      case 'maintenance': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={t('vessels.title')}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('vessels.title')}>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero Search Section */}
        <div className="text-center space-y-6 py-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Vessel Database
            </h1>
            <p className="text-muted-foreground">
              Search through {vessels.length} vessels by name or IMO number
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('vessels.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 pr-12 py-6 text-lg rounded-2xl border-2 shadow-lg focus:shadow-xl transition-shadow"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {search.length > 0 && search.length < 2 && (
              <p className="text-sm text-muted-foreground mt-2">Type at least 2 characters to search...</p>
            )}
          </div>
        </div>

        {/* Search Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {searchResults.length} vessel{searchResults.length !== 1 ? 's' : ''} found
              </h2>
              {searchResults.length > 0 && (
                <p className="text-sm text-muted-foreground">Click a vessel for details</p>
              )}
            </div>

            {searchResults.length === 0 ? (
              <Card className="card-premium">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Ship className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No vessels found</h3>
                  <p className="text-muted-foreground max-w-md">
                    No vessels match "{search}". Try searching with a different name or IMO number.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {searchResults.map((vessel) => (
                  <Card
                    key={vessel.id}
                    className={`card-premium cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 ${
                      selectedVessel?.id === vessel.id ? 'ring-2 ring-primary border-primary' : ''
                    }`}
                    onClick={() => setSelectedVessel(selectedVessel?.id === vessel.id ? null : vessel)}
                  >
                    <CardContent className="p-0">
                      {/* Main Row */}
                      <div className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                          <Ship className="w-6 h-6 text-primary" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-lg">{vessel.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                IMO {vessel.imo_number} • {vessel.vessel_type}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={getStatusColor(vessel.status)} variant="outline">
                                {vessel.status}
                              </Badge>
                              <ArrowRight className={`w-4 h-4 transition-transform ${selectedVessel?.id === vessel.id ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {selectedVessel?.id === vessel.id && (
                        <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                                <Flag className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Flag</p>
                                <p className="font-medium">{vessel.flag || '-'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Year Built</p>
                                <p className="font-medium">{vessel.year_built || '-'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                                <Anchor className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Owner</p>
                                <p className="font-medium truncate">{vessel.owner || '-'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                                <Weight className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">DWT</p>
                                <p className="font-medium">{vessel.dwt_mt?.toLocaleString() || '-'} MT</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 pt-4 border-t">
                            <div className="text-center p-3 bg-background rounded-lg">
                              <Ruler className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">LOA</p>
                              <p className="font-semibold">{vessel.loa_m ? `${vessel.loa_m}m` : '-'}</p>
                            </div>
                            <div className="text-center p-3 bg-background rounded-lg">
                              <Ruler className="w-4 h-4 mx-auto text-muted-foreground mb-1 rotate-90" />
                              <p className="text-xs text-muted-foreground">Beam</p>
                              <p className="font-semibold">{vessel.beam_m ? `${vessel.beam_m}m` : '-'}</p>
                            </div>
                            <div className="text-center p-3 bg-background rounded-lg">
                              <Anchor className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">Draft</p>
                              <p className="font-semibold">{vessel.draft_m ? `${vessel.draft_m}m` : '-'}</p>
                            </div>
                            <div className="text-center p-3 bg-background rounded-lg col-span-3 md:col-span-1">
                              <Ship className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">Gross Tonnage</p>
                              <p className="font-semibold">{vessel.gross_tonnage?.toLocaleString() || '-'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State - Show when no search */}
        {!hasSearched && (
          <Card className="card-premium">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
                <Ship className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Search for a Vessel</h3>
              <p className="text-muted-foreground max-w-md">
                Start typing a vessel name or IMO number to search through our database of {vessels.length} vessels.
              </p>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-8 mt-8 pt-8 border-t w-full max-w-md">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{vessels.length}</p>
                  <p className="text-sm text-muted-foreground">Total Vessels</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {vessels.filter(v => v.status === 'active').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {[...new Set(vessels.map(v => v.vessel_type))].length}
                  </p>
                  <p className="text-sm text-muted-foreground">Types</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
