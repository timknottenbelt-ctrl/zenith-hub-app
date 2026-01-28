import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Mail,
  Plus,
  X,
  FileText,
  Download,
  Eye,
  Loader2,
  Send,
  Trash2,
  Paperclip,
  Sparkles,
  ExternalLink,
  CheckCircle,
  Receipt,
} from "lucide-react";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import * as XLSX from "xlsx";

interface FDACuracaoProject {
  project_id: string;
  lbh_number: string;
  ship_name: string;
  client_email: string | null;
  client_name: string | null;
  billing_email: string | null;
  email_subject: string | null;
  email_body: string | null;
  final_pdf_url: string | null;
  fda_responsible: string | null;
  total_invoices: number | null;
  total_amount: number | null;
  google_sheet_url: string | null;
  status: string | null;
}

interface FDAEmailDraft {
  id: string;
  project_id: string;
  email_to: string;
  email_cc: string | null;
  email_subject: string;
  email_body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  status: string | null;
  google_sheet_url: string | null;
  drive_folder_url: string | null;
}

interface ProcessedInvoice {
  id: string;
  invoice_number: string;
  file_name: string;
  description: string | null;
  total_amount: number | null;
  currency: string | null;
  file_url: string | null;
  supplier_name: string | null;
}

interface ExtraAttachment {
  id: string;
  name: string;
  url: string;
}

const SEND_WEBHOOK_URL = "https://lbhcuracao.app.n8n.cloud/webhook/send-to-uruguay";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPABASE_URL = "https://oxkshjaombffbdemqrqb.supabase.co";

function getPublicPdfUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/object/sign/")) {
    return encodeURI(`${SUPABASE_URL}/storage/v1${url}`);
  }
  if (url.includes("fda-final-packages/") || url.includes("fda-curacao/") || url.includes("fda-invoices/")) {
    return encodeURI(`${SUPABASE_URL}/storage/v1/object/public/${url}`);
  }
  return url;
}

