import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ManualEmail {
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
  vessel_2_name: string | null;
  vessel_2_imo: string | null;
}

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

export function useManualEmails(filterAgentType: string) {
  const [emails, setEmails] = useState<ManualEmail[]>([]);
  const emailsRef = useRef<ManualEmail[]>([]);
  emailsRef.current = emails;
  const [selectedEmail, setSelectedEmail] = useState<ManualEmail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManualEmails();
  }, [filterAgentType]);

  // Auto-refresh polling for processing emails
  useEffect(() => {
    if (selectedEmail?.status !== "processing") return;

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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("manual_emails_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "manual_emails" },
        (payload) => {
          const eventType = payload.eventType;
          const newRow = payload.new as ManualEmail | undefined;
          const oldRow = payload.old as { id?: number } | undefined;

          setEmails((prev) => {
            const matchesFilter = (agentType?: string | null) =>
              filterAgentType === "all" || agentType === filterAgentType;

            if (eventType === "INSERT" && newRow) {
              if (!matchesFilter(newRow.agent_type)) return prev;
              if (prev.some((e) => e.id === newRow.id)) return prev;
              return [newRow, ...prev];
            }

            if (eventType === "UPDATE" && newRow) {
              const idx = prev.findIndex((e) => e.id === newRow.id);
              if (!matchesFilter(newRow.agent_type)) {
                if (idx !== -1) {
                  const next = [...prev];
                  next.splice(idx, 1);
                  return next;
                }
                return prev;
              }
              if (idx === -1) return [newRow, ...prev];
              const next = [...prev];
              next[idx] = newRow;
              return next;
            }

            if (eventType === "DELETE") {
              const idToRemove = oldRow?.id;
              return typeof idToRemove === "number" ? prev.filter((e) => e.id !== idToRemove) : prev;
            }
            return prev;
          });

          if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
            if (selectedEmail?.id === newRow.id) {
              setSelectedEmail(newRow);
            }

            // Show success toast when status transitions from processing to completed
            if (eventType === "UPDATE" && newRow.status && newRow.status !== "processing") {
              const prevInList = emailsRef.current.find((e) => e.id === newRow.id);
              if (prevInList?.status === "processing") {
                toast({ title: "Email gegenereerd!" });
              }
            }
          }

          if (eventType === "DELETE" && oldRow?.id && selectedEmail?.id === oldRow.id) {
            setSelectedEmail(null);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedEmail?.id, filterAgentType]);

  async function fetchManualEmails(options: { showLoading?: boolean } = {}) {
    const shouldShowLoading = options.showLoading ?? emails.length === 0;
    if (shouldShowLoading) setLoading(true);

    let query = supabase.from("manual_emails").select("*").order("created_at", { ascending: false });
    if (filterAgentType !== "all") query = query.eq("agent_type", filterAgentType);

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const serverRows = (data as ManualEmail[]) || [];
      setEmails(serverRows);

      setSelectedEmail((prev) => {
        if (!prev) return prev;
        return serverRows.find((row) => row.id === prev.id) ?? prev;
      });
    }
    if (shouldShowLoading) setLoading(false);
  }

  return {
    emails,
    setEmails,
    selectedEmail,
    setSelectedEmail,
    loading,
    fetchManualEmails,
    filterAgentType,
  };
}
