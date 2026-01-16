import { createClient, SupabaseClient } from '@supabase/supabase-js';

// BUILD_ID forces rebuild when changed
export const BUILD_ID = '1768578800000';

// Env presence checks (boolean only, never log actual values)
export const ENV_STATUS = {
  hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
  hasKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  urlStartsWithHttps: typeof import.meta.env.VITE_SUPABASE_URL === 'string' 
    && import.meta.env.VITE_SUPABASE_URL.startsWith('https://'),
};

// Lazy-initialized client (no throw at import time)
let _supabaseClient: SupabaseClient | null = null;
let _initError: string | null = null;

/**
 * Returns the Supabase client if envs are configured, otherwise null.
 * Call this instead of importing `supabase` directly.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;
  if (_initError) return null;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !key) {
    _initError = 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY';
    return null;
  }

  if (!url.startsWith('https://')) {
    _initError = 'VITE_SUPABASE_URL must start with https://';
    return null;
  }

  try {
    _supabaseClient = createClient(url, key);
    return _supabaseClient;
  } catch (err) {
    _initError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

/**
 * Returns the initialization error if client creation failed.
 */
export function getSupabaseInitError(): string | null {
  // Trigger init if not done yet
  getSupabaseClient();
  return _initError;
}

/**
 * Quick connectivity test: SELECT 1
 * Returns { ok: true } or { ok: false, error: string, code?: string }
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: getSupabaseInitError() || 'Client not initialized' };
  }

  try {
    const { data, error } = await client.rpc('', {}).maybeSingle();
    // rpc with empty name will fail, so let's use a raw query instead
    const result = await client.from('_dummy_ping_').select('1').limit(1);
    
    // We expect a 404 or similar because table doesn't exist, but connection works
    // If we get a network error or auth error, that's the real issue
    if (result.error) {
      // PGRST116 = table not found (expected, connection works)
      // 42P01 = relation does not exist (expected, connection works)
      const code = result.error.code || '';
      if (code === 'PGRST116' || code === '42P01' || result.error.message?.includes('does not exist')) {
        return { ok: true }; // Connection works, table just doesn't exist
      }
      return { ok: false, error: result.error.message, code };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Legacy export for compatibility (will be null if not configured)
export const supabase = getSupabaseClient();

// Database types
export interface Email {
  id: string;
  received_at: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  category: 'CARGO_AGENT' | 'OWNERS_AGENT' | 'OUT_OF_SCOPE';
  sheet_links: string[];
  to_name: string | null;
  to_email: string | null;
  composed_subject: string | null;
  composed_message: string | null;
  status: 'new' | 'draft' | 'ready' | 'sending' | 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailAttachment {
  id: string;
  email_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface FdaProject {
  id: string;
  code: string;
  status: 'draft' | 'sent';
  lbh_number: string | null;
  ship_name: string | null;
  shipper: string | null;
  shipper_email: string | null;
  shipper_phone: string | null;
  consignee: string | null;
  consignee_email: string | null;
  consignee_phone: string | null;
  client: string | null;
  client_email: string | null;
  client_phone: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  fda_responsible: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface FdaInvoice {
  id: string;
  fda_project_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

export interface KnowledgeFile {
  id: string;
  type: 'OWNERS_AGENT_KNOWLEDGE' | 'CARGO_AGENT_KNOWLEDGE' | 'PORT_INFO' | 'TARIFFS';
  file_path: string;
  file_name: string;
  created_at: string;
}

export interface Vessel {
  id: string;
  name: string;
  imo: string | null;
  status: string | null;
  type: string | null;
  flag: string | null;
  year_built: number | null;
  loa: number | null;
  beam: number | null;
  draft: number | null;
  dwt: number | null;
  gross_tonnage: number | null;
  owner: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string | null;
  vessel_name: string | null;
  email: string | null;
  phone: string | null;
  function: string | null;
  role: 'AGENT' | 'CLIENT' | 'SERVICE_PROVIDER' | null;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  language: 'nl' | 'en' | 'es' | 'pt';
  created_at: string;
}