export default function FDACuracaoEmail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useTransitionNavigate();

  const [project, setProject] = useState<FDACuracaoProject | null>(null);
  const [emailDraft, setEmailDraft] = useState<FDAEmailDraft | null>(null);
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Email form state
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newToEmail, setNewToEmail] = useState("");
  const [newCcEmail, setNewCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [extraAttachments, setExtraAttachments] = useState<ExtraAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadingInvoicePdf, setUploadingInvoicePdf] = useState(false);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<ProcessedInvoice | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Polling refs
  const emailDraftRef = useRef<FDAEmailDraft | null>(null);
  const projectRef = useRef<FDACuracaoProject | null>(null);

  useEffect(() => {
    emailDraftRef.current = emailDraft;
  }, [emailDraft]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const fetchProjectAndDraft = useCallback(async () => {
    if (!projectId) return;

    const { data: projectData, error: projectError } = await supabase
      .from("fda_curacao_projects")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      toast({ title: "Error", description: "Project not found", variant: "destructive" });
      navigate("/fda-curacao");
      return;
    }

    setProject(projectData);

    // Fetch invoices
    const { data: invoiceData } = await supabase
      .from("fda_curacao_processed_invoices")
      .select("id, invoice_number, file_name, description, total_amount, currency, file_url, supplier_name")
      .eq("project_id", projectId)
      .order("invoice_number", { ascending: true });

    if (invoiceData) {
      setInvoices(invoiceData);
    }

    // Fetch email draft
    const { data: draftData, error: draftError } = await supabase
      .from("fda_email_drafts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftData && !draftError && draftData.status === "draft") {
      setEmailDraft(draftData);

      const toList = draftData.email_to
        .split(",")
        .map((e: string) => e.trim())
        .filter((e: string) => e);
      setToEmails(toList);

      if (draftData.email_cc) {
        const ccList = draftData.email_cc
          .split(",")
          .map((e: string) => e.trim())
          .filter((e: string) => e);
        setCcEmails(ccList);
      }

      setSubject(draftData.email_subject);
      setBody(draftData.email_body);
    } else if (projectData.status === "sent") {
      // For already sent projects, use the stored email data from project
      if (projectData.client_email) {
        const toList = projectData.client_email
          .split(",")
          .map((e: string) => e.trim())
          .filter((e: string) => e);
        setToEmails(toList);
      }
      if (projectData.email_subject) {
        setSubject(projectData.email_subject);
      }
      if (projectData.email_body) {
        setBody(projectData.email_body);
      }
    }
  }, [projectId, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        await fetchProjectAndDraft();
      } catch (error) {
        console.error("FDACuracaoEmail load error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    let tries = 0;
    const maxTries = 60;

    const interval = setInterval(async () => {
      if (!projectId) return;
      tries += 1;

      // Poll for draft with status "draft"
      if (!emailDraftRef.current || emailDraftRef.current.status !== "draft") {
        const { data: draftData } = await supabase
          .from("fda_email_drafts")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (draftData && draftData.status === "draft") {
          setEmailDraft(draftData);

          const toList = (draftData.email_to || "")
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean);
          setToEmails(toList);

          const ccList = (draftData.email_cc || "")
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean);
          setCcEmails(ccList);

          setSubject(draftData.email_subject || "");
          setBody(draftData.email_body || "");
        }
      }

      // Poll for google_sheet_url
      const currentProject = projectRef.current;
      if (!currentProject?.google_sheet_url) {
        const { data } = await supabase
          .from("fda_curacao_projects")
          .select("google_sheet_url, final_pdf_url, status")
          .eq("project_id", projectId)
          .single();

        if (data) {
          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  google_sheet_url: data.google_sheet_url,
                  final_pdf_url: data.final_pdf_url,
                  status: data.status,
                }
              : null
          );
        }
      }

      // Poll for invoices if we don't have any yet
      if (invoices.length === 0) {
        const { data: invoiceData } = await supabase
          .from("fda_curacao_processed_invoices")
          .select("id, invoice_number, file_name, description, total_amount, currency, file_url, supplier_name")
          .eq("project_id", projectId)
          .order("invoice_number", { ascending: true });

        if (invoiceData && invoiceData.length > 0) {
          setInvoices(invoiceData);
        }
      }

      const nowHasDraft = emailDraftRef.current?.status === "draft";
      if (nowHasDraft || tries > maxTries) {
        clearInterval(interval);
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchProjectAndDraft, projectId, invoices.length]);

  // PDF Preview helpers
  const loadPdfForPreview = useCallback(async (invoice: ProcessedInvoice) => {
    const url = getPublicPdfUrl(invoice.file_url);
    if (!url) return;

    setPreviewInvoice(invoice);
    setPreviewOpen(true);
    setPdfLoading(true);

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`PDF fetch failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPdfObjectUrl(objectUrl);
    } catch (e) {
      console.error("PDF load error:", e);
      toast({ title: "Error", description: "Failed to load PDF", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewInvoice(null);
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
      setPdfObjectUrl(null);
    }
  }, [pdfObjectUrl]);

  const handleDownloadInvoice = useCallback(async (invoice: ProcessedInvoice) => {
    const url = getPublicPdfUrl(invoice.file_url);
    if (!url) return;

    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = invoice.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error("Download error:", e);
      toast({ title: "Error", description: "Failed to download", variant: "destructive" });
    }
  }, []);

  // Update invoice number
  async function handleUpdateInvoiceNumber(invoiceId: string, newNumber: string) {
    const { error } = await supabase
      .from("fda_curacao_processed_invoices")
      .update({ invoice_number: newNumber })
      .eq("id", invoiceId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, invoice_number: newNumber } : inv))
      );
      toast({ title: "Saved", description: "Invoice number updated" });
    }
  }

  function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email.trim());
  }

  function addToEmail() {
    const email = newToEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (toEmails.includes(email)) {
      toast({ title: "Duplicate", description: "This email is already added", variant: "destructive" });
      return;
    }
    setToEmails([...toEmails, email]);
    setNewToEmail("");
  }

  function removeToEmail(index: number) {
    setToEmails(toEmails.filter((_, i) => i !== index));
  }

  function addCcEmail() {
    const email = newCcEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (ccEmails.includes(email)) {
      toast({ title: "Duplicate", description: "This email is already added", variant: "destructive" });
      return;
    }
    setCcEmails([...ccEmails, email]);
    setNewCcEmail("");
  }

  function removeCcEmail(index: number) {
    setCcEmails(ccEmails.filter((_, i) => i !== index));
  }

  function handleToKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addToEmail();
    }
  }

  function handleCcKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCcEmail();
    }
  }

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Error", description: "File must be less than 10MB", variant: "destructive" });
      return;
    }

    setUploadingAttachment(true);

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${projectId}/extra/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("fda-attachments").upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("fda-attachments")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (!urlData?.signedUrl) throw new Error("Failed to get URL");

      setExtraAttachments([...extraAttachments, { id: fileName, name: file.name, url: urlData.signedUrl }]);

      toast({ title: "Success", description: "Attachment uploaded" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: "Failed to upload attachment", variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  }

  // Upload extra invoice PDF
  async function handleUploadInvoicePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: "Error", description: "Only PDF files allowed", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Error", description: "File must be less than 10MB", variant: "destructive" });
      return;
    }

    setUploadingInvoicePdf(true);

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${projectId}/invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("fda-invoices").upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("fda-invoices")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (!urlData?.signedUrl) throw new Error("Failed to get URL");

      // Add to local state as a new invoice row (user uploaded, no AI processing)
      const newInvoice: ProcessedInvoice = {
        id: `local-${Date.now()}`,
        invoice_number: String(invoices.length + 1).padStart(3, "0"),
        file_name: file.name,
        description: "User uploaded",
        total_amount: null,
        currency: null,
        file_url: urlData.signedUrl,
        supplier_name: null,
      };

      setInvoices(prev => [...prev, newInvoice]);
      toast({ title: "Success", description: "PDF uploaded" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: "Failed to upload PDF", variant: "destructive" });
    } finally {
      setUploadingInvoicePdf(false);
      e.target.value = "";
    }
  }

  function removeAttachment(id: string) {
    setExtraAttachments(extraAttachments.filter((a) => a.id !== id));
  }

  function handleExportExcel() {
    if (invoices.length === 0) {
      toast({ title: "Geen data", description: "Er zijn geen facturen om te exporteren", variant: "destructive" });
      return;
    }

    const exportData = invoices
      .filter((inv) => inv.description || inv.total_amount || inv.supplier_name)
      .map((inv) => ({
        "Invoice Number": inv.invoice_number,
        "File Name": inv.file_name,
        "Supplier": inv.supplier_name || "",
        "Description": inv.description || "",
        "Amount": inv.total_amount || "",
        "Currency": inv.currency || "",
      }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");

    const fileName = `${project?.lbh_number || "FDA"}_${project?.ship_name || "Export"}_Invoices.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({ title: "Success", description: "Excel bestand gedownload" });
  }

  async function handleSendEmail() {
    if (toEmails.length === 0) {
      toast({ title: "Error", description: "Please add at least one recipient", variant: "destructive" });
      return;
    }

    if (!subject.trim()) {
      toast({ title: "Error", description: "Please enter a subject", variant: "destructive" });
      return;
    }

    if (!body.trim()) {
      toast({ title: "Error", description: "Please enter email body", variant: "destructive" });
      return;
    }

    setSending(true);

    try {
      const payload = {
        project_id: projectId,
        lbh_number: project?.lbh_number,
        ship_name: project?.ship_name,
        email_to: toEmails.join(","),
        email_cc: ccEmails.join(","),
        email_subject: subject,
        email_body: body,
        google_sheet_url: project?.google_sheet_url || emailDraft?.google_sheet_url || "",
        attachment_url: emailDraft?.attachment_url || project?.final_pdf_url || "",
        extra_attachments: extraAttachments.map((a) => a.url),
        invoices: invoices.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          file_name: inv.file_name,
          file_url: inv.file_url,
          description: inv.description,
          total_amount: inv.total_amount,
          currency: inv.currency,
          supplier_name: inv.supplier_name,
        })),
      };

      const response = await fetch(SEND_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Send failed: ${response.status}`);
      }

      // Update project status
      await supabase
        .from("fda_curacao_projects")
        .update({ status: "sent", email_sent_at: new Date().toISOString() })
        .eq("project_id", projectId);

      toast({ title: "Success!", description: "Email sent successfully!" });
      navigate("/fda-curacao");
    } catch (error) {
      console.error("Send error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="FDA Curacao Email">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Check what's still loading - also consider already sent projects as "ready"
  const hasDraft = emailDraft?.status === "draft" || project?.status === "sent";
  const hasGoogleSheet = !!project?.google_sheet_url;

  return (
    <DashboardLayout title="FDA Curacao Email">
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/fda-curacao")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project?.ship_name}</h1>
              <p className="text-muted-foreground">{project?.lbh_number}</p>
            </div>
            {hasDraft ? (
              <Badge className="bg-success/10 text-success border-success/20" variant="outline">
                <CheckCircle className="w-3 h-3 mr-1" />
                Ready to Send
              </Badge>
            ) : (
              <Badge className="bg-warning/10 text-warning border-warning/20" variant="outline">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Processing
              </Badge>
            )}
          </div>
          <Button onClick={handleSendEmail} disabled={sending || !hasDraft} size="lg">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Email
          </Button>
        </div>

        {/* Google Sheet Link */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Google Sheet
            </CardTitle>
          </CardHeader>
          <CardContent>
          {hasGoogleSheet ? (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="text-sm">Invoice data has been processed successfully</span>
                </div>
                <Button size="sm" onClick={() => window.open(project!.google_sheet_url!, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Excel Sheet
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                AI is generating...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processed Invoices - Only show invoices that have been processed by AI (have description/amount) */}
        <Card className="card-premium">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              Verwerkte Facturen
              <Badge variant="secondary" className="ml-2">
                {invoices.filter(inv => inv.description || inv.total_amount || inv.supplier_name).length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.filter(inv => inv.description || inv.total_amount || inv.supplier_name).length === 0 ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                AI is processing invoices...
              </div>
            ) : (
              <div className="space-y-2">
                {invoices
                  .filter(inv => inv.description || inv.total_amount || inv.supplier_name)
                  .map((invoice, index) => (
                    <InvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      index={index}
                      onView={() => loadPdfForPreview(invoice)}
                      onDownload={() => handleDownloadInvoice(invoice)}
                      onUpdateNumber={handleUpdateInvoiceNumber}
                    />
                  ))}

                {/* Upload extra PDF */}
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors mt-4">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload extra PDF</span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleUploadInvoicePdf}
                    disabled={uploadingInvoicePdf}
                  />
                  {uploadingInvoicePdf && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Section */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Compose
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasDraft ? (
              <div className="space-y-4">
                {/* TO Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">To</label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
                    {toEmails.map((email, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {email}
                        <button onClick={() => removeToEmail(i)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={newToEmail}
                      onChange={(e) => setNewToEmail(e.target.value)}
                      onKeyDown={handleToKeyDown}
                      onBlur={addToEmail}
                      placeholder="Add email..."
                      className="flex-1 min-w-[150px] border-0 shadow-none focus-visible:ring-0 h-7 p-0"
                    />
                  </div>
                </div>

                {/* CC Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">CC</label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
                    {ccEmails.map((email, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {email}
                        <button onClick={() => removeCcEmail(i)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={newCcEmail}
                      onChange={(e) => setNewCcEmail(e.target.value)}
                      onKeyDown={handleCcKeyDown}
                      onBlur={addCcEmail}
                      placeholder="Add CC..."
                      className="flex-1 min-w-[150px] border-0 shadow-none focus-visible:ring-0 h-7 p-0"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
                </div>

                {/* Body */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Email body..."
                    className="min-h-[200px]"
                  />
                </div>

                {/* Extra Attachments */}
                {extraAttachments.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Extra Attachments</label>
                    {extraAttachments.map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Paperclip className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{att.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          onClick={() => removeAttachment(att.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Attachment Button */}
                <label className="inline-flex">
                  <Button variant="outline" size="sm" disabled={uploadingAttachment} asChild>
                    <span className="cursor-pointer">
                      {uploadingAttachment ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Add Extra Attachment
                    </span>
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleUploadAttachment}
                    disabled={uploadingAttachment}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                AI is generating email...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={closePreview}>
        <DialogContent className="max-w-4xl h-[85vh] p-0" aria-describedby={undefined}>
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {previewInvoice?.file_name || "PDF Preview"}
            </DialogTitle>
            <DialogDescription>
              Invoice preview
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-4 pb-4 h-[calc(85vh-80px)]">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : pdfObjectUrl ? (
              <iframe
                src={pdfObjectUrl}
                className="w-full h-full rounded-lg border"
                title={previewInvoice?.file_name || "PDF"}
                style={{ minHeight: "500px" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                PDF not available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// Invoice Row Component
interface InvoiceRowProps {
  invoice: ProcessedInvoice;
  index: number;
  onView: () => void;
  onDownload: () => void;
  onUpdateNumber: (id: string, number: string) => void;
}

function InvoiceRow({ invoice, index, onView, onDownload, onUpdateNumber }: InvoiceRowProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number || String(index + 1).padStart(3, "0"));

  const handleSaveNumber = () => {
    if (invoiceNumber !== invoice.invoice_number) {
      onUpdateNumber(invoice.id, invoiceNumber);
    }
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
      {/* File Name & Description */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <CheckCircle className="w-4 h-4 text-success shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-medium truncate block">{invoice.file_name}</span>
          {invoice.description && (
            <span className="text-xs text-muted-foreground truncate block">{invoice.description}</span>
          )}
          {invoice.supplier_name && (
            <span className="text-xs text-primary truncate block">{invoice.supplier_name}</span>
          )}
        </div>
      </div>

      {/* Amount */}
      {invoice.total_amount && (
        <div className="text-sm font-medium shrink-0">
          {invoice.currency || "USD"} {invoice.total_amount.toLocaleString()}
        </div>
      )}

      {/* Invoice Number */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">Nr:</span>
        <Input
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          onBlur={handleSaveNumber}
          className="w-20 h-8 text-sm"
          placeholder="001"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onView} title="View PDF">
          <Eye className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownload} title="Download PDF">
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
