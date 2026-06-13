// Port Call dossier model.
//
// A "port call" = one vessel arrival/operation at a Curaçao port. The agency's
// pain is that a single call generates many scattered emails (crew change,
// sludge, bunkers, cargo, status…). This module derives port-call dossiers from
// the `email` table client-side — no migration, works on live data — by
// grouping emails per vessel and splitting them into voyages on a time gap.
import { supabase } from '@/integrations/supabase/client';
import { fetchPortCallRecords } from '@/lib/portCallOps';

export interface PCEmail {
  id: number;
  subject: string | null;
  vessel_name: string | null;
  vessel_imo: string | null;
  vessel_grt: number | null;
  vessel_loa: number | null;
  vessel_dwt: number | null;
  vessel_eta: string | null;
  vessel_2_name: string | null;
  vessel_2_imo: string | null;
  port: string | null;
  terminal: string | null;
  cargo_type: string | null;
  cargo_quantity: number | null;
  company_name: string | null;
  contact_name: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
  'Email Type': string | null;
  pdf_url: string | null;
  dock_link_2: string | null;
  doc_link: string | null;
  missing_information: string | null;
}

export type PCStage = 'inquiry' | 'quoted' | 'fda';
export type PCCategory = 'cargo' | 'owners' | null;

export interface PCDocument {
  label: string;
  url: string;
  emailId: number | null;
  at: string | null;
}

export interface PortCall {
  key: string; // stable url key: slug + '__' + firstAt day
  vessel: string; // display name (most complete seen)
  slug: string; // normalized grouping key
  imo: string | null;
  grt: number | null;
  loa: number | null;
  dwt: number | null;
  eta: string | null;
  port: string | null;
  terminal: string | null;
  cargoType: string | null;
  cargoQuantity: number | null;
  company: string | null;
  emails: PCEmail[]; // ascending by created_at
  firstAt: string;
  lastAt: string;
  stage: PCStage;
  hasSent: boolean;
  hasOpen: boolean;
  hasIncomplete: boolean;
  documents: PCDocument[];
  category: PCCategory;
  // Merged from the persisted port_call record when one exists.
  nominated?: boolean;
  recordStatus?: string | null;
  nominationAmount?: number | null;
  nominationCurrency?: string | null;
}

const VOYAGE_GAP_MS = 30 * 24 * 3600 * 1000; // emails >30 days apart = new voyage

const EMAIL_COLS =
  'id, subject, vessel_name, vessel_imo, vessel_grt, vessel_loa, vessel_dwt, vessel_eta, ' +
  'vessel_2_name, vessel_2_imo, port, terminal, cargo_type, cargo_quantity, ' +
  'company_name, contact_name, status, sent_at, created_at, "Email Type", ' +
  'pdf_url, dock_link_2, doc_link, missing_information';

/** Strip common vessel prefixes and noise so "M/V Asphalt Carrier" and
 *  "MT ASPHALT CARRIER." group together. */
export function normVessel(name: string): string {
  return name
    .toUpperCase()
    .replace(/^\s*(M\/?[VTS]|S\/?[ST]|MS|MV|MT|SS|TT|FPSO|TUG|BARGE)\b[.\s-]*/, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Most-recent non-empty value across a voyage's emails (newest wins). */
function latest<T>(emails: PCEmail[], get: (e: PCEmail) => T | null | undefined): T | null {
  for (let i = emails.length - 1; i >= 0; i--) {
    const v = get(emails[i]);
    if (v !== null && v !== undefined && (v as unknown) !== '') return v as T;
  }
  return null;
}

function categoryOf(type: string | null): PCCategory {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t.includes('CARGO') || t.includes('LOADING') || t.includes('DISCHARGE')) return 'cargo';
  if (t.includes('OWNER')) return 'owners';
  return null;
}

const OPEN_STATUSES = new Set(['draft', 'rejected', 'needs_review', 'processing', 'inbound']);

function buildCall(slug: string, emails: PCEmail[], fda: Map<string, PCDocument>): PortCall {
  const firstAt = emails[0].created_at;
  const lastAt = emails[emails.length - 1].created_at;
  const vessel = latest(emails, (e) => e.vessel_name)?.trim() || slug;

  const hasSent = emails.some((e) => e.status === 'sent' || e.status === 'approved' || !!e.sent_at);
  const hasOpen = emails.some((e) => !e.status || OPEN_STATUSES.has(e.status));
  const hasIncomplete = emails.some((e) => !!e.missing_information);

  // Collect documents from the emails, newest first, de-duplicated by URL.
  const seen = new Set<string>();
  const documents: PCDocument[] = [];
  for (let i = emails.length - 1; i >= 0; i--) {
    const e = emails[i];
    const add = (url: string | null, label: string) => {
      if (url && /^https?:\/\//.test(url) && !seen.has(url)) {
        seen.add(url);
        documents.push({ label, url, emailId: e.id, at: e.sent_at || e.created_at });
      }
    };
    add(e.pdf_url, `EDA — ${e.vessel_name?.trim() || vessel}`);
    add(e.dock_link_2, `EDA — ${e.vessel_2_name?.trim() || 'tweede schip'}`);
    add(e.doc_link, 'Document');
  }

  const fdaDoc = fda.get(slug) || null;
  if (fdaDoc && (!fdaDoc.url || !seen.has(fdaDoc.url))) documents.push(fdaDoc);

  const stage: PCStage = fdaDoc ? 'fda' : hasSent ? 'quoted' : 'inquiry';

  // Dominant operational category, ignoring out-of-scope noise.
  const catCount: Record<string, number> = {};
  for (const e of emails) {
    const c = categoryOf(e['Email Type']);
    if (c) catCount[c] = (catCount[c] || 0) + 1;
  }
  const category = (Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] as PCCategory) ?? null;

  return {
    key: `${slug}__${firstAt.slice(0, 10)}`,
    vessel,
    slug,
    imo: latest(emails, (e) => e.vessel_imo),
    grt: latest(emails, (e) => e.vessel_grt),
    loa: latest(emails, (e) => e.vessel_loa),
    dwt: latest(emails, (e) => e.vessel_dwt),
    eta: latest(emails, (e) => e.vessel_eta),
    port: latest(emails, (e) => e.port),
    terminal: latest(emails, (e) => e.terminal),
    cargoType: latest(emails, (e) => e.cargo_type),
    cargoQuantity: latest(emails, (e) => e.cargo_quantity),
    company: latest(emails, (e) => e.company_name),
    emails,
    firstAt,
    lastAt,
    stage,
    hasSent,
    hasOpen,
    hasIncomplete,
    documents,
    category,
  };
}

