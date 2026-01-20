import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
import {
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Ship,
  Upload,
  X,
  PlusCircle,
  Send,
  ArrowLeft,
  RefreshCw,
  FileText,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";

interface ManualEmail {
  id: number;
  created_at: string | null;
  email_content: string;
  agent_type: string;
  vessel_name: string | null;
  imo: string | null;
  port: string | null;
  status: string | null;
  subject: string | null;
  body: string | null;
  pda_link_1: string | null;
  pda_link_2: string | null;
  company_name: string | null;
  contact_name: string | null;
  pdf_path: string | null;
}

export default function ManualEmails() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "history" ? "history" : "create";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [emails, setEmails] = useState<ManualEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<ManualEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterAgentType, setFilterAgentType] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<{ id: number; pdfPath: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Manual email creation state
  const [manualEmailContent, setManualEmailContent] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [manualAgentType, setManualAgentType] = useState<"OWNERS_AGENT" | "CARGO_AGENT" | "">("");
  const [manualPdfFile, setManualPdfFile] = useState<File | null>(null);
  const [manualSending, setManualSending] = useState(false);
  const submitLockRef = useRef(false);

  // Track per-optimistic placeholder timeouts so we can stop “processing…” when nothing comes back
  const optimisticTimeoutsRef = useRef<Record<number, number>>({});

  const handleCopyEmail = async () => {
    if (!selectedEmail?.body) return;
    const textToCopy = selectedEmail.subject
      ? `Subject: ${selectedEmail.subject}\n\n${selectedEmail.body}`
      : selectedEmail.body;

    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Gekopieerd", description: "Email gekopieerd naar klembord" });
  };

  const areEmailsEquivalentForUI = (a: ManualEmail, b: ManualEmail) =>
    a.id === b.id &&
    a.status === b.status &&
    a.subject === b.subject &&
    a.body === b.body &&
    a.pda_link_1 === b.pda_link_1 &&
    a.pda_link_2 === b.pda_link_2 &&
    a.pdf_path === b.pdf_path &&
    a.vessel_name === b.vessel_name &&
    a.imo === b.imo &&
    a.port === b.port &&
    a.company_name === b.company_name &&
    a.contact_name === b.contact_name &&
    a.email_content === b.email_content &&
    a.agent_type === b.agent_type;

  const normalizeForKey = (value: string) => value.trim().replace(/\s+/g, " ");

  const isCloseDuplicate = (a: ManualEmail, b: ManualEmail) => {
    if (a.id < 0 || b.id < 0) return false; // never dedupe optimistic placeholders
    if (a.agent_type !== b.agent_type) return false;
    if ((a.subject || "").trim() !== (b.subject || "").trim()) return false;
    if (normalizeForKey(a.email_content) !== normalizeForKey(b.email_content)) return false;

    const ta = a.created_at ? Date.parse(a.created_at) : NaN;
    const tb = b.created_at ? Date.parse(b.created_at) : NaN;
    if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;

    // If two identical rows were inserted within 2 minutes, treat it as an accidental duplicate
    return Math.abs(ta - tb) <= 2 * 60 * 1000;
  };

  const dedupeCloseDuplicates = (rows: ManualEmail[]) => {
    const out: ManualEmail[] = [];
    for (const row of rows) {
      const hasCloseDup = out.some((existing) => isCloseDuplicate(existing, row));
      if (hasCloseDup) continue;
      out.push(row);
    }
    return out;
  };

  useEffect(() => {
    fetchManualEmails();
  }, [filterAgentType]);

  // If an optimistic placeholder never gets reconciled (n8n didn’t insert/update Supabase), stop “loading forever”.
  useEffect(() => {
    const timeouts = optimisticTimeoutsRef.current;

    // Clear timeouts for items that no longer exist
    for (const idStr of Object.keys(timeouts)) {
      const id = Number(idStr);
      if (!emails.some((e) => e.id === id)) {
        window.clearTimeout(timeouts[id]);
        delete timeouts[id];
      }
    }

    for (const e of emails) {
      if (e.id >= 0) continue;

      const shouldTimeout = e.status === "processing";
      const hasTimeout = !!timeouts[e.id];

      if (shouldTimeout && !hasTimeout) {
        timeouts[e.id] = window.setTimeout(() => {
          const timeoutBody =
            "Geen response van de workflow ontvangen. Controleer of n8n daadwerkelijk een rij in Supabase (manual_emails) aanmaakt en de status bijwerkt.";

          setEmails((prev) =>
            prev.map((row) =>
              row.id === e.id
                ? {
                    ...row,
                    status: "error",
                    subject:
                      row.subject && row.subject !== "AI is thinking…"
                        ? row.subject
                        : "Timeout (geen workflow response)",
                    body: row.body ?? timeoutBody,
                  }
                : row,
            ),
          );

          setSelectedEmail((prev) =>
            prev?.id === e.id
              ? {
                  ...prev,
                  status: "error",
                  subject:
                    prev.subject && prev.subject !== "AI is thinking…"
                      ? prev.subject
                      : "Timeout (geen workflow response)",
                  body: prev.body ?? timeoutBody,
                }
              : prev,
          );
        }, 45_000);
      }

      if (!shouldTimeout && hasTimeout) {
        window.clearTimeout(timeouts[e.id]);
        delete timeouts[e.id];
      }
    }
  }, [emails]);

  // Auto-refresh polling for processing emails (silent, no UI flicker)
  useEffect(() => {
    if (selectedEmail?.status !== "processing") return;
    if (selectedEmail.id < 0) return; // optimistic placeholder, wait for realtime/id-based reconcile

    const interval = setInterval(async () => {
      const { data, error } = await supabase.from("manual_emails").select("*").eq("id", selectedEmail.id).single();

      if (error || !data) return;

      const updated = data as ManualEmail;

      setSelectedEmail((prev) => {
        if (!prev || prev.id !== updated.id) return prev;
        return areEmailsEquivalentForUI(prev, updated) ? prev : updated;
      });

      setEmails((prev) => {
        const idx = prev.findIndex((e) => e.id === updated.id);
        if (idx === -1) return prev;
        if (areEmailsEquivalentForUI(prev[idx], updated)) return prev;
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedEmail?.id, selectedEmail?.status]);

  // Realtime subscription for updates (update local state; avoid refetch flicker)
  useEffect(() => {
    const channel = supabase
      .channel("manual_emails_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "manual_emails",
        },
        (payload) => {
          const eventType = payload.eventType;
          const newRow = payload.new as ManualEmail | undefined;
          const oldRow = payload.old as { id?: number } | undefined;

          setEmails((prev) => {
            const next = [...prev];

            const matchesFilter = (agentType?: string | null) =>
              filterAgentType === "all" || agentType === filterAgentType;

            const findOptimisticMatchIndex = (row: ManualEmail) =>
              next.findIndex(
                (e) => e.id < 0 && e.agent_type === row.agent_type && e.email_content === row.email_content,
              );

            if (eventType === "INSERT" && newRow) {
              const row = newRow;
              if (!matchesFilter(row.agent_type)) return prev;

              // Prevent close duplicates showing up (double webhook / double click)
              const existingCloseDup = next.find((e) => isCloseDuplicate(e, row));
              if (existingCloseDup) return prev;

              const optimisticIdx = findOptimisticMatchIndex(row);
              if (optimisticIdx !== -1) {
                next[optimisticIdx] = row;
                return next;
              }

              if (next.some((e) => e.id === row.id)) return prev;
              next.unshift(row);
              return next;
            }

            if (eventType === "UPDATE" && newRow) {
              const row = newRow;
              const idx = next.findIndex((e) => e.id === row.id);

              if (!matchesFilter(row.agent_type)) {
                if (idx !== -1) next.splice(idx, 1);
                return next;
              }

              if (idx === -1) {
                const optimisticIdx = findOptimisticMatchIndex(row);
                if (optimisticIdx !== -1) {
                  next[optimisticIdx] = row;
                  return next;
                }

                next.unshift(row);
                return next;
              }

              next[idx] = row;
              return next;
            }

            if (eventType === "DELETE") {
              const idToRemove = oldRow?.id;
              return typeof idToRemove === "number" ? next.filter((e) => e.id !== idToRemove) : prev;
            }

            return prev;
          });

          // Keep details pane in sync (also replace optimistic selection)
          if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
            const isSameSelected = selectedEmail?.id === newRow.id;
            const isOptimisticSelectedMatch =
              !!selectedEmail &&
              selectedEmail.id < 0 &&
              selectedEmail.agent_type === newRow.agent_type &&
              selectedEmail.email_content === newRow.email_content;

            if (isSameSelected || isOptimisticSelectedMatch) {
              setSelectedEmail(newRow);
            }
          }

          if (eventType === "DELETE" && oldRow?.id && selectedEmail?.id === oldRow.id) {
            setSelectedEmail(null);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEmail?.id, selectedEmail?.agent_type, selectedEmail?.email_content, filterAgentType]);

  async function fetchManualEmails(options: { showLoading?: boolean } = {}) {
    const shouldShowLoading = options.showLoading ?? emails.length === 0;
    if (shouldShowLoading) setLoading(true);

    let query = supabase.from("manual_emails").select("*").order("created_at", { ascending: false });

    if (filterAgentType !== "all") {
      query = query.eq("agent_type", filterAgentType);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const serverRows = (data as ManualEmail[]) || [];
      setEmails((prev) => {
        const optimistic = prev.filter(
          (e) => e.id < 0 && (filterAgentType === "all" || e.agent_type === filterAgentType),
        );

        // If the server already has the row, replace the optimistic placeholder (prevents "2 emails")
        const resolvedOptimistic = optimistic.map((o) => {
          const match = serverRows.find(
            (row) => row.agent_type === o.agent_type && row.email_content === o.email_content,
          );
          return match ?? o;
        });

        const resolvedIds = new Set(resolvedOptimistic.filter((e) => e.id > 0).map((e) => e.id));
        const remainingServer = serverRows.filter((row) => !resolvedIds.has(row.id));

        const combined = [...resolvedOptimistic, ...remainingServer];
        return dedupeCloseDuplicates(combined);
      });
    }

    if (shouldShowLoading) setLoading(false);
  }

  async function handleManualSubmit() {
    if (manualSending || submitLockRef.current) return;

    if (!manualAgentType) {
      toast({ title: "Error", description: "Please select an agent type first", variant: "destructive" });
      return;
    }

    if (!manualEmailContent.trim()) {
      toast({ title: "Error", description: "Please paste an email message", variant: "destructive" });
      return;
    }

    // hard lock (prevents double click / double submit before React disables the button)
    submitLockRef.current = true;

    // Snapshot current inputs so we can clear the form without losing what we sent
    const originalEmailContent = manualEmailContent;
    const originalAgentType = manualAgentType;
    const originalSubject = manualSubject.trim();

    // Optimistic placeholder so it shows immediately in history (no disappearing / no flicker)
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
      subject: originalSubject || "Wachten op Supabase…",
      body: null,
      pda_link_1: null,
      pda_link_2: null,
      company_name: null,
      contact_name: null,
      pdf_path: null,
    };

    // Make sure the user can see the new record even if a filter was active
    if (filterAgentType !== "all" && filterAgentType !== originalAgentType) {
      setFilterAgentType("all");
    }

    setEmails((prev) => [optimisticEmail, ...prev]);
    setSelectedEmail(optimisticEmail);
    setActiveTab("history");
    setManualSending(true);

    try {
      // n8n is responsible for inserting/updating Supabase.
      // We only send the original email (email_content) + optional PDF.
      const formData = new FormData();
      formData.append("email_content", originalEmailContent);
      formData.append("agent_type", originalAgentType);
      if (originalSubject) formData.append("subject", originalSubject);
      if (manualPdfFile) formData.append("pdf", manualPdfFile);

      const response = await fetch("https://lbhcuracao.app.n8n.cloud/webhook/MANUAL-EMAIL-CREATION", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Webhook request failed");
      }

      toast({
        title: "Email Submitted",
        description: "Wachten tot AI klaar is in Supabase…",
      });

      // Poll Supabase until n8n has created the record with subject/body filled in
      const pollForResult = async () => {
        const pollInterval = 2000; // 2 seconds between polls
        const maxPolls = 150; // Max ~5 minutes of polling
        let pollCount = 0;

        const tryFindEmail = async (): Promise<ManualEmail | null> => {
          // Find the most recent email matching our content (n8n creates the row)
          const { data } = await supabase
            .from("manual_emails")
            .select("*")
            .eq("agent_type", originalAgentType)
            .order("created_at", { ascending: false })
            .limit(10);

          if (!data || data.length === 0) return null;

          // Find the email that matches our original content and has been processed
          const match = data.find(
            (e) =>
              e.email_content === originalEmailContent &&
              e.subject &&
              e.body &&
              e.status !== "processing"
          );

          return (match as ManualEmail) ?? null;
        };

        const reconcileWithRealRow = (real: ManualEmail) => {
          setEmails((prev) => {
            const withoutOptimistic = prev.filter((e) => e.id !== optimisticId);
            if (withoutOptimistic.some((e) => e.id === real.id)) return withoutOptimistic;
            return [real, ...withoutOptimistic];
          });
          setSelectedEmail(real);
        };

        // Update optimistic UI with polling status
        const updatePollingStatus = (message: string) => {
          setEmails((prev) =>
            prev.map((e) =>
              e.id === optimisticId
                ? { ...e, subject: message }
                : e
            )
          );
          setSelectedEmail((prev) =>
            prev?.id === optimisticId
              ? { ...prev, subject: message }
              : prev
          );
        };

        const poll = async () => {
          pollCount++;
          updatePollingStatus(`Wachten op Supabase… (${pollCount})`);

          const result = await tryFindEmail();
          if (result) {
            reconcileWithRealRow(result);
            toast({
              title: "Ready!",
              description: "AI has generated the email response.",
            });
            return;
          }

          if (pollCount >= maxPolls) {
            // Mark as error after max polls
            setEmails((prev) =>
              prev.map((e) =>
                e.id === optimisticId
                  ? {
                      ...e,
                      status: "error",
                      subject: "Timeout (geen data in Supabase)",
                      body: "Na 5 minuten is er nog geen verwerkt record gevonden in Supabase. Controleer of de AI workflow correct draait.",
                    }
                  : e
              )
            );
            setSelectedEmail((prev) =>
              prev?.id === optimisticId
                ? {
                    ...prev,
                    status: "error",
                    subject: "Timeout (geen data in Supabase)",
                    body: "Na 5 minuten is er nog geen verwerkt record gevonden in Supabase. Controleer of de AI workflow correct draait.",
                  }
                : prev
            );
            toast({
              title: "Timeout",
              description: "Na 5 minuten geen verwerkt record gevonden in Supabase.",
              variant: "destructive",
            });
            return;
          }

          // Continue polling
          setTimeout(poll, pollInterval);
        };

        // Start polling
        poll();
      };

      pollForResult();

      setManualEmailContent("");
      setManualSubject("");
      setManualPdfFile(null);
      const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      // Remove optimistic placeholder if submission failed
      setEmails((prev) => prev.filter((e) => e.id !== optimisticId));
      setSelectedEmail((prev) => (prev?.id === optimisticId ? null : prev));

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process email",
        variant: "destructive",
      });
    } finally {
      submitLockRef.current = false;
      setManualSending(false);
    }
  }

  async function handleViewPdf(pdfPath: string) {
    const { data, error } = await supabase.storage.from("pdfs").createSignedUrl(pdfPath, 3600); // 1 hour expiry

    if (error) {
      toast({ title: "Error", description: "Could not load PDF", variant: "destructive" });
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  function openDeleteDialog(emailId: number, pdfPath: string | null) {
    setEmailToDelete({ id: emailId, pdfPath });
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteEmail() {
    if (!emailToDelete) return;

    // Optimistic placeholder (not yet inserted in DB) → just remove locally
    if (emailToDelete.id < 0) {
      setEmails((prev) => prev.filter((e) => e.id !== emailToDelete.id));
      setSelectedEmail(null);
      toast({ title: "Verwijderd", description: "Concept email is verwijderd" });
      setDeleteDialogOpen(false);
      setEmailToDelete(null);
      return;
    }

    try {
      // Delete PDF from storage if exists
      if (emailToDelete.pdfPath) {
        await supabase.storage.from("pdfs").remove([emailToDelete.pdfPath]);
      }

      // Delete from database
      const { error } = await supabase.from("manual_emails").delete().eq("id", emailToDelete.id);

      if (error) throw error;

      // Immediately remove from UI (then refresh)
      setEmails((prev) => prev.filter((e) => e.id !== emailToDelete.id));
      setSelectedEmail(null);

      toast({ title: "Verwijderd", description: "Email is succesvol verwijderd" });
      await fetchManualEmails({ showLoading: false });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete email",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setEmailToDelete(null);
    }
  }

  async function handleRetryEmail() {
    if (!selectedEmail || retrying) return;

    setRetrying(true);

    // Update local state to processing
    const updateToProcessing = (email: ManualEmail) => ({
      ...email,
      status: "processing",
      subject: "AI is thinking…",
      body: null,
    });

    setEmails((prev) =>
      prev.map((e) => (e.id === selectedEmail.id ? updateToProcessing(e) : e))
    );
    setSelectedEmail(updateToProcessing(selectedEmail));

    try {
      const formData = new FormData();
      formData.append("email_content", selectedEmail.email_content);
      formData.append("agent_type", selectedEmail.agent_type);
      if (selectedEmail.id > 0) {
        formData.append("email_id", String(selectedEmail.id));
      }

      const response = await fetch("https://lbhcuracao.app.n8n.cloud/webhook/MANUAL-EMAIL-CREATION", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Webhook request failed");
      }

      let webhookData: {
        subject?: string;
        body?: string;
        email_id?: number;
        data?: { email_id?: number; subject?: string; body?: string; vessel_name?: string };
      } | null = null;

      try {
        webhookData = await response.json();
      } catch {
        // ignore parse errors
      }

      const respSubject = webhookData?.data?.subject ?? webhookData?.subject;
      const respBody = webhookData?.data?.body ?? webhookData?.body;
      const respVesselName = webhookData?.data?.vessel_name;

      if (respSubject || respBody) {
        const updateWithResponse = (email: ManualEmail) => ({
          ...email,
          subject: respSubject ?? email.subject,
          body: respBody ?? email.body,
          vessel_name: respVesselName ?? email.vessel_name,
          status: "draft",
        });

        setEmails((prev) =>
          prev.map((e) => (e.id === selectedEmail.id ? updateWithResponse(e) : e))
        );
        setSelectedEmail((prev) => (prev?.id === selectedEmail.id ? updateWithResponse(prev) : prev));
      }

      toast({
        title: "Opnieuw verzonden",
        description: "Email is opnieuw naar AI gestuurd.",
      });

      // Refresh from DB after a short delay
      setTimeout(() => fetchManualEmails({ showLoading: false }), 2000);
    } catch (error) {
      // Revert to error state
      setEmails((prev) =>
        prev.map((e) =>
          e.id === selectedEmail.id ? { ...e, status: "error" } : e
        )
      );
      setSelectedEmail((prev) =>
        prev?.id === selectedEmail.id ? { ...prev, status: "error" } : prev
      );

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to retry email",
        variant: "destructive",
      });
    } finally {
      setRetrying(false);
    }
  }

  const getStatusBadge = (status: string | null) => {
    const styles: Record<string, string> = {
      processing: "bg-primary/10 text-primary",
      completed: "bg-success/10 text-success",
      draft: "bg-muted text-muted-foreground",
      error: "bg-destructive/10 text-destructive",
    };
    return styles[status || "processing"] || "bg-muted text-muted-foreground";
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "processing":
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-3 h-3" />;
      case "error":
        return <XCircle className="w-3 h-3" />;
      case "draft":
      default:
        return <Mail className="w-3 h-3" />;
    }
  };

  return (
    <DashboardLayout title="Manual Emails">
      <div className="mb-4">
        <Link to="/inquiries">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to AI Inquiries
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="create" className="flex items-center gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />
            Create New
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Email History
          </TabsTrigger>
        </TabsList>

        {/* Create New Email Tab */}
        <TabsContent value="create" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manual Creation Form */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary" />
                  Manual Email Creation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agent Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="agent-type">Agent Type <span className="text-destructive">*</span></Label>
                  <Select
                    value={manualAgentType}
                    onValueChange={(value: "OWNERS_AGENT" | "CARGO_AGENT") => setManualAgentType(value)}
                  >
                    <SelectTrigger id="agent-type" className={!manualAgentType ? "border-destructive/50" : ""}>
                      <SelectValue placeholder="Select agent type first..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CARGO_AGENT">Cargo Agent</SelectItem>
                      <SelectItem value="OWNERS_AGENT">Owners Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  {!manualAgentType && (
                    <p className="text-xs text-muted-foreground">Please select an agent type before sending</p>
                  )}
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="email-subject">Subject (Optional)</Label>
                  <input
                    id="email-subject"
                    type="text"
                    placeholder="Enter email subject..."
                    value={manualSubject}
                    onChange={(e) => setManualSubject(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Email Content */}
                <div className="space-y-2">
                  <Label htmlFor="email-content">Email Content</Label>
                  <Textarea
                    id="email-content"
                    placeholder="Paste email content here..."
                    value={manualEmailContent}
                    onChange={(e) => setManualEmailContent(e.target.value)}
                    className="min-h-[300px] font-sans text-sm leading-relaxed"
                  />
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label htmlFor="manual-pdf-input">PDF Attachment (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer flex-1">
                      <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {manualPdfFile ? manualPdfFile.name : "Click to upload PDF"}
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
                            setManualPdfFile(file);
                          } else if (file) {
                            toast({
                              title: "Error",
                              description: "Only PDF files are allowed",
                              variant: "destructive",
                            });
                          }
                        }}
                      />
                    </label>
                    {manualPdfFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setManualPdfFile(null);
                          const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
                          if (fileInput) fileInput.value = "";
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  className="w-full"
                  onClick={handleManualSubmit}
                  disabled={manualSending || !manualEmailContent.trim() || !manualAgentType}
                >
                  {manualSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send to AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview / Instructions */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <h4 className="font-medium">How to use Manual Email Creation:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Select the agent type (Cargo Agent or Owners Agent)</li>
                    <li>Copy and paste the email content into the text area</li>
                    <li>Optionally attach a PDF document</li>
                    <li>Click "Send to AI" to process the email</li>
                  </ol>
                </div>

                {manualEmailContent && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="p-4 bg-muted/50 rounded-lg border max-h-[300px] overflow-auto">
                      <p className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{manualEmailContent}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email History Tab */}
        <TabsContent value="history" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Email List */}
            <Card className="card-premium lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Emails ({emails.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => fetchManualEmails({ showLoading: false })}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <div className="pt-2">
                  <Select value={filterAgentType} onValueChange={setFilterAgentType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="CARGO_AGENT">Cargo Agent</SelectItem>
                      <SelectItem value="OWNERS_AGENT">Owners Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-340px)]">
                  {loading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : emails.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No manual emails found</div>
                  ) : (
                    <div className="divide-y">
                      {emails.map((email) => (
                        <div
                          key={email.id}
                          onClick={() => setSelectedEmail(email)}
                          className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedEmail?.id === email.id ? "bg-primary/5 border-l-2 border-primary" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium line-clamp-1">{email.vessel_name || "TBN"}</p>
                            {email.status === "processing" ? (
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                            ) : (
                              <Badge className={`${getStatusBadge(email.status)} text-xs shrink-0`} variant="secondary">
                                {getStatusIcon(email.status)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {email.agent_type === "OWNERS_AGENT" ? "Owners" : "Cargo"}
                            </Badge>
                            {email.port && <span className="text-xs text-muted-foreground">{email.port}</span>}
                          </div>
                          {email.subject && email.subject !== "AI is thinking…" && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 italic">{email.subject}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {email.created_at ? new Date(email.created_at).toLocaleString("nl-NL") : "Unknown date"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="card-premium lg:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Email Details</CardTitle>
                {selectedEmail && (
                  <div className="flex items-center gap-2">
                    {selectedEmail.status === "error" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetryEmail}
                        disabled={retrying}
                        className="gap-1.5"
                      >
                        {retrying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Opnieuw proberen
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => openDeleteDialog(selectedEmail.id, selectedEmail.pdf_path)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {selectedEmail ? (
                  <div className="space-y-4">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Agent Type</Label>
                        <p className="text-sm font-medium">
                          {selectedEmail.agent_type === "OWNERS_AGENT" ? "Owners Agent" : "Cargo Agent"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge className={getStatusBadge(selectedEmail.status)}>
                          {selectedEmail.status || "processing"}
                        </Badge>
                      </div>
                      {selectedEmail.vessel_name && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Vessel</Label>
                          <p className="text-sm font-medium flex items-center gap-1">
                            <Ship className="w-3 h-3" />
                            {selectedEmail.vessel_name}
                          </p>
                        </div>
                      )}
                      {selectedEmail.imo && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">IMO</Label>
                          <p className="text-sm">{selectedEmail.imo}</p>
                        </div>
                      )}
                      {selectedEmail.port && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Port</Label>
                          <p className="text-sm">{selectedEmail.port}</p>
                        </div>
                      )}
                      {selectedEmail.company_name && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Company</Label>
                          <p className="text-sm">{selectedEmail.company_name}</p>
                        </div>
                      )}
                    </div>

                    {/* PDA Links and PDF */}
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.pda_link_1 && (
                        <a href={selectedEmail.pda_link_1} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1">
                            <ExternalLink className="w-3 h-3" />
                            PDA Link 1
                          </Button>
                        </a>
                      )}
                      {selectedEmail.pda_link_2 && (
                        <a href={selectedEmail.pda_link_2} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="gap-1">
                            <ExternalLink className="w-3 h-3" />
                            PDA Link 2
                          </Button>
                        </a>
                      )}
                      {selectedEmail.pdf_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleViewPdf(selectedEmail.pdf_path!)}
                        >
                          <FileText className="w-3 h-3" />
                          View Uploaded PDF
                        </Button>
                      )}
                    </div>

                    {/* AI Generated Response */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-2">
                          AI Generated Email
                          {selectedEmail.status === "processing" && (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          )}
                        </Label>
                        {selectedEmail.body && selectedEmail.status !== "processing" && (
                          <Button variant="ghost" size="sm" onClick={handleCopyEmail} className="h-7 gap-1.5 text-xs">
                            {copied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-500" />
                                Gekopieerd
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Kopieer
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {selectedEmail.status === "processing" ? (
                        <div className="border rounded-lg bg-muted/20 p-4">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <p className="text-sm">AI is generating your email response...</p>
                          </div>
                        </div>
                      ) : selectedEmail.body ? (
                        <div className="border rounded-lg overflow-hidden">
                          {selectedEmail.subject && (
                            <div className="px-4 py-3 bg-primary/5 border-b">
                              <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                              <p className="text-sm font-medium">{selectedEmail.subject}</p>
                            </div>
                          )}
                          <ScrollArea className="h-[180px]">
                            <pre className="p-4 text-sm whitespace-pre-wrap font-sans bg-muted/30">
                              {selectedEmail.body}
                            </pre>
                          </ScrollArea>
                        </div>
                      ) : (
                        <div className="border rounded-lg bg-muted/20 p-4 text-center text-muted-foreground text-sm">
                          No AI response yet
                        </div>
                      )}
                    </div>

                    {/* Original Email Content */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Original Email</Label>
                      <ScrollArea className="h-[150px] border rounded-lg">
                        <pre className="p-4 text-sm whitespace-pre-wrap font-sans">{selectedEmail.email_content}</pre>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    Select an email to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet u het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. De email en bijbehorende PDF worden permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEmail}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
