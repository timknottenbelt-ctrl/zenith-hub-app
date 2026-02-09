import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ExternalLink,
  Upload,
  FileText,
  Trash2,
  Download,
  Loader2,
  FileCheck,
  Merge,
  Eye,
  Pencil,
  Check,
  X,
  CheckCircle,
  GripVertical,
  Receipt,
  Sparkles,
  Mail,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProcessedInvoice {
  id: string;
  invoice_number: string;
  file_name: string;
  description: string | null;
  total_amount: number | null;
  currency: string | null;
  file_url: string | null;
}

interface FDAFrontPageStepProps {
  projectId: string;
  shipName: string;
  lbhNumber: string;
  googleSheetUrl: string | null;
  frontPageUrl: string | null;
  agencyCostUrl: string | null;
  finalPdfUrl: string | null;
  status: string | null;
  onProjectUpdate: () => void;
  onNavigateToEmail: () => void;
}

const MERGE_WEBHOOK_URL = "https://lbhcuracao.app.n8n.cloud/webhook/Merge-PDF";

export function FDAFrontPageStep({
  projectId,
  shipName,
  lbhNumber,
  googleSheetUrl,
  frontPageUrl,
  agencyCostUrl,
  finalPdfUrl,
  status,
  onProjectUpdate,
  onNavigateToEmail,
}: FDAFrontPageStepProps) {
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [uploadingFrontPage, setUploadingFrontPage] = useState(false);
  const [uploadingAgencyCost, setUploadingAgencyCost] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeDialog, setMergeDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: "front_page" | "agency_cost" | null; invoiceId?: string }>({ open: false, type: null });
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [fdaFilename, setFdaFilename] = useState(`FDA - ${shipName} - ${lbhNumber} - LBH Curacao`);
  const [checkingSheet, setCheckingSheet] = useState(!googleSheetUrl && status === "processing");

  const fetchInvoices = useCallback(async () => {
    const { data } = await supabase
      .from("fda_processed_invoices")
      .select("id, invoice_number, file_name, description, total_amount, currency, file_url")
      .eq("project_id", projectId)
      .order("invoice_number", { ascending: true });
    setInvoices(data || []);
  }, [projectId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Poll for google sheet + invoices when still processing
  useEffect(() => {
    if (!checkingSheet) return;
    const interval = setInterval(async () => {
      const [projectResult, invoicesResult] = await Promise.all([
        supabase.from("fda_projects").select("google_sheet_url, status").eq("project_id", projectId).limit(1),
        supabase.from("fda_processed_invoices").select("id, invoice_number, file_name, description, total_amount, currency, file_url").eq("project_id", projectId).order("invoice_number", { ascending: true }),
      ]);
      if (invoicesResult.data && invoicesResult.data.length > 0) setInvoices(invoicesResult.data);
      const p = projectResult.data?.[0];
      if (p && (p.status === "ready_to_send" || (invoicesResult.data?.length ?? 0) > 0)) {
        setCheckingSheet(false);
        clearInterval(interval);
        onProjectUpdate();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [checkingSheet, projectId, onProjectUpdate]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: "front_page" | "agency_cost") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast({ title: "Fout", description: "Alleen PDF bestanden", variant: "destructive" }); return; }
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Fout", description: "Max 10MB", variant: "destructive" }); return; }

    const bucket = type === "front_page" ? "fda-front-pages" : "fda-agency-costs";
    const fileName = type === "front_page" ? "front_page.pdf" : "agency_cost.pdf";
    const filePath = `${projectId}/${fileName}`;
    const setUploading = type === "front_page" ? setUploadingFrontPage : setUploadingAgencyCost;
    setUploading(true);

    try {
      await supabase.storage.from(bucket).remove([filePath]);
      const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60 * 60 * 24 * 365);
      if (!urlData?.signedUrl) throw new Error("URL niet beschikbaar");
      const updateField = type === "front_page" ? "front_page_url" : "agency_cost_url";
      await supabase.from("fda_projects").update({ [updateField]: urlData.signedUrl }).eq("project_id", projectId);
      onProjectUpdate();
      toast({ title: "Geüpload" });
    } catch (error) {
      toast({ title: "Fout", description: error instanceof Error ? error.message : "Upload mislukt", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteFile(type: "front_page" | "agency_cost") {
    const bucket = type === "front_page" ? "fda-front-pages" : "fda-agency-costs";
    const fileName = type === "front_page" ? "front_page.pdf" : "agency_cost.pdf";
    await supabase.storage.from(bucket).remove([`${projectId}/${fileName}`]);
    const updateField = type === "front_page" ? "front_page_url" : "agency_cost_url";
    await supabase.from("fda_projects").update({ [updateField]: null }).eq("project_id", projectId);
    onProjectUpdate();
    setDeleteDialog({ open: false, type: null });
  }

  async function handleDeleteInvoice(invoiceId: string) {
    await supabase.from("fda_processed_invoices").delete().eq("id", invoiceId);
    await fetchInvoices();
    setDeleteDialog({ open: false, type: null });
  }

  async function handleUpdateInvoiceNumber(invoiceId: string, newNumber: string) {
    await supabase.from("fda_processed_invoices").update({ invoice_number: newNumber }).eq("id", invoiceId);
    await fetchInvoices();
    setEditingInvoice(null);
  }

  // Drag & drop
  function handleDragStart(index: number) { setDraggedIndex(index); }
  function handleDragOver(e: React.DragEvent, index: number) { e.preventDefault(); setDragOverIndex(index); }
  function handleDrop(index: number) {
    if (draggedIndex === null || draggedIndex === index) { setDraggedIndex(null); setDragOverIndex(null); return; }
    const newInvoices = [...invoices];
    const [item] = newInvoices.splice(draggedIndex, 1);
    newInvoices.splice(index, 0, item);
    setInvoices(newInvoices);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  async function handleMergePDFs() {
    setMerging(true);
    setMergeDialog(false);
    try {
      const payload = {
        project_id: projectId,
        fda_name: fdaFilename,
        ship_name: shipName,
        lbh_number: lbhNumber,
        front_page_url: frontPageUrl,
        agency_cost_url: agencyCostUrl,
        google_sheet_url: googleSheetUrl,
        invoices: invoices.map((inv, i) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          file_name: inv.file_name,
          file_url: inv.file_url,
          description: inv.description,
          total_amount: inv.total_amount,
          currency: inv.currency,
          order: i + 1,
        })),
      };
      const response = await fetch(MERGE_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`Merge mislukt: ${response.status}`);
      toast({ title: "Gestart", description: "PDFs worden samengevoegd..." });
      onNavigateToEmail();
    } catch (error) {
      toast({ title: "Fout", description: error instanceof Error ? error.message : "Merge mislukt", variant: "destructive" });
    } finally {
      setMerging(false);
    }
  }

  const canMerge = !!frontPageUrl && !!agencyCostUrl;

  // Processing animation
  if (checkingSheet) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="relative bg-primary rounded-full p-4">
                <Sparkles className="w-8 h-8 text-primary-foreground animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Facturen worden verwerkt...</h3>
              <p className="text-muted-foreground text-sm mt-1">Dit duurt meestal 30-60 seconden.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Bezig met verwerken...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderUploadZone(type: "front_page" | "agency_cost", url: string | null, uploading: boolean, label: string) {
    if (url) {
      return (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-success" />
            <span className="font-medium">{type === "front_page" ? "front_page.pdf" : "agency_cost.pdf"}</span>
            <Badge variant="outline" className="text-success border-success/20">Geüpload</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}><Download className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialog({ open: true, type })} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      );
    }
    return (
      <label
        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            const input = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
            if (input) { const dt = new DataTransfer(); dt.items.add(files[0]); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
          }
        }}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {uploading ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Sleep PDF hier of <span className="font-medium text-primary">klik om te uploaden</span></p>
              <p className="text-xs text-muted-foreground">PDF, max 10MB</p>
            </>
          )}
        </div>
        <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleFileUpload(e, type)} disabled={uploading} />
      </label>
    );
  }

  return (
    <div className="space-y-6">
      {/* Google Sheet Link */}
      {googleSheetUrl && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="font-medium">Google Sheet</span>
                <Badge variant="outline" className="text-success border-success/20">Klaar</Badge>
              </div>
              <Button size="sm" onClick={() => window.open(googleSheetUrl, "_blank")}>
                <ExternalLink className="w-4 h-4 mr-2" />Openen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Front Page Upload */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />FDA Front Page
          </CardTitle>
        </CardHeader>
        <CardContent>{renderUploadZone("front_page", frontPageUrl, uploadingFrontPage, "Front Page")}</CardContent>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Verwerkte Facturen
            <Badge variant="secondary" className="ml-2">{invoices.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nog geen facturen verwerkt</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Sleep om de volgorde aan te passen</p>
              {invoices.map((invoice, index) => (
                <div
                  key={invoice.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                  className={`flex items-center gap-4 p-4 bg-muted/30 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                    draggedIndex === index ? "opacity-50 border-primary" : dragOverIndex === index ? "border-primary bg-primary/10" : "border-border/50"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center gap-2 min-w-[100px]">
                    {editingInvoice === invoice.id ? (
                      <div className="flex items-center gap-1">
                        <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-20 h-8 text-sm" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleUpdateInvoiceNumber(invoice.id, editValue)}>
                          <Check className="w-4 h-4 text-success" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingInvoice(null)}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">#{invoice.invoice_number}</Badge>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingInvoice(invoice.id); setEditValue(invoice.invoice_number); }}>
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">{invoice.file_name}</span>
                    {invoice.description && <p className="text-xs text-muted-foreground truncate">{invoice.description}</p>}
                  </div>
                  {invoice.total_amount && (
                    <div className="text-sm font-medium whitespace-nowrap">{invoice.currency || "USD"} {invoice.total_amount.toLocaleString()}</div>
                  )}
                  <div className="flex items-center gap-1">
                    {invoice.file_url && (
                      <>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(invoice.file_url!, "_blank")}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { const a = document.createElement("a"); a.href = invoice.file_url!; a.download = invoice.file_name; a.click(); }}><Download className="w-4 h-4" /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, type: null, invoiceId: invoice.id })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agency Cost Upload */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />Agency Cost
          </CardTitle>
        </CardHeader>
        <CardContent>{renderUploadZone("agency_cost", agencyCostUrl, uploadingAgencyCost, "Agency Cost")}</CardContent>
      </Card>

      {/* FDA Filename */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />FDA Bestandsnaam
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={fdaFilename} onChange={(e) => setFdaFilename(e.target.value)} className="font-medium" />
        </CardContent>
      </Card>

      {/* Merge Button */}
      <div className="flex items-center justify-end gap-4">
        {!canMerge && !finalPdfUrl && (
          <span className="text-sm text-muted-foreground">Upload Front Page en Agency Cost om door te gaan</span>
        )}
        <Button size="lg" disabled={!canMerge || merging} onClick={() => setMergeDialog(true)}>
          {merging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Merge className="w-4 h-4 mr-2" />}
          PDFs Samenvoegen
        </Button>
        {finalPdfUrl && (
          <Button size="lg" onClick={onNavigateToEmail} className="animate-fade-in">
            <Mail className="w-4 h-4 mr-2" />Naar E-mail
          </Button>
        )}
      </div>

      {/* Merge Confirmation */}
      <AlertDialog open={mergeDialog} onOpenChange={setMergeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>PDFs samenvoegen?</AlertDialogTitle>
            <AlertDialogDescription>
              Front Page, facturen en Agency Cost worden samengevoegd tot één PDF pakket. Er wordt automatisch een e-mail concept aangemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergePDFs}>Samenvoegen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>Dit bestand wordt permanent verwijderd.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteDialog.invoiceId) handleDeleteInvoice(deleteDialog.invoiceId);
              else if (deleteDialog.type) handleDeleteFile(deleteDialog.type);
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
