/**
 * Centralized webhook client.
 *
 * IMPORTANT: the frontend NEVER talks to n8n directly and NEVER holds the n8n
 * Basic Auth credentials. All webhook calls are routed through the
 * `n8n-webhook` Supabase Edge Function, which:
 *   - requires a valid logged-in Supabase user,
 *   - maps a webhook KEY to the real n8n URL (server-side allowlist),
 *   - adds the Basic Auth header from server-side secrets.
 *
 * To add a new webhook: add the KEY here AND in the edge function's
 * WEBHOOK_PATHS map (supabase/functions/n8n-webhook/index.ts).
 */
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://oxkshjaombffbdemqrqb.supabase.co";
// New-format publishable key (legacy anon JWT was disabled platform-wide 2026-04-20).
const SUPABASE_ANON_KEY = "sb_publishable_KJox5swPIcwq6PyTfDpAuQ_pyWGtqga";

const PROXY_URL = `${SUPABASE_URL}/functions/v1/n8n-webhook`;

// ─── Webhook keys (must match the edge function allowlist) ───────────────────
export const WEBHOOKS = {
  /** FDA Curaçao – invoice upload */
  FDA_CURACAO_INVOICE_UPLOAD: "FDA_CURACAO_INVOICE_UPLOAD",
  /** FDA (Bonaire) – invoice upload */
  FDA_INVOICE_UPLOAD: "FDA_INVOICE_UPLOAD",
  /** FDA – Merge PDF (Front Page step) */
  FDA_MERGE_PDF: "FDA_MERGE_PDF",
  /** FDA Curaçao – Send to Uruguay */
  SEND_TO_URUGUAY: "SEND_TO_URUGUAY",
  /** FDA – Send FDA Email */
  SEND_FDA_EMAIL: "SEND_FDA_EMAIL",
  /** AI Inquiries – Loading / Discharge email */
  SEND_EMAIL_LOADING_DISCHARGE: "SEND_EMAIL_LOADING_DISCHARGE",
  /** AI Inquiries – Owners Agent email */
  SEND_EMAIL_OWNERS_AGENT: "SEND_EMAIL_OWNERS_AGENT",
  /** AI Inquiries – Referral (Out of Scope) email */
  SEND_REFERRAL_EMAIL: "SEND_REFERRAL_EMAIL",
  /** Manual Email – creation / PDA */
  MANUAL_EMAIL_CREATION: "MANUAL_EMAIL_CREATION",
} as const;

export type WebhookKey = (typeof WEBHOOKS)[keyof typeof WEBHOOKS];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Auth headers carrying the current user's session (falls back to anon). */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? SUPABASE_ANON_KEY;
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

function proxyUrl(key: string): string {
  return `${PROXY_URL}?key=${encodeURIComponent(key)}`;
}

/**
 * POST JSON to a webhook (via the edge-function proxy).
 * Returns the raw Response so callers can inspect status / body.
 */
export async function webhookPostJSON(
  key: string,
  payload: unknown,
  opts?: { signal?: AbortSignal },
): Promise<Response> {
  const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
  return fetch(proxyUrl(key), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: opts?.signal,
  });
}

/**
 * POST FormData to a webhook (via the edge-function proxy).
 * Content-Type is set automatically by the browser (multipart boundary).
 */
export async function webhookPostFormData(
  key: string,
  formData: FormData,
  opts?: { signal?: AbortSignal },
): Promise<Response> {
  const headers = await authHeaders();
  return fetch(proxyUrl(key), {
    method: "POST",
    headers,
    body: formData,
    signal: opts?.signal,
  });
}
