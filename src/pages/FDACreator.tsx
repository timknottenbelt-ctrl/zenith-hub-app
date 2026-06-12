import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  FileText, Trash2, Loader2, Send, Ship, User, Mail, Phone, Receipt,
  Plus, ArrowLeft, Calendar, History, Anchor, DollarSign, CreditCard,
  Upload, Eye, Download, CheckCircle, Clock, Edit, FileUp, RefreshCw,
  Settings,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isValid } from "date-fns";
import { ClientSelector } from "@/components/ClientSelector";
import { FDAStepSidebar, type StepConfig } from "@/components/fda/FDAStepSidebar";
import { FDAFrontPageStep } from "@/components/fda/FDAFrontPageStep";
import { WEBHOOKS, webhookPostJSON } from "@/lib/webhooks";

// ─── Types ───────────────────────────────────────────────────────────────────
interface FDAProject {
  id: string;
  project_id: string;
  lbh_number: string;
  ship_name: string;
  fda_responsible: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  status: string | null;
  created_at: string | null;
  google_sheet_url: string | null;
  agency_cost_url: string | null;
  front_page_url: string | null;
  final_pdf_url: string | null;
  // Columns not yet in the generated Supabase types.
  vessel_arrived?: string | null;
  vessel_sailed?: string | null;
  operation?: string | null;
  commodity?: string | null;
  client_reference?: string | null;
  advanced_payment_amount?: number | null;
  advanced_payment_currency?: string | null;
  advanced_payment_reference?: string | null;
  advanced_payment_status?: string | null;
  advanced_payment_remark?: string | null;
}

interface FDAInvoice {
  id: string;
  fda_project_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  invoice_number: string | null;
}

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

const INITIAL_FORM: FDAFormData = {
  lbh_number: "", ship_name: "", fda_responsible: "",
  client_name: "", client_email: "", client_phone: "",
  billing_company: "", billing_address: "", billing_email: "", billing_phone: "",
  vessel_arrived: "", vessel_sailed: "", operation: "", commodity: "", client_reference: "",
  advanced_payment_amount: "", advanced_payment_currency: "USD",
  advanced_payment_reference: "", advanced_payment_status: "unpaid", advanced_payment_remark: "",
};

type FDAStep = "setup" | "invoices" | "frontpage" | "processing" | "email";

