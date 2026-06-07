import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Calculator, FileText, FileSpreadsheet, Plus, Trash2, Loader2, Paperclip,
  ChevronDown, ChevronRight, Check,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Email = Tables<'email'>;
interface Line { label: string; currency: string; amount: number }

const num = (s: string) => (s === '' ? null : Number(s));
const money = (n: number) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * In-inquiry Disbursement Account generator. Pre-fills from the email, calculates
 * port costs, lets you tweak extra lines (Excel stays available for deeper edits),
 * generates PDF/Excel and attaches them onto the inquiry so they ride along with
 * the reply.
 */
export function InquiryDAPanel({ email, onAttached }: { email: Email; onAttached: () => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(() => ({
    vessel_name: email.vessel_name || '',
    client_name: email.company_name || email.contact_name || '',
    gt: '', loa: '', dwt: '',
    terminal: '', facility: 'Bouy', operation_type: 'discharge', cargo_type: '',
    port_stay: '', tugs: '', linesmen_hours: '2',
  }));
  const [extra, setExtra] = useState<Line[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [daId, setDaId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const set = (k: string, val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: false }));
  };

  async function calculate() {
    const required: [string, string][] = [
      ['vessel_name', 'Vessel'], ['client_name', 'Client'], ['terminal', 'Terminal'],
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
    if (error || !data?.success) { toast({ title: 'Berekening mislukt', description: error?.message || data?.error, variant: 'destructive' }); return; }
    setLines(data.lines); setTotal(data.total); setDaId(data.da_output_id);
    toast({ title: 'DA berekend', description: `Totaal USD ${money(data.total)}` });
  }

  async function makeAndAttach(kind: 'pdf' | 'excel') {
    if (!daId) { toast({ title: 'Bereken eerst de DA', variant: 'destructive' }); return; }
    setBusy(kind);
    const fn = kind === 'pdf' ? 'generate-da-pdf' : 'generate-da-excel';
    const { data, error } = await supabase.functions.invoke(fn, { body: { da_output_id: daId } });
    const url = data?.pdf_url || data?.excel_url;
    if (error || !url) { setBusy(null); toast({ title: 'Genereren mislukt', description: error?.message || data?.error, variant: 'destructive' }); return; }
    // Attach onto the inquiry so it shows under Documents and rides with the reply.
    const patch = kind === 'pdf' ? { pdf_url: url } : { doc_link: url };
    await supabase.from('email').update(patch as never).eq('id', email.id);
    setBusy(null);
    toast({ title: kind === 'pdf' ? 'PDF gekoppeld aan deze aanvraag' : 'Excel gekoppeld aan deze aanvraag' });
    window.open(url, '_blank');
    onAttached();
  }

  const tf = (k: string, label: string, type = 'text', required = false) => (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input
        type={type}
        value={(v as Record<string, string>)[k]}
        onChange={(e) => set(k, e.target.value)}
        className={cn('h-9', errors[k] && 'border-destructive focus-visible:ring-destructive/30')}
      />
    </div>
  );

  const attached = !!email.pdf_url || !!email.doc_link;

  return (
    <div className="px-5 py-3 border-t border-border/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <Calculator className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disbursement Account</span>
        {attached && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
            <Check className="w-2.5 h-2.5" /> gekoppeld
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{open ? 'verbergen' : 'DA maken & koppelen'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {tf('vessel_name', 'Vessel', 'text', true)}
            {tf('client_name', 'Client', 'text', true)}
            {tf('terminal', 'Terminal', 'text', true)}
            {tf('gt', 'GT', 'number', true)}
            {tf('loa', 'LOA (m)', 'number')}
            {tf('dwt', 'DWT', 'number')}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Operation <span className="text-destructive ml-0.5">*</span></Label>
              <Select value={v.operation_type} onValueChange={(val) => set('operation_type', val)}>
                <SelectTrigger className={cn('h-9', errors.operation_type && 'border-destructive ring-1 ring-destructive/30')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discharge">discharge</SelectItem>
                  <SelectItem value="loading">loading</SelectItem>
                  <SelectItem value="bunkering">bunkering</SelectItem>
                  <SelectItem value="sts">sts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Facility</Label>
              <Select value={v.facility} onValueChange={(val) => set('facility', val)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bouy">Bouy</SelectItem>
                  <SelectItem value="Quay">Quay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tf('port_stay', 'Port stay (days)', 'number')}
            {tf('tugs', 'Tugs', 'number')}
            {tf('linesmen_hours', 'Linesmen hours', 'number')}
            {tf('cargo_type', 'Cargo type', 'text')}
          </div>

          {/* Extra cost lines (dashboard-editable; Excel stays available for deeper edits) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Extra kostenregels</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setExtra([...extra, { label: '', currency: 'USD', amount: 0 }])}>
                <Plus className="w-3 h-3" /> Regel
              </Button>
            </div>
            {extra.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Omschrijving" className="h-9" value={l.label} onChange={(e) => setExtra(extra.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input type="number" placeholder="Bedrag" className="h-9 w-36" value={l.amount} onChange={(e) => setExtra(extra.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setExtra(extra.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>

          <Button onClick={calculate} disabled={busy === 'calc'} className="h-9 rounded-lg">
            {busy === 'calc' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
            {lines.length ? 'Herbereken' : 'Bereken DA'}
          </Button>

          {lines.length > 0 && (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="max-h-[260px] overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {[...lines, ...extra].map((l, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="px-3 py-1.5 text-foreground/80">{l.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{money(l.amount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5 font-semibold">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right tabular-nums text-primary">USD {money(total ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3 border-t border-border/50 bg-muted/20">
                <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5" onClick={() => makeAndAttach('excel')} disabled={busy === 'excel'}>
                  {busy === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />} Excel + koppel
                </Button>
                <Button size="sm" className="h-8 rounded-lg gap-1.5" onClick={() => makeAndAttach('pdf')} disabled={busy === 'pdf'}>
                  {busy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />} PDF + koppel aan aanvraag
                </Button>
                <span className="text-[11px] text-muted-foreground ml-auto">Excel is bewerkbaar; pas aan en koppel daarna de PDF.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
