import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FileText, Loader2, Ship, History, Download, Clock } from "lucide-react";
import { DACalculatorPanel, type DAInitial } from "@/components/da/DACalculatorPanel";

interface RecentDA {
  id: number; doc_type: string | null; vessel_name: string | null; client_name: string | null;
  total: number | null; pdf_url: string | null; excel_url: string | null; created_at: string;
}

export default function DACreator() {
  const [recent, setRecent] = useState<RecentDA[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const initial: DAInitial = {
    vessel_name: searchParams.get("vessel") || undefined,
    gt: searchParams.get("gt") || undefined,
    loa: searchParams.get("loa") || undefined,
    dwt: searchParams.get("dwt") || undefined,
    cargo_type: searchParams.get("cargo") || undefined,
    terminal: searchParams.get("terminal") || undefined,
    client_name: searchParams.get("client") || undefined,
    operation_type: searchParams.get("operation") || undefined,
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

  return (
    <DashboardLayout title="DA / PDA Creator">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Ship className="w-5 h-5 text-primary" /></div>
          <div><h1 className="text-xl font-semibold">DA / PDA Creator</h1><p className="text-sm text-muted-foreground">Vul de scheepsgegevens in → bereken alle havenkosten → maak PDF / Excel</p></div>
        </div>

        <DACalculatorPanel initial={initial} onSaved={fetchRecent} />

        {/* ── Recente DA's ── */}
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
