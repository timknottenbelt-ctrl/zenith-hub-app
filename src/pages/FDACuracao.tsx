import { useState, useEffect, useCallback } from "react";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Upload,
  Trash2,
  Loader2,
  Send,
  Ship,
  User,
  Mail,
  Phone,
  Receipt,
  Plus,
  Edit,
  Clock,
  CheckCircle,
  ArrowLeft,
  FileUp,
  Calendar,
  Eye,
  Download,
  History,
  Anchor,
  Package,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isValid } from "date-fns";
import { ClientSelector } from "@/components/ClientSelector";

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
  updated_at: string | null;
  email_sent_at: string | null;
  front_page_url: string | null;
  agency_cost_url: string | null;
  google_sheet_url: string | null;
  final_pdf_url?: string | null;
}

interface FDACuracaoInvoice {
  id: string;
  project_id: string;
  lbh_number: string;
  ship_name: string;
  invoice_number: string;
  file_name: string;
  file_url: string | null;
  supplier_name: string | null;
  description: string | null;
  total_amount: number | null;
  currency: string | null;
  invoice_date: string | null;
  due_date: string | null;
  remark: string | null;
  processed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  // Port Call Information
  vessel_arrived: string;
  vessel_sailed: string;
  operation: string;
  commodity: string;
  client_reference: string;
  // Advanced Payment
  advanced_payment_amount: string;
  advanced_payment_currency: string;
  advanced_payment_reference: string;
  advanced_payment_status: string;
  advanced_payment_remark: string;
}

// Invoice Row Component for Curacao
interface CuracaoInvoiceRowProps {
  invoice: FDACuracaoInvoice;
  index: number;
  isSent: boolean;
  showDetails?: boolean; // Show supplier/amount details (for email page, not main page)
  onDelete: (invoice: FDACuracaoInvoice) => void;
  onUpdateInvoiceNumber: (invoiceId: string, invoiceNumber: string) => void;
}

// Helper to get public PDF URL from storage path
function getPublicPdfUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  
  // If it's already a full URL, return it
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  
  // Construct full Supabase storage URL
  const supabaseUrl = "https://oxkshjaombffbdemqrqb.supabase.co";
  
  // Check if path already includes bucket name
  if (fileUrl.startsWith('fda-invoices/') || fileUrl.startsWith('pdfs/')) {
    return `${supabaseUrl}/storage/v1/object/public/${fileUrl}`;
  }
  
  // Default to fda-invoices bucket
  return `${supabaseUrl}/storage/v1/object/public/fda-invoices/${fileUrl.replace(/^\//, "")}`;
}

