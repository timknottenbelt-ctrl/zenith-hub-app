import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';
import { Search, Ship, Loader2 } from 'lucide-react';

type Vessel = Tables<'vessels'>;

export default function Vessels() {
  const { t } = useLanguage();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [filteredVessels, setFilteredVessels] = useState<Vessel[]>([]);
  const [search, setSearch] = useState('');
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVessels();
  }, []);

  useEffect(() => {
    if (search) {
      const lower = search.toLowerCase();
      setFilteredVessels(
        vessels.filter(
          (v) =>
            v.name.toLowerCase().includes(lower) ||
            v.imo_number?.toLowerCase().includes(lower)
        )
      );
    } else {
      setFilteredVessels(vessels);
    }
  }, [search, vessels]);

  async function fetchVessels() {
    setLoading(true);

    const { data, error } = await supabase.from('vessels').select('*').order('name');

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setVessels(data || []);
      setFilteredVessels(data || []);
    }
    setLoading(false);
  }

  return (
    <DashboardLayout title={t('vessels.title')}>
      <div className="space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('vessels.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card className="card-premium">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredVessels.length === 0 ? (
              <div className="text-center p-12">
                <Ship className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('common.noData')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('vessels.name')}</TableHead>
                    <TableHead>{t('vessels.imo')}</TableHead>
                    <TableHead>{t('vessels.status')}</TableHead>
                    <TableHead>{t('vessels.type')}</TableHead>
                    <TableHead>{t('vessels.flag')}</TableHead>
                    <TableHead>{t('vessels.yearBuilt')}</TableHead>
                    <TableHead>{t('vessels.dwt')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVessels.map((vessel) => (
                    <TableRow
                      key={vessel.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedVessel(vessel)}
                    >
                      <TableCell className="font-medium">{vessel.name}</TableCell>
                      <TableCell>{vessel.imo_number || '-'}</TableCell>
                      <TableCell>
                        {vessel.status && (
                          <Badge variant="secondary">{vessel.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{vessel.vessel_type || '-'}</TableCell>
                      <TableCell>{vessel.flag || '-'}</TableCell>
                      <TableCell>{vessel.year_built || '-'}</TableCell>
                      <TableCell>{vessel.dwt_mt?.toLocaleString() || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Sheet */}
        <Sheet open={!!selectedVessel} onOpenChange={() => setSelectedVessel(null)}>
          <SheetContent className="sm:max-w-lg">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Ship className="w-5 h-5" />
                {selectedVessel?.name}
              </SheetTitle>
            </SheetHeader>
            {selectedVessel && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('vessels.imo')}</p>
                    <p className="font-medium">{selectedVessel.imo_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('vessels.status')}</p>
                    <p className="font-medium">{selectedVessel.status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('vessels.type')}</p>
                    <p className="font-medium">{selectedVessel.vessel_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('vessels.flag')}</p>
                    <p className="font-medium">{selectedVessel.flag || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('vessels.yearBuilt')}</p>
                    <p className="font-medium">{selectedVessel.year_built || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('vessels.owner')}</p>
                    <p className="font-medium">{selectedVessel.owner || '-'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Dimensions</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('vessels.loa')}</p>
                      <p className="font-medium">{selectedVessel.loa_m ? `${selectedVessel.loa_m}m` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('vessels.beam')}</p>
                      <p className="font-medium">{selectedVessel.beam_m ? `${selectedVessel.beam_m}m` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('vessels.draft')}</p>
                      <p className="font-medium">{selectedVessel.draft_m ? `${selectedVessel.draft_m}m` : '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Capacity</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('vessels.dwt')}</p>
                      <p className="font-medium">{selectedVessel.dwt_mt?.toLocaleString() || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('vessels.grossTonnage')}</p>
                      <p className="font-medium">{selectedVessel.gross_tonnage?.toLocaleString() || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}
