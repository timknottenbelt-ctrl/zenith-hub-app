// Lightweight in-memory preload cache. Warmed once right after login so the
// heaviest list pages can paint instantly from cache and revalidate silently in
// the background — no visible loading spinners on first navigation.
import { supabase } from '@/integrations/supabase/client';

const store = new Map<string, unknown>();

export function preloadGet<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}
export function preloadSet(key: string, value: unknown) {
  store.set(key, value);
}

// Keep these in sync with AIInquiries.tsx (LIST_COLS / EMAIL_TYPE_MAP).
const LIST_COLS =
  'id, subject, company_name, contact_name, vessel_name, port, status, created_at, email_to_person, missing_information, "Email Type", classification_confidence';
const CARGO_TYPES = ['CARGO AGENT', 'CARGO_AGENT', 'CARGO AGENT 2', 'LOADING_DISCHARGE_AGENT', 'LOADING DISCHARGE AGENT'];

let warming = false;

/** Prefetch the data behind the landing pages. Best-effort, fire-and-forget. */
export async function warmDashboard() {
  if (warming) return;
  warming = true;
  try {
    const inquiries = (supabase.from('email').select(LIST_COLS) as any)
      .eq('archived', false)
      .not('status', 'in', '("approved","sent")')
      .in('Email Type', CARGO_TYPES)
      .neq('status', 'out_of_scope')
      .order('created_at', { ascending: false })
      .limit(300);

    const sent = (supabase.from('email').select('*') as any)
      .eq('archived', false)
      .in('status', ['approved', 'sent'])
      .order('sent_at', { ascending: false });

    const [inqR, sentR] = await Promise.all([inquiries, sent]);
    if (!inqR.error && inqR.data) preloadSet('inq:CARGO_AGENT', inqR.data);
    if (!sentR.error && sentR.data) preloadSet('sent:list', sentR.data);
  } catch {
    /* best-effort: a cold first paint is acceptable */
  } finally {
    warming = false;
  }
}