// ─── Invoice Row ─────────────────────────────────────────────────────────────
function InvoiceRow({ invoice, index, isSent, onDelete, onUpdateNumber }: {
  invoice: FDAInvoice; index: number; isSent: boolean;
  onDelete: (inv: FDAInvoice) => void;
  onUpdateNumber: (id: string, num: string) => void;
}) {
  const [num, setNum] = useState(invoice.invoice_number || String(index + 1).padStart(3, "0"));
  const [loading, setLoading] = useState(false);

  const handleView = async () => {
    setLoading(true);
    const { data } = await supabase.storage.from("fda-invoices").createSignedUrl(invoice.file_path, 3600);
    setLoading(false);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <CheckCircle className="w-4 h-4 text-success shrink-0" />
        <span className="text-sm truncate">{invoice.file_name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">Nr:</span>
        <Input value={num} onChange={(e) => setNum(e.target.value)} onBlur={() => num !== invoice.invoice_number && onUpdateNumber(invoice.id, num)} className="w-20 h-8 text-sm" disabled={isSent} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleView} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        </Button>
        {!isSent && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(invoice)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function FDACreator() {
  const { t } = useLanguage();
  const navigate = useTransitionNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const setProjectInUrl = useCallback((pid: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("project", pid);
    if (!next.has("step")) next.set("step", "setup");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearProjectInUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("project");
    next.delete("step");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setStepInUrl = useCallback((step: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("step", step);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const activeStep = (searchParams.get("step") as FDAStep) || "setup";

  const [projects, setProjects] = useState<FDAProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<FDAProject | null>(null);
  const [invoices, setInvoices] = useState<FDAInvoice[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [formData, setFormData] = useState<FDAFormData>(INITIAL_FORM);

  // ─── Data Fetching ───────────────────────────────────────────────────────
  useEffect(() => { fetchProjects(true); }, []);

  useEffect(() => {
    const pid = searchParams.get("project");
    if (!pid) return;
    const found = projects.find((p) => p.project_id === pid);
    if (found && (!selectedProject || selectedProject.project_id !== found.project_id)) {
      setSelectedProject(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, searchParams]);

  useEffect(() => {
    if (selectedProject) loadProjectData(selectedProject);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  async function fetchProjects(showLoader = false) {
    if (showLoader) setLoading(true);
    const { data } = await supabase.from("fda_projects").select("*").order("created_at", { ascending: false });
    if (data) setProjects(data);
    if (showLoader) setLoading(false);
  }

  async function loadProjectData(project: FDAProject) {
    setFormData({
      lbh_number: project.lbh_number,
      ship_name: project.ship_name,
      fda_responsible: project.fda_responsible || "",
      client_name: project.client_name || "",
      client_email: project.client_email || "",
      client_phone: project.client_phone || "",
      billing_company: project.billing_company || "",
      billing_address: project.billing_address || "",
      billing_email: project.billing_email || "",
      billing_phone: project.billing_phone || "",
      vessel_arrived: project.vessel_arrived || "",
      vessel_sailed: project.vessel_sailed || "",
      operation: project.operation || "",
      commodity: project.commodity || "",
      client_reference: project.client_reference || "",
      advanced_payment_amount: project.advanced_payment_amount?.toString() || "",
      advanced_payment_currency: project.advanced_payment_currency || "USD",
      advanced_payment_reference: project.advanced_payment_reference || "",
      advanced_payment_status: project.advanced_payment_status || "unpaid",
      advanced_payment_remark: project.advanced_payment_remark || "",
    });
    const { data } = await supabase.from("fda_invoices").select("*").eq("fda_project_id", project.id).order("created_at", { ascending: true });
    setInvoices(data || []);
  }

  const handleInputChange = (field: keyof FDAFormData, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  // ─── CRUD Operations ────────────────────────────────────────────────────
  async function handleCreateProject() {
    if (!formData.lbh_number || !formData.ship_name) {
      toast({ title: "Fout", description: "LBH nummer en scheepsnaam zijn verplicht", variant: "destructive" });
      return;
    }
    setSaving(true);
    const projectId = crypto.randomUUID();
    const { data, error } = await supabase.from("fda_projects").insert({
      project_id: projectId, lbh_number: formData.lbh_number, ship_name: formData.ship_name,
      fda_responsible: formData.fda_responsible || null, client_name: formData.client_name || null,
      client_email: formData.client_email || null, client_phone: formData.client_phone || null,
      billing_company: formData.billing_company || null, billing_address: formData.billing_address || null,
      billing_email: formData.billing_email || null, billing_phone: formData.billing_phone || null,
    }).select().single();

    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      if (formData.client_name) {
        const { data: existing } = await supabase.from("contacts").select("id").eq("name", formData.client_name).eq("role", "FDA Client").maybeSingle();
        if (!existing) await supabase.from("contacts").insert({ name: formData.client_name, email: formData.client_email || null, phone: formData.client_phone || null, company: formData.billing_company || null, function: formData.billing_address || null, role: "FDA Client" });
      }
      toast({ title: "Aangemaakt" });
      setShowCreateDialog(false);
      setFormData(INITIAL_FORM);
      await fetchProjects();
      if (data) { setProjectInUrl(data.project_id); setSelectedProject(data); }
    }
    setSaving(false);
  }

  async function handleSaveProject() {
    if (!selectedProject) return;
    setSaving(true);
    const { error } = await supabase.from("fda_projects").update({
      lbh_number: formData.lbh_number, ship_name: formData.ship_name,
      fda_responsible: formData.fda_responsible || null, client_name: formData.client_name || null,
      client_email: formData.client_email || null, client_phone: formData.client_phone || null,
      billing_company: formData.billing_company || null, billing_address: formData.billing_address || null,
      billing_email: formData.billing_email || null, billing_phone: formData.billing_phone || null,
      vessel_arrived: formData.vessel_arrived || null, vessel_sailed: formData.vessel_sailed || null,
      operation: formData.operation || null, commodity: formData.commodity || null,
      client_reference: formData.client_reference || null,
      advanced_payment_amount: formData.advanced_payment_amount ? parseFloat(formData.advanced_payment_amount) : null,
      advanced_payment_currency: formData.advanced_payment_currency || "USD",
      advanced_payment_reference: formData.advanced_payment_reference || null,
      advanced_payment_status: formData.advanced_payment_status || "unpaid",
      advanced_payment_remark: formData.advanced_payment_remark || null,
    }).eq("id", selectedProject.id);
    if (error) toast({ title: "Fout", description: error.message, variant: "destructive" });
    else { toast({ title: "Opgeslagen" }); await fetchProjects(); }
    setSaving(false);
  }

  async function handleDeleteProject() {
    if (!selectedProject) return;
    await supabase.from("fda_projects").delete().eq("id", selectedProject.id);
    toast({ title: "Verwijderd" });
    clearProjectInUrl();
    setSelectedProject(null);
    await fetchProjects();
  }

  // ─── Invoice Management ──────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !selectedProject) return;
    setUploadingFiles(true);
    let count = invoices.length;
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") { toast({ title: "Fout", description: "Alleen PDF bestanden", variant: "destructive" }); continue; }
      const filePath = `${selectedProject.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("fda-invoices").upload(filePath, file);
      if (error) { toast({ title: "Upload mislukt", description: error.message, variant: "destructive" }); continue; }
      count++;
      await supabase.from("fda_invoices").insert({ fda_project_id: selectedProject.id, file_path: filePath, file_name: file.name, file_size: file.size, invoice_number: String(count).padStart(3, "0") });
    }
    const { data } = await supabase.from("fda_invoices").select("*").eq("fda_project_id", selectedProject.id).order("created_at", { ascending: true });
    setInvoices(data || []);
    setUploadingFiles(false);
    toast({ title: "Geüpload" });
    e.target.value = "";
  }

  async function handleDeleteInvoice(invoice: FDAInvoice) {
    await supabase.storage.from("fda-invoices").remove([invoice.file_path]);
    await supabase.from("fda_invoices").delete().eq("id", invoice.id);
    if (selectedProject) {
      const { data } = await supabase.from("fda_invoices").select("*").eq("fda_project_id", selectedProject.id).order("created_at", { ascending: true });
      setInvoices(data || []);
    }
  }

  async function handleUpdateInvoiceNumber(id: string, num: string) {
    const { error } = await supabase.from("fda_invoices").update({ invoice_number: num }).eq("id", id);
    if (error) toast({ title: "Niet opgeslagen", description: error.message, variant: "destructive" });
    else toast({ title: "Factuurnummer opgeslagen" });
  }

  // ─── Send to Webhook ────────────────────────────────────────────────────
  async function handleSendFDA() {
    if (!selectedProject || invoices.length === 0) {
      toast({ title: "Fout", description: "Upload minimaal één factuur", variant: "destructive" });
      return;
    }
    if (!formData.vessel_arrived || !formData.vessel_sailed || !formData.operation) {
      toast({ title: "Ontbrekende velden", description: "Aankomst, vertrek en operatie zijn verplicht", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await handleSaveProject();
      const fileUrls: string[] = [];
      for (const inv of invoices) {
        const { data } = await supabase.storage.from("fda-invoices").createSignedUrl(inv.file_path, 86400);
        if (data?.signedUrl) fileUrls.push(data.signedUrl);
      }
      const payload = {
        project_id: selectedProject.project_id,
        lbh_number: formData.lbh_number, ship_name: formData.ship_name,
        fda_responsible: formData.fda_responsible,
        client_name: formData.client_name, client_email: formData.client_email, client_phone: formData.client_phone,
        billing_company: formData.billing_company, billing_address: formData.billing_address,
        billing_email: formData.billing_email, billing_phone: formData.billing_phone,
        vessel_arrived: formData.vessel_arrived, vessel_sailed: formData.vessel_sailed,
        operation: formData.operation, commodity: formData.commodity, client_reference: formData.client_reference,
        advanced_payment_amount: formData.advanced_payment_amount ? parseFloat(formData.advanced_payment_amount) : null,
        invoice_files: fileUrls, invoice_count: invoices.length, sent_at: new Date().toISOString(),
      };
      await supabase.from("fda_projects").update({ status: "processing" }).eq("project_id", selectedProject.project_id);
      setSelectedProject(prev => prev ? { ...prev, status: "processing" } : null);
      webhookPostJSON(WEBHOOKS.FDA_INVOICE_UPLOAD, payload).catch(err => console.error("Webhook error:", err));
      toast({ title: "Verzonden", description: "Verwerking gestart..." });
      setStepInUrl("frontpage");
    } catch (error) {
      toast({ title: "Fout", description: error instanceof Error ? error.message : "Verzenden mislukt", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  // ─── Step Status Calculation ────────────────────────────────────────────
  function getStepStatuses(): StepConfig[] {
    const s = selectedProject?.status;
    const isSentStatus = s === "sent" || s === "email_sent" || s === "completed";
    const hasSheet = !!selectedProject?.google_sheet_url;
    const hasFinalPdf = !!selectedProject?.final_pdf_url;
    const hasInvoices = invoices.length > 0;

    // Setup is only truly complete when the fields required for sending are
    // filled — otherwise the sidebar showed a green check but "Verstuur" failed.
    const setupComplete = !!formData.lbh_number && !!formData.ship_name &&
      !!formData.vessel_arrived && !!formData.vessel_sailed && !!formData.operation;
    const invoicesComplete = hasInvoices;
    const frontpageComplete = hasFinalPdf || isSentStatus;
    const processingComplete = hasSheet || hasFinalPdf || isSentStatus;
    const emailComplete = isSentStatus;

    return [
      { id: "setup", label: "Setup", icon: Settings, status: setupComplete ? "complete" : "warning" },
      { id: "invoices", label: "Facturen", icon: FileText, status: invoicesComplete ? "complete" : "pending" },
      { id: "frontpage", label: "Front Page", icon: FileUp, status: frontpageComplete ? "complete" : s === "processing" ? "processing" : hasInvoices ? "pending" : "pending" },
      { id: "processing", label: "Verwerken", icon: Send, status: processingComplete ? "complete" : s === "processing" ? "processing" : "pending" },
      { id: "email", label: "E-mail", icon: Mail, status: emailComplete ? "complete" : hasFinalPdf ? "warning" : "pending" },
    ];
  }

  const isSent = selectedProject?.status === "sent" || selectedProject?.status === "email_sent";

  // ─── Status Badge ────────────────────────────────────────────────────────
  function getStatusBadge(status: string | null) {
    if (status === "sent" || status === "email_sent") return <Badge className="bg-success/10 text-success border-success/20" variant="outline"><CheckCircle className="w-3 h-3 mr-1" />Verstuurd</Badge>;
    if (status === "processing" || status === "ready_to_send") return <Badge className="bg-warning/10 text-warning border-warning/20" variant="outline"><Clock className="w-3 h-3 mr-1" />Verwerken</Badge>;
    return <Badge className="bg-muted text-muted-foreground" variant="outline"><Clock className="w-3 h-3 mr-1" />Concept</Badge>;
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return <DashboardLayout title={t("fda.title")}><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  // ─── Detail View (Sidebar Layout) ───────────────────────────────────────
  if (selectedProject) {
    return (
      <DashboardLayout title={t("fda.title")}>
        <div className="flex h-[calc(100vh-4rem)] -m-6">
          {/* Sidebar */}
          <FDAStepSidebar
            projectName={formData.ship_name}
            lbhNumber={formData.lbh_number}
            steps={getStepStatuses()}
            activeStepId={activeStep}
            onStepClick={(stepId) => {
              if (stepId === "email" && selectedProject) {
                navigate(`/fda/email/${selectedProject.project_id}`);
              } else {
                setStepInUrl(stepId);
              }
            }}
            onBack={() => { clearProjectInUrl(); setSelectedProject(null); }}
            projectStatus={selectedProject.status}
          />

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold">{formData.ship_name || "Nieuw project"}</h1>
                  <p className="text-sm text-muted-foreground">{formData.lbh_number}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { fetchProjects(); if (selectedProject) loadProjectData(selectedProject); }} title="Vernieuwen">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Verwijderen"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Project verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>Dit verwijdert het project en alle bijbehorende data permanent.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="outline" onClick={handleSaveProject} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Opslaan
                  </Button>
                  {activeStep === "invoices" && (
                    <Button onClick={handleSendFDA} disabled={sending || invoices.length === 0}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Verstuur FDA
                    </Button>
                  )}
                </div>
              </div>

              {/* Step: Setup */}
              {activeStep === "setup" && (
                <div className="grid gap-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center gap-2"><Ship className="w-4 h-4 text-primary" />Schip</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">LBH Nummer *</Label><Input value={formData.lbh_number} onChange={(e) => handleInputChange("lbh_number", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Scheepsnaam *</Label><Input value={formData.ship_name} onChange={(e) => handleInputChange("ship_name", e.target.value)} /></div>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">FDA Verantwoordelijke</Label><Input value={formData.fda_responsible} onChange={(e) => handleInputChange("fda_responsible", e.target.value)} /></div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center justify-between">
                          <div className="flex items-center gap-2"><User className="w-4 h-4 text-primary" />Klant</div>
                          <ClientSelector onSelectClient={(c) => setFormData(prev => ({ ...prev, client_name: c.client_name, client_email: c.client_email, client_phone: c.client_phone, billing_company: c.billing_company, billing_email: c.billing_email, billing_address: c.billing_address, billing_phone: c.billing_phone }))} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1"><Label className="text-xs">Naam</Label><Input value={formData.client_name} onChange={(e) => handleInputChange("client_name", e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input type="email" value={formData.client_email} onChange={(e) => handleInputChange("client_email", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Telefoon</Label><Input value={formData.client_phone} onChange={(e) => handleInputChange("client_phone", e.target.value)} /></div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base font-medium flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" />Facturatie</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Bedrijf</Label><Input value={formData.billing_company} onChange={(e) => handleInputChange("billing_company", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input type="email" value={formData.billing_email} onChange={(e) => handleInputChange("billing_email", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Adres</Label><Input value={formData.billing_address} onChange={(e) => handleInputChange("billing_address", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Telefoon</Label><Input value={formData.billing_phone} onChange={(e) => handleInputChange("billing_phone", e.target.value)} /></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base font-medium flex items-center gap-2"><Anchor className="w-4 h-4 text-primary" />Haven informatie</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Aankomst *</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start h-9 text-sm">
                                <Calendar className="mr-2 h-3.5 w-3.5" />
                                {formData.vessel_arrived && isValid(parseISO(formData.vessel_arrived)) ? format(parseISO(formData.vessel_arrived), "d MMM yy") : <span className="text-muted-foreground">Datum</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent mode="single" selected={formData.vessel_arrived ? parseISO(formData.vessel_arrived) : undefined} onSelect={(d) => handleInputChange("vessel_arrived", d ? format(d, "yyyy-MM-dd") : "")} />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vertrek *</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start h-9 text-sm">
                                <Calendar className="mr-2 h-3.5 w-3.5" />
                                {formData.vessel_sailed && isValid(parseISO(formData.vessel_sailed)) ? format(parseISO(formData.vessel_sailed), "d MMM yy") : <span className="text-muted-foreground">Datum</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent mode="single" selected={formData.vessel_sailed ? parseISO(formData.vessel_sailed) : undefined} onSelect={(d) => handleInputChange("vessel_sailed", d ? format(d, "yyyy-MM-dd") : "")} />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Operatie *</Label><Input value={formData.operation} onChange={(e) => handleInputChange("operation", e.target.value)} placeholder="Laden / Lossen" /></div>
                        <div className="space-y-1"><Label className="text-xs">Lading</Label><Input value={formData.commodity} onChange={(e) => handleInputChange("commodity", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Referentie</Label><Input value={formData.client_reference} onChange={(e) => handleInputChange("client_reference", e.target.value)} /></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base font-medium flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />Voorschot</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Bedrag</Label>
                          <div className="relative"><DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" /><Input type="number" value={formData.advanced_payment_amount} onChange={(e) => handleInputChange("advanced_payment_amount", e.target.value)} className="pl-6" step="0.01" /></div>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Valuta</Label><Select value={formData.advanced_payment_currency} onValueChange={(v) => handleInputChange("advanced_payment_currency", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="ANG">ANG</SelectItem><SelectItem value="GBP">GBP</SelectItem><SelectItem value="CHF">CHF</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={formData.advanced_payment_status} onValueChange={(v) => handleInputChange("advanced_payment_status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Onbetaald</SelectItem><SelectItem value="paid">Betaald</SelectItem><SelectItem value="pending">Lopend</SelectItem><SelectItem value="partial">Deels</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-xs">Referentie</Label><Input value={formData.advanced_payment_reference} onChange={(e) => handleInputChange("advanced_payment_reference", e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-xs">Opmerking</Label><Input value={formData.advanced_payment_remark} onChange={(e) => handleInputChange("advanced_payment_remark", e.target.value)} /></div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button onClick={() => {
                      handleSaveProject();
                      if (!formData.vessel_arrived || !formData.vessel_sailed || !formData.operation) {
                        toast({ title: "Let op", description: "Vul aankomst, vertrek en operatie in vóór je de FDA verstuurt." });
                      }
                      setStepInUrl("invoices");
                    }}>
                      Opslaan & Volgende →
                    </Button>
                  </div>
                </div>
              )}

              {/* Step: Invoices */}
              {activeStep === "invoices" && (
                <div className="grid gap-6">
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Factuur PDFs ({invoices.length})</CardTitle>
                        {!isSent && (
                          <label className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-2" />Upload PDF</span></Button>
                            <input type="file" multiple accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={uploadingFiles} />
                          </label>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {uploadingFiles && <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><Loader2 className="w-4 h-4 animate-spin" />Uploaden...</div>}
                      {invoices.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          <FileUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nog geen bestanden geüpload</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {invoices.map((inv, i) => (
                            <InvoiceRow key={inv.id} invoice={inv} index={i} isSent={!!isSent} onDelete={handleDeleteInvoice} onUpdateNumber={handleUpdateInvoiceNumber} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step: Front Page */}
              {activeStep === "frontpage" && selectedProject && (
                <FDAFrontPageStep
                  projectId={selectedProject.project_id}
                  shipName={formData.ship_name}
                  lbhNumber={formData.lbh_number}
                  googleSheetUrl={selectedProject.google_sheet_url}
                  frontPageUrl={selectedProject.front_page_url}
                  agencyCostUrl={selectedProject.agency_cost_url}
                  finalPdfUrl={selectedProject.final_pdf_url}
                  status={selectedProject.status}
                  onProjectUpdate={async () => {
                    await fetchProjects();
                    const { data } = await supabase.from("fda_projects").select("*").eq("project_id", selectedProject.project_id).single();
                    if (data) setSelectedProject(data);
                  }}
                  onNavigateToEmail={() => navigate(`/fda/email/${selectedProject.project_id}`)}
                />
              )}

              {/* Step: Processing */}
              {activeStep === "processing" && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-8">
                    {selectedProject?.status === "processing" ? (
                      <div className="flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <div className="text-center">
                          <h3 className="text-lg font-semibold">Bezig met verwerken...</h3>
                          <p className="text-muted-foreground text-sm mt-1">Dit duurt meestal 30-60 seconden.</p>
                        </div>
                        <Button variant="outline" onClick={() => setStepInUrl("frontpage")}>
                          Ga naar Front Page →
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-4">
                        <CheckCircle className="w-8 h-8 text-success" />
                        <div className="text-center">
                          <h3 className="text-lg font-semibold">Verwerking voltooid</h3>
                          <p className="text-muted-foreground text-sm mt-1">Ga naar de Front Page of E-mail stap.</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Step: Email */}
              {activeStep === "email" && (
                <Card className="border-success/50 bg-success/5">
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-success" />
                        <div>
                          <h3 className="font-semibold">E-mail klaar</h3>
                          <p className="text-sm text-muted-foreground">De e-mail is gereed om te versturen of is al verstuurd.</p>
                        </div>
                      </div>
                      <Button onClick={() => navigate(`/fda/email/${selectedProject.project_id}`)}>
                        <Mail className="w-4 h-4 mr-2" />Naar E-mail
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Overview ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title={t("fda.title")}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("fda.title")}</h1>
            <p className="text-sm text-muted-foreground">Beheer je FDA projecten</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/fda/history")}><History className="w-4 h-4 mr-2" />Historie</Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nieuw</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nieuw FDA Project</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>LBH Nummer *</Label><Input value={formData.lbh_number} onChange={(e) => handleInputChange("lbh_number", e.target.value)} placeholder="LBH-2024-001" /></div>
                    <div className="space-y-2"><Label>Scheepsnaam *</Label><Input value={formData.ship_name} onChange={(e) => handleInputChange("ship_name", e.target.value)} placeholder="MV Ocean King" /></div>
                  </div>
                  <div className="space-y-2"><Label>FDA Verantwoordelijke</Label><Input value={formData.fda_responsible} onChange={(e) => handleInputChange("fda_responsible", e.target.value)} /></div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Klant gegevens</span>
                    <ClientSelector onSelectClient={(c) => setFormData(prev => ({ ...prev, client_name: c.client_name, client_email: c.client_email, client_phone: c.client_phone, billing_company: c.billing_company, billing_email: c.billing_email, billing_address: c.billing_address, billing_phone: c.billing_phone }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Naam</Label><Input value={formData.client_name} onChange={(e) => handleInputChange("client_name", e.target.value)} /></div>
                    <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={formData.client_email} onChange={(e) => handleInputChange("client_email", e.target.value)} /></div>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <span className="text-sm font-medium flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" />Facturatie</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Bedrijf</Label><Input value={formData.billing_company} onChange={(e) => handleInputChange("billing_company", e.target.value)} /></div>
                      <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={formData.billing_email} onChange={(e) => handleInputChange("billing_email", e.target.value)} /></div>
                    </div>
                    <div className="space-y-2"><Label>Adres</Label><Input value={formData.billing_address} onChange={(e) => handleInputChange("billing_address", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Telefoon</Label><Input value={formData.billing_phone} onChange={(e) => handleInputChange("billing_phone", e.target.value)} /></div>
                  </div>
                  <Button onClick={handleCreateProject} disabled={saving} className="w-full" size="lg">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Aanmaken
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-medium mb-1">Geen projecten</h3>
              <p className="text-sm text-muted-foreground mb-4">Maak je eerste FDA project aan</p>
              <Button onClick={() => setShowCreateDialog(true)}><Plus className="w-4 h-4 mr-2" />Nieuw project</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <Card key={project.id} className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30" onClick={() => { setProjectInUrl(project.project_id); setSelectedProject(project); }}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Ship className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h3 className="font-semibold">{project.ship_name}</h3>
                        <p className="text-sm text-muted-foreground">{project.lbh_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(project.status)}
                      <span className="text-xs text-muted-foreground">{project.created_at ? new Date(project.created_at).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
