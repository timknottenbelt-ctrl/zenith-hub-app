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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  FileText,
  Trash2,
  Loader2,
  Send,
  Ship,
  User,
  Mail,
  Phone,
  Receipt,
  Plus,
  ArrowLeft,
  Calendar,
  History,
  Anchor,
  Package,
  DollarSign,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isValid } from "date-fns";
import { ClientSelector } from "@/components/ClientSelector";
import { FDACuracaoWizardSteps } from "@/components/fda-curacao/FDACuracaoWizardSteps";
import { FDACuracaoProjectCard } from "@/components/fda-curacao/FDACuracaoProjectCard";
import { FDACuracaoInvoiceUpload } from "@/components/fda-curacao/FDACuracaoInvoiceUpload";
import { FDACuracaoProcessingStatus } from "@/components/fda-curacao/FDACuracaoProcessingStatus";

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
}

interface Invoice {
  id: string;
  file_name: string;
  file_url: string | null;
  invoice_number: string;
  isNew?: boolean;
}

interface AgencyCostRow {
  id: string;
  description: string;
  number: string;
  remark: string;
  amount: string;
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
  lbh_number: "",
  ship_name: "",
  fda_responsible: "",
  client_name: "",
  client_email: "",
  client_phone: "",
  billing_company: "",
  billing_address: "",
  billing_email: "",
  billing_phone: "",
  vessel_arrived: "",
  vessel_sailed: "",
  operation: "",
  commodity: "",
  client_reference: "",
  advanced_payment_amount: "",
  advanced_payment_currency: "USD",
  advanced_payment_reference: "",
  advanced_payment_status: "unpaid",
  advanced_payment_remark: "",
};

const WEBHOOK_URL = "https://lbhcuracao.app.n8n.cloud/webhook/invoice-upload-curacao";

