import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Mail, CheckCircle, XCircle, Loader2, ExternalLink,
  Ship, FileText, Trash2, Copy, Check, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ManualEmail } from "@/hooks/useManualEmails";
import { WEBHOOKS, webhookPostFormData } from "@/lib/webhooks";

interface ManualEmailDetailProps {
  email: ManualEmail | null;
  onDelete: (id: number, pdfPath: string | null) => void;
  onEmailUpdated: (updated: ManualEmail) => void;
  onRefresh: () => void;
}

export function ManualEmailDetail({ email, onDelete, onEmailUpdated, onRefresh }: ManualEmailDetailProps) {
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleCopyEmail = async () => {
    if (!email?.body) return;
    const textToCopy = email.subject
      ? `Subject: ${email.subject}\n\n${email.body}`
      : email.body;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Gekopieerd", description: "Email gekopieerd naar klembord" });
  };

  async function handleViewPdf(pdfPath: string) {
    const { data, error } = await supabase.storage.from("pdfs").createSignedUrl(pdfPath, 3600);
    if (error) {
      toast({ title: "Error", description: "Kon PDF niet laden", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleRetryEmail() {
    if (!email || retrying) return;
    setRetrying(true);

    const processingVersion: ManualEmail = {
      ...email,
      status: "processing",
      subject: "AI is thinking…",
      body: null,
    };
    onEmailUpdated(processingVersion);

    try {
      const formData = new FormData();
      formData.append("email_content", email.email_content);
      formData.append("agent_type", email.agent_type);
      if (email.id > 0) formData.append("email_id", String(email.id));

      const response = await webhookPostFormData(WEBHOOKS.MANUAL_EMAIL_CREATION, formData);

      if (!response.ok) throw new Error("Webhook request failed");

      let webhookData: any = null;
      try { webhookData = await response.json(); } catch { /* ignore */ }

      const respSubject = webhookData?.data?.subject ?? webhookData?.subject;
      const respBody = webhookData?.data?.body ?? webhookData?.body;
      const respVesselName = webhookData?.data?.vessel_name;

      if (respSubject || respBody) {
        onEmailUpdated({
          ...email,
          subject: respSubject ?? email.subject,
          body: respBody ?? email.body,
          vessel_name: respVesselName ?? email.vessel_name,
          status: "draft",
        });
      }

      toast({ title: "Opnieuw verzonden", description: "Email is opnieuw naar AI gestuurd." });
      setTimeout(onRefresh, 2000);
    } catch (error) {
      onEmailUpdated({ ...email, status: "error" });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Opnieuw proberen mislukt",
        variant: "destructive",
      });
    } finally {
      setRetrying(false);
    }
  }

  if (!email) {
    return (
      <Card className="card-premium lg:col-span-2 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">E-mail Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            Selecteer een e-mail om details te bekijken
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-premium lg:col-span-2 overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">E-mail Details</CardTitle>
        <div className="flex items-center gap-2">
          {email.status === "error" && (
            <Button variant="outline" size="sm" onClick={handleRetryEmail} disabled={retrying} className="gap-1.5">
              {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Opnieuw proberen
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(email.id, email.pdf_path)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Agent Type</Label>
              <p className="text-sm font-medium">
                {email.agent_type === "OWNERS_AGENT" ? "Owners Agent" : "Cargo Agent"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <p className="text-sm">{email.status || "processing"}</p>
            </div>
            {email.vessel_name && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {email.vessel_2_name ? "Vessel 1" : "Vessel"}
                </Label>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Ship className="w-3 h-3" />
                  {email.vessel_name}
                </p>
              </div>
            )}
            {email.imo && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {email.vessel_2_imo ? "IMO 1" : "IMO"}
                </Label>
                <p className="text-sm">{email.imo}</p>
              </div>
            )}
            {email.vessel_2_name && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Vessel 2</Label>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Ship className="w-3 h-3" />
                  {email.vessel_2_name}
                </p>
              </div>
            )}
            {email.vessel_2_imo && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IMO 2</Label>
                <p className="text-sm">{email.vessel_2_imo}</p>
              </div>
            )}
            {email.port && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Haven</Label>
                <p className="text-sm">{email.port}</p>
              </div>
            )}
            {email.company_name && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bedrijf</Label>
                <p className="text-sm">{email.company_name}</p>
              </div>
            )}
            {email.contact_name && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Contact</Label>
                <p className="text-sm">{email.contact_name}</p>
              </div>
            )}
          </div>

          {/* PDA Links and PDF */}
          <div className="flex flex-wrap gap-2">
            {email.pda_link_1 && (
              <a href={email.pda_link_1} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="w-3 h-3" /> PDA Link 1
                </Button>
              </a>
            )}
            {email.pda_link_2 && (
              <a href={email.pda_link_2} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="w-3 h-3" /> PDA Link 2
                </Button>
              </a>
            )}
            {email.pdf_path && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => handleViewPdf(email.pdf_path!)}>
                <FileText className="w-3 h-3" /> PDF Bekijken
              </Button>
            )}
          </div>

          {/* AI Generated Response */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                AI Gegenereerde E-mail
                {email.status === "processing" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </Label>
              {email.body && email.status !== "processing" && (
                <Button variant="ghost" size="sm" onClick={handleCopyEmail} className="h-7 gap-1.5 text-xs">
                  {copied ? (
                    <><Check className="w-3.5 h-3.5 text-green-500" /> Gekopieerd</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Kopieer</>
                  )}
                </Button>
              )}
            </div>

            {email.status === "processing" ? (
              <div className="border rounded-lg bg-muted/20 p-5 space-y-3">
                <div className="space-y-2.5">
                  <div className="h-3.5 w-[90%] rounded-md bg-muted animate-pulse" />
                  <div className="h-3.5 w-[75%] rounded-md bg-muted animate-pulse [animation-delay:150ms]" />
                  <div className="h-3.5 w-[85%] rounded-md bg-muted animate-pulse [animation-delay:300ms]" />
                  <div className="h-3.5 w-[60%] rounded-md bg-muted animate-pulse [animation-delay:450ms]" />
                </div>
                <p className="text-xs text-muted-foreground pt-1">AI is generating your email…</p>
              </div>
            ) : email.body ? (
              <div className="border rounded-lg overflow-hidden animate-fade-in">
                {email.subject && (
                  <div className="px-4 py-3 bg-primary/5 border-b">
                    <p className="text-xs text-muted-foreground mb-1">Onderwerp:</p>
                    <p className="text-sm font-medium">{email.subject}</p>
                  </div>
                )}
                <div className="bg-muted/30">
                  <pre className="p-4 text-sm whitespace-pre-wrap font-sans">{email.body}</pre>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg bg-muted/20 p-4 text-center text-muted-foreground text-sm">
                Nog geen AI-antwoord
              </div>
            )}
          </div>

          {/* Original Email */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Originele E-mail</Label>
            <div className="border rounded-lg">
              <pre className="p-4 text-sm whitespace-pre-wrap font-sans">{email.email_content}</pre>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
