/**
 * Centralized Supabase Storage URL helpers.
 *
 * Replaces the copies of getPublicPdfUrl / parseSupabaseStorageUrl /
 * getWebhookPdfUrl / toPublicUrl / getAttachmentDownloadUrl that were
 * duplicated across FDAEmailPreview, FDACuracaoEmail and FDAEmailHistory.
 */
import { supabase } from "@/integrations/supabase/client";

export const SUPABASE_URL = "https://oxkshjaombffbdemqrqb.supabase.co";
export const STORAGE_BASE = `${SUPABASE_URL}/storage/v1`;

/** Buckets that are public — files in them can be served via a permanent public URL. */
export const PUBLIC_BUCKETS = new Set(["avatars", "fda-final-packages"]);

export function stripQuery(url: string): string {
  return url.split("?")[0];
}

export interface ParsedStorageUrl {
  bucket: string | null;
  path: string | null;
  kind: "sign" | "public" | "path" | "other";
}

/**
 * Parse a Supabase storage URL (full, relative, or "bucket/path" string)
 * into its bucket + object path.
 */
export function parseSupabaseStorageUrl(input: string): ParsedStorageUrl {
  const url = (input ?? "").trim();
  if (!url) return { bucket: null, path: null, kind: "other" };

  // https://<ref>.supabase.co/storage/v1/object/(sign|public)/<bucket>/<path>
  // /storage/v1/object/(sign|public)/<bucket>/<path>
  const m = url.match(/\/storage\/v1\/object\/(sign|public)\/([^/]+)\/(.+)$/);
  if (m) return { bucket: m[2], path: m[3], kind: m[1] as "sign" | "public" };

  // "bucket/path" strings like fda-invoices/curacao/.../file.pdf
  const cleaned = url.replace(/^\/+/, "");
  const [bucket, ...rest] = cleaned.split("/");
  if (bucket && rest.length > 0) {
    return { bucket, path: rest.join("/"), kind: "path" };
  }
  return { bucket: null, path: null, kind: "other" };
}

/**
 * Resolve a usable URL for *display / download* in the UI.
 * Keeps full + signed URLs intact; builds public URLs for known public paths.
 */
export function toDownloadUrl(url: string | null): string | null {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // Signed object path stays signed (works for private buckets too).
  if (url.startsWith("/object/sign/")) {
    return encodeURI(`${STORAGE_BASE}${url}`);
  }

  // Known public path references.
  if (
    url.includes("fda-final-packages/") ||
    url.includes("fda-curacao/") ||
    url.includes("fda-invoices/")
  ) {
    return encodeURI(`${STORAGE_BASE}/object/public/${url}`);
  }
  return url;
}

/**
 * Force a *public* URL for display: strips signing tokens and rewrites
 * sign→public. Use for files in public buckets (e.g. fda-final-packages).
 * (Was FDACuracaoEmail's getPublicPdfUrl.)
 */
export function toPublicUrl(url: string | null): string | null {
  if (!url) return null;

  if (url.includes("/object/sign/")) {
    const match = url.match(/\/object\/sign\/([^?]+)/);
    if (match) return `${STORAGE_BASE}/object/public/${match[1]}`;
  }

  if (url.includes("?token=")) {
    const urlWithoutToken = url.split("?token=")[0];
    return urlWithoutToken.replace("/object/sign/", "/object/public/");
  }

  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  if (url.startsWith("/object/sign/")) {
    const path = url.replace("/object/sign/", "");
    return `${STORAGE_BASE}/object/public/${path}`;
  }

  if (
    url.includes("fda-final-packages/") ||
    url.includes("fda-curacao/") ||
    url.includes("fda-invoices/")
  ) {
    return `${STORAGE_BASE}/object/public/${url}`;
  }
  return url;
}

/**
 * Resolve a URL suitable for handing to an external service (webhook / n8n).
 * Public buckets → permanent public URL; private buckets → fresh signed URL.
 */
export async function getWebhookPdfUrl(inputUrl: string | null): Promise<string> {
  if (!inputUrl) return "";

  // Non-Supabase URLs (e.g. OneDrive) are passed through.
  if (
    !inputUrl.includes("/storage/v1/object/") &&
    (inputUrl.startsWith("http://") || inputUrl.startsWith("https://"))
  ) {
    return inputUrl;
  }

  const parsed = parseSupabaseStorageUrl(stripQuery(inputUrl));
  if (!parsed.bucket || !parsed.path) return inputUrl;

  if (PUBLIC_BUCKETS.has(parsed.bucket)) {
    return `${STORAGE_BASE}/object/public/${parsed.bucket}/${parsed.path}`;
  }

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, 60 * 60 * 24 * 7); // 7 days

  if (error || !data?.signedUrl) return inputUrl;
  return data.signedUrl;
}
