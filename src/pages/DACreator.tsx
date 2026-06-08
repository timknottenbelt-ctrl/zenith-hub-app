import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Calculator, FileText, FileSpreadsheet, Plus, Trash2, Loader2, Ship, History, Download, Clock, Anchor, Ruler } from "lucide-react";

interface Line { label: string; currency: string; amount: number }
interface RecentDA {
  id: number; doc_type: string | null; vessel_name: string | null; client_name: string | null;
  total: number | null; pdf_url: string | null; excel_url: string | null; created_at: string;
}

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
  const [recent, setRecent] = useState<RecentDA[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const set = (k: string, val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: false }));
  };

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase
      .from("da_outputs")
      .select("id, doc_type, vessel_name, client_name, total, pdf_url, excel_url, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setRecent(data as RecentDA[]);
  }, []);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  // Prefill from a port call (DA Creator opened with ?vessel=&gt=&loa=&cargo=…).
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (![...searchParams.keys()].length) return;
    const g = (k: string) => searchParams.get(k) || '';
    setV((p) => ({
      ...p,
      vessel_name: g('vessel') || p.vessel_name,
      gt: g('gt') || p.gt,
      loa: g('loa') || p.loa,
      dwt: g('dwt') || p.dwt,
      cargo_type: g('cargo') || p.cargo_type,
      terminal: g('terminal') || p.terminal,
      client_name: g('client') || p.client_name,
      operation_type: g('operation') || p.operation_type,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function calculate() {
    // Required before a calculation can run.
    const required: [string, string][] = [
      ["vessel_name", "Vessel name"], ["client_name", "Client"], ["terminal", "Terminal"],
      ["gt", "GT"], ["operation_type", "Operation"],
    ];
    const missing = required.filter(([k]) => !String((v as Record<string, string>)[k] ?? "").trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map(([k]) => [k, true])));
      toast({ title: "Vul de verplichte velden in", description: missing.map(([, l]) => l).join(", "), variant: "destructive" });
      return;
    }
    setErrors({});
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
    fetchRecent();
  }

  async function makeFile(kind: "pdf" | "excel") {
    if (!daId) { toast({ title: "Bereken eerst de DA", variant: "destructive" }); return; }
    setBusy(kind);
    const fn = kind === "pdf" ? "generate-da-pdf" : "generate-da-excel";
    const { data, error } = await supabase.functions.invoke(fn, { body: { da_output_id: daId } });
    setBusy(null);
    const url = data?.pdf_url || data?.excel_url;
    if (error || !url) { toast({ title: "Genereren mislukt", description: error?.message || data?.error, variant: "destructive" }); return; }
    toast({ title: kind === "pdf" ? "PDF gegenereerd" : "Excel gegenereerd", description: "Bestand wordt geopend in een nieuw tabblad." });
    window.open(url, "_blank");
    fetchRecent();
  }

  // Open (or regenerate) a document for any historic DA row.
  async function openExisting(row: RecentDA, kind: "pdf" | "excel") {
    if (kind === "pdf" && row.pdf_url) { window.open(row.pdf_url, "_blank"); return; }
    if (kind === "excel" && row.excel_url) { window.open(row.excel_url, "_blank"); return; }
    setRowBusy(`${row.id}:${kind}`);
    const fn = kind === "pdf" ? "generate-da-pdf" : "generate-da-excel";
    const { data, error } = await supabase.functions.invoke(fn, { body: { da_output_id: row.id } });
    setRowBusy(null);
    const url = data?.pdf_url || data?.excel_url;
    if (error || !url) { toast({ title: "Genereren mislukt", description: error?.message || data?.error, variant: "destructive" }); return; }
    window.open(url, "_blank");
    fetchRecent();
  }

  const tf = (k: string, label: string, type = "text", required = false) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input
        type={type}
        value={(v as Record<string, string>)[k]}
        onChange={(e) => set(k, e.target.value)}
        className={cn(errors[k] && "border-destructive focus-visible:ring-destructive/30")}
      />
    </div>
  );

  return (
    <DashboardLayout title="DA / PDA Creator">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Ship className="w-5 h-5 text-primary" /></div>
          <div><h1 className="text-xl font-semibold">DA / PDA Creator</h1><p className="text-sm text-muted-foreground">Vul de scheepsgegevens in → bereken alle havenkosten → maak PDF / Excel</p></div>
        </div>

        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ship className="w-4 h-4 text-primary" /> Scheepsgegevens
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Velden met <span className="text-destructive font-medium">*</span> zijn verplicht voordat je kunt berekenen.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Schip & klant */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5"><Anchor className="w-3 h-3" /> Schip & klant</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {tf("vessel_name", "Vessel name", "text", true)}
                {tf("client_name", "Client", "text", true)}
                {tf("terminal", "Terminal", "text", true)}
              </div>
            </div>

            {/* Afmetingen */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5"><Ruler className="w-3 h-3" /> Afmetingen</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {tf("gt", "GT", "number", true)}
                {tf("loa", "LOA (m)", "number")}
                {tf("dwt", "DWT", "number")}
              </div>
            </div>

            {/* Operatie */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5"><Calculator className="w-3 h-3" /> Operatie & call</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Operation <span className="text-destructive ml-0.5">*</span></Label>
                  <Select value={v.operation_type} onValueChange={(val) => set("operation_type", val)}>
                    <SelectTrigger className={cn(errors.operation_type && "border-destructive ring-1 ring-destructive/30")}><SelectValue /></SelectTrigger>
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
                  <Select value={v.facility} onValueChange={(val) => set("facility", val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bouy">Bouy</SelectItem>
                      <SelectItem value="Quay">Quay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tf("cargo_type", "Cargo type", "text")}
                {tf("port_stay", "Port stay (days)", "number")}
                {tf("tugs", "Tugs", "number")}
                {tf("linesmen_hours", "Linesmen hours", "number")}
              </div>
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
          <Button variant="outline" onClick={() => makeFile("pdf")} disabled={!daId || busy === "pdf"}>{busy === "pdf" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}Maak PDF</Button>
          <Button variant="outline" onClick={() => makeFile("excel")} disabled={!daId || busy === "excel"}>{busy === "excel" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}Maak Excel</Button>
        </div>

        {lines.length > 0 && (
          <Card className="card-premium animate-in fade-in-50 duration-300">
            <CardHeader><CardTitle className="text-sm font-medium">Disbursement Account</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">USD</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...lines, ...extra].map((l, i) => (
                    <TableRow key={i}><TableCell>{l.label}</TableCell><TableCell className="text-right tabular-nums">{Number(l.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell></TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2 bg-primary/5 hover:bg-primary/10"><TableCell>TOTAL</TableCell><TableCell className="text-right tabular-nums text-primary">{Number(total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── Recente DA's — eerder gemaakte disbursement accounts terugvinden ── */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><History className="w-4 h-4 text-primary" /></div>
              <div>
                <CardTitle className="text-sm font-medium">Recente DA's</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Eerder gemaakte disbursement accounts — open de PDF of Excel opnieuw</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md tabular-nums">{recent.length}</span>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nog geen DA's gemaakt.</p>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <div className="divide-y divide-border/50">
                  {recent.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                        <Ship className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{r.vessel_name || "—"}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{r.doc_type || "DA"}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {r.client_name && <span className="truncate">{r.client_name}</span>}
                          <span className="flex items-center gap-1 shrink-0"><Clock className="w-3 h-3" />{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground shrink-0 mr-1">
                        {r.total != null ? `USD ${Number(r.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={() => openExisting(r, "pdf")} disabled={rowBusy === `${r.id}:pdf`}>
                          {rowBusy === `${r.id}:pdf` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-red-500" />} PDF
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={() => openExisting(r, "excel")} disabled={rowBusy === `${r.id}:excel`}>
                          {rowBusy === `${r.id}:excel` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-500" />} Excel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
