import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle,
  Eye,
  Download,
  FileUp,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Invoice {
  id: string;
  file_name: string;
  file_url: string | null;
  invoice_number: string;
  isNew?: boolean;
}

interface FDACuracaoInvoiceUploadProps {
  projectId: string;
  lbhNumber: string;
  shipName: string;
  invoices: Invoice[];
  onInvoicesChange: (invoices: Invoice[]) => void;
  disabled?: boolean;
}

export function FDACuracaoInvoiceUpload({
  projectId,
  lbhNumber,
  shipName,
  invoices,
  onInvoicesChange,
  disabled,
}: FDACuracaoInvoiceUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!projectId) return;
    
    setUploading(true);
    const newInvoices: Invoice[] = [];
    let currentCount = invoices.length;

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        toast({ title: "Fout", description: "Alleen PDF bestanden toegestaan", variant: "destructive" });
        continue;
      }

      const filePath = `curacao/${projectId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from("fda-invoices").upload(filePath, file);

      if (uploadError) {
        toast({ title: "Upload mislukt", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: signedData } = await supabase.storage
        .from("fda-invoices")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      currentCount += 1;
      const invoiceNumber = String(currentCount).padStart(3, "0");

      const { data: insertedData, error: insertError } = await supabase
        .from("fda_curacao_processed_invoices")
        .insert({
          project_id: projectId,
          lbh_number: lbhNumber,
          ship_name: shipName,
          file_name: file.name,
          file_url: signedData?.signedUrl || null,
          invoice_number: invoiceNumber,
        })
        .select()
        .single();

      if (insertError) {
        toast({ title: "Fout", description: insertError.message, variant: "destructive" });
      } else if (insertedData) {
        newInvoices.push({ ...insertedData, isNew: true });
      }
    }

    onInvoicesChange([...invoices, ...newInvoices]);
    setUploading(false);
    if (newInvoices.length > 0) {
      toast({ title: "Geüpload", description: `${newInvoices.length} bestand(en) toegevoegd` });
    }
  }, [projectId, lbhNumber, shipName, invoices, onInvoicesChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) await uploadFiles(files);
  }, [disabled, uploadFiles]);

  const handleDelete = async (invoice: Invoice) => {
    await supabase.from("fda_curacao_processed_invoices").delete().eq("id", invoice.id);
    onInvoicesChange(invoices.filter((i) => i.id !== invoice.id));
    toast({ title: "Verwijderd" });
  };

  const handleUpdateNumber = async (id: string, number: string) => {
    const { error } = await supabase
      .from("fda_curacao_processed_invoices")
      .update({ invoice_number: number })
      .eq("id", id);
    
    if (!error) {
      onInvoicesChange(invoices.map((i) => (i.id === id ? { ...i, invoice_number: number } : i)));
    }
  };

  const openPreview = async (invoice: Invoice) => {
    if (!invoice.file_url) return;
    setPreviewName(invoice.file_name);
    setPdfLoading(true);
    
    try {
      const res = await fetch(invoice.file_url, { cache: "no-store" });
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      toast({ title: "Fout", description: "Kon PDF niet laden", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName("");
  };

  // Filter duplicates
  const uniqueInvoices = invoices.filter(
    (inv, index, self) => index === self.findIndex((i) => i.file_name === inv.file_name)
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Facturen
              <Badge variant="secondary">{uniqueInvoices.length}</Badge>
            </div>
            <input
              type="file"
              id="invoice-upload-input"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              disabled={disabled || uploading}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => document.getElementById("invoice-upload-input")?.click()}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40"}
              ${uniqueInvoices.length === 0 ? "py-8" : "py-3"}
            `}
            onClick={() => !disabled && document.getElementById("invoice-upload-input")?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
            ) : isDragging ? (
              <div className="flex items-center justify-center gap-2">
                <FileUp className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Laat los om te uploaden</span>
              </div>
            ) : uniqueInvoices.length === 0 ? (
              <div className="space-y-1">
                <FileUp className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Sleep PDF bestanden hierheen</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">+ Meer PDFs toevoegen</p>
            )}
          </div>

          {/* Invoice list */}
          {uniqueInvoices.length > 0 && (
            <div className="space-y-2">
              {uniqueInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {invoice.isNew ? (
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    )}
                    <span className="text-sm truncate">{invoice.file_name}</span>
                    {invoice.isNew && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-primary/10 text-primary">
                        Nieuw
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      value={invoice.invoice_number}
                      onChange={(e) => handleUpdateNumber(invoice.id, e.target.value)}
                      className="w-16 h-7 text-xs text-center"
                      disabled={disabled}
                    />
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {invoice.file_url && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPreview(invoice);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(invoice.file_url!, "_blank");
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {!disabled && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(invoice);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl || pdfLoading} onOpenChange={() => closePreview()}>
        <DialogContent className="max-w-4xl h-[85vh] p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {previewName}
            </DialogTitle>
            <DialogDescription>PDF preview</DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-4 pb-4 h-[calc(85vh-80px)]">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg border"
                title={previewName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
