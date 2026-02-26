/**
 * Centralized webhook configuration with Basic Auth.
 *
 * All n8n webhooks are routed through this module so that
 * URLs and authentication are defined in a single place.
 */

const WEBHOOK_BASE = "https://lbhcuracao.app.n8n.cloud/webhook";

const BASIC_AUTH_USER = "lbh-webhook-2026";
const BASIC_AUTH_PASS = "L@bh_W3bh00k_C!2026";
const BASIC_AUTH_HEADER = `Basic ${btoa(`${BASIC_AUTH_USER}:${BASIC_AUTH_PASS}`)}`;

// ─── Webhook URLs ────────────────────────────────────────────────────────────

export const WEBHOOKS = {
  /** FDA Curaçao – invoice upload */
  FDA_CURACAO_INVOICE_UPLOAD: `${WEBHOOK_BASE}/invoice-upload-curacao`,

  /** FDA (Bonaire) – invoice upload */
  FDA_INVOICE_UPLOAD: `${WEBHOOK_BASE}/invoice-upload`,

  /** FDA – Merge PDF (Front Page step) */
  FDA_MERGE_PDF: `${WEBHOOK_BASE}/9f21d8c2-3d6e-4cd9-bfb3-a5dd29aa125a`,

  /** FDA Curaçao – Send to Uruguay */
  SEND_TO_URUGUAY: `${WEBHOOK_BASE}/send-to-uruguay`,

  /** FDA – Send FDA Email */
  SEND_FDA_EMAIL: `${WEBHOOK_BASE}/bd83b476-e7a1-49d6-891f-c4fe214ed915`,

  /** AI Inquiries – Loading / Discharge email */
  SEND_EMAIL_LOADING_DISCHARGE: `${WEBHOOK_BASE}/Send-Email-Loading-Discharge`,

  /** AI Inquiries – Owners Agent email */
  SEND_EMAIL_OWNERS_AGENT: `${WEBHOOK_BASE}/Send-Email-Owners-Agent`,

  /** AI Inquiries – Referral (Out of Scope) email */
  SEND_REFERRAL_EMAIL: `${WEBHOOK_BASE}/SEND-REFERRAL-EMAIL`,

  /** Manual Email – creation / PDA */
  MANUAL_EMAIL_CREATION: "https://lbhcuracao.app.n8n.cloud/webhook/MANUAL-EMAIL-CREATION",
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Default headers used for JSON webhook calls. */
function jsonHeaders(): Record<string, string> {
  return {
    Authorization: BASIC_AUTH_HEADER,
    "Content-Type": "application/json",
  };
}

/** Headers for FormData calls (no Content-Type – browser sets boundary). */
function formDataHeaders(): Record<string, string> {
  return {
    Authorization: BASIC_AUTH_HEADER,
  };
}

/**
 * POST JSON to a webhook with Basic Auth.
 * Returns the raw Response so callers can inspect status / body.
 */
export async function webhookPostJSON(
  url: string,
  payload: unknown,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
}

/**
 * POST FormData to a webhook with Basic Auth.
 * Content-Type is set automatically by the browser.
 */
export async function webhookPostFormData(
  url: string,
  formData: FormData,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: formDataHeaders(),
    body: formData,
  });
}
