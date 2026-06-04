// Shared auth helper: verify the caller carries a valid Supabase JWT.
// Used to gate edge functions so only logged-in users / service-role can call them.
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

export interface AuthResult {
  ok: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { ok: false, status: 401, error: "Unauthorized" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await client.auth.getClaims(token);
  const userId = data?.claims?.sub ?? null;
  if (error || !userId) return { ok: false, status: 401, error: "Invalid token" };

  return { ok: true, userId };
}
