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
      // Read an attached PDF (if any) as base64 so the Supabase pipeline can
      // extract its text itself — manual emails no longer depend on n8n.
      let pdf_base64: string | undefined;
      if (pdfFile) {
        pdf_base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Kon PDF niet lezen"));
          reader.readAsDataURL(pdfFile);
        });
      }

      const payload = {
        email_content: emailContent,
        agent_type: originalAgentType,
        subject: originalSubject || undefined,
        pdf_base64,
      };

      // Clear the form and switch to history IMMEDIATELY — don't block ~20s on the
      // AI. The History view shows a skeleton; the email's polling reveals the
      // processed result as soon as it's ready.
      setEmailContent("");
      setSubject("");
      setPdfFile(null);
      const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      submitLockRef.current = false;
      setSending(false);
      onSubmitted();
      onSwitchToHistory();

      // Fire-and-forget: process in the background.
      void supabase.functions
        .invoke("manual-email-create", { body: payload })
        .then(({ data, error }) => {
          if (error || !data?.success) {
            toast({
              title: "Verwerking mislukt",
              description: error?.message || data?.error || "Probeer het opnieuw",
              variant: "destructive",
            });
          }
        })
        .catch((err) => {
          toast({ title: "Verwerking mislukt", description: err instanceof Error ? err.message : "Onbekende fout", variant: "destructive" });
        });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Verwerking mislukt",
        variant: "destructive",
      });
      submitLockRef.current = false;
      setSending(false);
    }
  }

  const AgentCard = ({
    type, icon: Icon, title, subtitle,
  }: { type: "CARGO_AGENT" | "OWNERS_AGENT"; icon: typeof Ship; title: string; subtitle: string }) => (
    <button
      type="button"
      onClick={() => setAgentType(type)}
      className={cn(
        "card-premium flex items-center gap-3 p-3.5 text-left transition-all duration-200 rounded-xl",
        agentType === type ? "ring-2 ring-primary ring-offset-2" : "hover:shadow-lg"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          agentType === type ? "bg-primary" : "bg-primary/8"
        )}
        style={agentType === type ? { boxShadow: "0 4px 12px -2px rgba(0,128,255,0.35)" } : undefined}
      >
        <Icon className={cn("w-[18px] h-[18px]", agentType === type ? "text-white" : "text-primary")} />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{subtitle}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Agent Type — full width, compact horizontal cards */}
      <div>
        <Label className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2 block">
          Agent Type
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AgentCard type="CARGO_AGENT" icon={Ship} title="Cargo Agent" subtitle="Loading & discharge inquiries" />
          <AgentCard type="OWNERS_AGENT" icon={Anchor} title="Owners Agent" subtitle="Vessel owner representations" />
        </div>
      </div>

      {/* Main working row: meta (left) + email body (right) side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: subject + pdf + how-it-works + submit */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="card-premium p-4 rounded-2xl space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-subject" className="text-sm font-medium">
                Onderwerp <span className="text-muted-foreground/40">(optioneel)</span>
              </Label>
              <input
                id="email-subject"
                type="text"
                placeholder="Voer onderwerp in..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-border/60 bg-transparent px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                PDF Bijlage <span className="text-muted-foreground/40">(optioneel)</span>
              </Label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex-1">
                  <div className={cn(
                    "flex items-center justify-center gap-2.5 p-3 border-2 border-dashed rounded-xl transition-all",
                    pdfFile ? "border-primary/30 bg-primary/5" : "border-border/40 hover:border-primary/30 hover:bg-primary/[0.02]"
                  )}>
                    {pdfFile ? <FileText className="w-5 h-5 text-primary" /> : <Upload className="w-5 h-5 text-muted-foreground/40" />}
                    <span className={cn("text-sm truncate", pdfFile ? "text-foreground font-medium" : "text-muted-foreground/50")}>
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

            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-500/5 p-3">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Selecteer een agent type, plak de e-mail rechts, voeg eventueel een PDF toe en klik
                <span className="font-medium text-foreground"> Verstuur naar AI</span>.
              </p>
            </div>
          </div>

          <Button
            className="w-full h-12 rounded-xl text-sm font-semibold mt-auto"
            onClick={handleSubmit}
            disabled={sending || !emailContent.trim() || !agentType}
            style={{ boxShadow: !sending && emailContent.trim() && agentType ? "0 4px 14px -3px rgba(0,128,255,0.4)" : undefined }}
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verwerken...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" />Verstuur naar AI</>
            )}
          </Button>
        </div>

        {/* Right: the email body — the main wide area */}
        <div className="lg:col-span-7 card-premium p-4 rounded-2xl flex flex-col">
          <Label htmlFor="email-content" className="text-sm font-medium mb-2 flex items-center justify-between">
            <span>E-mail Inhoud</span>
            {emailContent && (
              <span className="text-[11px] font-normal text-muted-foreground/50 tabular-nums">
                {emailContent.length.toLocaleString()} tekens
              </span>
            )}
          </Label>
          <Textarea
            id="email-content"
            placeholder="Plak hier de volledige e-mail inhoud..."
            value={emailContent}
            onChange={(e) => setEmailContent(e.target.value)}
            className="flex-1 min-h-[240px] lg:min-h-[280px] font-sans text-sm leading-relaxed rounded-xl border-border/60 bg-transparent placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/30 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