/** Best-effort lookup of final disbursement accounts, keyed by vessel slug. */
async function fetchFdaDocs(): Promise<Map<string, PCDocument>> {
  const map = new Map<string, PCDocument>();
  try {
    const queries = [
      // These select strings mix columns that aren't all present in the
      // generated types for both tables — cast the builder loosely.
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (supabase.from('fda_curacao_projects').select('ship_name, final_pdf_url, updated_at, created_at') as any).limit(1000),
      (supabase.from('fda_projects').select('ship_name, final_pdf_url, updated_at, created_at') as any).limit(1000),
      /* eslint-enable @typescript-eslint/no-explicit-any */
    ];
    const results = await Promise.allSettled(queries);
    for (const r of results) {
      if (r.status !== 'fulfilled' || r.value.error || !r.value.data) continue;
      for (const row of r.value.data as Array<Record<string, string | null>>) {
        const name = row.ship_name?.trim();
        if (!name) continue;
        const slug = normVessel(name);
        if (!slug || map.has(slug)) continue;
        map.set(slug, {
          label: `FDA — ${name}`,
          url: row.final_pdf_url || '',
          emailId: null,
          at: row.updated_at || row.created_at || null,
        });
      }
    }
  } catch {
    /* FDA enrichment is optional */
  }
  return map;
}

let _cache: PortCall[] | null = null;

export function getCachedPortCalls(): PortCall[] | null {
  return _cache;
}

/** Fetch emails + FDA docs and derive port-call dossiers (one per voyage). */
export async function fetchPortCalls(): Promise<PortCall[]> {
  const [emailsRes, fda, records] = await Promise.all([
    supabase.from('email').select(EMAIL_COLS)
      .eq('archived' as never, false as never)
      .not('vessel_name', 'is', null)
      .order('created_at', { ascending: true })
      .limit(3000),
    fetchFdaDocs(),
    fetchPortCallRecords().catch(() => new Map()),
  ]);

  if (emailsRes.error || !emailsRes.data) return _cache ?? [];

  const rows = (emailsRes.data as PCEmail[]).filter((r) => r.vessel_name && r.vessel_name.trim());

  // Group by normalized vessel name.
  const groups = new Map<string, PCEmail[]>();
  for (const r of rows) {
    const slug = normVessel(r.vessel_name!);
    if (!slug) continue;
    const g = groups.get(slug);
    if (g) g.push(r);
    else groups.set(slug, [r]);
  }

  const calls: PortCall[] = [];
  for (const [slug, emails] of groups) {
    emails.sort((a, b) => a.created_at.localeCompare(b.created_at));
    // Split a vessel's history into voyages on a >30-day gap.
    let cluster: PCEmail[] = [];
    const flush = () => {
      if (cluster.length) calls.push(buildCall(slug, cluster, fda));
      cluster = [];
    };
    for (const e of emails) {
      if (cluster.length) {
        const prev = new Date(cluster[cluster.length - 1].created_at).getTime();
        const cur = new Date(e.created_at).getTime();
        if (cur - prev > VOYAGE_GAP_MS) flush();
      }
      cluster.push(e);
    }
    flush();
  }

  // Merge persisted operations data (nomination / status) onto each dossier.
  for (const c of calls) {
    const rec = records.get(c.key);
    if (rec) {
      c.nominated = rec.nominated;
      c.recordStatus = rec.status;
      c.nominationAmount = rec.nomination_amount;
      c.nominationCurrency = rec.nomination_currency;
      if (rec.nominated && c.stage === 'inquiry') c.stage = 'quoted';
    }
  }

  calls.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  _cache = calls;
  return calls;
}
