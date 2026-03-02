import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import {
  Ship, Anchor, Settings2, Calculator, Plus, Trash2, Download, Upload,
  AlertTriangle, CheckCircle2, Loader2, Pencil, BarChart3, Navigation,
} from 'lucide-react';
import {
  usePDAConfigs,
  calculatePDA,
  type VesselInput,
  type PDACalculation,
  type TugRule,
  type LoadingRate,
  type TerminalAssignment,
} from '@/hooks/usePDAConfigs';

// ─── Constants ───────────────────────────────────────
const OPERATIONS = ['load', 'discharge', 'bunker', 'repair', 'STS'];
const PORT_CODES = ['WILLEMSTAD', 'ISLA', 'OFFSHORE'];

const EMPTY_VESSEL: VesselInput = {
  vessel_name: '', loa: 0, grt: 0, dwt: 0, flag: '',
  operation: 'load', cargo_type: '', cargo_quantity: 0, port_code: 'WILLEMSTAD',
};

// ─── Page ────────────────────────────────────────────
export default function PDACreator() {
  const {
    configs, loading, error, refetch,
    updateTugRule, createTugRule,
    updateLoadingRate, createLoadingRate,
    updateTerminalAssignment, createTerminalAssignment,
    updatePortStayFormula,
    deactivateRule,
    exportConfig, importConfig,
  } = usePDAConfigs();

  const [activeTab, setActiveTab] = useState('vessel');
  const [vessel, setVessel] = useState<VesselInput>({ ...EMPTY_VESSEL });
  const [calculation, setCalculation] = useState<PDACalculation | null>(null);

  // What-if slider overrides
  const [qtyOverride, setQtyOverride] = useState<number | null>(null);
  const [loaOverride, setLoaOverride] = useState<number | null>(null);

  // Config editing dialogs
  const [editingTugRule, setEditingTugRule] = useState<TugRule | null>(null);
  const [editingRate, setEditingRate] = useState<LoadingRate | null>(null);
  const [editingTerminal, setEditingTerminal] = useState<TerminalAssignment | null>(null);
  const [showNewTug, setShowNewTug] = useState(false);
  const [showNewRate, setShowNewRate] = useState(false);
  const [showNewTerminal, setShowNewTerminal] = useState(false);

  // Derived cargo types from configs
  const cargoTypes = useMemo(() => {
    if (!configs) return [];
    const set = new Set(configs.loadingRates.map((r) => r.cargo_type));
    return Array.from(set).sort();
  }, [configs]);

  // ── Calculation ────────────────────────────────
  const effectiveVessel = useMemo<VesselInput>(() => ({
    ...vessel,
    cargo_quantity: qtyOverride ?? vessel.cargo_quantity,
    loa: loaOverride ?? vessel.loa,
  }), [vessel, qtyOverride, loaOverride]);

  const liveCalc = useMemo(() => {
    if (!configs || !effectiveVessel.vessel_name || !effectiveVessel.cargo_type) return null;
    return calculatePDA(effectiveVessel, configs);
  }, [effectiveVessel, configs]);

  const handleCalculate = () => {
    if (!configs) return;
    if (!vessel.vessel_name || !vessel.cargo_type || vessel.loa <= 0) {
      toast({ title: 'Velden ontbreken', description: 'Vul scheepsnaam, LOA en cargo type in.', variant: 'destructive' });
      return;
    }
    const result = calculatePDA(effectiveVessel, configs);
    setCalculation(result);
    toast({ title: 'PDA Berekend', description: `${result.terminal} — ${result.total_port_stay_days} dagen` });
  };

  // ── Import handler ─────────────────────────────
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

  // ── Save helpers ───────────────────────────────
  const saveTugRule = async (rule: TugRule) => {
    try {
      await updateTugRule(rule.id, { terminal_code: rule.terminal_code, loa_min: rule.loa_min, loa_max: rule.loa_max, tugs_required: rule.tugs_required, notes: rule.notes });
      setEditingTugRule(null);
      toast({ title: 'Tug rule opgeslagen' });
    } catch { toast({ title: 'Opslaan mislukt', variant: 'destructive' }); }
  };

  const saveRate = async (rate: LoadingRate) => {
    try {
      await updateLoadingRate(rate.id, { cargo_type: rate.cargo_type, rate_mt_per_day: rate.rate_mt_per_day, operation: rate.operation, notes: rate.notes });
      setEditingRate(null);
      toast({ title: 'Loading rate opgeslagen' });
    } catch { toast({ title: 'Opslaan mislukt', variant: 'destructive' }); }
  };

  const saveTerminal = async (t: TerminalAssignment) => {
    try {
      await updateTerminalAssignment(t.id, { cargo_type: t.cargo_type, loa_min: t.loa_min, loa_max: t.loa_max, terminal_code: t.terminal_code, port_code: t.port_code, notes: t.notes });
      setEditingTerminal(null);
      toast({ title: 'Terminal assignment opgeslagen' });
    } catch { toast({ title: 'Opslaan mislukt', variant: 'destructive' }); }
  };

  if (loading) {
    return (
      <DashboardLayout title="PDA Creator">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="PDA Creator">
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
    <DashboardLayout title="PDA Creator">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Anchor className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="heading-primary">Port Data Analyzer</h1>
              <p className="text-sm text-muted-foreground">Bereken PDA's voor Curaçao</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Input + Config ──────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="vessel" className="gap-1"><Ship className="w-4 h-4" /> Vessel</TabsTrigger>
                <TabsTrigger value="tugs" className="gap-1"><Navigation className="w-4 h-4" /> Tugs</TabsTrigger>
                <TabsTrigger value="rates" className="gap-1"><BarChart3 className="w-4 h-4" /> Rates</TabsTrigger>
                <TabsTrigger value="terminals" className="gap-1"><Settings2 className="w-4 h-4" /> Terminals</TabsTrigger>
              </TabsList>

              {/* ── Vessel Input ──────────────────── */}
              <TabsContent value="vessel" className="space-y-4 mt-4">
                <Card className="card-premium">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Vessel & Cargo Data</CardTitle>
                    <CardDescription>Voer scheeps- en ladinggegevens in</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Vessel Name *</Label>
                        <Input className="h-9" value={vessel.vessel_name} onChange={(e) => setVessel((v) => ({ ...v, vessel_name: e.target.value }))} placeholder="MT Atlantic Spirit" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Flag</Label>
                        <Input className="h-9" value={vessel.flag} onChange={(e) => setVessel((v) => ({ ...v, flag: e.target.value }))} placeholder="Panama" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">LOA (m) *</Label>
                        <Input className="h-9" type="number" value={vessel.loa || ''} onChange={(e) => setVessel((v) => ({ ...v, loa: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">GRT</Label>
                        <Input className="h-9" type="number" value={vessel.grt || ''} onChange={(e) => setVessel((v) => ({ ...v, grt: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">DWT</Label>
                        <Input className="h-9" type="number" value={vessel.dwt || ''} onChange={(e) => setVessel((v) => ({ ...v, dwt: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Operation *</Label>
                        <Select value={vessel.operation} onValueChange={(v) => setVessel((p) => ({ ...p, operation: v }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {OPERATIONS.map((op) => <SelectItem key={op} value={op}>{op.charAt(0).toUpperCase() + op.slice(1)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Port Code</Label>
                        <Select value={vessel.port_code} onValueChange={(v) => setVessel((p) => ({ ...p, port_code: v }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PORT_CODES.map((pc) => <SelectItem key={pc} value={pc}>{pc}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cargo Type *</Label>
                        <Select value={vessel.cargo_type} onValueChange={(v) => setVessel((p) => ({ ...p, cargo_type: v }))}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select cargo" /></SelectTrigger>
                          <SelectContent>
                            {cargoTypes.map((ct) => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cargo Quantity (MT)</Label>
                        <Input className="h-9" type="number" value={vessel.cargo_quantity || ''} onChange={(e) => setVessel((v) => ({ ...v, cargo_quantity: Number(e.target.value) }))} />
                      </div>
                    </div>

                    {/* What-if Sliders */}
                    {vessel.cargo_quantity > 0 && (
                      <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What-If Scenario</p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Cargo Quantity</span>
                            <span className="font-medium">{qtyOverride ?? vessel.cargo_quantity} MT</span>
                          </div>
                          <Slider
                            min={Math.round(vessel.cargo_quantity * 0.5)}
                            max={Math.round(vessel.cargo_quantity * 1.5)}
                            step={100}
                            value={[qtyOverride ?? vessel.cargo_quantity]}
                            onValueChange={([v]) => setQtyOverride(v === vessel.cargo_quantity ? null : v)}
                          />
                        </div>
                        {vessel.loa > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>LOA</span>
                              <span className="font-medium">{loaOverride ?? vessel.loa} m</span>
                            </div>
                            <Slider
                              min={Math.round(vessel.loa * 0.7)}
                              max={Math.round(vessel.loa * 1.3)}
                              step={1}
                              value={[loaOverride ?? vessel.loa]}
                              onValueChange={([v]) => setLoaOverride(v === vessel.loa ? null : v)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <Button onClick={handleCalculate} className="w-full">
                      <Calculator className="w-4 h-4 mr-2" /> Bereken PDA
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Tug Rules Config ──────────────── */}
              <TabsContent value="tugs" className="mt-4">
                <Card className="card-premium">
                  <CardHeader className="pb-3 flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Tug Rules</CardTitle>
                      <CardDescription>Aantal tugs per terminal en LOA</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowNewTug(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Nieuw
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Terminal</TableHead>
                            <TableHead>LOA Min</TableHead>
                            <TableHead>LOA Max</TableHead>
                            <TableHead>Tugs</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {configs?.tugRules.map((rule) => (
                            <TableRow key={rule.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditingTugRule({ ...rule })}>
                              <TableCell><Badge variant="outline">{rule.terminal_code}</Badge></TableCell>
                              <TableCell>{rule.loa_min}m</TableCell>
                              <TableCell>{rule.loa_max ? `${rule.loa_max}m` : '∞'}</TableCell>
                              <TableCell><Badge>{rule.tugs_required}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{rule.notes}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deactivateRule('pda_tug_rules', rule.id); }}>
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

              {/* ── Loading Rates Config ──────────── */}
              <TabsContent value="rates" className="mt-4">
                <Card className="card-premium">
                  <CardHeader className="pb-3 flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Loading Rates</CardTitle>
                      <CardDescription>MT/dag per cargo type en operatie</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowNewRate(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Nieuw
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cargo Type</TableHead>
                            <TableHead>Rate (MT/day)</TableHead>
                            <TableHead>Operation</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {configs?.loadingRates.map((rate) => (
                            <TableRow key={rate.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditingRate({ ...rate })}>
                              <TableCell className="font-medium">{rate.cargo_type}</TableCell>
                              <TableCell><Badge variant="secondary">{rate.rate_mt_per_day.toLocaleString()}</Badge></TableCell>
                              <TableCell>{rate.operation}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{rate.notes}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deactivateRule('pda_loading_rates', rate.id); }}>
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

              {/* ── Terminal Assignments ──────────── */}
              <TabsContent value="terminals" className="mt-4">
                <Card className="card-premium">
                  <CardHeader className="pb-3 flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Terminal Assignments</CardTitle>
                      <CardDescription>Cargo type + LOA → terminal mapping</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowNewTerminal(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Nieuw
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cargo Type</TableHead>
                            <TableHead>LOA Range</TableHead>
                            <TableHead>Terminal</TableHead>
                            <TableHead>Port</TableHead>
                            <TableHead className="w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {configs?.terminalAssignments.map((ta) => (
                            <TableRow key={ta.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditingTerminal({ ...ta })}>
                              <TableCell className="font-medium">{ta.cargo_type}</TableCell>
                              <TableCell>{ta.loa_min}m – {ta.loa_max ? `${ta.loa_max}m` : '∞'}</TableCell>
                              <TableCell><Badge variant="outline">{ta.terminal_code}</Badge></TableCell>
                              <TableCell>{ta.port_code}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deactivateRule('pda_terminal_assignments', ta.id); }}>
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
            </Tabs>
          </div>

          {/* ── Right: Live Preview ───────────────── */}
          <div className="space-y-4">
            <Card className="card-premium border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {liveCalc ? (
                  <>
                    <div className="space-y-3">
                      <PreviewRow label="Vessel" value={liveCalc.vessel.vessel_name || '—'} />
                      <PreviewRow label="Terminal" value={liveCalc.terminal} highlight />
                      <PreviewRow label="Tugs" value={String(liveCalc.tugs)} />
                      <Separator />
                      <PreviewRow label="Loading Rate" value={`${liveCalc.loading_rate.toLocaleString()} MT/day`} />
                      <PreviewRow label="Loading Time" value={`${liveCalc.loading_time_hours} hrs`} />
                      <PreviewRow label="Buffer" value={`${liveCalc.buffer_hours} hrs`} />
                      <PreviewRow label="Positioning" value={`${liveCalc.positioning_hours} hrs`} />
                      <Separator />
                      <PreviewRow label="Total Port Stay" value={`${liveCalc.total_port_stay_hours} hrs`} highlight />
                      <PreviewRow label="Days" value={`${liveCalc.total_port_stay_days} days`} highlight />
                    </div>

                    {liveCalc.warnings.length > 0 && (
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-1">
                        {liveCalc.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-warning flex gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ship className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Voer vessel data in voor een live preview</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Final Calculation Result */}
            {calculation && (
              <Card className="card-premium bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    PDA Resultaat
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <PreviewRow label="Vessel" value={calculation.vessel.vessel_name} />
                  <PreviewRow label="Terminal" value={calculation.terminal} highlight />
                  <PreviewRow label="Tugs" value={String(calculation.tugs)} />
                  <PreviewRow label="Port Stay" value={`${calculation.total_port_stay_days} dagen`} highlight />
                  <PreviewRow label="Cargo" value={`${calculation.vessel.cargo_quantity.toLocaleString()} MT ${calculation.vessel.cargo_type}`} />
                </CardContent>
              </Card>
            )}

            {/* Status Indicator */}
            <Card className="card-premium">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] animate-pulse" />
                  <span className="text-xs font-medium text-foreground">Connected to Supabase ✓</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Last updated: {new Date().toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            {configs && (
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Tug Rules" value={configs.tugRules.length} />
                <MiniStat label="Loading Rates" value={configs.loadingRates.length} />
                <MiniStat label="Terminals" value={configs.terminalAssignments.length} />
                <MiniStat label="Port Formulas" value={configs.portStayFormulas.length} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Tug Rule Dialog ───────────────────── */}
      <EditDialog
        open={!!editingTugRule}
        onClose={() => setEditingTugRule(null)}
        title="Tug Rule Bewerken"
        onSave={() => editingTugRule && saveTugRule(editingTugRule)}
      >
        {editingTugRule && (
          <div className="space-y-3">
            <Field label="Terminal"><Input className="h-9" value={editingTugRule.terminal_code} onChange={(e) => setEditingTugRule({ ...editingTugRule, terminal_code: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LOA Min"><Input className="h-9" type="number" value={editingTugRule.loa_min} onChange={(e) => setEditingTugRule({ ...editingTugRule, loa_min: Number(e.target.value) })} /></Field>
              <Field label="LOA Max"><Input className="h-9" type="number" value={editingTugRule.loa_max ?? ''} onChange={(e) => setEditingTugRule({ ...editingTugRule, loa_max: e.target.value ? Number(e.target.value) : null })} /></Field>
            </div>
            <Field label="Tugs"><Input className="h-9" type="number" value={editingTugRule.tugs_required} onChange={(e) => setEditingTugRule({ ...editingTugRule, tugs_required: Number(e.target.value) })} /></Field>
            <Field label="Notes"><Input className="h-9" value={editingTugRule.notes || ''} onChange={(e) => setEditingTugRule({ ...editingTugRule, notes: e.target.value })} /></Field>
          </div>
        )}
      </EditDialog>

      {/* ── Edit Loading Rate Dialog ───────────────── */}
      <EditDialog
        open={!!editingRate}
        onClose={() => setEditingRate(null)}
        title="Loading Rate Bewerken"
        onSave={() => editingRate && saveRate(editingRate)}
      >
        {editingRate && (
          <div className="space-y-3">
            <Field label="Cargo Type"><Input className="h-9" value={editingRate.cargo_type} onChange={(e) => setEditingRate({ ...editingRate, cargo_type: e.target.value })} /></Field>
            <Field label="Rate (MT/day)"><Input className="h-9" type="number" value={editingRate.rate_mt_per_day} onChange={(e) => setEditingRate({ ...editingRate, rate_mt_per_day: Number(e.target.value) })} /></Field>
            <Field label="Operation">
              <Select value={editingRate.operation} onValueChange={(v) => setEditingRate({ ...editingRate, operation: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{OPERATIONS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Notes"><Input className="h-9" value={editingRate.notes || ''} onChange={(e) => setEditingRate({ ...editingRate, notes: e.target.value })} /></Field>
          </div>
        )}
      </EditDialog>

      {/* ── Edit Terminal Assignment Dialog ─────────── */}
      <EditDialog
        open={!!editingTerminal}
        onClose={() => setEditingTerminal(null)}
        title="Terminal Assignment Bewerken"
        onSave={() => editingTerminal && saveTerminal(editingTerminal)}
      >
        {editingTerminal && (
          <div className="space-y-3">
            <Field label="Cargo Type"><Input className="h-9" value={editingTerminal.cargo_type} onChange={(e) => setEditingTerminal({ ...editingTerminal, cargo_type: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LOA Min"><Input className="h-9" type="number" value={editingTerminal.loa_min} onChange={(e) => setEditingTerminal({ ...editingTerminal, loa_min: Number(e.target.value) })} /></Field>
              <Field label="LOA Max"><Input className="h-9" type="number" value={editingTerminal.loa_max ?? ''} onChange={(e) => setEditingTerminal({ ...editingTerminal, loa_max: e.target.value ? Number(e.target.value) : null })} /></Field>
            </div>
            <Field label="Terminal Code"><Input className="h-9" value={editingTerminal.terminal_code} onChange={(e) => setEditingTerminal({ ...editingTerminal, terminal_code: e.target.value })} /></Field>
            <Field label="Port Code"><Input className="h-9" value={editingTerminal.port_code} onChange={(e) => setEditingTerminal({ ...editingTerminal, port_code: e.target.value })} /></Field>
            <Field label="Notes"><Input className="h-9" value={editingTerminal.notes || ''} onChange={(e) => setEditingTerminal({ ...editingTerminal, notes: e.target.value })} /></Field>
          </div>
        )}
      </EditDialog>

      {/* ── New Tug Rule Dialog ─────────────────────── */}
      <NewRuleDialog
        open={showNewTug}
        onClose={() => setShowNewTug(false)}
        title="Nieuwe Tug Rule"
        onSave={async (form) => {
          await createTugRule({ terminal_code: form.terminal_code, loa_min: Number(form.loa_min), loa_max: form.loa_max ? Number(form.loa_max) : null, tugs_required: Number(form.tugs_required), notes: form.notes || null });
          setShowNewTug(false);
          toast({ title: 'Tug rule aangemaakt' });
        }}
        fields={[
          { key: 'terminal_code', label: 'Terminal Code', required: true },
          { key: 'loa_min', label: 'LOA Min', type: 'number', required: true },
          { key: 'loa_max', label: 'LOA Max', type: 'number' },
          { key: 'tugs_required', label: 'Tugs Required', type: 'number', required: true },
          { key: 'notes', label: 'Notes' },
        ]}
      />

      {/* ── New Loading Rate Dialog ────────────────── */}
      <NewRuleDialog
        open={showNewRate}
        onClose={() => setShowNewRate(false)}
        title="Nieuwe Loading Rate"
        onSave={async (form) => {
          await createLoadingRate({ cargo_type: form.cargo_type, rate_mt_per_day: Number(form.rate_mt_per_day), operation: form.operation || 'load', notes: form.notes || null });
          setShowNewRate(false);
          toast({ title: 'Loading rate aangemaakt' });
        }}
        fields={[
          { key: 'cargo_type', label: 'Cargo Type', required: true },
          { key: 'rate_mt_per_day', label: 'Rate (MT/day)', type: 'number', required: true },
          { key: 'operation', label: 'Operation' },
          { key: 'notes', label: 'Notes' },
        ]}
      />

      {/* ── New Terminal Assignment Dialog ─────────── */}
      <NewRuleDialog
        open={showNewTerminal}
        onClose={() => setShowNewTerminal(false)}
        title="Nieuwe Terminal Assignment"
        onSave={async (form) => {
          await createTerminalAssignment({ cargo_type: form.cargo_type, loa_min: Number(form.loa_min), loa_max: form.loa_max ? Number(form.loa_max) : null, terminal_code: form.terminal_code, port_code: form.port_code || 'WILLEMSTAD', notes: form.notes || null });
          setShowNewTerminal(false);
          toast({ title: 'Terminal assignment aangemaakt' });
        }}
        fields={[
          { key: 'cargo_type', label: 'Cargo Type', required: true },
          { key: 'loa_min', label: 'LOA Min', type: 'number', required: true },
          { key: 'loa_max', label: 'LOA Max', type: 'number' },
          { key: 'terminal_code', label: 'Terminal Code', required: true },
          { key: 'port_code', label: 'Port Code' },
          { key: 'notes', label: 'Notes' },
        ]}
      />
    </DashboardLayout>
  );
}

// ─── Sub-components ──────────────────────────────────

function PreviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${highlight ? 'font-semibold text-primary' : 'font-medium text-foreground'}`}>{value}</span>
    </div>
  );
}

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

function EditDialog({ open, onClose, title, onSave, children }: {
  open: boolean; onClose: () => void; title: string; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
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
      <DialogContent>
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
