import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Ship, User, Receipt, Anchor, Package, DollarSign, CreditCard,
  Plus, Trash2, Loader2, ArrowLeft, Calendar, ExternalLink, FileText,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ClientSelector } from "@/components/ClientSelector";
import { FDACuracaoInvoiceUpload } from "@/components/fda-curacao/FDACuracaoInvoiceUpload";

// ── Types ──────────────────────────────────────────────────────────────────
interface FDAFormData {
  lbh_number: string;
  ship_name: string;
  fda_responsible: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  billing_company: string;
  billing_address: string;
  billing_email: string;
  billing_phone: string;
  vessel_arrived: string;
  vessel_sailed: string;
  operation: string;
  commodity: string;
  client_reference: string;
  advanced_payment_amount: string;
  advanced_payment_currency: string;
  advanced_payment_reference: string;
  advanced_payment_status: string;
  advanced_payment_remark: string;
}

interface AgencyCostRow {
  id: string;
  description: string;
  number: string;
  remark: string;
  amount: string;
}

interface Invoice {
  id: string;
  file_name: string;
  file_url: string | null;
  invoice_number: string;
  isNew?: boolean;
}

const EMPTY_FORM: FDAFormData = {
  lbh_number: "", ship_name: "", fda_responsible: "",
  client_name: "", client_email: "", client_phone: "",
  billing_company: "", billing_address: "", billing_email: "", billing_phone: "",
  vessel_arrived: "", vessel_sailed: "", operation: "", commodity: "", client_reference: "",
  advanced_payment_amount: "", advanced_payment_currency: "USD",
  advanced_payment_reference: "", advanced_payment_status: "unpaid", advanced_payment_remark: "",
};

export interface FDAInlinePanelProps {
  /** Existing FDA project_id to edit. Null/undefined → create mode. */
  projectId?: string | null;
  /** Pre-fill when creating a new FDA from a port call. */
  createDefaults?: Partial<Pick<FDAFormData, "lbh_number" | "ship_name" | "client_name" | "vessel_arrived" | "vessel_sailed">>;
  /** Dossier key to link a newly created FDA back to its port call. */
  dossierKey?: string | null;
  /** Deep-link to open the full FDA workspace (processing / e-mail steps). */
  onOpenFull?: (projectId: string) => void;
  /** Close the panel and return to the dossier. */
  onBack: () => void;
  /** Fired after a successful create or save so the parent can refresh links/totals. */
  onChanged?: () => void;
}

const section = "rounded-xl border border-border/60 bg-card";

