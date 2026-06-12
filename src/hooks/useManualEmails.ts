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
  const selectedEmailRef = useRef<ManualEmail | null>(null);
  selectedEmailRef.current = selectedEmail;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManualEmails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Auto-refresh polling every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchManualEmails({ showLoading: false });
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAgentType]);

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
