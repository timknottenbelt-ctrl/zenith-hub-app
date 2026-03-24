import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Upload, X, Loader2, Ship, Anchor, FileText, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ManualEmailCreateFormProps {
  onSubmitted: () => void;
  onSwitchToHistory: () => void;
  filterAgentType: string;
  setFilterAgentType: (v: string) => void;
}

export function ManualEmailCreateForm({
  onSubmitted,
  onSwitchToHistory,
  filterAgentType,
  setFilterAgentType,
}: ManualEmailCreateFormProps) {
  const [emailContent, setEmailContent] = useState("");
  const [subject, setSubject] = useState("");
  const [agentType, setAgentType] = useState<"OWNERS_AGENT" | "CARGO_AGENT" | "">("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const submitLockRef = useRef(false);

  async function handleSubmit() {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSending(true);

    if (!agentType) {
      toast({ title: "Error", description: "Selecteer eerst een agent type", variant: "destructive" });
      submitLockRef.current = false;
      setSending(false);
      return;
    }
    if (!emailContent.trim()) {
      toast({ title: "Error", description: "Plak een e-mailbericht", variant: "destructive" });
      submitLockRef.current = false;
      setSending(false);
      return;
    }

    const originalAgentType = agentType;
    const originalSubject = subject.trim();

    if (filterAgentType !== "all" && filterAgentType !== originalAgentType) {
      setFilterAgentType("all");
    }

    try {
      const formData = new FormData();
      formData.append("email_content", emailContent);
      formData.append("agent_type", originalAgentType);
      if (originalSubject) formData.append("subject", originalSubject);
      if (pdfFile) formData.append("pdf", pdfFile);

      let lastError: Error | null = null;
      let success = false;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { data: responseData, error: fnError } = await supabase.functions.invoke("trigger-manual-email", {
            body: formData,
          });

          if (fnError) throw new Error(fnError.message || "Webhook request failed");
          if (responseData?.upstream_status && responseData.upstream_status >= 400) {
            console.warn("n8n upstream error:", responseData);
          }
          success = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[ManualEmail] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
        }
      }

      if (!success && lastError) throw lastError;

      setEmailContent("");
      setSubject("");
      setPdfFile(null);
      const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      onSubmitted();
      onSwitchToHistory();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Verwerking mislukt",
        variant: "destructive",
      });
    } finally {
      submitLockRef.current = false;
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Form */}
      <div className="lg:col-span-3 space-y-5">
        {/* Agent Type Cards */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3 block">
            Agent Type
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAgentType("CARGO_AGENT")}
              className={cn(
                "card-premium p-5 text-left transition-all duration-200 rounded-2xl",
                agentType === "CARGO_AGENT"
                  ? "ring-2 ring-primary ring-offset-2"
                  : "hover:shadow-lg"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                agentType === "CARGO_AGENT" ? "bg-primary" : "bg-primary/8"
              )}
                style={agentType === "CARGO_AGENT" ? { boxShadow: '0 4px 12px -2px rgba(0,128,255,0.35)' } : undefined}>
                <Ship className={cn("w-5 h-5", agentType === "CARGO_AGENT" ? "text-white" : "text-primary")} />
              </div>
              <p className="font-semibold text-sm text-foreground">Cargo Agent</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Loading & discharge inquiries</p>
            </button>

            <button
              type="button"
              onClick={() => setAgentType("OWNERS_AGENT")}
              className={cn(
                "card-premium p-5 text-left transition-all duration-200 rounded-2xl",
                agentType === "OWNERS_AGENT"
                  ? "ring-2 ring-primary ring-offset-2"
                  : "hover:shadow-lg"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                agentType === "OWNERS_AGENT" ? "bg-primary" : "bg-primary/8"
              )}
                style={agentType === "OWNERS_AGENT" ? { boxShadow: '0 4px 12px -2px rgba(0,128,255,0.35)' } : undefined}>
                <Anchor className={cn("w-5 h-5", agentType === "OWNERS_AGENT" ? "text-white" : "text-primary")} />
              </div>
              <p className="font-semibold text-sm text-foreground">Owners Agent</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Vessel owner representations</p>
            </button>
          </div>
        </div>

        {/* Subject */}
        <div className="card-premium p-5 rounded-2xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-subject" className="text-sm font-medium">Onderwerp <span className="text-muted-foreground/40">(optioneel)</span></Label>
            <input
              id="email-subject"
              type="text"
              placeholder="Voer onderwerp in..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-border/60 bg-transparent px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-all"
            />
          </div>

          {/* Email Content */}
          <div className="space-y-2">
            <Label htmlFor="email-content" className="text-sm font-medium">E-mail Inhoud</Label>
            <Textarea
              id="email-content"
              placeholder="Plak hier de e-mail inhoud..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              className="min-h-[280px] font-sans text-sm leading-relaxed rounded-xl border-border/60 bg-transparent placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/30 resize-none"
            />
          </div>

          {/* PDF Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">PDF Bijlage <span className="text-muted-foreground/40">(optioneel)</span></Label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer flex-1">
                <div className={cn(
                  "flex items-center justify-center gap-2.5 p-4 border-2 border-dashed rounded-xl transition-all",
                  pdfFile ? "border-primary/30 bg-primary/5" : "border-border/40 hover:border-primary/30 hover:bg-primary/[0.02]"
                )}>
                  {pdfFile ? (
                    <FileText className="w-5 h-5 text-primary" />
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground/40" />
                  )}
                  <span className={cn("text-sm", pdfFile ? "text-foreground font-medium" : "text-muted-foreground/50")}>
                    {pdfFile ? pdfFile.name : "Klik om PDF te uploaden"}
                  </span>
                </div>
                <input
                  id="manual-pdf-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.type === "application/pdf") {
                      setPdfFile(file);
                    } else if (file) {
                      toast({ title: "Error", description: "Alleen PDF bestanden zijn toegestaan", variant: "destructive" });
                    }
                  }}
                />
              </label>
              {pdfFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl shrink-0"
                  onClick={() => {
                    setPdfFile(null);
                    const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
                    if (fileInput) fileInput.value = "";
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <Button
          className="w-full h-12 rounded-xl text-sm font-semibold"
          onClick={handleSubmit}
          disabled={sending || !emailContent.trim() || !agentType}
          style={{ boxShadow: !sending && emailContent.trim() && agentType ? '0 4px 14px -3px rgba(0,128,255,0.4)' : undefined }}
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verwerken...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Verstuur naar AI
            </>
          )}
        </Button>
      </div>

      {/* Instructions Panel */}
      <div className="lg:col-span-2 space-y-5">
        <div className="card-premium p-6 rounded-2xl">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-amber-500" />
            </div>
            <h3 className="font-semibold text-sm">Hoe het werkt</h3>
          </div>
          <ol className="space-y-3">
            {[
              { step: '1', text: 'Selecteer het agent type hierboven' },
              { step: '2', text: 'Kopieer en plak de e-mailinhoud' },
              { step: '3', text: 'Voeg optioneel een PDF toe' },
              { step: '4', text: 'Klik "Verstuur naar AI" om te verwerken' },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 text-[11px] font-bold text-primary">
                  {item.step}
                </span>
                <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">{item.text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Live Preview */}
        {emailContent && (
          <div className="card-premium p-5 rounded-2xl">
            <Label className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3 block">
              Voorbeeld
            </Label>
            <div className="p-4 bg-black/[0.02] rounded-xl max-h-[300px] overflow-auto">
              <p className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground/80">{emailContent}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
