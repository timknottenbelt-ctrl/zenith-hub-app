import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Send, Upload, X, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WEBHOOKS, webhookPostFormData } from "@/lib/webhooks";
import { toast } from "@/hooks/use-toast";
import type { ManualEmail } from "@/hooks/useManualEmails";

interface ManualEmailCreateFormProps {
  onEmailCreated: (optimistic: ManualEmail) => void;
  onSwitchToHistory: () => void;
  filterAgentType: string;
  setFilterAgentType: (v: string) => void;
}

export function ManualEmailCreateForm({
  onEmailCreated,
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
    if (sending || submitLockRef.current) return;

    if (!agentType) {
      toast({ title: "Error", description: "Selecteer eerst een agent type", variant: "destructive" });
      return;
    }
    if (!emailContent.trim()) {
      toast({ title: "Error", description: "Plak een e-mailbericht", variant: "destructive" });
      return;
    }

    submitLockRef.current = true;

    const originalEmailContent = emailContent;
    const originalAgentType = agentType;
    const originalSubject = subject.trim();

    const optimisticId = -Date.now();
    const optimisticEmail: ManualEmail = {
      id: optimisticId,
      created_at: new Date().toISOString(),
      email_content: originalEmailContent,
      agent_type: originalAgentType,
      vessel_name: null,
      imo: null,
      port: null,
      status: "processing",
      subject: originalSubject || null,
      body: null,
      pda_link_1: null,
      pda_link_2: null,
      company_name: null,
      contact_name: null,
      pdf_path: null,
      vessel_2_name: null,
      vessel_2_imo: null,
    };

    if (filterAgentType !== "all" && filterAgentType !== originalAgentType) {
      setFilterAgentType("all");
    }

    onEmailCreated(optimisticEmail);
    onSwitchToHistory();
    setSending(true);

    try {
      const formData = new FormData();
      formData.append("email_content", originalEmailContent);
      formData.append("agent_type", originalAgentType);
      if (originalSubject) formData.append("subject", originalSubject);
      if (pdfFile) formData.append("pdf", pdfFile);

      const response = await webhookPostFormData(WEBHOOKS.MANUAL_EMAIL_CREATION, formData);

      if (!response.ok) throw new Error("Webhook request failed");

      toast({ title: "Verzonden" });

      // Poll for result (single call — bug fix: was called twice before)
      const startedAt = Date.now();
      const normalizeMatch = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
      const target = normalizeMatch(originalEmailContent);

      const pollForResult = async () => {
        const tryFindEmail = async (): Promise<ManualEmail | null> => {
          const { data } = await supabase
            .from("manual_emails")
            .select("*")
            .eq("agent_type", originalAgentType)
            .order("created_at", { ascending: false })
            .limit(50);

          if (!data?.length) return null;
          const rows = data as ManualEmail[];
          const snippet = target.slice(0, 160);

          return rows.find((e) => {
            const content = normalizeMatch(e.email_content ?? "");
            const isSame = content === target || (snippet && content.includes(snippet)) || target.includes(content);
            const isDone = !!e.subject && !!e.body && e.status !== "processing";
            return isSame && isDone;
          }) ?? null;
        };

        const poll = async () => {
          const result = await tryFindEmail();
          if (result) {
            // Will be picked up by realtime/parent state
            toast({ title: "Klaar", description: "Email is bijgewerkt." });
            return;
          }
          const elapsedMs = Date.now() - startedAt;
          const intervalMs = elapsedMs < 3 * 60_000 ? 2000 : elapsedMs < 10 * 60_000 ? 5000 : 15000;
          setTimeout(poll, intervalMs);
        };

        poll();
      };

      pollForResult();

      setEmailContent("");
      setSubject("");
      setPdfFile(null);
      const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            Handmatige Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agent Type */}
          <div className="space-y-2">
            <Label htmlFor="agent-type">Agent Type <span className="text-destructive">*</span></Label>
            <Select
              value={agentType}
              onValueChange={(value: "OWNERS_AGENT" | "CARGO_AGENT") => setAgentType(value)}
            >
              <SelectTrigger id="agent-type" className={!agentType ? "border-destructive/50" : ""}>
                <SelectValue placeholder="Selecteer agent type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CARGO_AGENT">Cargo Agent</SelectItem>
                <SelectItem value="OWNERS_AGENT">Owners Agent</SelectItem>
              </SelectContent>
            </Select>
            {!agentType && (
              <p className="text-xs text-muted-foreground">Selecteer een agent type voor verzending</p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="email-subject">Onderwerp (Optioneel)</Label>
            <input
              id="email-subject"
              type="text"
              placeholder="Voer onderwerp in..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Email Content */}
          <div className="space-y-2">
            <Label htmlFor="email-content">E-mail Inhoud</Label>
            <Textarea
              id="email-content"
              placeholder="Plak hier de e-mail inhoud..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              className="min-h-[300px] font-sans text-sm leading-relaxed"
            />
          </div>

          {/* PDF Upload */}
          <div className="space-y-2">
            <Label htmlFor="manual-pdf-input">PDF Bijlage (Optioneel)</Label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer flex-1">
                <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
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

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={sending || !emailContent.trim() || !agentType}
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
        </CardContent>
      </Card>

      {/* Instructions / Preview */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Instructies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="font-medium">Hoe handmatige e-mail aanmaken werkt:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Selecteer het agent type (Cargo Agent of Owners Agent)</li>
              <li>Kopieer en plak de e-mailinhoud in het tekstveld</li>
              <li>Voeg optioneel een PDF-document toe</li>
              <li>Klik op "Verstuur naar AI" om de e-mail te verwerken</li>
            </ol>
          </div>

          {emailContent && (
            <div className="space-y-2">
              <Label>Voorbeeld</Label>
              <div className="p-4 bg-muted/50 rounded-lg border max-h-[300px] overflow-auto">
                <p className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{emailContent}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