export default function FDACuracao() {
  const { t } = useLanguage();
  const navigate = useTransitionNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const setProjectInUrl = useCallback(
    (projectId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("project", projectId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearProjectInUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("project");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  
  const [projects, setProjects] = useState<FDAProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<FDAProject | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showProcessing, setShowProcessing] = useState(false);
  
  const [agencyCostRows, setAgencyCostRows] = useState<AgencyCostRow[]>([
    { id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }
  ]);
  const [formData, setFormData] = useState<FDAFormData>(INITIAL_FORM);

  useEffect(() => {
    fetchProjects(true);
  }, []);

  useEffect(() => {
    const projectId = searchParams.get("project");
    if (!projectId) return;

    const found = projects.find((p) => p.project_id === projectId);
    if (!found) return;

    if (!selectedProject || selectedProject.project_id !== found.project_id) {
      setSelectedProject(found);
    }
  }, [projects, searchParams, selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectData(selectedProject);
    }
  }, [selectedProject?.id]);

  async function fetchProjects(showLoader = false) {
    if (showLoader) setLoading(true);
    const { data, error } = await supabase
      .from("fda_curacao_projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setProjects(data || []);
    if (showLoader) setLoading(false);
  }

  async function loadProjectData(project: FDAProject) {
    // Load form data
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
      vessel_arrived: (project as any).vessel_arrived || "",
      vessel_sailed: (project as any).vessel_sailed || "",
      operation: (project as any).operation || "",
      commodity: (project as any).commodity || "",
      client_reference: (project as any).client_reference || "",
      advanced_payment_amount: (project as any).advanced_payment_amount?.toString() || "",
      advanced_payment_currency: (project as any).advanced_payment_currency || "USD",
      advanced_payment_reference: (project as any).advanced_payment_reference || "",
      advanced_payment_status: (project as any).advanced_payment_status || "unpaid",
      advanced_payment_remark: (project as any).advanced_payment_remark || "",
    });

    // Load agency costs
    const { data: agencyData } = await supabase
      .from("fda_curacao_agency_costs")
      .select("*")
      .eq("project_id", project.project_id)
      .order("created_at", { ascending: true });

    if (agencyData && agencyData.length > 0) {
      setAgencyCostRows(agencyData.map((row: any) => ({
        id: row.id,
        description: row.description || "",
        number: row.invoice_number || "",
        remark: row.remark || "",
        amount: row.total_amount?.toString() || "",
      })));
    } else {
      setAgencyCostRows([{ id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }]);
    }

    // Load invoices
    const { data: invData } = await supabase
      .from("fda_curacao_processed_invoices")
      .select("id, file_name, file_url, invoice_number")
      .eq("project_id", project.project_id)
      .order("created_at", { ascending: true });

    setInvoices(invData || []);
    
    // Check if we should show processing status
    setShowProcessing(project.status === "processing" || project.status === "ready_to_send");
  }

  const handleInputChange = (field: keyof FDAFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAgencyCostChange = (id: string, field: keyof AgencyCostRow, value: string) => {
    setAgencyCostRows(rows => rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addAgencyCostRow = () => {
    if (agencyCostRows.length >= 7) {
      toast({ title: "Maximum bereikt", description: "Max 7 regels", variant: "destructive" });
      return;
    }
    setAgencyCostRows(rows => [...rows, { id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }]);
  };

  const removeAgencyCostRow = (id: string) => {
    if (agencyCostRows.length > 1) {
      setAgencyCostRows(rows => rows.filter(row => row.id !== id));
    }
  };

  async function saveAgencyCosts(projectId: string) {
    await supabase.from("fda_curacao_agency_costs").delete().eq("project_id", projectId);
    
    const rows = agencyCostRows.filter(r => r.description || r.number || r.remark || r.amount);
    if (rows.length === 0) return;

    await supabase.from("fda_curacao_agency_costs").insert(
      rows.map(row => ({
        project_id: projectId,
        lbh_number: formData.lbh_number,
        ship_name: formData.ship_name,
        invoice_number: row.number || "",
        description: row.description || null,
        remark: row.remark || null,
        total_amount: row.amount ? parseFloat(row.amount) : null,
        currency: "USD",
      }))
    );
  }

  async function handleCreateProject() {
    if (!formData.lbh_number || !formData.ship_name) {
      toast({ title: "Fout", description: "LBH nummer en scheepsnaam zijn verplicht", variant: "destructive" });
      return;
    }

    setSaving(true);
    const projectId = crypto.randomUUID();
    
    const { data, error } = await supabase
      .from("fda_curacao_projects")
      .insert({
        project_id: projectId,
        lbh_number: formData.lbh_number,
        ship_name: formData.ship_name,
        fda_responsible: formData.fda_responsible || null,
        client_name: formData.client_name || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        billing_company: formData.billing_company || null,
        billing_address: formData.billing_address || null,
        billing_email: formData.billing_email || null,
        billing_phone: formData.billing_phone || null,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Aangemaakt", description: "Project is aangemaakt" });
      setShowCreateDialog(false);
      setFormData(INITIAL_FORM);
      await fetchProjects();
      if (data) {
        setProjectInUrl(data.project_id);
        setSelectedProject(data);
      }
    }
    setSaving(false);
  }

  async function handleSaveProject() {
    if (!selectedProject) return;
    
    setSaving(true);
    const { error } = await supabase
      .from("fda_curacao_projects")
      .update({
        lbh_number: formData.lbh_number,
        ship_name: formData.ship_name,
        fda_responsible: formData.fda_responsible || null,
        client_name: formData.client_name || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        billing_company: formData.billing_company || null,
        billing_address: formData.billing_address || null,
        billing_email: formData.billing_email || null,
        billing_phone: formData.billing_phone || null,
        vessel_arrived: formData.vessel_arrived || null,
        vessel_sailed: formData.vessel_sailed || null,
        operation: formData.operation || null,
        commodity: formData.commodity || null,
        client_reference: formData.client_reference || null,
        advanced_payment_amount: formData.advanced_payment_amount ? parseFloat(formData.advanced_payment_amount) : null,
        advanced_payment_currency: formData.advanced_payment_currency || "USD",
        advanced_payment_reference: formData.advanced_payment_reference || null,
        advanced_payment_status: formData.advanced_payment_status || "unpaid",
        advanced_payment_remark: formData.advanced_payment_remark || null,
      })
      .eq("id", selectedProject.id);

    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      await saveAgencyCosts(selectedProject.project_id);
      toast({ title: "Opgeslagen" });
      await fetchProjects();
    }
    setSaving(false);
  }

  async function handleDeleteProject() {
    if (!selectedProject) return;
    
    const { error } = await supabase.from("fda_curacao_projects").delete().eq("id", selectedProject.id);
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Verwijderd" });
      clearProjectInUrl();
      setSelectedProject(null);
      await fetchProjects();
    }
  }

  async function handleSendFDA(forceResend = false) {
    if (!selectedProject) return;

    // If already processing, just navigate
    if ((selectedProject.status === "processing" || selectedProject.status === "ready_to_send") && !forceResend) {
      navigate(`/fda-curacao/email/${selectedProject.project_id}`);
      return;
    }

    setSending(true);

    try {
      // Save everything first
      await handleSaveProject();

      // If force resend, delete old processed invoices to prevent duplicates
      if (forceResend) {
        await supabase
          .from("fda_curacao_processed_invoices")
          .delete()
          .eq("project_id", selectedProject.project_id);
      }

      // Update status to processing
      await supabase
        .from("fda_curacao_projects")
        .update({ status: "processing" })
        .eq("project_id", selectedProject.project_id);

      // Prepare payload
      const payload = {
        project_id: selectedProject.project_id,
        lbh_number: formData.lbh_number,
        ship_name: formData.ship_name,
        fda_responsible: formData.fda_responsible,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        billing_company: formData.billing_company,
        billing_address: formData.billing_address,
        billing_email: formData.billing_email,
        billing_phone: formData.billing_phone,
        vessel_arrived: formData.vessel_arrived,
        vessel_sailed: formData.vessel_sailed,
        operation: formData.operation,
        commodity: formData.commodity,
        client_reference: formData.client_reference,
        advanced_payment_amount: formData.advanced_payment_amount ? parseFloat(formData.advanced_payment_amount) : null,
        advanced_payment_currency: formData.advanced_payment_currency,
        advanced_payment_reference: formData.advanced_payment_reference,
        advanced_payment_status: formData.advanced_payment_status,
        advanced_payment_remark: formData.advanced_payment_remark,
        agency_costs: agencyCostRows.filter(r => r.description || r.amount).map(r => ({
          description: r.description,
          number: r.number,
          remark: r.remark,
          amount: r.amount ? parseFloat(r.amount) : null,
          currency: formData.advanced_payment_currency || "USD",
        })),
        invoice_files: invoices.map(inv => ({
          file_name: inv.file_name,
          file_url: inv.file_url,
          invoice_number: inv.invoice_number,
        })),
        invoice_count: invoices.length,
        force_resend: forceResend,
      };

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Webhook error: ${response.status}`);

      setShowProcessing(true);
      
      // Update local selectedProject status without full refetch to prevent screen flash
      setSelectedProject(prev => prev ? { ...prev, status: "processing" } : null);
      
      toast({ title: "Verzonden", description: "Verwerking gestart..." });

    } catch (error) {
      console.error("Send error:", error);
      toast({ 
        title: "Fout", 
        description: error instanceof Error ? error.message : "Verzenden mislukt", 
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  }

  const isProcessing = selectedProject?.status === "processing" || selectedProject?.status === "ready_to_send";
  const isSent = selectedProject?.status === "sent" || selectedProject?.status === "completed";
  const hasBeenProcessed = isProcessing || isSent || selectedProject?.google_sheet_url;
  const currentStep = !selectedProject ? "setup" : invoices.length === 0 ? "setup" : showProcessing ? "processing" : "invoices";

  if (loading) {
    return (
      <DashboardLayout title="FDA Curacao">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Detail view
  if (selectedProject) {
    return (
      <DashboardLayout title="FDA Curacao">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  clearProjectInUrl();
                  setSelectedProject(null);
                }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{formData.ship_name || "Nieuw project"}</h1>
                <p className="text-sm text-muted-foreground">{formData.lbh_number}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => { fetchProjects(); if (selectedProject) loadProjectData(selectedProject); }} title="Vernieuwen">
                <RefreshCw className="w-4 h-4" />
              </Button>

              {/* Delete project */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Project verwijderen">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Project verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dit verwijdert het project "{formData.ship_name}" ({formData.lbh_number}) inclusief alle facturen en gerelateerde data. Dit kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          // Delete related data first
                          await supabase.from("fda_curacao_processed_invoices").delete().eq("project_id", selectedProject.project_id);
                          await supabase.from("fda_curacao_agency_costs").delete().eq("project_id", selectedProject.id);
                          await supabase.from("fda_email_drafts").delete().eq("project_id", selectedProject.id);
                          // Delete the project
                          await supabase.from("fda_curacao_projects").delete().eq("project_id", selectedProject.project_id);
                          toast({ title: "Verwijderd", description: "Project is verwijderd" });
                          clearProjectInUrl();
                          setSelectedProject(null);
                          fetchProjects(true);
                        } catch (err) {
                          toast({ title: "Fout", description: "Kon project niet verwijderen", variant: "destructive" });
                        }
                      }}
                    >
                      Ja, verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="outline" onClick={handleSaveProject} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Opslaan
              </Button>
              
              {/* Always show reprocess button if needed */}
              {hasBeenProcessed ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={sending || invoices.length === 0}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Opnieuw verwerken
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Opnieuw verwerken?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dit project is al eerder verwerkt. Weet je zeker dat je alle facturen opnieuw wilt laten verwerken? Dit kan 1-2 minuten duren.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleSendFDA(true)}>
                        Ja, opnieuw verwerken
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={() => handleSendFDA(false)} disabled={sending || invoices.length === 0}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Verstuur FDA
                </Button>
              )}
            </div>
          </div>

          {/* Wizard Steps - Shows actual project status, not page location */}
          <FDACuracaoWizardSteps 
            projectStatus={selectedProject.status}
            hasInvoices={invoices.length > 0}
            hasDraft={false}
            onNavigate={(step) => {
              if (step === "email" || step === "processing") {
                navigate(`/fda-curacao/email/${selectedProject.project_id}`);
              }
              // setup and invoices are on the same page, no navigation needed
            }}
          />

          {/* Processing Status */}
          {showProcessing && (
            <FDACuracaoProcessingStatus
              projectId={selectedProject.project_id}
              initialSheetUrl={selectedProject.google_sheet_url}
              initialAgencyCostUrl={selectedProject.agency_cost_url}
              initialStatus={selectedProject.status}
              onComplete={async () => {
                await fetchProjects();
              }}
              onNavigateToEmail={() => navigate(`/fda-curacao/email/${selectedProject.project_id}`)}
            />
          )}

          {/* Form sections */}
          <div className="grid gap-6">
            {/* Ship & Client info */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Ship className="w-4 h-4 text-primary" />
                    Schip
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">LBH Nummer *</Label>
                      <Input value={formData.lbh_number} onChange={(e) => handleInputChange("lbh_number", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Scheepsnaam *</Label>
                      <Input value={formData.ship_name} onChange={(e) => handleInputChange("ship_name", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">FDA Verantwoordelijke</Label>
                    <Input value={formData.fda_responsible} onChange={(e) => handleInputChange("fda_responsible", e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Klant
                    </div>
                    <ClientSelector
                      onSelectClient={(client) => {
                        setFormData(prev => ({
                          ...prev,
                          client_name: client.client_name,
                          client_email: client.client_email,
                          client_phone: client.client_phone,
                          billing_company: client.billing_company,
                          billing_email: client.billing_email,
                          billing_address: client.billing_address,
                          billing_phone: client.billing_phone,
                        }));
                      }}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Naam</Label>
                    <Input value={formData.client_name} onChange={(e) => handleInputChange("client_name", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">E-mail</Label>
                      <Input type="email" value={formData.client_email} onChange={(e) => handleInputChange("client_email", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefoon</Label>
                      <Input value={formData.client_phone} onChange={(e) => handleInputChange("client_phone", e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Billing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  Facturatie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Bedrijf</Label>
                    <Input value={formData.billing_company} onChange={(e) => handleInputChange("billing_company", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input type="email" value={formData.billing_email} onChange={(e) => handleInputChange("billing_email", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Adres</Label>
                    <Input value={formData.billing_address} onChange={(e) => handleInputChange("billing_address", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefoon</Label>
                    <Input value={formData.billing_phone} onChange={(e) => handleInputChange("billing_phone", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Port Call */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-primary" />
                  Haven informatie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Aankomst</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start h-9 text-sm">
                          <Calendar className="mr-2 h-3.5 w-3.5" />
                          {formData.vessel_arrived && isValid(parseISO(formData.vessel_arrived))
                            ? format(parseISO(formData.vessel_arrived), "d MMM yy")
                            : <span className="text-muted-foreground">Datum</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.vessel_arrived ? parseISO(formData.vessel_arrived) : undefined}
                          onSelect={(date) => handleInputChange("vessel_arrived", date ? format(date, "yyyy-MM-dd") : "")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Vertrek</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start h-9 text-sm">
                          <Calendar className="mr-2 h-3.5 w-3.5" />
                          {formData.vessel_sailed && isValid(parseISO(formData.vessel_sailed))
                            ? format(parseISO(formData.vessel_sailed), "d MMM yy")
                            : <span className="text-muted-foreground">Datum</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.vessel_sailed ? parseISO(formData.vessel_sailed) : undefined}
                          onSelect={(date) => handleInputChange("vessel_sailed", date ? format(date, "yyyy-MM-dd") : "")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Operatie</Label>
                    <Input value={formData.operation} onChange={(e) => handleInputChange("operation", e.target.value)} placeholder="Laden / Lossen" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lading</Label>
                    <Input value={formData.commodity} onChange={(e) => handleInputChange("commodity", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Referentie</Label>
                    <Input value={formData.client_reference} onChange={(e) => handleInputChange("client_reference", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Payment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Voorschot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Bedrag</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        type="number"
                        value={formData.advanced_payment_amount}
                        onChange={(e) => handleInputChange("advanced_payment_amount", e.target.value)}
                        className="pl-6"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valuta</Label>
                    <Select value={formData.advanced_payment_currency} onValueChange={(v) => handleInputChange("advanced_payment_currency", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="ANG">ANG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={formData.advanced_payment_status} onValueChange={(v) => handleInputChange("advanced_payment_status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">Onbetaald</SelectItem>
                        <SelectItem value="paid">Betaald</SelectItem>
                        <SelectItem value="partial">Deels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Referentie</Label>
                    <Input value={formData.advanced_payment_reference} onChange={(e) => handleInputChange("advanced_payment_reference", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Opmerking</Label>
                    <Input value={formData.advanced_payment_remark} onChange={(e) => handleInputChange("advanced_payment_remark", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agency Costs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Agency Kosten
                  </div>
                  <Button variant="outline" size="sm" onClick={addAgencyCostRow} disabled={agencyCostRows.length >= 7}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Toevoegen
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {agencyCostRows.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input
                        value={row.description}
                        onChange={(e) => handleAgencyCostChange(row.id, "description", e.target.value)}
                        placeholder="Omschrijving"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={row.number}
                        onChange={(e) => handleAgencyCostChange(row.id, "number", e.target.value)}
                        placeholder="Nr"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={row.remark}
                        onChange={(e) => handleAgencyCostChange(row.id, "remark", e.target.value)}
                        placeholder="Opmerking"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                        <Input
                          type="number"
                          value={row.amount}
                          onChange={(e) => handleAgencyCostChange(row.id, "amount", e.target.value)}
                          placeholder="0.00"
                          className="h-8 text-sm pl-6"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {agencyCostRows.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAgencyCostRow(row.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Invoice Upload */}
            <FDACuracaoInvoiceUpload
              projectId={selectedProject.project_id}
              lbhNumber={formData.lbh_number}
              shipName={formData.ship_name}
              invoices={invoices}
              onInvoicesChange={setInvoices}
              disabled={isSent}
            />

            {/* Delete */}
            {!isSent && (
              <div className="flex justify-end pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Verwijderen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Project verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dit verwijdert het project en alle bijbehorende facturen permanent.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Verwijderen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Overview
  return (
    <DashboardLayout title="FDA Curacao">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">FDA Curacao</h1>
            <p className="text-sm text-muted-foreground">Beheer je FDA projecten</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/fda-curacao/history")}>
              <History className="w-4 h-4 mr-2" />
              Historie
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nieuw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuw FDA Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>LBH Nummer *</Label>
                      <Input value={formData.lbh_number} onChange={(e) => handleInputChange("lbh_number", e.target.value)} placeholder="LBH-2024-001" />
                    </div>
                    <div className="space-y-2">
                      <Label>Scheepsnaam *</Label>
                      <Input value={formData.ship_name} onChange={(e) => handleInputChange("ship_name", e.target.value)} placeholder="MV Ocean King" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Klant gegevens</span>
                    <ClientSelector
                      onSelectClient={(client) => {
                        setFormData(prev => ({
                          ...prev,
                          client_name: client.client_name,
                          client_email: client.client_email,
                          client_phone: client.client_phone,
                          billing_company: client.billing_company,
                          billing_email: client.billing_email,
                          billing_address: client.billing_address,
                          billing_phone: client.billing_phone,
                        }));
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Naam</Label>
                      <Input value={formData.client_name} onChange={(e) => handleInputChange("client_name", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input type="email" value={formData.client_email} onChange={(e) => handleInputChange("client_email", e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuleren</Button>
                    <Button onClick={handleCreateProject} disabled={saving}>
                      {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Aanmaken
                    </Button>
                  </div>
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
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nieuw project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project, i) => (
              <FDACuracaoProjectCard
                key={project.id}
                project={project}
                onClick={() => {
                  setProjectInUrl(project.project_id);
                  setSelectedProject(project);
                }}
                isNew={i === 0 && new Date(project.created_at || "").getTime() > Date.now() - 60000}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
