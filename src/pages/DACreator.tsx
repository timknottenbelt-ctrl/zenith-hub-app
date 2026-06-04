import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Calculator, FileText, FileSpreadsheet, Plus, Trash2, Loader2, Ship } from "lucide-react";

interface Line { label: string; currency: string; amount: number }

const num = (v: string) => (v === "" ? null : Number(v));

export default function DACreator() {
  const [v, setV] = useState({
    vessel_name: "", gt: "", loa: "", dwt: "", port_stay: "", tugs: "", linesmen_hours: "2",
    facility: "Bouy", operation_type: "discharge", cargo_type: "", terminal: "", client_name: "",
  });
  const [extra, setExtra] = useState<Line[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [daId, setDaId] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function calculate() {
    if (!v.gt) { toast({ title: "GT verplicht", variant: "destructive" }); return; }
    setBusy("calc");
    const { data, error } = await supabase.functions.invoke("calculate-da", {
      body: {
        vessel: {
          vessel_name: v.vessel_name, gt: num(v.gt), loa: num(v.loa), dwt: num(v.dwt),
          port_stay: num(v.port_stay), tugs: num(v.tugs), linesmen_hours: num(v.linesmen_hours),
          facility: v.facility, operation_type: v.operation_type, cargo_type: v.cargo_type,
          terminal: v.terminal, client_name: v.client_name,
        },
        extra_lines: extra,
        store: true, doc_type: "EDA",
      },
    });
    setBusy(null);
    if (error || !data?.success) { toast({ title: "Berekening mislukt", description: error?.message || data?.error, variant: "destructive" }); return; }
    setLines(data.lines); setTotal(data.total); setDaId(data.da_output_id);
    toast({ title: "DA berekend", description: `Totaal USD ${data.total}` });
  }

  async function makeFile(kind: "pdf" | "excel") {
    if (!daId) { toast({ title: "Bereken eerst de DA", variant: "destructive" }); return; }
    setBusy(kind);
    const fn = kind === "pdf" ? "generate-da-pdf" : "generate-da-excel";
    const { data, error } = await supabase.functions.invoke(fn, { body: { da_output_id: daId } });
    setBusy(null);
    const url = data?.pdf_url || data?.excel_url;
    if (error || !url) { toast({ title: "Genereren mislukt", description: error?.message || data?.error, variant: "destructive" }); return; }
    window.open(url, "_blank");
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Ship className="w-5 h-5 text-primary" /></div>
          <div><h1 className="text-xl font-semibold">DA / PDA Creator</h1><p className="text-sm text-muted-foreground">Vul de scheepsgegevens in → bereken alle havenkosten → maak PDF / Excel</p></div>
        </div>

        <Card className="card-premium">
          <CardHeader><CardTitle className="text-sm font-medium">Scheepsgegevens</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ["vessel_name", "Vessel name", "text"], ["client_name", "Client", "text"], ["terminal", "Terminal", "text"],
              ["gt", "GT *", "number"], ["loa", "LOA (m)", "number"], ["dwt", "DWT", "number"],
              ["port_stay", "Port stay (days)", "number"], ["tugs", "Tugs", "number"], ["linesmen_hours", "Linesmen hours", "number"],
              ["cargo_type", "Cargo type", "text"],
            ].map(([k, label, type]) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input type={type} value={(v as Record<string, string>)[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs">Facility</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={v.facility} onChange={(e) => set("facility", e.target.value)}>
                <option>Bouy</option><option>Quay</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operation</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={v.operation_type} onChange={(e) => set("operation_type", e.target.value)}>
                <option>discharge</option><option>loading</option><option>bunkering</option><option>sts</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Extra kostenregels</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setExtra([...extra, { label: "", currency: "USD", amount: 0 }])}><Plus className="w-4 h-4 mr-1" />Regel</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {extra.length === 0 && <p className="text-sm text-muted-foreground">Voeg losse kosten toe (NGO agency fee, bank charges, ...).</p>}
            {extra.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Omschrijving" value={l.label} onChange={(e) => setExtra(extra.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input type="number" placeholder="Bedrag" className="w-40" value={l.amount} onChange={(e) => setExtra(extra.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                <Button variant="ghost" size="icon" onClick={() => setExtra(extra.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={calculate} disabled={busy === "calc"}>{busy === "calc" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}Bereken DA</Button>
          <Button variant="outline" onClick={() => makeFile("pdf")} disabled={!daId || busy === "pdf"}><FileText className="w-4 h-4 mr-2" />Maak PDF</Button>
          <Button variant="outline" onClick={() => makeFile("excel")} disabled={!daId || busy === "excel"}><FileSpreadsheet className="w-4 h-4 mr-2" />Maak Excel</Button>
        </div>

        {lines.length > 0 && (
          <Card className="card-premium">
            <CardHeader><CardTitle className="text-sm font-medium">Disbursement Account</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">USD</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...lines, ...extra].map((l, i) => (
                    <TableRow key={i}><TableCell>{l.label}</TableCell><TableCell className="text-right tabular-nums">{Number(l.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell></TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2"><TableCell>TOTAL</TableCell><TableCell className="text-right tabular-nums text-primary">{Number(total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