export function FDAInlinePanel({
  projectId: initialProjectId,
  createDefaults,
  dossierKey,
  onOpenFull,
  onBack,
  onChanged,
}: FDAInlinePanelProps) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [loading, setLoading] = useState<boolean>(!!initialProjectId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FDAFormData>(EMPTY_FORM);
  const [rows, setRows] = useState<AgencyCostRow[]>([
    { id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" },
  ]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const set = (field: keyof FDAFormData, value: string) => setForm((p) => ({ ...p, [field]: value }));

  // Load an existing project, or seed the form from the port call defaults.
  const load = useCallback(async (id: string) => {
    setLoading(true);
    const { data: project } = await supabase
      .from("fda_curacao_projects").select("*").eq("project_id", id).maybeSingle();
    if (project) {
      const p = project as Record<string, unknown>;
      const str = (k: string) => (p[k] == null ? "" : String(p[k]));
      setForm({
        lbh_number: str("lbh_number"), ship_name: str("ship_name"), fda_responsible: str("fda_responsible"),
        client_name: str("client_name"), client_email: str("client_email"), client_phone: str("client_phone"),
        billing_company: str("billing_company"), billing_address: str("billing_address"),
        billing_email: str("billing_email"), billing_phone: str("billing_phone"),
        vessel_arrived: str("vessel_arrived"), vessel_sailed: str("vessel_sailed"),
        operation: str("operation"), commodity: str("commodity"), client_reference: str("client_reference"),
        advanced_payment_amount: str("advanced_payment_amount"),
        advanced_payment_currency: str("advanced_payment_currency") || "USD",
        advanced_payment_reference: str("advanced_payment_reference"),
        advanced_payment_status: str("advanced_payment_status") || "unpaid",
        advanced_payment_remark: str("advanced_payment_remark"),
      });
    }
    const { data: agency } = await supabase
      .from("fda_curacao_agency_costs").select("*").eq("project_id", id).order("created_at", { ascending: true });
    if (agency && agency.length > 0) {
      setRows(agency.map((r: Record<string, unknown>) => ({
        id: String(r.id), description: String(r.description ?? ""), number: String(r.invoice_number ?? ""),
        remark: String(r.remark ?? ""), amount: r.total_amount == null ? "" : String(r.total_amount),
      })));
    } else {
      setRows([{ id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }]);
    }
    const { data: inv } = await supabase
      .from("fda_curacao_processed_invoices").select("id, file_name, file_url, invoice_number")
      .eq("project_id", id).order("created_at", { ascending: true });
    setInvoices((inv as Invoice[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialProjectId) {
      load(initialProjectId);
    } else {
      setForm({ ...EMPTY_FORM, ...createDefaults });
      setLoading(false);
    }
    // Seed once on mount; parent supplies a stable key via React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Agency-cost row helpers ────────────────────────────────────────────────
  const setRow = (id: string, field: keyof AgencyCostRow, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addRow = () => {
    if (rows.length >= 7) { toast({ title: "Maximum bereikt", description: "Max 7 regels", variant: "destructive" }); return; }
    setRows((rs) => [...rs, { id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }]);
  };
  const removeRow = (id: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  async function saveAgencyCosts(pid: string) {
    await supabase.from("fda_curacao_agency_costs").delete().eq("project_id", pid);
    const keep = rows.filter((r) => r.description || r.number || r.remark || r.amount);
    if (keep.length === 0) return;
    await supabase.from("fda_curacao_agency_costs").insert(
      keep.map((r) => ({
        project_id: pid, lbh_number: form.lbh_number, ship_name: form.ship_name,
        invoice_number: r.number || "", description: r.description || null,
        remark: r.remark || null, total_amount: r.amount ? parseFloat(r.amount) : null,
        currency: form.advanced_payment_currency || "USD",
      })),
    );
  }

  function projectPayload() {
    return {
      lbh_number: form.lbh_number, ship_name: form.ship_name,
      fda_responsible: form.fda_responsible || null, client_name: form.client_name || null,
      client_email: form.client_email || null, client_phone: form.client_phone || null,
      billing_company: form.billing_company || null, billing_address: form.billing_address || null,
      billing_email: form.billing_email || null, billing_phone: form.billing_phone || null,
      vessel_arrived: form.vessel_arrived || null, vessel_sailed: form.vessel_sailed || null,
      operation: form.operation || null, commodity: form.commodity || null,
      client_reference: form.client_reference || null,
      advanced_payment_amount: form.advanced_payment_amount ? parseFloat(form.advanced_payment_amount) : null,
      advanced_payment_currency: form.advanced_payment_currency || "USD",
      advanced_payment_reference: form.advanced_payment_reference || null,
      advanced_payment_status: form.advanced_payment_status || "unpaid",
      advanced_payment_remark: form.advanced_payment_remark || null,
    };
  }

  async function handleSave() {
    if (!form.lbh_number || !form.ship_name) {
      toast({ title: "Fout", description: "LBH nummer en scheepsnaam zijn verplicht", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (projectId) {
        const { error } = await (supabase.from("fda_curacao_projects") as ReturnType<typeof supabase.from>)
          .update(projectPayload()).eq("project_id", projectId);
        if (error) throw error;
        await saveAgencyCosts(projectId);
        toast({ title: "Opgeslagen" });
      } else {
        const newId = crypto.randomUUID();
        const { error } = await (supabase.from("fda_curacao_projects") as ReturnType<typeof supabase.from>)
          .insert({ project_id: newId, ...projectPayload(), dossier_key: dossierKey || null });
        if (error) throw error;
        await saveAgencyCosts(newId);
        setProjectId(newId);
        toast({ title: "FDA aangemaakt", description: "Je kunt nu facturen toevoegen." });
      }
      onChanged?.();
    } catch {
      toast({ title: "Fout", description: "Kon de FDA niet opslaan. Probeer het opnieuw.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dateField = (field: "vessel_arrived" | "vessel_sailed", label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-full justify-start text-sm font-normal">
            <Calendar className="mr-2 h-3.5 w-3.5" />
            {form[field] && isValid(parseISO(form[field]))
              ? format(parseISO(form[field]), "d MMM yy")
              : <span className="text-muted-foreground">Datum</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={form[field] ? parseISO(form[field]) : undefined}
            onSelect={(d) => set(field, d ? format(d, "yyyy-MM-dd") : "")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-background p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dossier
          </Button>
          <div>
            <h2 className="text-base font-semibold leading-tight">
              {projectId ? (form.ship_name || "FDA bewerken") : "Nieuwe FDA"}
            </h2>
            <p className="text-[12px] text-muted-foreground">{form.lbh_number || "Vul de gegevens in"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {projectId && onOpenFull && (
            <Button variant="outline" size="sm" onClick={() => onOpenFull(projectId)}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Volledige FDA
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {projectId ? "Opslaan" : "Aanmaken"}
          </Button>
        </div>
      </div>

      {/* Ship + Client */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className={section}>
          <CardHeader className="pb-2.5"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Ship className="h-4 w-4 text-primary" />Schip</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1"><Label className="text-xs">LBH Nummer *</Label><Input value={form.lbh_number} onChange={(e) => set("lbh_number", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Scheepsnaam *</Label><Input value={form.ship_name} onChange={(e) => set("ship_name", e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">FDA Verantwoordelijke</Label><Input value={form.fda_responsible} onChange={(e) => set("fda_responsible", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className={section}>
          <CardHeader className="pb-2.5">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2"><User className="h-4 w-4 text-primary" />Klant</span>
              <ClientSelector onSelectClient={(c) => setForm((p) => ({ ...p, client_name: c.client_name, client_email: c.client_email, client_phone: c.client_phone, billing_company: c.billing_company, billing_email: c.billing_email, billing_address: c.billing_address, billing_phone: c.billing_phone }))} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="space-y-1"><Label className="text-xs">Naam</Label><Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input type="email" value={form.client_email} onChange={(e) => set("client_email", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Telefoon</Label><Input value={form.client_phone} onChange={(e) => set("client_phone", e.target.value)} /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing */}
      <Card className={section}>
        <CardHeader className="pb-2.5"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Receipt className="h-4 w-4 text-primary" />Facturatie</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div className="space-y-1"><Label className="text-xs">Bedrijf</Label><Input value={form.billing_company} onChange={(e) => set("billing_company", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input type="email" value={form.billing_email} onChange={(e) => set("billing_email", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Adres</Label><Input value={form.billing_address} onChange={(e) => set("billing_address", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Telefoon</Label><Input value={form.billing_phone} onChange={(e) => set("billing_phone", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Port info */}
      <Card className={section}>
        <CardHeader className="pb-2.5"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Anchor className="h-4 w-4 text-primary" />Haven informatie</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            {dateField("vessel_arrived", "Aankomst")}
            {dateField("vessel_sailed", "Vertrek")}
            <div className="space-y-1"><Label className="text-xs">Operatie</Label><Input value={form.operation} onChange={(e) => set("operation", e.target.value)} placeholder="Laden / Lossen" /></div>
            <div className="space-y-1"><Label className="text-xs">Lading</Label><Input value={form.commodity} onChange={(e) => set("commodity", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Referentie</Label><Input value={form.client_reference} onChange={(e) => set("client_reference", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Advance payment */}
      <Card className={section}>
        <CardHeader className="pb-2.5"><CardTitle className="flex items-center gap-2 text-sm font-medium"><CreditCard className="h-4 w-4 text-primary" />Voorschot</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Bedrag</Label>
              <div className="relative"><DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" /><Input type="number" value={form.advanced_payment_amount} onChange={(e) => set("advanced_payment_amount", e.target.value)} className="pl-6" step="0.01" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Valuta</Label><Select value={form.advanced_payment_currency} onValueChange={(v) => set("advanced_payment_currency", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="ANG">ANG</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={form.advanced_payment_status} onValueChange={(v) => set("advanced_payment_status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Onbetaald</SelectItem><SelectItem value="paid">Betaald</SelectItem><SelectItem value="partial">Deels</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label className="text-xs">Referentie</Label><Input value={form.advanced_payment_reference} onChange={(e) => set("advanced_payment_reference", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Opmerking</Label><Input value={form.advanced_payment_remark} onChange={(e) => set("advanced_payment_remark", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Agency costs */}
      <Card className={section}>
        <CardHeader className="pb-2.5">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Agency Kosten</span>
            <Button variant="outline" size="sm" onClick={addRow} disabled={rows.length >= 7}><Plus className="mr-1 h-3.5 w-3.5" />Toevoegen</Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-4"><Input value={row.description} onChange={(e) => setRow(row.id, "description", e.target.value)} placeholder="Omschrijving" className="h-8 text-sm" /></div>
              <div className="col-span-2"><Input value={row.number} onChange={(e) => setRow(row.id, "number", e.target.value)} placeholder="Nr" className="h-8 text-sm" /></div>
              <div className="col-span-3"><Input value={row.remark} onChange={(e) => setRow(row.id, "remark", e.target.value)} placeholder="Opmerking" className="h-8 text-sm" /></div>
              <div className="col-span-2"><div className="relative"><DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" /><Input type="number" value={row.amount} onChange={(e) => setRow(row.id, "amount", e.target.value)} placeholder="0.00" className="h-8 pl-6 text-sm" step="0.01" /></div></div>
              <div className="col-span-1 flex justify-center">{rows.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(row.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Invoices — only after the project exists (upload writes against project_id) */}
      <Card className={section}>
        <CardHeader className="pb-2.5"><CardTitle className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-primary" />Facturen</CardTitle></CardHeader>
        <CardContent>
          {projectId ? (
            <FDACuracaoInvoiceUpload
              projectId={projectId}
              lbhNumber={form.lbh_number}
              shipName={form.ship_name}
              invoices={invoices}
              onInvoicesChange={(inv) => { setInvoices(inv); onChanged?.(); }}
            />
          ) : (
            <p className="text-[12px] text-muted-foreground">Maak de FDA eerst aan ("Aanmaken") om facturen te kunnen toevoegen.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