function CuracaoInvoiceRow({ invoice, index, isSent, showDetails = false, onDelete, onUpdateInvoiceNumber }: CuracaoInvoiceRowProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number || String(index + 1).padStart(3, "0"));
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  
  // Get the full public URL for the PDF
  const pdfUrl = getPublicPdfUrl(invoice.file_url);

  const loadPdfIntoObjectUrl = useCallback(async (): Promise<string | null> => {
    if (!pdfUrl) return null;

    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch(pdfUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`PDF fetch failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const nextUrl = URL.createObjectURL(blob);

      setPdfObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      return nextUrl;
    } catch (e) {
      const message = e instanceof Error ? e.message : "PDF laden mislukt";
      setPdfError(message);
      return null;
    } finally {
      setPdfLoading(false);
    }
  }, [pdfUrl]);

  useEffect(() => {
    if (!showPdfDialog) return;
    void loadPdfIntoObjectUrl();
  }, [showPdfDialog, loadPdfIntoObjectUrl]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    };
  }, [pdfObjectUrl]);

  const handleDownload = async () => {
    if (!pdfUrl) return;
    const href = pdfObjectUrl ?? (await loadPdfIntoObjectUrl());
    if (!href) return;

    const a = document.createElement("a");
    a.href = href;
    a.download = invoice.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSaveNumber = () => {
    if (invoiceNumber !== invoice.invoice_number) {
      onUpdateInvoiceNumber(invoice.id, invoiceNumber);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
        {/* File Name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CheckCircle className="w-4 h-4 text-success shrink-0" />
          <span className="text-sm truncate">{invoice.file_name}</span>
          {showDetails && invoice.supplier_name && (
            <span className="text-xs text-muted-foreground">({invoice.supplier_name})</span>
          )}
        </div>

        {/* Amount - only show on details view */}
        {showDetails && invoice.total_amount && (
          <div className="text-sm font-medium shrink-0">
            {invoice.currency || 'USD'} {invoice.total_amount.toLocaleString()}
          </div>
        )}

        {/* Invoice Number - Always editable input */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">Nr:</span>
          <Input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            onBlur={handleSaveNumber}
            className="w-20 h-8 text-sm font-normal"
            placeholder="001"
            disabled={isSent}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {pdfUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPdfDialog(true);
              }}
              title="View PDF"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {pdfUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Download PDF"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleDownload();
              }}
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
          {!isSent && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(invoice)}
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="max-w-4xl h-[85vh] p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {invoice.file_name}
            </DialogTitle>
            <DialogDescription>
              PDF preview (wordt geladen in een popup, zonder je naar een Supabase URL te sturen).
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-4 pb-4 h-[calc(85vh-80px)]">
            {!pdfUrl ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                PDF URL niet beschikbaar
              </div>
            ) : pdfLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Laden...
              </div>
            ) : pdfError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <p className="text-sm">{pdfError}</p>
                <Button variant="outline" onClick={() => void loadPdfIntoObjectUrl()}>
                  Opnieuw proberen
                </Button>
              </div>
            ) : pdfObjectUrl ? (
              <iframe
                src={pdfObjectUrl}
                className="w-full h-full rounded-lg border"
                title={invoice.file_name}
                style={{ minHeight: "500px" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                PDF is nog niet geladen
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const WEBHOOK_URL = "https://lbhcuracao.app.n8n.cloud/webhook/invoice-upload-curacao";

export default function FDACuracao() {
  const { t } = useLanguage();
  const navigate = useTransitionNavigate();
  const [projects, setProjects] = useState<FDAProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<FDAProject | null>(null);
  const [projectInvoices, setProjectInvoices] = useState<FDACuracaoInvoice[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Agency Cost rows
  const [agencyCostRows, setAgencyCostRows] = useState<AgencyCostRow[]>([
    { id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }
  ]);

  const [formData, setFormData] = useState<FDAFormData>({
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
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setFormData({
        lbh_number: selectedProject.lbh_number,
        ship_name: selectedProject.ship_name,
        fda_responsible: selectedProject.fda_responsible || "",
        client_name: selectedProject.client_name || "",
        client_email: selectedProject.client_email || "",
        client_phone: selectedProject.client_phone || "",
        billing_company: selectedProject.billing_company || "",
        billing_address: selectedProject.billing_address || "",
        billing_email: selectedProject.billing_phone || "",
        billing_phone: selectedProject.billing_phone || "",
        vessel_arrived: (selectedProject as any).vessel_arrived || "",
        vessel_sailed: (selectedProject as any).vessel_sailed || "",
        operation: (selectedProject as any).operation || "",
        commodity: (selectedProject as any).commodity || "",
        client_reference: (selectedProject as any).client_reference || "",
        advanced_payment_amount: (selectedProject as any).advanced_payment_amount?.toString() || "",
        advanced_payment_currency: (selectedProject as any).advanced_payment_currency || "USD",
        advanced_payment_reference: (selectedProject as any).advanced_payment_reference || "",
        advanced_payment_status: (selectedProject as any).advanced_payment_status || "unpaid",
        advanced_payment_remark: (selectedProject as any).advanced_payment_remark || "",
      });
      // Reset agency cost rows when project changes
      setAgencyCostRows([{ id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }]);
      fetchProjectInvoices(selectedProject.project_id);
    }
  }, [selectedProject]);

  async function fetchProjects() {
    setLoading(true);
    const { data, error } = await supabase.from("fda_curacao_projects").select("*").order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects:", error);
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  }

  async function fetchProjectInvoices(projectId: string) {
    console.log("Fetching invoices for project_id:", projectId);
    const { data, error } = await supabase
      .from("fda_curacao_processed_invoices")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    console.log("Fetched invoices:", data, "Error:", error);
    if (error) {
      console.error("Error fetching invoices:", error);
    }
    setProjectInvoices(data || []);
  }

  const handleInputChange = (field: keyof FDAFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  async function syncClientToContacts(data: FDAFormData) {
    const clientName = data.client_name?.trim();
    if (!clientName) return;

    try {
      const { data: existingContact, error: existingError } = await supabase
        .from("contacts")
        .select("id")
        .eq("name", clientName)
        .eq("role", "FDA Client")
        .maybeSingle();

      if (existingError) {
        console.error("Error checking existing contact:", existingError);
        return;
      }

      const contactData = {
        name: clientName,
        email: data.client_email || null,
        phone: data.client_phone || null,
        company: data.billing_company || null,
        function: data.billing_address || null, // Store address in function field
      };

      if (existingContact?.id) {
        const { error: updateError } = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", existingContact.id);

        if (updateError) {
          console.error("Error updating client in contacts:", updateError);
        }
      } else {
        const { error: insertError } = await supabase.from("contacts").insert({
          ...contactData,
          role: "FDA Client",
        });

        if (insertError) {
          console.error("Error saving client to contacts:", insertError);
        }
      }
    } catch (e) {
      console.error("Unexpected error syncing client to contacts:", e);
    }
  }

  // Agency Cost Row handlers
  const handleAgencyCostChange = (id: string, field: keyof AgencyCostRow, value: string) => {
    setAgencyCostRows(rows => rows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const addAgencyCostRow = () => {
    setAgencyCostRows(rows => [...rows, { 
      id: crypto.randomUUID(), 
      description: "", 
      number: "", 
      remark: "", 
      amount: "" 
    }]);
  };

  const removeAgencyCostRow = (id: string) => {
    if (agencyCostRows.length > 1) {
      setAgencyCostRows(rows => rows.filter(row => row.id !== id));
    }
  };

  async function handleCreateProject() {
    if (!formData.lbh_number || !formData.ship_name) {
      toast({ title: "Error", description: "LBH Number and Ship Name are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("fda_curacao_projects")
      .insert({
        project_id: crypto.randomUUID(),
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
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await syncClientToContacts(formData);

      toast({ title: "Success", description: "FDA Curacao project created" });
      setShowCreateDialog(false);
      resetForm();
      await fetchProjects();
      if (data) {
        setSelectedProject(data);
      }
    }
    setSaving(false);
  }

  async function handleUpdateProject() {
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
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await syncClientToContacts(formData);
      toast({ title: "Success", description: "Project saved" });
      await fetchProjects();
    }
    setSaving(false);
  }

  async function handleDeleteProject(id: string) {
    const { error } = await supabase.from("fda_curacao_projects").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Project deleted" });
      setSelectedProject(null);
      await fetchProjects();
    }
  }

  // File upload handler - stores in fda_curacao_processed_invoices
  async function uploadFiles(files: FileList | File[]) {
    if (!selectedProject) return;

    setUploadingFiles(true);
    let currentCount = projectInvoices.length;

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast({ title: "Error", description: "Only PDF files are allowed", variant: "destructive" });
        continue;
      }

      const filePath = `curacao/${selectedProject.project_id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from("fda-invoices").upload(filePath, file);

      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }

      // Get signed URL
      const { data: signedData } = await supabase.storage.from("fda-invoices").createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      currentCount += 1;
      const invoiceNumber = String(currentCount).padStart(3, "0");

      // Insert into fda_curacao_processed_invoices
      const { error: insertError } = await supabase.from("fda_curacao_processed_invoices").insert({
        project_id: selectedProject.project_id,
        lbh_number: selectedProject.lbh_number,
        ship_name: selectedProject.ship_name,
        file_name: file.name,
        file_url: signedData?.signedUrl || null,
        invoice_number: invoiceNumber,
      });

      if (insertError) {
        toast({ title: "Error", description: insertError.message, variant: "destructive" });
      }
    }

    await fetchProjectInvoices(selectedProject.project_id);
    setUploadingFiles(false);
    toast({ title: "Success", description: "Files uploaded" });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    await uploadFiles(files);
    e.target.value = "";
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFiles(files);
    }
  }, [selectedProject, projectInvoices]);

  async function handleDeleteInvoice(invoice: FDACuracaoInvoice) {
    await supabase.from("fda_curacao_processed_invoices").delete().eq("id", invoice.id);
    if (selectedProject) {
      await fetchProjectInvoices(selectedProject.project_id);
    }
    toast({ title: "Success", description: "Invoice deleted" });
  }

  async function handleUpdateInvoiceNumber(invoiceId: string, invoiceNumber: string) {
    const { error } = await supabase.from("fda_curacao_processed_invoices").update({ invoice_number: invoiceNumber }).eq("id", invoiceId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Invoice number updated" });
      if (selectedProject) {
        await fetchProjectInvoices(selectedProject.project_id);
      }
    }
  }

  async function handleSendToWebhook() {
    if (!selectedProject) {
      toast({ title: "Error", description: "No project selected", variant: "destructive" });
      return;
    }

    setSending(true);

    try {
      // Collect invoice file URLs
      const invoiceFiles = projectInvoices.map(inv => ({
        file_name: inv.file_name,
        file_url: inv.file_url,
        invoice_number: inv.invoice_number,
      }));

      // Collect agency cost data (filter out empty rows)
      const agencyCosts = agencyCostRows
        .filter(row => row.description || row.number || row.remark || row.amount)
        .map(row => ({
          description: row.description,
          number: row.number,
          remark: row.remark,
          amount: row.amount ? parseFloat(row.amount) : null,
        }));

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
        // Agency Costs
        agency_costs: agencyCosts,
        // Invoice files
        invoice_files: invoiceFiles,
        invoice_count: projectInvoices.length,
        sent_at: new Date().toISOString(),
      };

      // Update project status
      await supabase
        .from("fda_curacao_projects")
        .update({ status: "processing" })
        .eq("project_id", selectedProject.project_id);

      // Send to webhook
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      toast({ title: "Success", description: "FDA sent successfully, redirecting..." });
      
      // Navigate to the email page to show AI generating status
      navigate(`/fda-curacao/email/${selectedProject.project_id}`);

    } catch (error) {
      console.error("Send error:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to send FDA", 
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setFormData({
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
    });
    setAgencyCostRows([{ id: crypto.randomUUID(), description: "", number: "", remark: "", amount: "" }]);
  }

  const getStatusBadge = (status: string | null) => {
    if (status === "sent" || status === "email_sent") {
      return (
        <Badge className="bg-success/10 text-success border-success/20" variant="outline">
          <CheckCircle className="w-3 h-3 mr-1" /> Sent
        </Badge>
      );
    }
    if (status === "processing" || status === "ready_to_send") {
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20" variant="outline">
          <Clock className="w-3 h-3 mr-1" /> Processing
        </Badge>
      );
    }
    return (
      <Badge className="bg-muted text-muted-foreground" variant="outline">
        <Clock className="w-3 h-3 mr-1" /> Draft
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout title="FDA Curacao">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Detail View
  if (selectedProject) {
    return (
      <DashboardLayout title="FDA Curacao">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedProject(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{formData.ship_name}</h1>
                <p className="text-muted-foreground">{formData.lbh_number}</p>
              </div>
              {getStatusBadge(selectedProject.status)}
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete FDA Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the FDA project for "{selectedProject.ship_name}" ({selectedProject.lbh_number})? 
                      This will permanently delete all associated invoices and data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={handleUpdateProject} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4" />}
                <span className="ml-2">Save</span>
              </Button>
              {selectedProject.status === 'sent' && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate(`/fda-curacao/email/${selectedProject.project_id}`)}
                >
                  <Mail className="w-4 h-4" />
                  <span className="ml-2">Bekijk Email</span>
                </Button>
              )}
              <Button onClick={handleSendToWebhook} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-2">{selectedProject.status === 'sent' ? 'Send FDA Again' : 'Send FDA'}</span>
              </Button>
            </div>
          </div>

          {/* Form Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ship Information */}
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Ship className="w-4 h-4 text-primary" />
                  Ship Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">LBH Number *</Label>
                    <Input
                      value={formData.lbh_number}
                      onChange={(e) => handleInputChange("lbh_number", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Ship Name *</Label>
                    <Input
                      value={formData.ship_name}
                      onChange={(e) => handleInputChange("ship_name", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">FDA Responsible</Label>
                  <Input
                    value={formData.fda_responsible}
                    onChange={(e) => handleInputChange("fda_responsible", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Client Information */}
            <Card className="card-premium">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Client Information
                  </div>
                  <ClientSelector
                    onSelectClient={(client) => {
                      setFormData((prev) => ({
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
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Client Name</Label>
                  <Input
                    value={formData.client_name}
                    onChange={(e) => handleInputChange("client_name", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={formData.client_email}
                      onChange={(e) => handleInputChange("client_email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input
                      value={formData.client_phone}
                      onChange={(e) => handleInputChange("client_phone", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billing Information - Spans full width */}
            <Card className="card-premium lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-primary" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Company</Label>
                    <Input
                      value={formData.billing_company}
                      onChange={(e) => handleInputChange("billing_company", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={formData.billing_email}
                      onChange={(e) => handleInputChange("billing_email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Input
                      value={formData.billing_address}
                      onChange={(e) => handleInputChange("billing_address", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input
                      value={formData.billing_phone}
                      onChange={(e) => handleInputChange("billing_phone", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Port Call Information - Full Width */}
            <Card className="card-premium lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-primary" />
                  Port Call Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Vessel Arrived */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Vessel Arrived</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal h-10"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {formData.vessel_arrived && isValid(parseISO(formData.vessel_arrived))
                            ? format(parseISO(formData.vessel_arrived), "dd MMM yyyy")
                            : <span className="text-muted-foreground">Select date</span>
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.vessel_arrived ? parseISO(formData.vessel_arrived) : undefined}
                          onSelect={(date) => handleInputChange("vessel_arrived", date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Vessel Sailed */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Vessel Sailed</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal h-10"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {formData.vessel_sailed && isValid(parseISO(formData.vessel_sailed))
                            ? format(parseISO(formData.vessel_sailed), "dd MMM yyyy")
                            : <span className="text-muted-foreground">Select date</span>
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.vessel_sailed ? parseISO(formData.vessel_sailed) : undefined}
                          onSelect={(date) => handleInputChange("vessel_sailed", date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Operation */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Operation</Label>
                    <Input
                      value={formData.operation}
                      onChange={(e) => handleInputChange("operation", e.target.value)}
                      placeholder="Loading / Discharge"
                    />
                  </div>

                  {/* Commodity */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Commodity</Label>
                    <Input
                      value={formData.commodity}
                      onChange={(e) => handleInputChange("commodity", e.target.value)}
                      placeholder="Cargo type"
                    />
                  </div>

                  {/* Client Reference */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Client Reference</Label>
                    <Input
                      value={formData.client_reference}
                      onChange={(e) => handleInputChange("client_reference", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Payment - Full Width */}
            <Card className="card-premium lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Advanced Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={formData.advanced_payment_amount}
                        onChange={(e) => handleInputChange("advanced_payment_amount", e.target.value)}
                        placeholder="0.00"
                        className="pl-9"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Currency</Label>
                    <Select
                      value={formData.advanced_payment_currency}
                      onValueChange={(value) => handleInputChange("advanced_payment_currency", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="ANG">ANG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reference */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Reference</Label>
                    <Input
                      value={formData.advanced_payment_reference}
                      onChange={(e) => handleInputChange("advanced_payment_reference", e.target.value)}
                      placeholder="Payment ref"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                      value={formData.advanced_payment_status}
                      onValueChange={(value) => handleInputChange("advanced_payment_status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remark */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Remark</Label>
                    <Input
                      value={formData.advanced_payment_remark}
                      onChange={(e) => handleInputChange("advanced_payment_remark", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agency Cost - Full Width with Multiple Rows */}
            <Card className="card-premium lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    Agency Cost
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAgencyCostRow}
                    className="h-8"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Row
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-3 text-xs text-muted-foreground font-medium px-1">
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2">Number</div>
                  <div className="col-span-3">Remark</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-1"></div>
                </div>
                
                {agencyCostRows.map((row, index) => (
                  <div key={row.id} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4">
                      <Input
                        value={row.description}
                        onChange={(e) => handleAgencyCostChange(row.id, "description", e.target.value)}
                        placeholder="Description"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={row.number}
                        onChange={(e) => handleAgencyCostChange(row.id, "number", e.target.value)}
                        placeholder="Number"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={row.remark}
                        onChange={(e) => handleAgencyCostChange(row.id, "remark", e.target.value)}
                        placeholder="Remark"
                        className="h-9"
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
                          className="h-9 pl-6"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {agencyCostRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeAgencyCostRow(row.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Invoice PDF Upload Card with Drag & Drop */}
          <Card className="card-premium lg:col-span-2">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Invoice PDFs ({projectInvoices.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="invoice-upload"
                  multiple
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("invoice-upload")?.click()}
                  disabled={uploadingFiles}
                >
                  {uploadingFiles ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-6 transition-all text-center
                  ${isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/30 hover:border-muted-foreground/50"
                  }
                  ${projectInvoices.length === 0 ? "py-12" : "py-4"}
                `}
              >
                {uploadingFiles ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : isDragging ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="w-8 h-8 text-primary" />
                    <p className="text-sm font-medium">Drop PDF files here</p>
                  </div>
                ) : projectInvoices.length === 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="w-8 h-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Drag & drop PDF files here or use the Upload button</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Drag & drop more PDFs here</p>
                )}
              </div>

              {/* Uploaded invoices list */}
              {projectInvoices.length > 0 && (
                <div className="space-y-2">
                  {/* Filter out duplicates by file_name - only show unique files */}
                  {projectInvoices
                    .filter((invoice, index, self) => 
                      index === self.findIndex(i => i.file_name === invoice.file_name)
                    )
                    .map((invoice, index) => (
                      <CuracaoInvoiceRow
                        key={invoice.id}
                        invoice={invoice}
                        index={index}
                        isSent={selectedProject.status === "sent"}
                        onDelete={handleDeleteInvoice}
                        onUpdateInvoiceNumber={handleUpdateInvoiceNumber}
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          {selectedProject.status !== "sent" && (
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Weet u het zeker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      U staat op het punt om het FDA project voor "{selectedProject.ship_name}" ({selectedProject.lbh_number}) te verwijderen. 
                      Alle bijbehorende facturen en data worden permanent verwijderd. Deze actie kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Overview View
  return (
    <DashboardLayout title="FDA Curacao">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">FDA Curacao</h1>
            <p className="text-muted-foreground">Manage your FDA Curacao projects</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="gap-2" onClick={() => navigate("/fda-curacao/history")}>
              <History className="w-4 h-4" />
              Email History
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create FDA
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New FDA Curacao Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                {/* Vessel Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Ship className="w-4 h-4 text-primary" /> Vessel Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>LBH Number *</Label>
                      <Input
                        value={formData.lbh_number}
                        onChange={(e) => handleInputChange("lbh_number", e.target.value)}
                        placeholder="LBH-2024-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ship Name *</Label>
                      <Input
                        value={formData.ship_name}
                        onChange={(e) => handleInputChange("ship_name", e.target.value)}
                        placeholder="MV Ocean King"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>FDA Responsible</Label>
                    <Input
                      value={formData.fda_responsible}
                      onChange={(e) => handleInputChange("fda_responsible", e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <Separator />

                {/* Client Info */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" /> Client Details
                    </h3>
                    <ClientSelector
                      onSelectClient={(client) => {
                        setFormData((prev) => ({
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
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => handleInputChange("client_name", e.target.value)}
                      placeholder="Client Name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </Label>
                      <Input
                        type="email"
                        value={formData.client_email}
                        onChange={(e) => handleInputChange("client_email", e.target.value)}
                        placeholder="client@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone
                      </Label>
                      <Input
                        value={formData.client_phone}
                        onChange={(e) => handleInputChange("client_phone", e.target.value)}
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Billing Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" /> Billing Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input
                        value={formData.billing_company}
                        onChange={(e) => handleInputChange("billing_company", e.target.value)}
                        placeholder="Billing Company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </Label>
                      <Input
                        type="email"
                        value={formData.billing_email}
                        onChange={(e) => handleInputChange("billing_email", e.target.value)}
                        placeholder="billing@company.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Address</Label>
                    <Input
                      value={formData.billing_address}
                      onChange={(e) => handleInputChange("billing_address", e.target.value)}
                      placeholder="123 Business Street, City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <Input
                      value={formData.billing_phone}
                      onChange={(e) => handleInputChange("billing_phone", e.target.value)}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>

                <Button onClick={handleCreateProject} disabled={saving} className="w-full" size="lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Project
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="card-premium">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No FDA Curacao Projects</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Create your first FDA Curacao project to get started with document management.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Create FDA
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="card-premium cursor-pointer transition-all hover:shadow-lg hover:border-primary/30"
                onClick={() => setSelectedProject(project)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Ship className="w-6 h-6 text-primary" />
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{project.ship_name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{project.lbh_number}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                    {project.fda_responsible && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {project.fda_responsible}
                      </span>
                    )}
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
