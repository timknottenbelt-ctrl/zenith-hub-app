import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Calculator, FileText, FileSpreadsheet, Plus, Trash2, Loader2, Ship, Anchor, Ruler, ArrowLeft } from 'lucide-react';

interface Line {
  label: string;
  currency: string;
  amount: number;
}

export interface DAInitial {
  vessel_name?: string;
  gt?: string;
  loa?: string;
  dwt?: string;
  cargo_type?: string;
  terminal?: string;
  client_name?: string;
  operation_type?: string;
}

const num = (v: string) => (v === '' ? null : Number(v));

const DEFAULTS = {
  vessel_name: '', gt: '', loa: '', dwt: '', port_stay: '', tugs: '', linesmen_hours: '2',
  facility: 'Bouy', operation_type: 'discharge', cargo_type: '', terminal: '', client_name: '',
};

/** Reusable DA/EDA calculator — used standalone on /da-creator and inline on the
 *  port-call dossier. Owns the form, calculation (calculate-da) and PDF/Excel
 *  generation. `onSaved` lets the host refresh a recent-list; `onBack` shows a
 *  back button when embedded. */
export function DACalculatorPanel({ initial, onSaved, onBack }: { initial?: DAInitial; onSaved?: () => void; onBack?: () => void }) {
  const [v, setV] = useState(() => ({
    ...DEFAULTS,
    ...Object.fromEntries(Object.entries(initial || {}).filter(([, val]) => val)),
  }));
  const [extra, setExtra] = useState<Line[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [daId, setDaId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const set = (k: string, val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: false }));
  };

  async function calculate() {
    const required: [string, string][] = [
      ['vessel_name', 'Vessel name'], ['client_name', 'Client'], ['terminal', 'Terminal'],
      ['gt', 'GT'], ['operation_type', 'Operation'],
    ];
    const missing = required.filter(([k]) => !String((v as Record<string, string>)[k] ?? '').trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map(([k]) => [k, true])));
      toast({ title: 'Vul de verplichte velden in', description: missing.map(([, l]) => l).join(', '), variant: 'destructive' });
      return;
    }
    setErrors({});
    setBusy('calc');
    const { data, error } = await supabase.functions.invoke('calculate-da', {
      body: {
        vessel: {
          vessel_name: v.vessel_name, gt: num(v.gt), loa: num(v.loa), dwt: num(v.dwt),
          port_stay: num(v.port_stay), tugs: num(v.tugs), linesmen_hours: num(v.linesmen_hours),
          facility: v.facility, operation_type: v.operation_type, cargo_type: v.cargo_type,
          terminal: v.terminal, client_name: v.client_name,
        },
        extra_lines: extra,
        store: true, doc_type: 'EDA',
      },
    });
    setBusy(null);
    if (error || !data?.success) {
      toast({ title: 'Berekening mislukt', description: error?.message || data?.error, variant: 'destructive' });
      return;
    }
    setLines(data.lines);
    setTotal(data.total);
    setDaId(data.da_output_id);
    toast({ title: 'DA berekend', description: `Totaal USD ${data.total}` });
    onSaved?.();
  }

  async function makeFile(kind: 'pdf' | 'excel') {
    if (!daId) {
      toast({ title: 'Bereken eerst de DA', variant: 'destructive' });
      return;
    }
    setBusy(kind);
    const fn = kind === 'pdf' ? 'generate-da-pdf' : 'generate-da-excel';
    const { data, error } = await supabase.functions.invoke(fn, { body: { da_output_id: daId } });
    setBusy(null);
    const url = data?.pdf_url || data?.excel_url;
    if (error || !url) {
      toast({ title: 'Genereren mislukt', description: error?.message || data?.error, variant: 'destructive' });
      return;
    }
    toast({ title: kind === 'pdf' ? 'PDF gegenereerd' : 'Excel gegenereerd', description: 'Bestand wordt geopend in een nieuw tabblad.' });
    window.open(url, '_blank');
    onSaved?.();
  }

  const tf = (k: string, label: string, type = 'text', required = false) => (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        value={(v as Record<string, string>)[k]}
        onChange={(e) => set(k, e.target.value)}
        className={cn(errors[k] && 'border-destructive focus-visible:ring-destructive/30')}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Terug naar dossier
        </Button>
      )}

      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Ship className="h-4 w-4 text-primary" /> Scheepsgegevens
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Velden met <span className="font-medium text-destructive">*</span> zijn verplicht voordat je kunt berekenen.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <Anchor className="h-3 w-3" /> Schip &amp; klant
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {tf('vessel_name', 'Vessel name', 'text', true)}
              {tf('client_name', 'Client', 'text', true)}
              {tf('terminal', 'Terminal', 'text', true)}
            </div>
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <Ruler className="h-3 w-3" /> Afmetingen
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {tf('gt', 'GT', 'number', true)}
              {tf('loa', 'LOA (m)', 'number')}
              {tf('dwt', 'DWT', 'number')}
            </div>
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <Calculator className="h-3 w-3" /> Operatie &amp; call
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Operation <span className="ml-0.5 text-destructive">*</span>
                </Label>
                <Select value={v.operation_type} onValueChange={(val) => set('operation_type', val)}>
                  <SelectTrigger className={cn(errors.operation_type && 'border-destructive ring-1 ring-destructive/30')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discharge">discharge</SelectItem>
                    <SelectItem value="loading">loading</SelectItem>
                    <SelectItem value="bunkering">bunkering</SelectItem>
                    <SelectItem value="sts">sts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Facility</Label>
                <Select value={v.facility} onValueChange={(val) => set('facility', val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bouy">Bouy</SelectItem>
                    <SelectItem value="Quay">Quay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tf('cargo_type', 'Cargo type', 'text')}
              {tf('port_stay', 'Port stay (days)', 'number')}
              {tf('tugs', 'Tugs', 'number')}
              {tf('linesmen_hours', 'Linesmen hours', 'number')}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-premium">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Extra kostenregels</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setExtra([...extra, { label: '', currency: 'USD', amount: 0 }])}>
            <Plus className="mr-1 h-4 w-4" />
            Regel
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {extra.length === 0 && <p className="text-sm text-muted-foreground">Voeg losse kosten toe (NGO agency fee, bank charges, …).</p>}
          {extra.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Omschrijving" value={l.label} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <Input type="number" placeholder="Bedrag" className="w-40" value={l.amount} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
              <Button variant="ghost" size="icon" onClick={() => setExtra(extra.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={calculate} disabled={busy === 'calc'}>
          {busy === 'calc' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
          Bereken DA
        </Button>
        <Button variant="outline" onClick={() => makeFile('pdf')} disabled={!daId || busy === 'pdf'}>
          {busy === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Maak PDF
        </Button>
        <Button variant="outline" onClick={() => makeFile('excel')} disabled={!daId || busy === 'excel'}>
          {busy === 'excel' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          Maak Excel
        </Button>
      </div>

      {lines.length > 0 && (
        <Card className="card-premium duration-300 animate-in fade-in-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Disbursement Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...lines, ...extra].map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(l.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-primary/5 font-semibold hover:bg-primary/10">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right tabular-nums text-primary">{Number(total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
