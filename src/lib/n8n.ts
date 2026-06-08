// n8n "create draft" integration — DRAFT ONLY.
//
// SAFETY CONTRACT: this module can only ask n8n to CREATE A GMAIL DRAFT. It
// always sends `draft: true` and there is deliberately NO send function here.
// The n8n Webhook node must branch on `draft === true` to the Gmail → Create
// Draft action (never Send). A real send must be a separate, explicit,
// user-triggered action — not wired here.

const WEBHOOK_KEY = 'lbh_n8n_webhook';

// Live draft-only webhook in the LBH n8n instance (Webhook → Build → Outlook
// Create Draft → Respond). Draft-only by construction; never sends.
const DEFAULT_WEBHOOK = 'https://lbhcuracao.app.n8n.cloud/webhook/dashboard-create-draft';

export function getN8nWebhook(): string {
  try {
    return localStorage.getItem(WEBHOOK_KEY) || DEFAULT_WEBHOOK;
  } catch {
    return DEFAULT_WEBHOOK;
  }
}

export function setN8nWebhook(url: string): void {
  try {
    localStorage.setItem(WEBHOOK_KEY, url.trim());
  } catch {
    /* ignore */
  }
}

export type DocType = 'arrival_notice' | 'SOF' | 'NOR' | 'PDA' | 'FDA';

export interface DraftPayload {
  doc_type: DocType;
  port_call_id: string | null;
  dossier_key: string;
  vessel: { name: string | null; imo: string | null };
  to: string[];
  cc: string[];
  subject: string;
  body_html: string;
  attachments: { filename: string; url: string }[];
}

export interface DraftResult {
  ok: boolean;
  draft_url?: string;
  gmail_draft_id?: string;
  error?: string;
}

/**
 * Ask n8n to create a Gmail draft. ALWAYS draft-only — `draft: true` is
 * hard-coded and cannot be overridden by callers.
 */
export async function createN8nDraft(payload: DraftPayload): Promise<DraftResult> {
  const url = getN8nWebhook();
  if (!url) return { ok: false, error: 'Geen n8n webhook-URL ingesteld.' };
  if (!/^https?:\/\//.test(url)) return { ok: false, error: 'Webhook-URL is ongeldig.' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // draft:true is forced here — this call can never send an email.
      body: JSON.stringify({ ...payload, draft: true }),
    });
    if (!res.ok) return { ok: false, error: `n8n antwoordde met status ${res.status}` };
    const data = (await res.json().catch(() => ({}))) as Partial<DraftResult>;
    return { ok: true, draft_url: data.draft_url, gmail_draft_id: data.gmail_draft_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Netwerkfout' };
  }
}
