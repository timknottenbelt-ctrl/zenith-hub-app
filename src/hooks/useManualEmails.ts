import { useState, useEffect, useRef, useMemo } from "react";
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

const normalizeForKey = (value: string) => value.trim().replace(/\s+/g, " ");

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

const isCloseDuplicate = (a: ManualEmail, b: ManualEmail) => {
  if (a.id < 0 || b.id < 0) return false;
  if (a.agent_type !== b.agent_type) return false;
  if ((a.subject || "").trim() !== (b.subject || "").trim()) return false;
  if (normalizeForKey(a.email_content) !== normalizeForKey(b.email_content)) return false;
  const ta = a.created_at ? Date.parse(a.created_at) : NaN;
  const tb = b.created_at ? Date.parse(b.created_at) : NaN;
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(ta - tb) <= 2 * 60 * 1000;
};

const dedupeCloseDuplicates = (rows: ManualEmail[]) => {
  const out: ManualEmail[] = [];
  for (const row of rows) {
    if (!out.some((existing) => isCloseDuplicate(existing, row))) {
      out.push(row);
    }
  }
  return out;
};

export function useManualEmails(filterAgentType: string) {
  const [emails, setEmails] = useState<ManualEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<ManualEmail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManualEmails();
  }, [filterAgentType]);

  // Auto-refresh polling for processing emails
  useEffect(() => {
    if (selectedEmail?.status !== "processing") return;
    if (selectedEmail.id < 0) return;

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
            const next = [...prev];
            const matchesFilter = (agentType?: string | null) =>
              filterAgentType === "all" || agentType === filterAgentType;
            const findOptimisticMatchIndex = (row: ManualEmail) =>
              next.findIndex(
                (e) =>
                  e.id < 0 &&
                  e.agent_type === row.agent_type &&
                  normalizeForKey(e.email_content) === normalizeForKey(row.email_content),
              );

            if (eventType === "INSERT" && newRow) {
              if (!matchesFilter(newRow.agent_type)) return prev;
              if (next.find((e) => isCloseDuplicate(e, newRow))) return prev;
              const optimisticIdx = findOptimisticMatchIndex(newRow);
              if (optimisticIdx !== -1) { next[optimisticIdx] = newRow; return next; }
              if (next.some((e) => e.id === newRow.id)) return prev;
              next.unshift(newRow);
              return next;
            }

            if (eventType === "UPDATE" && newRow) {
              const idx = next.findIndex((e) => e.id === newRow.id);
              if (!matchesFilter(newRow.agent_type)) {
                if (idx !== -1) next.splice(idx, 1);
                return next;
              }
              if (idx === -1) {
                const optimisticIdx = findOptimisticMatchIndex(newRow);
                if (optimisticIdx !== -1) { next[optimisticIdx] = newRow; return next; }
                next.unshift(newRow);
                return next;
              }
              next[idx] = newRow;
              return next;
            }

            if (eventType === "DELETE") {
              const idToRemove = oldRow?.id;
              return typeof idToRemove === "number" ? next.filter((e) => e.id !== idToRemove) : prev;
            }
            return prev;
          });

          if ((eventType === "INSERT" || eventType === "UPDATE") && newRow) {
            const isSameSelected = selectedEmail?.id === newRow.id;
            const isOptimisticMatch =
              !!selectedEmail &&
              selectedEmail.id < 0 &&
              selectedEmail.agent_type === newRow.agent_type &&
              normalizeForKey(selectedEmail.email_content) === normalizeForKey(newRow.email_content);
            if (isSameSelected || isOptimisticMatch) setSelectedEmail(newRow);
          }

          if (eventType === "DELETE" && oldRow?.id && selectedEmail?.id === oldRow.id) {
            setSelectedEmail(null);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedEmail?.id, selectedEmail?.agent_type, selectedEmail?.email_content, filterAgentType]);

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
      setEmails((prev) => {
        const optimistic = prev.filter(
          (e) => e.id < 0 && (filterAgentType === "all" || e.agent_type === filterAgentType),
        );
        const resolvedOptimistic = optimistic.map((o) => {
          const match = serverRows.find(
            (row) => row.agent_type === o.agent_type && row.email_content === o.email_content,
          );
          return match ?? o;
        });
        const resolvedIds = new Set(resolvedOptimistic.filter((e) => e.id > 0).map((e) => e.id));
        const remainingServer = serverRows.filter((row) => !resolvedIds.has(row.id));
        return dedupeCloseDuplicates([...resolvedOptimistic, ...remainingServer]);
      });

      setSelectedEmail((prev) => {
        if (!prev) return prev;
        if (prev.id < 0) {
          const realRow = serverRows.find(
            (row) => row.agent_type === prev.agent_type &&
              normalizeForKey(row.email_content) === normalizeForKey(prev.email_content)
          );
          return realRow ?? prev;
        }
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
