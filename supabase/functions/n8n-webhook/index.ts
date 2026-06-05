import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { reportError } from "../_shared/tados.ts";

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Webhook allowlist ───────────────────────────────────────────────────────
// The frontend only sends a KEY; the actual n8n path lives here, server-side.
// This is the single source of truth for which n8n webhooks the app may call.
const WEBHOOK_BASE = "https://lbhcuracao.app.n8n.cloud/webhook";

const WEBHOOK_PATHS: Record<string, string> = {
  FDA_CURACAO_INVOICE_UPLOAD: "invoice-upload-curacao",
  FDA_INVOICE_UPLOAD: "invoice-upload",
  FDA_MERGE_PDF: "9f21d8c2-3d6e-4cd9-bfb3-a5dd29aa125a",
  SEND_TO_URUGUAY: "send-to-uruguay",
  SEND_FDA_EMAIL: "bd83b476-e7a1-49d6-891f-c4fe214ed915",
  SEND_EMAIL_LOADING_DISCHARGE: "Send-Email-Loading-Discharge",
  SEND_EMAIL_OWNERS_AGENT: "Send-Email-Owners-Agent",
  SEND_REFERRAL_EMAIL: "SEND-REFERRAL-EMAIL",
  MANUAL_EMAIL_CREATION: "MANUAL-EMAIL-CREATION",
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── 1. Require a valid Supabase user (auth-gated) ──
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return json({ error: "Invalid token" }, 401);
  }

  // ── 2. Resolve target webhook from the allowlist ──
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-webhook-key") || "";
  const path = WEBHOOK_PATHS[key];
  if (!path) return json({ error: `Unknown webhook key: ${key}` }, 400);

  // ── 3. Basic Auth credentials (server-side only) ──
  const user = Deno.env.get("N8N_BASIC_AUTH_USER");
  const pass = Deno.env.get("N8N_BASIC_AUTH_PASSWORD");
  if (!user || !pass) {
    console.error("N8N_BASIC_AUTH credentials not configured");
    return json({ error: "Server configuration error" }, 500);
  }
  const basicAuth = `Basic ${btoa(`${user}:${pass}`)}`;

  // ── 4. Forward the request body transparently to n8n ──
  const contentType = req.headers.get("content-type") || "";
  const body = await req.arrayBuffer();

  const fwdHeaders: Record<string, string> = { Authorization: basicAuth };
  if (contentType) fwdHeaders["Content-Type"] = contentType;

  try {
    const upstream = await fetch(`${WEBHOOK_BASE}/${path}`, {
      method: "POST",
      headers: fwdHeaders,
      body,
    });

    // Return the upstream response transparently so callers keep the same
    // semantics as the old direct-fetch (.ok / .status / .json() / .text()).
    const respBody = await upstream.arrayBuffer();
    const respHeaders: Record<string, string> = { ...corsHeaders };
    const ct = upstream.headers.get("content-type");
    if (ct) respHeaders["Content-Type"] = ct;

    return new Response(respBody, { status: upstream.status, headers: respHeaders });
  } catch (error) {
    console.error("[n8n-webhook] proxy error:", error);
    await reportError("n8n-webhook", error);
    return json(
      { error: error instanceof Error ? error.message : "proxy_error" },
      502,
    );
  }
});
