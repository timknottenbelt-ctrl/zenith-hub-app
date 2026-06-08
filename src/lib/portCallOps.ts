// Persistent operations data for a port-call dossier: the port_call record
// (status, nomination, revenue, ETA/ETB/ETD), the Statement-of-Facts event log,
// and the arrival-document checklist. Backed by the port_call / port_call_event
// / port_call_doc tables (migration 20260608120000). The generated Supabase
// types don't include these tables yet, so the query builder is cast to `any`.
import { supabase } from '@/integrations/supabase/client';

export interface PortCallRecord {
  id: string;
  dossier_key: string;
  slug: string;
  vessel_name: string | null;
  imo: string | null;
  status: string; // expected | nominated | alongside | sailed | closed
  nominated: boolean;
  nomination_amount: number | null;
  nomination_currency: string | null;
  principal: string | null;
  eta: string | null;
  etb: string | null;
  etd: string | null;
  terminal: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortCallEvent {
  id: string;
  port_call_id: string;
  event_type: string;
  event_time: string;
  remark: string | null;
  created_at: string;
}

export interface PortCallDoc {
  id: string;
  port_call_id: string;
  label: string;
  url: string | null;
  doc_kind: string; // arrival | other
  status: string; // pending | sent | received
  created_at: string;
}

export interface PortCallSeed {
  dossier_key: string;
  slug: string;
  vessel_name?: string | null;
  imo?: string | null;
  terminal?: string | null;
  eta?: string | null;
}

const pc = () => supabase.from('port_call') as any;
const ev = () => supabase.from('port_call_event') as any;
const dc = () => supabase.from('port_call_doc') as any;

export type CallType = 'cargo_agent' | 'owners_agent' | null;

// Standard arrival documents, split by call type (cargo vs owner's agent).
const COMMON_ARRIVAL_DOCS = [
  'Pre-arrival Notification / Forms',
  'Crew List',
  'Maritime Declaration of Health',
  'Inward Clearance (Customs / Immigration)',
  'Port Clearance Certificate',
];
const CARGO_ARRIVAL_DOCS = [
  'Notice of Readiness (NOR)',
  'Cargo Manifest',
  'Stowage / Loading Plan',
  'Bill of Lading',
  'Statement of Facts (SOF)',
  'Time Sheet / Laytime Statement',
];
const OWNERS_ARRIVAL_DOCS = [
  'Crew Change / Sign On-Off List',
  'Cash to Master Receipt',
  'Sludge / Garbage / FW Receipts',
  'Bunker Delivery Note (BDN)',
  'Stores / Provisions List',
];

/** Standard arrival documents for a call type (defaults to the full set). */
export function arrivalDocTemplates(callType: CallType): string[] {
  if (callType === 'cargo_agent') return [...COMMON_ARRIVAL_DOCS, ...CARGO_ARRIVAL_DOCS];
  if (callType === 'owners_agent') return [...COMMON_ARRIVAL_DOCS, ...OWNERS_ARRIVAL_DOCS];
  return [...COMMON_ARRIVAL_DOCS, ...CARGO_ARRIVAL_DOCS, ...OWNERS_ARRIVAL_DOCS];
}

/** Fetch all persisted dossier records, keyed by dossier_key (for list merge). */
export async function fetchPortCallRecords(): Promise<Map<string, PortCallRecord>> {
  const map = new Map<string, PortCallRecord>();
  const { data, error } = await pc().select('*').limit(5000);
  if (error || !data) return map;
  for (const r of data as PortCallRecord[]) map.set(r.dossier_key, r);
  return map;
}

/** Get-or-create the dossier record for a derived port call (never clobbers
 *  user-edited fields — only inserts when missing). */
export async function materializePortCall(seed: PortCallSeed): Promise<PortCallRecord | null> {
  const { data: existing } = await pc().select('*').eq('dossier_key', seed.dossier_key).maybeSingle();
  if (existing) return existing as PortCallRecord;
  const { data, error } = await pc()
    .insert({
      dossier_key: seed.dossier_key,
      slug: seed.slug,
      vessel_name: seed.vessel_name ?? null,
      imo: seed.imo ?? null,
      terminal: seed.terminal ?? null,
      eta: seed.eta ?? null,
      status: 'expected',
    })
    .select()
    .single();
  return error ? null : (data as PortCallRecord);
}

export async function updatePortCall(id: string, patch: Partial<PortCallRecord>): Promise<void> {
  await pc().update(patch).eq('id', id);
}

export async function loadEvents(portCallId: string): Promise<PortCallEvent[]> {
  const { data } = await ev().select('*').eq('port_call_id', portCallId).order('event_time', { ascending: true });
  return (data as PortCallEvent[]) ?? [];
}

export async function addEvent(
  portCallId: string,
  event_type: string,
  event_time: string,
  remark: string | null,
): Promise<PortCallEvent | null> {
  const { data, error } = await ev()
    .insert({ port_call_id: portCallId, event_type, event_time, remark })
    .select()
    .single();
  return error ? null : (data as PortCallEvent);
}

export async function updateEvent(id: string, patch: Partial<PortCallEvent>): Promise<void> {
  await ev().update(patch).eq('id', id);
}

export async function deleteEvent(id: string): Promise<void> {
  await ev().delete().eq('id', id);
}

export async function loadDocs(portCallId: string): Promise<PortCallDoc[]> {
  const { data } = await dc().select('*').eq('port_call_id', portCallId).order('created_at', { ascending: true });
  return (data as PortCallDoc[]) ?? [];
}

export async function addDoc(
  portCallId: string,
  label: string,
  doc_kind = 'arrival',
  url: string | null = null,
): Promise<PortCallDoc | null> {
  const { data, error } = await dc()
    .insert({ port_call_id: portCallId, label, doc_kind, url, status: 'pending' })
    .select()
    .single();
  return error ? null : (data as PortCallDoc);
}

export async function updateDoc(id: string, patch: Partial<PortCallDoc>): Promise<void> {
  await dc().update(patch).eq('id', id);
}

export async function deleteDoc(id: string): Promise<void> {
  await dc().delete().eq('id', id);
}

/** Seed the standard arrival-document checklist (skips ones already present). */
export async function seedArrivalDocs(
  portCallId: string,
  existing: PortCallDoc[],
  callType: CallType = null,
): Promise<PortCallDoc[]> {
  const have = new Set(existing.filter((d) => d.doc_kind === 'arrival').map((d) => d.label));
  const toAdd = arrivalDocTemplates(callType).filter((l) => !have.has(l));
  if (!toAdd.length) return [];
  const rows = toAdd.map((label) => ({ port_call_id: portCallId, label, doc_kind: 'arrival', status: 'pending' }));
  const { data, error } = await dc().insert(rows).select();
  return error ? [] : ((data as PortCallDoc[]) ?? []);
}

// ── Human-in-the-loop tasks ───────────────────────────────────────────────
export interface PortCallTask {
  id: string;
  port_call_id: string;
  title: string;
  done: boolean;
  source: string; // manual | ai
  created_at: string;
}

const tk = () => supabase.from('port_call_task') as any;

export async function loadTasks(portCallId: string): Promise<PortCallTask[]> {
  const { data } = await tk().select('*').eq('port_call_id', portCallId).order('created_at', { ascending: true });
  return (data as PortCallTask[]) ?? [];
}

export async function addTask(portCallId: string, title: string, source = 'manual'): Promise<PortCallTask | null> {
  const { data, error } = await tk().insert({ port_call_id: portCallId, title, source }).select().single();
  return error ? null : (data as PortCallTask);
}

/** Bulk-add tasks (AI), skipping titles that already exist for this call. */
export async function addTasks(
  portCallId: string,
  titles: string[],
  existing: PortCallTask[],
  source = 'ai',
): Promise<PortCallTask[]> {
  const have = new Set(existing.map((t) => t.title.trim().toLowerCase()));
  const fresh = titles.map((t) => t.trim()).filter((t) => t && !have.has(t.toLowerCase()));
  if (!fresh.length) return [];
  const rows = fresh.map((title) => ({ port_call_id: portCallId, title, source }));
  const { data, error } = await tk().insert(rows).select();
  return error ? [] : ((data as PortCallTask[]) ?? []);
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  await tk().update({ done }).eq('id', id);
}

export async function deleteTask(id: string): Promise<void> {
  await tk().delete().eq('id', id);
}

export interface AiScanResult {
  summary: string;
  updates: string[];
  todos: string[];
}

/** Run the port-call AI scan over the given emails (read-only). */
export async function runPortCallAi(emailIds: number[]): Promise<AiScanResult | null> {
  const { data, error } = await supabase.functions.invoke('port-call-ai', { body: { emailIds } });
  if (error || !data) return null;
  const d = data as Partial<AiScanResult>;
  return {
    summary: d.summary ?? '',
    updates: Array.isArray(d.updates) ? d.updates : [],
    todos: Array.isArray(d.todos) ? d.todos : [],
  };
}
