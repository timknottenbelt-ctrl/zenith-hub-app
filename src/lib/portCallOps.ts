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

/** Standard arrival documents an agent handles once a vessel is nominated. */
export const ARRIVAL_DOC_TEMPLATES: string[] = [
  'Pre-arrival Notification / Forms',
  'Notice of Readiness (NOR)',
  'Crew List',
  'Maritime Declaration of Health',
  'Inward Clearance (Customs / Immigration)',
  'Cargo Manifest',
  'Stowage / Loading Plan',
  'Port Clearance Certificate',
  'Statement of Facts (SOF)',
  'Time Sheet / Laytime Statement',
];

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
export async function seedArrivalDocs(portCallId: string, existing: PortCallDoc[]): Promise<PortCallDoc[]> {
  const have = new Set(existing.filter((d) => d.doc_kind === 'arrival').map((d) => d.label));
  const toAdd = ARRIVAL_DOC_TEMPLATES.filter((l) => !have.has(l));
  if (!toAdd.length) return [];
  const rows = toAdd.map((label) => ({ port_call_id: portCallId, label, doc_kind: 'arrival', status: 'pending' }));
  const { data, error } = await dc().insert(rows).select();
  return error ? [] : ((data as PortCallDoc[]) ?? []);
}
