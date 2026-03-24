import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Mail, CheckCircle, XCircle, Loader2, ExternalLink,
  Ship, FileText, Trash2, Copy, Check, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ManualEmail } from "@/hooks/useManualEmails";

interface ManualEmailDetailProps {
  email: ManualEmail | null;
  onDelete: (id: number, pdfPath: string | null) => void;
  onEmailUpdated: (updated: ManualEmail) => void;
  onRefresh: () => void;
}

// ── Body parser ───────────────────────────────────────────────
// Splits the AI body into structured blocks:
//   • vessel sections  (--- VESSEL 1: MV NAME ---)
//   • key-value lines  (LOA: 200m)
//   • plain paragraphs (everything else)

interface VesselSection {
  type: 'vessel';
  title: string;
  rows: { label: string; value: string }[];
}

interface TextBlock {
  type: 'text';
  content: string;
}

type BodyBlock = VesselSection | TextBlock;

function parseEmailBody(body: string): BodyBlock[] {
  const lines = body.split('\n');
  const blocks: BodyBlock[] = [];
  let currentVessel: VesselSection | null = null;
  let textBuffer: string[] = [];

  const flushText = () => {
    const joined = textBuffer.join('\n').trim();
    if (joined) blocks.push({ type: 'text', content: joined });
    textBuffer = [];
  };

  const vesselHeaderRe = /^-{2,}\s*VESSEL\s*(\d+)\s*:\s*(.+?)\s*-{2,}$/i;
  const sectionHeaderRe = /^-{2,}\s*(.+?)\s*-{2,}$/;
  // Match "Label: value" but not URLs (http:) or time-like (10:30)
  const kvRe = /^([A-Z][A-Za-z0-9 /&().'-]{1,40}):\s+(.+)$/;

  for (const line of lines) {
    const vesselMatch = line.match(vesselHeaderRe);
    if (vesselMatch) {
      flushText();
      if (currentVessel) blocks.push(currentVessel);
      currentVessel = { type: 'vessel', title: `Vessel ${vesselMatch[1]}: ${vesselMatch[2].trim()}`, rows: [] };
      continue;
    }

    // Non-vessel section headers like --- GENERAL INFO ---
    const sectionMatch = line.match(sectionHeaderRe);
    if (sectionMatch && !vesselMatch) {
      flushText();
      if (currentVessel) { blocks.push(currentVessel); currentVessel = null; }
      currentVessel = { type: 'vessel', title: sectionMatch[1].trim(), rows: [] };
      continue;
    }

    const kvMatch = line.match(kvRe);
    if (kvMatch && currentVessel) {
      currentVessel.rows.push({ label: kvMatch[1].trim(), value: kvMatch[2].trim() });
      continue;
    }

    if (kvMatch && !currentVessel) {
      // Standalone KV line outside a vessel section — start an anonymous section
      flushText();
      currentVessel = { type: 'vessel', title: '', rows: [{ label: kvMatch[1].trim(), value: kvMatch[2].trim() }] };
      continue;
    }

    // If the line is blank and we have an active vessel section with rows, close it
    if (line.trim() === '' && currentVessel && currentVessel.rows.length > 0) {
      blocks.push(currentVessel);
      currentVessel = null;
      textBuffer.push(line);
      continue;
    }

    if (currentVessel) {
      // Non-KV line inside vessel section — could be free text
      if (line.trim()) {
        currentVessel.rows.push({ label: '', value: line.trim() });
      }
    } else {
      textBuffer.push(line);
    }
  }

  if (currentVessel) blocks.push(currentVessel);
  flushText();

  return blocks;
}

// ── Component ─────────────────────────────────────────────────

export function ManualEmailDetail({ email, onDelete, onEmailUpdated, onRefresh }: ManualEmailDetailProps) {
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const bodyBlocks = useMemo(() => {
    if (!email?.body) return [];
    return parseEmailBody(email.body);
  }, [email?.body]);

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

      const { data: responseData, error: fnError } = await supabase.functions.invoke("trigger-manual-email", {
        body: formData,
      });

      if (fnError) throw new Error(fnError.message || "Webhook request failed");
      if (responseData?.upstream_status && responseData.upstream_status >= 400) {
        console.warn("n8n upstream error:", responseData);
      }

      const webhookData: any = responseData?.data ?? null;
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
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.02] flex items-center justify-center mb-4">
              <Mail className="w-7 h-7 opacity-30" />
            </div>
            <p className="text-sm font-medium">Selecteer een e-mail</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Kies een item uit de lijst</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-premium lg:col-span-2 overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">E-mail Details</CardTitle>
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
            email.status === 'draft' && 'bg-amber-50 text-amber-600',
            email.status === 'processing' && 'bg-blue-50 text-blue-600',
            email.status === 'sent' && 'bg-emerald-50 text-emerald-600',
            email.status === 'error' && 'bg-red-50 text-red-600',
            !['draft','processing','sent','error'].includes(email.status || '') && 'bg-gray-50 text-gray-500',
          )}>
            {email.status || 'processing'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {email.status === "error" && (
            <Button variant="outline" size="sm" onClick={handleRetryEmail} disabled={retrying} className="gap-1.5 rounded-lg h-8 text-xs">
              {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Opnieuw
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/8 rounded-lg h-8 w-8 p-0"
            onClick={() => onDelete(email.id, email.pdf_path)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Meta Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetaChip label="Agent Type" value={email.agent_type === "OWNERS_AGENT" ? "Owners Agent" : "Cargo Agent"} />
          {email.vessel_name && <MetaChip label={email.vessel_2_name ? "Vessel 1" : "Vessel"} value={email.vessel_name} icon={<Ship className="w-3.5 h-3.5 text-primary" />} />}
          {email.imo && <MetaChip label={email.vessel_2_imo ? "IMO 1" : "IMO"} value={email.imo} />}
          {email.vessel_2_name && <MetaChip label="Vessel 2" value={email.vessel_2_name} icon={<Ship className="w-3.5 h-3.5 text-primary" />} />}
          {email.vessel_2_imo && <MetaChip label="IMO 2" value={email.vessel_2_imo} />}
          {email.port && <MetaChip label="Haven" value={email.port} />}
          {email.company_name && <MetaChip label="Bedrijf" value={email.company_name} />}
          {email.contact_name && <MetaChip label="Contact" value={email.contact_name} />}
        </div>

        {/* Links */}
        {(email.pda_link_1 || email.pda_link_2 || email.pdf_path) && (
          <div className="flex flex-wrap gap-2">
            {email.pda_link_1 && (
              <a href={email.pda_link_1} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
                <ExternalLink className="w-3 h-3" /> PDA Link 1
              </a>
            )}
            {email.pda_link_2 && (
              <a href={email.pda_link_2} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">
                <ExternalLink className="w-3 h-3" /> PDA Link 2
              </a>
            )}
            {email.pdf_path && (
              <button onClick={() => handleViewPdf(email.pdf_path!)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                <FileText className="w-3 h-3" /> PDF Bekijken
              </button>
            )}
          </div>
        )}

        {/* ── AI Generated Email ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">AI Gegenereerde E-mail</span>
              {email.status === "processing" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            {email.body && email.status !== "processing" && (
              <Button
                onClick={handleCopyEmail}
                size="sm"
                className={cn(
                  "h-8 gap-1.5 rounded-lg text-xs font-semibold transition-all",
                  copied
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-primary/10 hover:bg-primary/20 text-primary"
                )}
                variant="ghost"
              >
                {copied ? (
                  <><Check className="w-3.5 h-3.5" /> Gekopieerd!</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Kopieer E-mail</>
                )}
              </Button>
            )}
          </div>

          {email.status === "processing" ? (
            <div className="rounded-2xl bg-black/[0.02] p-6 space-y-3">
              <div className="space-y-2.5">
                <div className="h-3.5 w-[90%] rounded-md bg-black/[0.04] animate-pulse" />
                <div className="h-3.5 w-[75%] rounded-md bg-black/[0.04] animate-pulse [animation-delay:150ms]" />
                <div className="h-3.5 w-[85%] rounded-md bg-black/[0.04] animate-pulse [animation-delay:300ms]" />
                <div className="h-3.5 w-[60%] rounded-md bg-black/[0.04] animate-pulse [animation-delay:450ms]" />
              </div>
              <p className="text-xs text-muted-foreground/50 pt-1">AI is generating your email…</p>
            </div>
          ) : email.body ? (
            <div className="rounded-2xl overflow-hidden animate-fade-in"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)' }}>
              {/* Subject Header */}
              {email.subject && (
                <div className="px-5 py-4 bg-gradient-to-r from-primary/[0.06] to-primary/[0.02]"
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">Onderwerp</p>
                  <p className="text-[15px] font-semibold text-foreground leading-snug">{email.subject}</p>
                </div>
              )}

              {/* Parsed Body */}
              <div className="p-5 space-y-4 bg-white">
                {bodyBlocks.map((block, i) => {
                  if (block.type === 'vessel') {
                    return (
                      <div key={i} className="rounded-xl bg-black/[0.02] overflow-hidden"
                        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04)' }}>
                        {block.title && (
                          <div className="px-4 py-2.5 flex items-center gap-2"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <Ship className="w-4 h-4 text-primary" />
                            <span className="text-[13px] font-semibold text-foreground">{block.title}</span>
                          </div>
                        )}
                        <div className="px-4 py-2 divide-y divide-black/[0.04]">
                          {block.rows.map((row, j) => (
                            <div key={j} className="flex items-baseline py-1.5 gap-3">
                              {row.label ? (
                                <>
                                  <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide w-[120px] shrink-0">{row.label}</span>
                                  <span className="text-sm text-foreground">{row.value}</span>
                                </>
                              ) : (
                                <span className="text-sm text-foreground">{row.value}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  // Text block
                  return (
                    <div key={i} className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">
                      {block.content}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-black/[0.02] p-8 text-center text-muted-foreground/50 text-sm">
              Nog geen AI-antwoord
            </div>
          )}
        </div>

        {/* Original Email — collapsible */}
        <div>
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] transition-colors text-left"
          >
            <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">Originele E-mail</span>
            {showOriginal ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
          </button>
          {showOriginal && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
              <pre className="p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/70 max-h-[300px] overflow-y-auto bg-white">{email.email_content}</pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Meta chip ─────────────────────────────────────────────────

function MetaChip({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 p-3 bg-black/[0.02] rounded-xl">
      {icon && (
        <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
