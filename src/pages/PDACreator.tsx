import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import {
  Settings2, Plus, Trash2, Download, Upload,
  AlertTriangle, Loader2, Navigation, BarChart3, Anchor, ChevronDown, ChevronRight, X, Check, Pencil,
} from 'lucide-react';
import {
  usePDAConfigs,
  type TugRule,
  type LoadingRate,
  type TerminalAssignment,
} from '@/hooks/usePDAConfigs';

const CARGO_TYPE_OPTIONS = [
  'crude oil', 'bitumen', 'fuel oil', 'gasoline', 'cement',
  'limestone', 'coal', 'breakbulk', 'heavy equipment', 'fuel', 'hfo',
];

const OPERATION_OPTIONS = ['loading', 'discharge', 'both'];

export default function PDACreator() {
  const {
    configs, loading, error, refetch,
    updateTugRule, createTugRule,
    updateLoadingRate, createLoadingRate,
    updateTerminalAssignment, createTerminalAssignment,
    deactivateRule,
    exportConfig, importConfig,
  } = usePDAConfigs();

  const [activeTab, setActiveTab] = useState('tugs');

  const [editingTugRule, setEditingTugRule] = useState<TugRule | null>(null);
  const [editingRate, setEditingRate] = useState<LoadingRate | null>(null);
  const [editingTerminal, setEditingTerminal] = useState<TerminalAssignment | null>(null);
  const [showNewTug, setShowNewTug] = useState(false);
  const [showNewRate, setShowNewRate] = useState(false);
  const [showNewTerminal, setShowNewTerminal] = useState(false);
  const [expandedTerminals, setExpandedTerminals] = useState<Set<string>>(new Set());
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [newTugForTerminal, setNewTugForTerminal] = useState<string | null>(null);

  // Group tug rules by terminal
  const tugGroups = useMemo(() => {
    if (!configs?.tugRules) return [];
    const map = new Map<string, TugRule[]>();
    for (const rule of configs.tugRules) {
      const key = rule.terminal;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(rule);
    }
    for (const rules of map.values()) {
      rules.sort((a, b) => (a.loa_min ?? 0) - (b.loa_min ?? 0));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [configs?.tugRules]);

  // Group terminal assignments by area, then by terminal_name
  const terminalAreaGroups = useMemo(() => {
    if (!configs?.terminalAssignments) return [];
    const areaMap = new Map<string, Map<string, TerminalAssignment[]>>();
    for (const ta of configs.terminalAssignments) {
      const area = ta.area_name || 'Uncategorized';
      if (!areaMap.has(area)) areaMap.set(area, new Map());
      const termMap = areaMap.get(area)!;
      const termKey = ta.terminal_name;
      if (!termMap.has(termKey)) termMap.set(termKey, []);
      termMap.get(termKey)!.push(ta);
    }
    return Array.from(areaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([area, termMap]) => ({
        area,
        terminals: Array.from(termMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, assignments]) => ({
            name,
            assignments,
            // Aggregate info from first assignment or across all
            portCode: assignments[0]?.port_code || '',
            facility: assignments[0]?.facility_name || '',
            maxLoa: assignments[0]?.max_loa,
            maxDraft: assignments[0]?.max_draft,
            cargoTypes: [...new Set(assignments.map(a => a.cargo_type))],
            operations: [...new Set(assignments.flatMap(a => a.allowed_operations || []))],
          })),
      }));
  }, [configs?.terminalAssignments]);

  // Start areas expanded
  useMemo(() => {
    if (terminalAreaGroups.length > 0 && expandedAreas.size === 0) {
      setExpandedAreas(new Set(terminalAreaGroups.map(g => g.area)));
    }
  }, [terminalAreaGroups]);

  const existingTerminals = useMemo(() => {
    if (!configs?.tugRules) return [];
    return [...new Set(configs.tugRules.map(r => r.terminal))].sort();
  }, [configs?.tugRules]);

  const toggleTerminal = (terminal: string) => {
    setExpandedTerminals(prev => {
      const next = new Set(prev);
      if (next.has(terminal)) next.delete(terminal);
      else next.add(terminal);
      return next;
    });
  };

  const toggleArea = (area: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  // Start tug terminals expanded
  useMemo(() => {
    if (tugGroups.length > 0 && expandedTerminals.size === 0) {
      setExpandedTerminals(new Set(tugGroups.map(([t]) => t)));
    }
  }, [tugGroups]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importConfig(file);
      toast({ title: 'Config geïmporteerd' });
    } catch {
      toast({ title: 'Import mislukt', variant: 'destructive' });
    }
    e.target.value = '';
  };

  const saveTugRule = async (rule: TugRule) => {
    try {
      await updateTugRule(rule.id, {
        rule_name: rule.rule_name, terminal: rule.terminal, port_code: rule.port_code,
        loa_min: rule.loa_min, loa_max: rule.loa_max, tug_count: rule.tug_count,
        cargo_types: rule.cargo_types,
      });
      setEditingTugRule(null);
      toast({ title: 'Tug rule opgeslagen' });
    } catch { toast({ title: 'Opslaan mislukt', variant: 'destructive' }); }
  };

  const saveRate = async (rate: LoadingRate) => {
    try {
      await updateLoadingRate(rate.id, { cargo_type: rate.cargo_type, loading_rate: rate.loading_rate, discharge_rate: rate.discharge_rate, cargo_category: rate.cargo_category, heating_required: rate.heating_required, notes: rate.notes });
      setEditingRate(null);
      toast({ title: 'Loading rate opgeslagen' });
    } catch { toast({ title: 'Opslaan mislukt', variant: 'destructive' }); }
  };

  const saveTerminal = async (t: TerminalAssignment) => {
    try {
      await updateTerminalAssignment(t.id, {
        cargo_type: t.cargo_type, terminal_name: t.terminal_name,
        facility_name: t.facility_name, area_name: t.area_name,
        port_code: t.port_code, max_loa: t.max_loa, max_draft: t.max_draft,
        allowed_operations: t.allowed_operations, priority: t.priority, notes: t.notes,
      });
      setEditingTerminal(null);
      toast({ title: 'Terminal opgeslagen' });
    } catch { toast({ title: 'Opslaan mislukt', variant: 'destructive' }); }
  };

  const handleAddRangeToTerminal = async (form: Record<string, string>, terminal: string) => {
    const cargoArr = form.cargo_types_arr
      ? JSON.parse(form.cargo_types_arr) as string[]
      : null;
    await createTugRule({
      rule_name: form.rule_name,
      terminal,
      port_code: form.port_code || 'WILLEMSTAD',
      loa_min: form.loa_min ? Number(form.loa_min) : 0,
      loa_max: form.loa_max ? Number(form.loa_max) : null,
      tug_count: Number(form.tug_count),
      tug_type: null,
      operation_types: null,
      cargo_types: cargoArr,
    } as any);
    setNewTugForTerminal(null);
    toast({ title: 'Tug rule aangemaakt' });
  };

  if (loading) {
    return (
      <DashboardLayout title="PDA Admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="PDA Admin">
        <Card className="card-premium">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{error}</p>
            <Button onClick={refetch} className="mt-4">Opnieuw laden</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="PDA Admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="heading-primary">PDA Configuration</h1>
              <p className="text-sm text-muted-foreground">Beheer tug rules, loading rates & terminals</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportConfig}>
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="w-4 h-4 mr-1" /> Import</span>
              </Button>
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {configs && (
            <>
              <MiniStat label="Tug Rules" value={configs.tugRules.length} />
              <MiniStat label="Loading Rates" value={configs.loadingRates.length} />
              <MiniStat label="Terminals" value={configs.terminalAssignments.length} />
              <div className="card-premium p-3 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] animate-pulse" />
                  <span className="text-xs font-medium text-foreground">Live ✓</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">n8n synced</p>
              </div>
            </>
          )}
        </div>

        {/* Config Tables */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="tugs" className="gap-1"><Navigation className="w-4 h-4" /> Tugs</TabsTrigger>
            <TabsTrigger value="rates" className="gap-1"><BarChart3 className="w-4 h-4" /> Rates</TabsTrigger>
            <TabsTrigger value="terminals" className="gap-1"><Anchor className="w-4 h-4" /> Terminals</TabsTrigger>
          </TabsList>

          {/* ── Tug Rules (Grouped by Terminal) ──────── */}
          <TabsContent value="tugs" className="mt-4">
            <Card className="card-premium">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tug Rules</CardTitle>
                  <CardDescription>Aantal tugs per terminal & LOA range — gegroepeerd per terminal</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowNewTug(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Nieuw
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
                  <div className="space-y-2 p-6 pt-0">
                    {tugGroups.map(([terminal, rules]) => {
                      const isExpanded = expandedTerminals.has(terminal);
                      return (
                        <div key={terminal} className="border border-border rounded-lg overflow-hidden">
                          <button
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                            onClick={() => toggleTerminal(terminal)}
                          >
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            }
                            <span className="font-semibold text-sm text-foreground">{terminal}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
                          </button>
                          {isExpanded && (
                            <>
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="pl-10">LOA Range</TableHead>
                                    <TableHead>Tugs</TableHead>
                                    <TableHead>Naam</TableHead>
                                    <TableHead>Cargo Types</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rules.map((rule) => (
                                    <TableRow
                                      key={rule.id}
                                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                                      onClick={() => setEditingTugRule({ ...rule })}
                                    >
                                      <TableCell className="pl-10 font-mono text-sm">
                                        {rule.loa_min ?? 0}m – {rule.loa_max ? `${rule.loa_max}m` : '∞'}
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm font-semibold text-foreground">{rule.tug_count} tug{rule.tug_count !== 1 ? 's' : ''}</span>
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{rule.rule_name}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                                        {rule.cargo_types?.length ? rule.cargo_types.join(', ') : '—'}
                                      </TableCell>
                                      <TableCell>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); deactivateRule('tug_rules', rule.id); }}>
                                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              <div className="px-4 py-2 border-t border-border bg-muted/20">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                                  onClick={() => setNewTugForTerminal(terminal)}
                                >
                                  <Plus className="w-3 h-3" /> Add range
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {tugGroups.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">Geen tug rules gevonden</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Loading Rates ──────────────── */}
          <TabsContent value="rates" className="mt-4">
            <Card className="card-premium">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Loading Rates</CardTitle>
                  <CardDescription>Loading & discharge rates per cargo type — port stay = cargo_quantity / rate</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowNewRate(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Nieuw
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cargo Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Loading (MT/day)</TableHead>
                        <TableHead>Discharge (MT/day)</TableHead>
                        <TableHead>Heating</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configs?.loadingRates.map((rate) => (
                        <TableRow key={rate.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditingRate({ ...rate })}>
                          <TableCell className="font-medium">{rate.cargo_type}</TableCell>
                          <TableCell><Badge variant="secondary">{rate.cargo_category || '-'}</Badge></TableCell>
                          <TableCell>{rate.loading_rate.toLocaleString()}</TableCell>
                          <TableCell>{rate.discharge_rate.toLocaleString()}</TableCell>
                          <TableCell>{rate.heating_required ? '🔥' : '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{rate.notes}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deactivateRule('loading_rates', rate.id); }}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Terminals (Grouped by Area) ──────── */}
          <TabsContent value="terminals" className="mt-4">
            <Card className="card-premium">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Terminals</CardTitle>
                  <CardDescription>Terminal configuratie gegroepeerd per area — klik om te bewerken</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowNewTerminal(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Nieuw
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-380px)] min-h-[300px]">
                  <div className="space-y-2 p-6 pt-0">
                    {terminalAreaGroups.map(({ area, terminals }) => {
                      const isExpanded = expandedAreas.has(area);
                      return (
                        <div key={area} className="border border-border rounded-lg overflow-hidden">
                          <button
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                            onClick={() => toggleArea(area)}
                          >
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            }
                            <span className="font-semibold text-sm text-foreground">{area}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{terminals.length} terminal{terminals.length !== 1 ? 's' : ''}</span>
                          </button>
                          {isExpanded && (
                            <Table>
                              <TableHeader>
                                <TableRow className="text-xs">
                                  <TableHead className="pl-6">Terminal</TableHead>
                                  <TableHead>Port</TableHead>
                                  <TableHead>Max LOA</TableHead>
                                  <TableHead>Max Draft</TableHead>
                                  <TableHead>Cargo Types</TableHead>
                                  <TableHead>Operations</TableHead>
                                  <TableHead className="w-20"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {terminals.map((term) => (
                                  <TableRow
                                    key={term.name}
                                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => setEditingTerminal({ ...term.assignments[0] })}
                                  >
                                    <TableCell className="pl-6">
                                      <div>
                                        <span className="font-medium text-sm text-foreground">{term.name}</span>
                                        {term.facility && (
                                          <p className="text-[11px] text-muted-foreground">{term.facility}</p>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{term.portCode}</TableCell>
                                    <TableCell className="text-xs">{term.maxLoa ? `${term.maxLoa}m` : '—'}</TableCell>
                                    <TableCell className="text-xs">{term.maxDraft ? `${term.maxDraft}m` : '—'}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {term.cargoTypes.map(ct => (
                                          <Badge key={ct} variant="secondary" className="text-[10px] py-0 px-1.5 capitalize">{ct}</Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {term.operations.length > 0 ? term.operations.map(op => (
                                          <Badge key={op} variant="outline" className="text-[10px] py-0 px-1.5 capitalize">{op}</Badge>
                                        )) : <span className="text-xs text-muted-foreground">—</span>}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setEditingTerminal({ ...term.assignments[0] }); }}>
                                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); deactivateRule('terminal_assignments', term.assignments[0].id); }}>
                                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      );
                    })}
                    {terminalAreaGroups.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">Geen terminals gevonden</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Edit Tug Rule Dialog ───────────────────── */}
      <Dialog open={!!editingTugRule} onOpenChange={(o) => !o && setEditingTugRule(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tug Rule Bewerken</DialogTitle></DialogHeader>
          {editingTugRule && (
            <div className="space-y-3">
              <Field label="Naam"><Input className="h-9" value={editingTugRule.rule_name} onChange={(e) => setEditingTugRule({ ...editingTugRule, rule_name: e.target.value })} /></Field>
              <Field label="Terminal"><Input className="h-9" value={editingTugRule.terminal} onChange={(e) => setEditingTugRule({ ...editingTugRule, terminal: e.target.value })} /></Field>
              <Field label="Port Code"><Input className="h-9" value={editingTugRule.port_code} onChange={(e) => setEditingTugRule({ ...editingTugRule, port_code: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="LOA Min"><Input className="h-9" type="number" value={editingTugRule.loa_min ?? ''} onChange={(e) => setEditingTugRule({ ...editingTugRule, loa_min: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label="LOA Max"><Input className="h-9" type="number" value={editingTugRule.loa_max ?? ''} onChange={(e) => setEditingTugRule({ ...editingTugRule, loa_max: e.target.value ? Number(e.target.value) : null })} /></Field>
              </div>
              <Field label="Tug Count"><Input className="h-9" type="number" value={editingTugRule.tug_count} onChange={(e) => setEditingTugRule({ ...editingTugRule, tug_count: Number(e.target.value) })} /></Field>
              <Field label="Cargo Types">
                <CargoTypesMultiSelect
                  value={editingTugRule.cargo_types || []}
                  onChange={(cargo_types) => setEditingTugRule({ ...editingTugRule, cargo_types })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTugRule(null)}>Annuleren</Button>
            <Button onClick={() => editingTugRule && saveTugRule(editingTugRule)}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Loading Rate Dialog ───────────────── */}
      <EditDialog open={!!editingRate} onClose={() => setEditingRate(null)} title="Loading Rate Bewerken" onSave={() => editingRate && saveRate(editingRate)}>
        {editingRate && (
          <div className="space-y-3">
            <Field label="Cargo Type"><Input className="h-9" value={editingRate.cargo_type} onChange={(e) => setEditingRate({ ...editingRate, cargo_type: e.target.value })} /></Field>
            <Field label="Category"><Input className="h-9" value={editingRate.cargo_category || ''} onChange={(e) => setEditingRate({ ...editingRate, cargo_category: e.target.value || null })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loading Rate (MT/day)"><Input className="h-9" type="number" value={editingRate.loading_rate} onChange={(e) => setEditingRate({ ...editingRate, loading_rate: Number(e.target.value) })} /></Field>
              <Field label="Discharge Rate (MT/day)"><Input className="h-9" type="number" value={editingRate.discharge_rate} onChange={(e) => setEditingRate({ ...editingRate, discharge_rate: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Notes"><Input className="h-9" value={editingRate.notes || ''} onChange={(e) => setEditingRate({ ...editingRate, notes: e.target.value })} /></Field>
          </div>
        )}
      </EditDialog>

      {/* ── Edit Terminal Assignment Dialog ─────────── */}
      <Dialog open={!!editingTerminal} onOpenChange={(o) => !o && setEditingTerminal(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Terminal Bewerken</DialogTitle></DialogHeader>
          {editingTerminal && (
            <div className="space-y-3">
              <Field label="Terminal Name"><Input className="h-9" value={editingTerminal.terminal_name} onChange={(e) => setEditingTerminal({ ...editingTerminal, terminal_name: e.target.value })} /></Field>
              <Field label="Facility Name"><Input className="h-9" value={editingTerminal.facility_name || ''} onChange={(e) => setEditingTerminal({ ...editingTerminal, facility_name: e.target.value || null })} /></Field>
              <Field label="Area Name"><Input className="h-9" value={editingTerminal.area_name || ''} onChange={(e) => setEditingTerminal({ ...editingTerminal, area_name: e.target.value || null })} /></Field>
              <Field label="Port Code">
                <Input className="h-9 uppercase" value={editingTerminal.port_code} onChange={(e) => setEditingTerminal({ ...editingTerminal, port_code: e.target.value.toUpperCase() })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Max LOA (m)"><Input className="h-9" type="number" value={editingTerminal.max_loa ?? ''} onChange={(e) => setEditingTerminal({ ...editingTerminal, max_loa: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label="Max Draft (m)"><Input className="h-9" type="number" value={editingTerminal.max_draft ?? ''} onChange={(e) => setEditingTerminal({ ...editingTerminal, max_draft: e.target.value ? Number(e.target.value) : null })} /></Field>
              </div>
              <Field label="Accepted Cargo Types">
                <CargoTypesMultiSelect
                  value={editingTerminal.cargo_type ? [editingTerminal.cargo_type] : []}
                  onChange={(types) => setEditingTerminal({ ...editingTerminal, cargo_type: types[0] || '' })}
                />
              </Field>
              <Field label="Allowed Operations">
                <OperationsMultiSelect
                  value={editingTerminal.allowed_operations || []}
                  onChange={(ops) => setEditingTerminal({ ...editingTerminal, allowed_operations: ops })}
                />
              </Field>
              <Field label="Priority"><Input className="h-9" type="number" value={editingTerminal.priority ?? 1} onChange={(e) => setEditingTerminal({ ...editingTerminal, priority: Number(e.target.value) || 1 })} /></Field>
              <Field label="Notes"><Input className="h-9" value={editingTerminal.notes || ''} onChange={(e) => setEditingTerminal({ ...editingTerminal, notes: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTerminal(null)}>Annuleren</Button>
            <Button onClick={() => editingTerminal && saveTerminal(editingTerminal)}>Opslaan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Tug Rule Dialog (global) ────────────── */}
      <NewTugRuleDialog
        open={showNewTug}
        onClose={() => setShowNewTug(false)}
        existingTerminals={existingTerminals}
        onSave={async (form) => {
          const cargoArr = form.cargo_types_arr
            ? JSON.parse(form.cargo_types_arr) as string[]
            : null;
          await createTugRule({
            rule_name: form.rule_name,
            terminal: form.terminal,
            port_code: form.port_code || 'WILLEMSTAD',
            loa_min: form.loa_min ? Number(form.loa_min) : 0,
            loa_max: form.loa_max ? Number(form.loa_max) : null,
            tug_count: Number(form.tug_count),
            tug_type: null,
            operation_types: null,
            cargo_types: cargoArr,
          } as any);
          setShowNewTug(false);
          toast({ title: 'Tug rule aangemaakt' });
        }}
      />

      {/* ── New Tug Rule for specific terminal ─────── */}
      <NewTugRuleForTerminalDialog
        open={!!newTugForTerminal}
        terminal={newTugForTerminal || ''}
        onClose={() => setNewTugForTerminal(null)}
        onSave={(form) => handleAddRangeToTerminal(form, newTugForTerminal!)}
      />

      {/* ── New Loading Rate Dialog ────────────────── */}
      <NewRuleDialog
        open={showNewRate} onClose={() => setShowNewRate(false)} title="Nieuwe Loading Rate"
        onSave={async (form) => {
          await createLoadingRate({ cargo_type: form.cargo_type, cargo_category: form.cargo_category || null, loading_rate: Number(form.loading_rate), discharge_rate: Number(form.discharge_rate), heating_required: false, heating_buffer_percent: 0, port_stay_buffer_percent: 0, notes: form.notes || null } as any);
          setShowNewRate(false);
          toast({ title: 'Loading rate aangemaakt' });
        }}
        fields={[
          { key: 'cargo_type', label: 'Cargo Type', required: true },
          { key: 'cargo_category', label: 'Category' },
          { key: 'loading_rate', label: 'Loading Rate (MT/day)', type: 'number', required: true },
          { key: 'discharge_rate', label: 'Discharge Rate (MT/day)', type: 'number', required: true },
          { key: 'notes', label: 'Notes' },
        ]}
      />

      {/* ── New Terminal Dialog ─────────────────────── */}
      <NewTerminalDialog
        open={showNewTerminal}
        onClose={() => setShowNewTerminal(false)}
        onSave={async (data) => {
          await createTerminalAssignment({
            cargo_type: data.cargo_type,
            terminal_name: data.terminal_name,
            facility_name: data.facility_name || null,
            area_name: data.area_name || null,
            port_code: data.port_code || 'WILLEMSTAD',
            loa_min: 0,
            loa_max: null,
            max_loa: data.max_loa ? Number(data.max_loa) : null,
            max_draft: data.max_draft ? Number(data.max_draft) : null,
            has_pipeline: false,
            has_crane: false,
            has_repair_berth: false,
            allowed_operations: data.allowed_operations || [],
            notes: data.notes || null,
            priority: data.priority ? Number(data.priority) : 1,
          } as any);
          setShowNewTerminal(false);
          toast({ title: 'Terminal aangemaakt' });
        }}
      />
    </DashboardLayout>
  );
}

// ─── Sub-components ──────────────────────────────────

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-premium p-3 text-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/** Multi-select dropdown for cargo types with chips */
function CargoTypesMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs py-0.5 px-2">
              {tag}
              <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} className="hover:text-destructive ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
          onClick={() => setOpen(!open)}
        >
          <span className="text-muted-foreground">
            {value.length === 0 ? 'Selecteer cargo types…' : `${value.length} geselecteerd`}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
            {CARGO_TYPE_OPTIONS.map((option) => {
              const selected = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
                  onClick={() => toggleOption(option)}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-primary border-primary' : 'border-input'}`}>
                    {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="capitalize">{option}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Multi-select for operations */
function OperationsMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {OPERATION_OPTIONS.map((op) => {
        const selected = value.includes(op);
        return (
          <button
            key={op}
            type="button"
            className={`px-3 py-1.5 rounded-md border text-sm transition-colors capitalize ${
              selected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-muted/50'
            }`}
            onClick={() => toggleOption(op)}
          >
            {op}
          </button>
        );
      })}
    </div>
  );
}

function EditDialog({ open, onClose, title, onSave, children }: {
  open: boolean; onClose: () => void; title: string; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={onSave}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** New Tug Rule dialog with terminal picker */
function NewTugRuleDialog({ open, onClose, existingTerminals, onSave }: {
  open: boolean; onClose: () => void;
  existingTerminals: string[];
  onSave: (form: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [useNewTerminal, setUseNewTerminal] = useState(false);
  const [cargoTypes, setCargoTypes] = useState<string[]>([]);

  const handleSave = async () => {
    if (!form.terminal && !useNewTerminal) {
      toast({ title: 'Terminal is verplicht', variant: 'destructive' }); return;
    }
    if (!form.rule_name) {
      toast({ title: 'Naam is verplicht', variant: 'destructive' }); return;
    }
    if (!form.tug_count) {
      toast({ title: 'Tug Count is verplicht', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const submitForm = { ...form, cargo_types_arr: cargoTypes.length ? JSON.stringify(cargoTypes) : '' };
      await onSave(submitForm);
      setForm({}); setCargoTypes([]); setUseNewTerminal(false);
    } catch { toast({ title: 'Aanmaken mislukt', variant: 'destructive' }); } finally { setSaving(false); }
  };

  const handleClose = () => { onClose(); setForm({}); setCargoTypes([]); setUseNewTerminal(false); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nieuwe Tug Rule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Terminal">
            {!useNewTerminal && existingTerminals.length > 0 ? (
              <div className="space-y-2">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.terminal || ''}
                  onChange={(e) => setForm(p => ({ ...p, terminal: e.target.value }))}
                >
                  <option value="">Selecteer bestaande terminal…</option>
                  {existingTerminals.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setUseNewTerminal(true); setForm(p => ({ ...p, terminal: '' })); }}>
                  + Nieuwe terminal aanmaken
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input className="h-9" placeholder="Naam nieuwe terminal" value={form.terminal || ''} onChange={(e) => setForm(p => ({ ...p, terminal: e.target.value }))} />
                {existingTerminals.length > 0 && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setUseNewTerminal(false)}>← Kies bestaande terminal</button>
                )}
              </div>
            )}
          </Field>
          <Field label="Naam"><Input className="h-9" value={form.rule_name || ''} onChange={(e) => setForm(p => ({ ...p, rule_name: e.target.value }))} /></Field>
          <Field label="Port Code"><Input className="h-9" value={form.port_code || ''} onChange={(e) => setForm(p => ({ ...p, port_code: e.target.value }))} placeholder="WILLEMSTAD" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="LOA Min"><Input className="h-9" type="number" value={form.loa_min || ''} onChange={(e) => setForm(p => ({ ...p, loa_min: e.target.value }))} /></Field>
            <Field label="LOA Max"><Input className="h-9" type="number" value={form.loa_max || ''} onChange={(e) => setForm(p => ({ ...p, loa_max: e.target.value }))} /></Field>
          </div>
          <Field label="Tug Count"><Input className="h-9" type="number" value={form.tug_count || ''} onChange={(e) => setForm(p => ({ ...p, tug_count: e.target.value }))} /></Field>
          <Field label="Cargo Types">
            <CargoTypesMultiSelect value={cargoTypes} onChange={setCargoTypes} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuleren</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aanmaken'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** New tug rule for a specific terminal (add range) */
function NewTugRuleForTerminalDialog({ open, terminal, onClose, onSave }: {
  open: boolean; terminal: string; onClose: () => void;
  onSave: (form: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cargoTypes, setCargoTypes] = useState<string[]>([]);

  const handleSave = async () => {
    if (!form.rule_name) { toast({ title: 'Naam is verplicht', variant: 'destructive' }); return; }
    if (!form.tug_count) { toast({ title: 'Tug Count is verplicht', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const submitForm = { ...form, cargo_types_arr: cargoTypes.length ? JSON.stringify(cargoTypes) : '' };
      await onSave(submitForm);
      setForm({}); setCargoTypes([]);
    } catch { toast({ title: 'Aanmaken mislukt', variant: 'destructive' }); } finally { setSaving(false); }
  };

  const handleClose = () => { onClose(); setForm({}); setCargoTypes([]); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nieuwe LOA Range — {terminal}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Naam"><Input className="h-9" value={form.rule_name || ''} onChange={(e) => setForm(p => ({ ...p, rule_name: e.target.value }))} /></Field>
          <Field label="Port Code"><Input className="h-9" value={form.port_code || ''} onChange={(e) => setForm(p => ({ ...p, port_code: e.target.value }))} placeholder="WILLEMSTAD" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="LOA Min"><Input className="h-9" type="number" value={form.loa_min || ''} onChange={(e) => setForm(p => ({ ...p, loa_min: e.target.value }))} /></Field>
            <Field label="LOA Max"><Input className="h-9" type="number" value={form.loa_max || ''} onChange={(e) => setForm(p => ({ ...p, loa_max: e.target.value }))} /></Field>
          </div>
          <Field label="Tug Count"><Input className="h-9" type="number" value={form.tug_count || ''} onChange={(e) => setForm(p => ({ ...p, tug_count: e.target.value }))} /></Field>
          <Field label="Cargo Types">
            <CargoTypesMultiSelect value={cargoTypes} onChange={setCargoTypes} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuleren</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aanmaken'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** New Terminal dialog with full fields */
function NewTerminalDialog({ open, onClose, onSave }: {
  open: boolean; onClose: () => void;
  onSave: (data: { terminal_name: string; facility_name: string; area_name: string; port_code: string; max_loa: string; max_draft: string; cargo_type: string; allowed_operations: string[]; priority: string; notes: string }) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cargoTypes, setCargoTypes] = useState<string[]>([]);
  const [operations, setOperations] = useState<string[]>([]);

  const handleSave = async () => {
    if (!form.terminal_name) { toast({ title: 'Terminal Name is verplicht', variant: 'destructive' }); return; }
    if (cargoTypes.length === 0) { toast({ title: 'Selecteer minstens 1 cargo type', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await onSave({
        terminal_name: form.terminal_name,
        facility_name: form.facility_name || '',
        area_name: form.area_name || '',
        port_code: (form.port_code || 'WILLEMSTAD').toUpperCase(),
        max_loa: form.max_loa || '',
        max_draft: form.max_draft || '',
        cargo_type: cargoTypes[0] || '',
        allowed_operations: operations,
        priority: form.priority || '1',
        notes: form.notes || '',
      });
      setForm({}); setCargoTypes([]); setOperations([]);
    } catch { toast({ title: 'Aanmaken mislukt', variant: 'destructive' }); } finally { setSaving(false); }
  };

  const handleClose = () => { onClose(); setForm({}); setCargoTypes([]); setOperations([]); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nieuwe Terminal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Terminal Name"><Input className="h-9" value={form.terminal_name || ''} onChange={(e) => setForm(p => ({ ...p, terminal_name: e.target.value }))} /></Field>
          <Field label="Facility Name"><Input className="h-9" value={form.facility_name || ''} onChange={(e) => setForm(p => ({ ...p, facility_name: e.target.value }))} /></Field>
          <Field label="Area Name"><Input className="h-9" value={form.area_name || ''} onChange={(e) => setForm(p => ({ ...p, area_name: e.target.value }))} placeholder="e.g. ISLA, Fuik Bay, Offshore" /></Field>
          <Field label="Port Code">
            <Input className="h-9 uppercase" value={form.port_code || ''} onChange={(e) => setForm(p => ({ ...p, port_code: e.target.value.toUpperCase() }))} placeholder="WILLEMSTAD" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max LOA (m)"><Input className="h-9" type="number" value={form.max_loa || ''} onChange={(e) => setForm(p => ({ ...p, max_loa: e.target.value }))} /></Field>
            <Field label="Max Draft (m)"><Input className="h-9" type="number" value={form.max_draft || ''} onChange={(e) => setForm(p => ({ ...p, max_draft: e.target.value }))} /></Field>
          </div>
          <Field label="Accepted Cargo Types">
            <CargoTypesMultiSelect value={cargoTypes} onChange={setCargoTypes} />
          </Field>
          <Field label="Allowed Operations">
            <OperationsMultiSelect value={operations} onChange={setOperations} />
          </Field>
          <Field label="Priority"><Input className="h-9" type="number" value={form.priority || '1'} onChange={(e) => setForm(p => ({ ...p, priority: e.target.value }))} /></Field>
          <Field label="Notes"><Input className="h-9" value={form.notes || ''} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuleren</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aanmaken'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldDef { key: string; label: string; type?: string; required?: boolean; }

function NewRuleDialog({ open, onClose, title, onSave, fields }: {
  open: boolean; onClose: () => void; title: string;
  onSave: (form: Record<string, string>) => Promise<void>;
  fields: FieldDef[];
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    for (const f of fields) {
      if (f.required && !form[f.key]) {
        toast({ title: `${f.label} is verplicht`, variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    try { await onSave(form); setForm({}); } catch { toast({ title: 'Aanmaken mislukt', variant: 'destructive' }); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setForm({}); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input className="h-9" type={f.type || 'text'} value={form[f.key] || ''} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
            </Field>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setForm({}); }}>Annuleren</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aanmaken'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
