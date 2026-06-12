import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { fetchPortCalls, getCachedPortCalls, type PortCall, type PCEmail } from '@/lib/portCalls';
import {
  SOF_PHASES,
  SOF_EVENTS,
  SOF_BY_KEY,
  deriveOpsStatus,
  eventApplies,
  eventLabel,
  type SofPhase,
  type OpsStatus,
  type AppliesTo,
} from '@/lib/sofEvents';
import {
  materializePortCall,
  updatePortCall,
  loadEvents,
  addEvent as apiAddEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
  loadDocs,
  addDoc as apiAddDoc,
  updateDoc as apiUpdateDoc,
  deleteDoc as apiDeleteDoc,
  seedArrivalDocs,
  loadTasks,
  addTask as apiAddTask,
  addTasks as apiAddTasks,
  toggleTask as apiToggleTask,
  deleteTask as apiDeleteTask,
  runPortCallAi,
  saveAiScan,
  type PortCallRecord,
  type PortCallEvent,
  type PortCallDoc,
  type PortCallTask,
  type AiScanResult,
} from '@/lib/portCallOps';
import { TERMINALS, resolveTerminal, berthCheck, suggestBerths, cargoToProduct } from '@/lib/terminals';
import { LIFECYCLE_ORDER, LIFECYCLE_META } from '@/lib/portCallStatus';
import { DACalculatorPanel, type DAInitial } from '@/components/da/DACalculatorPanel';
import { resolvePortLoc, osmEmbedUrl, marineTrafficUrl, vesselFinderUrl } from '@/lib/curacaoPorts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getN8nWebhook, setN8nWebhook, createN8nDraft, type DocType, type DraftResult } from '@/lib/n8n';
import {
  ArrowLeft,
  Ship,
  Anchor,
  MapPin,
  Package,
  Building2,
  FileText,
  ExternalLink,
  Mail,
  Hash,
  Ruler,
  Gauge,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  DollarSign,
  Navigation,
  Clock,
  ListChecks,
  CircleDot,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  ShipWheel,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ClipboardList,
  Calculator,
  FileSignature,
  type LucideIcon,
} from 'lucide-react';

const TONE: Record<OpsStatus['tone'], string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PHASE_DOT: Record<SofPhase, string> = {
  pre_arrival: 'bg-sky-500',
  anchorage_waiting: 'bg-indigo-500',
  berthing: 'bg-violet-500',
  cargo_operations: 'bg-amber-500',
  bunkering_services: 'bg-teal-500',
  departure: 'bg-rose-500',
  completion_closing: 'bg-emerald-500',
};

// Quick-add chips: the events logged on almost every call.
const QUICK_KEYS = [
  'nomination_received',
  'eta_notice',
  'anchored',
  'nor_tendered',
  'all_fast',
  'first_line_ashore',
  'cargo_commenced_loading',
  'cargo_commenced_discharging',
  'bunkering_commenced',
  'bunkering_completed',
  'cargo_completed_loading',
  'cargo_completed_discharging',
  'atd',
  'sof_signed',
];

const EVENT_LIFECYCLE: Record<string, string> = {
  nomination_received: 'nominated',
  appointment_confirmed: 'nominated',
  all_fast: 'alongside',
  atb: 'alongside',
  arrived_at_berth: 'alongside',
  atd: 'sailed',
  cosp: 'sailed',
  vessel_cleared_port: 'sailed',
  port_call_closed: 'closed',
};

const CURRENCIES = ['USD', 'EUR', 'ANG'];

// High-level pipeline shown as a phase bar in the header.
const PIPELINE = ['Pre-arrival', 'Alongside', 'Departure', 'Closing'];
function derivePipeline(events: PortCallEvent[], status: string | undefined): number {
  if (status === 'closed') return 3;
  if (events.length) {
    const latest = [...events].sort((a, b) => b.event_time.localeCompare(a.event_time))[0];
    const ph = SOF_BY_KEY[latest.event_type]?.phase;
    if (ph === 'completion_closing') return 3;
    if (ph === 'departure') return 2;
    if (ph === 'berthing' || ph === 'cargo_operations' || ph === 'bunkering_services') return 1;
    return 0;
  }
  if (status === 'sailed') return 2;
  if (status === 'alongside') return 1;
  return 0;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function nowLocal(): string {
  return toLocalInput(new Date().toISOString());
}

function statusMeta(status: string | null): { label: string; cls: string } {
  switch (status) {
    case 'sent':
    case 'approved':
      return {
        label: status === 'sent' ? 'Sent' : 'Approved',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'draft':
      return { label: 'Draft', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'out_of_scope':
      return { label: 'Out of scope', cls: 'bg-muted text-muted-foreground border-border' };
    default:
      return { label: status || 'New', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
}

const DOC_TYPE_LABEL: Record<DocType, string> = {
  arrival_notice: 'Arrival notice',
  SOF: 'Statement of Facts',
  NOR: 'Notice of Readiness',
  PDA: 'Proforma DA (PDA)',
  FDA: 'Final DA (FDA)',
};

function esc(s: string | null | undefined): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildDraftBodyHtml(
  docType: DocType,
  vessel: string,
  imo: string | null,
  terminal: string | null,
  eta: string | null,
  etb: string | null,
  etd: string | null,
  events: PortCallEvent[],
  docs: { label: string; url: string }[] = [],
): string {
  const facts: [string, string | null][] = [
    ['Vessel', vessel],
    ['IMO', imo],
    ['Terminal', terminal],
    ['ETA', eta ? fmtDateTime(eta) : null],
    ['ETB', etb ? fmtDateTime(etb) : null],
    ['ETD', etd ? fmtDateTime(etd) : null],
  ];
  const factRows = facts
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`)
    .join('');
  const lines: string[] = ['<p>Geachte heer/mevrouw,</p>'];
  if (docType === 'arrival_notice') lines.push(`<p>Hierbij de aankomstgegevens voor <b>${esc(vessel)}</b>.</p>`);
  else if (docType === 'SOF') lines.push(`<p>Bijgaand de Statement of Facts voor <b>${esc(vessel)}</b>.</p>`);
  else lines.push(`<p>Betreft <b>${esc(vessel)}</b> — ${esc(DOC_TYPE_LABEL[docType])}.</p>`);
  lines.push(`<table>${factRows}</table>`);
  if (docType === 'SOF' && events.length) {
    lines.push('<p><b>Statement of Facts:</b></p><ul>');
    for (const e of events) {
      lines.push(`<li>${esc(fmtDateTime(e.event_time))} — ${esc(eventLabel(e.event_type))}${e.remark ? ` (${esc(e.remark)})` : ''}</li>`);
    }
    lines.push('</ul>');
  }
  if (docs.length) {
    lines.push('<p><b>Documenten:</b></p><ul>');
    for (const d of docs) lines.push(`<li><a href="${esc(d.url)}">${esc(d.label)}</a></li>`);
    lines.push('</ul>');
  }
  lines.push('<p>Met vriendelijke groet,<br/>LBH Curaçao</p>');
  return lines.join('\n');
}

const DOC_STATUS_CYCLE = ['pending', 'sent', 'received'] as const;
const DOC_STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-emerald-100 text-emerald-700',
};

/** Collapsible section block for the dossier's left column. */
function Block({
  title,
  icon: Icon,
  defaultOpen = true,
  badge,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 items-center gap-2 text-base font-semibold">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{title}</span>
          {badge != null && <span className="text-sm font-normal text-muted-foreground">{badge}</span>}
        </button>
        {action}
      </CardHeader>
      {open && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

export default function PortCallDetail() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { key = '' } = useParams();
  const decodedKey = decodeURIComponent(key);

  const [call, setCall] = useState<PortCall | null>(
    () => getCachedPortCalls()?.find((c) => c.key === decodedKey) ?? null,
  );
  const [record, setRecord] = useState<PortCallRecord | null>(null);
  const [events, setEvents] = useState<PortCallEvent[]>([]);
  const [docs, setDocs] = useState<PortCallDoc[]>([]);
  const [tasks, setTasks] = useState<PortCallTask[]>([]);
  const [loading, setLoading] = useState(!call);
  const [busy, setBusy] = useState(false);

  // SOF add-event form
  const [newType, setNewType] = useState('');
  const [newTime, setNewTime] = useState(nowLocal());
  const [newRemark, setNewRemark] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Te doen + AI
  const [newTask, setNewTask] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AiScanResult | null>(null);

  // Inline tool view below the header: dossier (default) | da
  const [view, setView] = useState<'dossier' | 'da'>('dossier');

  // Nomination form (in a dialog)
  const [nomOpen, setNomOpen] = useState(false);
  const [nominated, setNominated] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [principal, setPrincipal] = useState('');
  const [eta, setEta] = useState('');
  const [etb, setEtb] = useState('');
  const [etd, setEtd] = useState('');
  const [clientSaving, setClientSaving] = useState(false);
  const [contactOpts, setContactOpts] = useState<string[]>([]);
  const [fdaLinks, setFdaLinks] = useState<{ project_id: string; lbh_number: string; ship_name: string; status: string | null; total_amount: number | null; total_invoices: number | null }[]>([]);

  // New custom doc
  const [docLabel, setDocLabel] = useState('');
  const [docUrl, setDocUrl] = useState('');

  // Berth check
  const [bcTerminal, setBcTerminal] = useState('');
  const [bcLoa, setBcLoa] = useState('');
  const [bcDraft, setBcDraft] = useState('');
  const [bcDwt, setBcDwt] = useState('');
  const [bcAir, setBcAir] = useState('');

  // n8n draft (concept-only)
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftType, setDraftType] = useState<DocType>('arrival_notice');
  const [draftTo, setDraftTo] = useState('');
  const [draftCc, setDraftCc] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftWebhook, setDraftWebhook] = useState(getN8nWebhook());
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);

  // Resolve the call (from cache or a fresh fetch) and materialise its record.
  useEffect(() => {
    let active = true;
    (async () => {
      let c = call;
      if (!c) {
        const data = await fetchPortCalls();
        c = data.find((x) => x.key === decodedKey) ?? null;
        if (!active) return;
        setCall(c);
      }
      if (!c) {
        setLoading(false);
        return;
      }
      const rec = await materializePortCall({
        dossier_key: c.key,
        slug: c.slug,
        vessel_name: c.vessel,
        imo: c.imo,
        terminal: c.terminal,
        eta: c.eta,
      });
      if (!active) return;
      setRecord(rec);
      if (rec) {
        setNominated(rec.nominated);
        setAmount(rec.nomination_amount != null ? String(rec.nomination_amount) : '');
        setCurrency(rec.nomination_currency || 'USD');
        setPrincipal(rec.principal || c.company || '');
        setEta(toLocalInput(rec.eta || c.eta));
        setEtb(toLocalInput(rec.etb));
        setEtd(toLocalInput(rec.etd));
        if (c.loa) setBcLoa(String(c.loa));
        const rt = resolveTerminal(rec.terminal, c.terminal, c.port);
        if (rt) setBcTerminal(rt.name);
        const [evs, dcs, tks] = await Promise.all([loadEvents(rec.id), loadDocs(rec.id), loadTasks(rec.id)]);
        if (!active) return;
        setEvents(evs);
        setDocs(dcs);
        setTasks(tks);
        // Show the cached AI summary instantly.
        if (rec.ai_summary) setAiResult({ summary: rec.ai_summary, updates: rec.ai_updates || [], todos: [] });
        // Auto-scan in the background when new mail has arrived since the last scan.
        const emailCount = c.emails.length;
        if (emailCount > 0 && (rec.ai_scanned_count == null || emailCount > rec.ai_scanned_count)) {
          setAiBusy(true);
          (async () => {
            const res = await runPortCallAi(c!.emails.map((e) => e.id));
            if (!active) return;
            if (res) {
              setAiResult(res);
              await saveAiScan(rec.id, res, emailCount);
              if (res.todos.length) {
                await apiAddTasks(rec.id, res.todos, tks, 'ai');
                if (active) setTasks(await loadTasks(rec.id));
              }
              setRecord((r) =>
                r
                  ? { ...r, ai_summary: res.summary, ai_updates: res.updates, ai_scanned_count: emailCount, ai_scanned_at: new Date().toISOString() }
                  : r,
              );
            }
            if (active) setAiBusy(false);
          })();
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedKey]);

  const opsStatus = useMemo(() => deriveOpsStatus(events), [events]);
  const phaseIdx = useMemo(() => derivePipeline(events, record?.status), [events, record?.status]);
  const portLoc = useMemo(() => {
    const tt = resolveTerminal(record?.terminal, call?.terminal, call?.port);
    if (tt) return { name: tt.name, lat: tt.lat, lon: tt.lon };
    return resolvePortLoc(record?.terminal, call?.terminal, call?.port);
  }, [record?.terminal, call?.terminal, call?.port]);
  const comms = useMemo(() => (call ? [...call.emails].reverse() : []), [call]);
  const arrivalDocs = docs.filter((d) => d.doc_kind === 'arrival');
  const arrivalDone = arrivalDocs.filter((d) => d.status !== 'pending').length;
  const openTasks = tasks.filter((tk) => !tk.done).length;

  async function reloadEvents(id: string) {
    setEvents(await loadEvents(id));
  }
  async function reloadDocs(id: string) {
    setDocs(await loadDocs(id));
  }
  async function reloadTasks(id: string) {
    setTasks(await loadTasks(id));
  }

  async function bumpLifecycle(typeKey: string) {
    if (!record) return;
    const lifecycle = EVENT_LIFECYCLE[typeKey];
    if (lifecycle && record.status !== lifecycle) {
      await updatePortCall(record.id, { status: lifecycle });
      setRecord({ ...record, status: lifecycle });
    }
  }

  async function handleAddEvent() {
    if (!record || !newType) return;
    setBusy(true);
    const iso = fromLocalInput(newTime) || new Date().toISOString();
    const ev = await apiAddEvent(record.id, newType, iso, newRemark.trim() || null);
    if (ev) {
      setNewType('');
      setNewRemark('');
      setNewTime(nowLocal());
      await reloadEvents(record.id);
      await bumpLifecycle(ev.event_type);
    } else {
      toast({ title: 'Kon event niet opslaan', variant: 'destructive' });
    }
    setBusy(false);
  }

  async function quickAdd(typeKey: string) {
    if (!record) return;
    if (SOF_BY_KEY[typeKey]?.requiresReason) {
      setNewType(typeKey);
      setNewTime(nowLocal());
      return;
    }
    const ev = await apiAddEvent(record.id, typeKey, new Date().toISOString(), null);
    if (ev) {
      await reloadEvents(record.id);
      await bumpLifecycle(typeKey);
      toast({ title: `${eventLabel(typeKey)} logged` });
    }
  }

  function startEdit(e: PortCallEvent) {
    setEditId(e.id);
    setEditTime(toLocalInput(e.event_time));
    setEditRemark(e.remark || '');
  }
  async function saveEdit() {
    if (!record || !editId) return;
    await apiUpdateEvent(editId, {
      event_time: fromLocalInput(editTime) || undefined,
      remark: editRemark.trim() || null,
    });
    setEditId(null);
    await reloadEvents(record.id);
  }
  async function removeEvent(id: string) {
    if (!record) return;
    await apiDeleteEvent(id);
    await reloadEvents(record.id);
  }

  async function handleStatusChange(status: string) {
    if (!record) return;
    await updatePortCall(record.id, { status });
    setRecord({ ...record, status });
    toast({ title: `Status: ${LIFECYCLE_META[status as keyof typeof LIFECYCLE_META]?.label ?? status}` });
  }

  // Load known clients/companies from the contacts table for autocomplete.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('contacts').select('company,name').limit(500);
      if (!active || !data) return;
      const set = new Set<string>();
      for (const c of data as { company: string | null; name: string | null }[]) {
        if (c.company) set.add(c.company);
        if (c.name) set.add(c.name);
      }
      setContactOpts(Array.from(set).sort((a, b) => a.localeCompare(b)));
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveClient() {
    if (!record) return;
    setClientSaving(true);
    const value = principal.trim() || null;
    await updatePortCall(record.id, { principal: value });
    setRecord({ ...record, principal: value } as PortCallRecord);
    setClientSaving(false);
    toast({ title: 'Klant opgeslagen' });
  }

  // Open the FDA Creator pre-filled with this port call's context.
  function openFdaForCall() {
    if (!call) return;
    const p = new URLSearchParams();
    p.set('prefill', '1');
    p.set('dossier', call.key);
    if (call.vessel) p.set('ship', call.vessel);
    const client = principal.trim() || call.company || '';
    if (client) p.set('client', client);
    const arrived = record?.eta || record?.etb;
    if (arrived) p.set('arrived', arrived.slice(0, 10));
    if (record?.etd) p.set('sailed', record.etd.slice(0, 10));
    navigate(`/fda-curacao?${p.toString()}`);
  }

  // FDA projects linked to this dossier.
  useEffect(() => {
    if (!call?.key) return;
    let active = true;
    (async () => {
      // dossier_key is not in the generated types yet; cast the builder.
      const q = supabase.from('fda_curacao_projects') as unknown as {
        select: (c: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: typeof fdaLinks | null }> } };
      };
      const { data } = await q.select('project_id, lbh_number, ship_name, status, total_amount, total_invoices').eq('dossier_key', call.key).order('created_at', { ascending: false });
      if (active && data) setFdaLinks(data);
    })();
    return () => {
      active = false;
    };
  }, [call?.key]);

  async function saveNomination() {
    if (!record) return;
    setBusy(true);
    const patch: Partial<PortCallRecord> = {
      nominated,
      nomination_amount: amount.trim() ? Number(amount) : null,
      nomination_currency: currency,
      principal: principal.trim() || null,
      eta: fromLocalInput(eta),
      etb: fromLocalInput(etb),
      etd: fromLocalInput(etd),
    };
    if (nominated && record.status === 'expected') patch.status = 'nominated';
    await updatePortCall(record.id, patch);
    setRecord({ ...record, ...patch } as PortCallRecord);
    setBusy(false);
    setNomOpen(false);
    toast({ title: 'Opgeslagen' });
  }

  // Te doen
  async function handleAddTask() {
    if (!record || !newTask.trim()) return;
    const tk = await apiAddTask(record.id, newTask.trim());
    if (tk) {
      setNewTask('');
      await reloadTasks(record.id);
    }
  }
  async function toggleTaskDone(tk: PortCallTask) {
    await apiToggleTask(tk.id, !tk.done);
    setTasks((ts) => ts.map((x) => (x.id === tk.id ? { ...x, done: !x.done } : x)));
  }
  async function removeTask(id: string) {
    if (!record) return;
    await apiDeleteTask(id);
    setTasks((ts) => ts.filter((x) => x.id !== id));
  }

  async function runAiScan() {
    if (!call || !record) return;
    setAiBusy(true);
    const res = await runPortCallAi(call.emails.map((e) => e.id));
    if (res) {
      setAiResult(res);
      await saveAiScan(record.id, res, call.emails.length);
      setRecord((r) =>
        r
          ? { ...r, ai_summary: res.summary, ai_updates: res.updates, ai_scanned_count: call.emails.length, ai_scanned_at: new Date().toISOString() }
          : r,
      );
      if (res.todos.length) {
        await apiAddTasks(record.id, res.todos, tasks, 'ai');
        await reloadTasks(record.id);
      }
      toast({ title: `AI-scan klaar — ${res.todos.length} taak/taken` });
    } else {
      toast({ title: 'AI-scan mislukt', variant: 'destructive' });
    }
    setAiBusy(false);
  }

  async function handleSeedArrivalDocs() {
    if (!record) return;
    setBusy(true);
    const ct = call?.category === 'cargo' ? 'cargo_agent' : call?.category === 'owners' ? 'owners_agent' : null;
    await seedArrivalDocs(record.id, docs, ct);
    await reloadDocs(record.id);
    setBusy(false);
  }
  async function cycleDocStatus(d: PortCallDoc) {
    if (!record) return;
    const next = DOC_STATUS_CYCLE[(DOC_STATUS_CYCLE.indexOf(d.status as never) + 1) % DOC_STATUS_CYCLE.length];
    await apiUpdateDoc(d.id, { status: next });
    await reloadDocs(record.id);
  }
  async function handleAddDoc() {
    if (!record || !docLabel.trim()) return;
    await apiAddDoc(record.id, docLabel.trim(), 'other', docUrl.trim() || null);
    setDocLabel('');
    setDocUrl('');
    await reloadDocs(record.id);
  }
  async function removeDoc(id: string) {
    if (!record) return;
    await apiDeleteDoc(id);
    await reloadDocs(record.id);
  }

  function openDraftDialog() {
    if (!call) return;
    const term = record?.terminal || call.terminal || call.port || '';
    setDraftSubject(`${DOC_TYPE_LABEL[draftType]} – ${call.vessel}${term ? ` – ${term}` : ''}`);
    setDraftResult(null);
    setDraftOpen(true);
  }
  function onDraftTypeChange(tp: DocType) {
    if (!call) return;
    setDraftType(tp);
    const term = record?.terminal || call.terminal || call.port || '';
    setDraftSubject(`${DOC_TYPE_LABEL[tp]} – ${call.vessel}${term ? ` – ${term}` : ''}`);
  }
  async function handleCreateDraft() {
    if (!call) return;
    setDraftBusy(true);
    setDraftResult(null);
    setN8nWebhook(draftWebhook);
    const attachments = call.documents
      .filter((d) => d.url)
      .map((d) => ({ filename: `${d.label}.pdf`, url: d.url }));
    const res = await createN8nDraft({
      doc_type: draftType,
      port_call_id: record?.id ?? null,
      dossier_key: call.key,
      vessel: { name: call.vessel, imo: call.imo },
      to: draftTo.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      cc: draftCc.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      subject: draftSubject,
      body_html: buildDraftBodyHtml(
        draftType,
        call.vessel,
        call.imo,
        record?.terminal || call.terminal || call.port,
        record?.eta ?? null,
        record?.etb ?? null,
        record?.etd ?? null,
        events,
        attachments.map((a) => ({ label: a.filename.replace(/\.pdf$/i, ''), url: a.url })),
      ),
      attachments,
    });
    setDraftResult(res);
    setDraftBusy(false);
    if (res.ok) toast({ title: 'Concept aangemaakt' });
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-muted/50" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted/50" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted/50" />
        </div>
      </DashboardLayout>
    );
  }

  if (!call) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Anchor className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">{t('portCalls.notFound')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/port-calls')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('portCalls.back')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const particulars = [
    { icon: Hash, label: 'IMO', value: call.imo },
    { icon: Gauge, label: 'GT', value: call.grt ? call.grt.toLocaleString() : null },
    { icon: Ruler, label: 'LOA', value: call.loa ? `${call.loa} m` : null },
    { icon: MapPin, label: t('portCalls.terminal'), value: record?.terminal || call.terminal || call.port },
    {
      icon: Package,
      label: t('portCalls.cargo'),
      value: call.cargoType
        ? `${call.cargoType}${call.cargoQuantity ? ` · ${call.cargoQuantity.toLocaleString()} MT` : ''}`
        : call.category === 'owners'
          ? t('portCalls.services')
          : null,
    },
  ].filter((p) => p.value);

  const etaRow = [
    { label: 'ETA', value: record?.eta },
    { label: 'ETB', value: record?.etb },
    { label: 'ETD', value: record?.etd },
  ];

  const callType: AppliesTo | null =
    call.category === 'cargo' ? 'cargo_agent' : call.category === 'owners' ? 'owners_agent' : null;
  const filterType = showAllEvents ? null : callType;
  const quickKeys = QUICK_KEYS.filter((k) => SOF_BY_KEY[k] && eventApplies(SOF_BY_KEY[k], filterType));
  const newDef = newType ? SOF_BY_KEY[newType] : null;
  const reasonNeeded = !!newDef?.requiresReason && !newRemark.trim();

  const num = (s: string) => (s.trim() ? Number(s) : null);
  const selectedTerminal =
    (bcTerminal ? TERMINALS.find((tm) => tm.name === bcTerminal) : null) ||
    resolveTerminal(record?.terminal, call?.terminal, call?.port);
  const check = selectedTerminal
    ? berthCheck({ loa: num(bcLoa) ?? call.loa, draft: num(bcDraft), dwt: num(bcDwt), airDraft: num(bcAir) }, selectedTerminal)
    : null;
  const BC_TONE = { fits: TONE.emerald, exceeds: TONE.rose, unknown: TONE.slate } as const;
  const BC_LABEL = { fits: 'Past', exceeds: 'Past niet', unknown: 'Onbekend' } as const;

  const cargoProduct = cargoToProduct(call.cargoType);
  const suggestions = suggestBerths(call.cargoType, { loa: num(bcLoa) ?? call.loa, draft: num(bcDraft), dwt: num(bcDwt) }).slice(0, 5);

  const actionBtn = 'flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-white/25';

  // Prefill the inline DA calculator from this port call.
  const daInitial: DAInitial = {
    vessel_name: call.vessel,
    gt: call.grt ? String(call.grt) : undefined,
    loa: call.loa ? String(call.loa) : undefined,
    cargo_type: call.cargoType || undefined,
    terminal: record?.terminal || call.terminal || call.port || undefined,
    client_name: principal || call.company || undefined,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/port-calls')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('portCalls.back')}
        </Button>

        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="bg-gradient-to-br from-primary to-blue-700 px-6 py-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                  <Ship className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">{call.vessel}</h1>
                  <p className="text-[12px] text-white/75">
                    {call.imo ? `IMO ${call.imo}` : t('portCalls.noImo')} ·{' '}
                    {call.category === 'cargo'
                      ? t('portCalls.cargoAgent')
                      : call.category === 'owners'
                        ? t('portCalls.ownersAgent')
                        : t('portCalls.general')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn('border', TONE[opsStatus.tone])}>
                  <CircleDot className="mr-1 h-3 w-3" />
                  {opsStatus.label}
                </Badge>
                {record?.nominated && (
                  <Badge className="border border-emerald-200 bg-emerald-100 text-emerald-700">Nominated</Badge>
                )}
                {record &&
                  (record.status === 'closed' ? (
                    <button onClick={() => handleStatusChange('sailed')} className={actionBtn}>
                      <RotateCcw className="h-3.5 w-3.5" /> Heropenen
                    </button>
                  ) : (
                    <button onClick={() => handleStatusChange('closed')} className={actionBtn}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Sluiten
                    </button>
                  ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setNomOpen(true)} className={actionBtn}>
                <DollarSign className="h-3.5 w-3.5" /> Nominatie &amp; opbrengst
                {record?.nomination_amount != null && (
                  <span className="ml-1 font-bold">
                    {record.nomination_currency || 'USD'} {record.nomination_amount.toLocaleString()}
                  </span>
                )}
              </button>
              <button
                onClick={() => setView((view) => (view === 'da' ? 'dossier' : 'da'))}
                className={cn(actionBtn, view === 'da' && 'bg-white text-primary hover:bg-white/90')}
              >
                <Calculator className="h-3.5 w-3.5" /> DA Creator
              </button>
              <button onClick={openFdaForCall} className={actionBtn}>
                <FileSignature className="h-3.5 w-3.5" /> FDA Creator
              </button>
              <button onClick={runAiScan} disabled={aiBusy} className={cn(actionBtn, 'disabled:opacity-60')}>
                <Sparkles className="h-3.5 w-3.5" /> {aiBusy ? 'AI bezig…' : 'AI-scan'}
              </button>
              <button onClick={openDraftDialog} className={cn(actionBtn, 'bg-white text-primary hover:bg-white/90')}>
                <Mail className="h-3.5 w-3.5" /> Concept
              </button>
            </div>
          </div>

          {/* Phase pipeline */}
          <div className="flex items-center gap-1 border-b border-border/50 px-6 py-3">
            {PIPELINE.map((p, i) => (
              <Fragment key={p}>
                <div className={cn('flex items-center gap-1.5 text-[12px] font-medium', i <= phaseIdx ? 'text-primary' : 'text-muted-foreground')}>
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      i < phaseIdx ? 'bg-primary' : i === phaseIdx ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/30',
                    )}
                  />
                  {p}
                </div>
                {i < PIPELINE.length - 1 && <div className={cn('h-px flex-1', i < phaseIdx ? 'bg-primary/40' : 'bg-border')} />}
              </Fragment>
            ))}
          </div>

          {/* ETA / ETB / ETD strip */}
          <div className="grid grid-cols-3 divide-x divide-border/50">
            {etaRow.map((r) => (
              <div key={r.label} className="px-6 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</div>
                <div className="text-[13px] font-medium text-foreground">{fmtDateTime(r.value ?? null)}</div>
              </div>
            ))}
          </div>
        </div>

        {view === 'da' ? (
          <DACalculatorPanel initial={daInitial} onBack={() => setView('dossier')} />
        ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT: blocks */}
          <div className="space-y-4 lg:col-span-2">
            {/* Te doen */}
            <Block
              title="Te doen"
              icon={ClipboardList}
              badge={openTasks || undefined}
              action={
                <Button size="sm" variant="outline" onClick={runAiScan} disabled={aiBusy}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {aiBusy ? 'Bezig…' : 'AI-scan'}
                </Button>
              }
            >
              {aiBusy && !aiResult?.summary && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[12px] text-primary">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" /> AI leest de mails…
                </div>
              )}
              {aiResult?.summary && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-semibold text-primary">
                      <Sparkles className={cn('h-3.5 w-3.5', aiBusy && 'animate-pulse')} /> AI-samenvatting
                    </p>
                    {record?.ai_scanned_at && (
                      <span className="text-[10px] text-muted-foreground">bijgewerkt {fmtDateTime(record.ai_scanned_at)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-foreground">{aiResult.summary}</p>
                  {aiResult.updates.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {aiResult.updates.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {tasks.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Nog geen taken. Voeg toe of laat de AI de mails scannen.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {tasks.map((tk) => (
                    <div key={tk.id} className="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2">
                      <button
                        onClick={() => toggleTaskDone(tk)}
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          tk.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40',
                        )}
                      >
                        {tk.done && <Check className="h-3 w-3" />}
                      </button>
                      <span className={cn('min-w-0 flex-1 text-[13px]', tk.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                        {tk.title}
                      </span>
                      {tk.source === 'ai' && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      )}
                      <button onClick={() => removeTask(tk.id)} className="shrink-0 text-muted-foreground/50 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Nieuwe taak…"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                />
                <Button variant="outline" onClick={handleAddTask} disabled={!newTask.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Block>

            {/* Schip & berth-check */}
            <Block title="Schip & berth-check" icon={ShipWheel} badge={check ? <Badge className={cn('border', BC_TONE[check.verdict])}>{BC_LABEL[check.verdict]}</Badge> : undefined}>
              {particulars.length > 0 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {particulars.map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.label} className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{p.label}</div>
                          <div className="truncate text-[13px] font-medium text-foreground">{p.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-[12px]">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Klant / Opdrachtgever
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    list="pc-client-options"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    placeholder={call.company || 'Naam klant…'}
                    className="h-10"
                  />
                  <Button size="sm" variant="secondary" disabled={!record || clientSaving} onClick={saveClient}>
                    {clientSaving ? '…' : 'Opslaan'}
                  </Button>
                </div>
                <datalist id="pc-client-options">
                  {contactOpts.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Terminal</Label>
                <select
                  value={selectedTerminal?.name ?? ''}
                  onChange={(e) => setBcTerminal(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Kies terminal…</option>
                  {TERMINALS.map((tm) => (
                    <option key={tm.name} value={tm.name}>
                      {tm.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-[11px]">LOA (m)</Label>
                  <Input type="number" value={bcLoa} onChange={(e) => setBcLoa(e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Draft (m)</Label>
                  <Input type="number" value={bcDraft} onChange={(e) => setBcDraft(e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">DWT</Label>
                  <Input type="number" value={bcDwt} onChange={(e) => setBcDwt(e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Air draft (m)</Label>
                  <Input type="number" value={bcAir} onChange={(e) => setBcAir(e.target.value)} placeholder="—" />
                </div>
              </div>
              {check && selectedTerminal && (
                <div className="space-y-1.5">
                  {check.rows.map((r) => {
                    const meta =
                      r.status === 'ok'
                        ? { Icon: CheckCircle2, cls: 'text-emerald-600', txt: 'past' }
                        : r.status === 'nolimit'
                          ? { Icon: CheckCircle2, cls: 'text-emerald-600', txt: 'geen limiet' }
                          : r.status === 'exceed'
                            ? { Icon: XCircle, cls: 'text-rose-600', txt: 'overschrijdt' }
                            : { Icon: MinusCircle, cls: 'text-muted-foreground', txt: 'onbekend' };
                    const Icon = meta.Icon;
                    return (
                      <div key={r.label} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-[12px]">
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <Icon className={cn('h-4 w-4', meta.cls)} /> {r.label}
                        </span>
                        <span className="text-muted-foreground">
                          {r.vesselVal != null ? `${r.vesselVal} ${r.unit}` : '—'}
                          <span className="mx-1.5 opacity-50">/</span>
                          {r.noteNoLimit ? 'geen limiet' : r.limitVal != null ? `${r.limitVal} ${r.unit}` : 'n.b.'}
                          <span className={cn('ml-2 font-semibold', meta.cls)}>{meta.txt}</span>
                        </span>
                      </div>
                    );
                  })}
                  {selectedTerminal.outOfService && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Deze terminal is momenteel in onderhoud / niet in gebruik.
                    </p>
                  )}
                  {selectedTerminal.airDraftM != null && (
                    <p className="flex items-start gap-1.5 pt-1 text-[11px] text-amber-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Julianabrug-doorvaarthoogte {selectedTerminal.airDraftM} m geldt voor het Schottegat.
                    </p>
                  )}
                </div>
              )}
              {(call.cargoType || num(bcDraft) != null) && suggestions.length > 0 && (
                <div className="space-y-2 border-t border-border/50 pt-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                    <Navigation className="h-3.5 w-3.5 text-primary" /> Terminal-suggestie
                    {call.cargoType && (
                      <span className="font-normal text-muted-foreground">
                        {call.cargoType}
                        {cargoProduct ? ` → ${cargoProduct}` : ''}
                      </span>
                    )}
                  </p>
                  {suggestions.map((s, i) => (
                    <button
                      key={s.terminal.name}
                      onClick={() => setBcTerminal(s.terminal.name)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40',
                        i === 0 ? 'border-primary/40 bg-primary/5' : 'border-border/60',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {i === 0 && '★ '}
                          {s.terminal.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          max draft {s.terminal.maxDraftM != null ? `${s.terminal.maxDraftM} m` : 'n.b.'} ·
                          {s.terminal.noLoaLimit ? ' geen LOA-limiet' : s.terminal.maxLoaM != null ? ` LOA ${s.terminal.maxLoaM} m` : ' LOA n.b.'}
                        </p>
                      </div>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', s.productMatch === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                        {s.productMatch === 'confirmed' ? 'lading ✓' : 'ongec.'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Block>

            {/* Financieel overzicht */}
            <Block title="Financieel overzicht" icon={DollarSign}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/50 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Verwacht · nominatie</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {record?.nomination_amount != null
                      ? `${record.nomination_currency || 'USD'} ${record.nomination_amount.toLocaleString()}`
                      : '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    FDA totaal · {fdaLinks.length} FDA · {fdaLinks.reduce((s, f) => s + (f.total_invoices || 0), 0)} facturen
                  </div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {fdaLinks.some((f) => f.total_amount != null)
                      ? fdaLinks.reduce((s, f) => s + (f.total_amount || 0), 0).toLocaleString()
                      : '—'}
                  </div>
                </div>
              </div>
              {record?.nomination_amount == null && fdaLinks.length === 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">Voeg een nominatie/opbrengst toe of koppel een FDA om dit overzicht te vullen.</p>
              )}
            </Block>

            {/* Gekoppelde FDA */}
            <Block title="FDA & facturen" icon={FileSignature}>
              {fdaLinks.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Nog geen FDA aan deze aanloop gekoppeld.</p>
              ) : (
                <div className="space-y-1.5">
                  {fdaLinks.map((f) => (
                    <button
                      key={f.project_id}
                      onClick={() => navigate(`/fda-curacao?project=${f.project_id}`)}
                      className="flex w-full items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-left text-[12px] transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-foreground">{f.lbh_number || 'FDA'}</span>
                        <span className="ml-2 text-muted-foreground">{f.ship_name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                        {f.status && <Badge variant="outline" className="text-[10px]">{f.status}</Badge>}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={openFdaForCall}>
                <FileSignature className="mr-1.5 h-3.5 w-3.5" /> {fdaLinks.length ? 'Nieuwe FDA voor deze aanloop' : 'FDA aanmaken voor deze aanloop'}
              </Button>
            </Block>

            {/* Kaart */}
            <Block
              title={portLoc.name}
              icon={Navigation}
              defaultOpen={false}
              action={
                <div className="flex items-center gap-2">
                  <a href={marineTrafficUrl(call.imo, call.vessel)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">
                      MarineTraffic <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <a href={vesselFinderUrl(call.imo, call.vessel)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">
                      VesselFinder <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              }
            >
              <iframe
                title="port-map"
                className="h-[280px] w-full rounded-xl border border-border/60"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={osmEmbedUrl(portLoc)}
              />
              <p className="text-[11px] text-muted-foreground">Kaart toont de terminal/ligplaats. Live AIS-positie via MarineTraffic/VesselFinder.</p>
            </Block>

            {/* Documenten */}
            <Block title="Documenten" icon={ListChecks} badge={arrivalDocs.length + call.documents.length || undefined} defaultOpen={false}>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-foreground">
                  Arrival documents {arrivalDocs.length > 0 && <span className="font-normal text-muted-foreground">{arrivalDone}/{arrivalDocs.length}</span>}
                </p>
                {arrivalDocs.length === 0 && (
                  <Button size="sm" variant="outline" onClick={handleSeedArrivalDocs} disabled={busy}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Standaardlijst
                  </Button>
                )}
              </div>
              {arrivalDocs.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">Voeg de standaard arrival-documenten toe zodra het schip genomineerd is.</p>
              ) : (
                <div className="space-y-1.5">
                  {arrivalDocs.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{d.label}</span>
                      <button
                        onClick={() => cycleDocStatus(d)}
                        className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors', DOC_STATUS_CLS[d.status] || 'bg-muted text-muted-foreground')}
                        title="Klik om status te wisselen"
                      >
                        {d.status === 'pending' ? 'openstaand' : d.status === 'sent' ? 'verzonden' : 'ontvangen'}
                      </button>
                      <button onClick={() => removeDoc(d.id)} className="text-muted-foreground/50 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-border/50 pt-3">
                <p className="mb-2 text-[12px] font-semibold text-foreground">EDA / PDA / FDA &amp; bijlagen</p>
                {call.documents.length === 0 && docs.filter((d) => d.doc_kind === 'other').length === 0 ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">{t('portCalls.noDocs')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {call.documents.map((d, i) => (
                      <a
                        key={`${d.url}-${i}`}
                        href={d.url || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{d.label}</span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                    {docs
                      .filter((d) => d.doc_kind === 'other')
                      .map((d) => (
                        <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {d.url ? (
                            <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground hover:text-primary">
                              {d.label}
                            </a>
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{d.label}</span>
                          )}
                          <button onClick={() => removeDoc(d.id)} className="text-muted-foreground/50 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input placeholder="Documentnaam" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} className="sm:flex-1" />
                  <Input placeholder="URL (optioneel)" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} className="sm:flex-1" />
                  <Button variant="outline" onClick={handleAddDoc} disabled={!docLabel.trim()}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Toevoegen
                  </Button>
                </div>
              </div>
            </Block>

            {/* Communicatie */}
            <Block title="Communicatie" icon={Mail} badge={comms.length || undefined} defaultOpen={false}>
              <ol className="relative space-y-1 border-l border-border/60 pl-5">
                {comms.map((e: PCEmail) => {
                  const sm = statusMeta(e.status);
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                      <button
                        onClick={() => navigate(`/inquiries?emailId=${e.id}`)}
                        className="group w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">{fmtDateTime(e.sent_at || e.created_at)}</span>
                          <Badge variant="outline" className={cn('text-[10px]', sm.cls)}>
                            {sm.label}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px] font-medium text-foreground group-hover:text-primary">
                          {e.subject || t('portCalls.noSubject')}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Block>
          </div>

          {/* RIGHT: SOF event log */}
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-base font-semibold">
                <Clock className="h-4 w-4 text-primary" /> Statement of Facts
                <span className="text-sm font-normal text-muted-foreground">({events.length})</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {callType && (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    {showAllEvents ? 'Alle events' : callType === 'cargo_agent' ? 'Cargo-events' : 'Owner’s-events'}
                  </span>
                  <button onClick={() => setShowAllEvents((v) => !v)} className="text-[11px] font-medium text-primary hover:underline">
                    {showAllEvents ? 'Toon relevante' : 'Toon alle'}
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {quickKeys.map((k) => (
                  <button
                    key={k}
                    onClick={() => quickAdd(k)}
                    disabled={!record}
                    className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                    title={SOF_BY_KEY[k]?.definition}
                  >
                    + {eventLabel(k)}
                  </button>
                ))}
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Kies een event…</option>
                  {SOF_PHASES.map((ph) => {
                    const opts = SOF_EVENTS.filter((e) => e.phase === ph.key && eventApplies(e, filterType));
                    if (!opts.length) return null;
                    return (
                      <optgroup key={ph.key} label={ph.label}>
                        {opts.map((e) => (
                          <option key={e.key} value={e.key}>
                            {e.label}
                            {e.requiresReason ? ' *' : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <Input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                <Textarea
                  placeholder={newDef?.requiresReason ? 'Reden / opmerking (verplicht)…' : 'Opmerking (optioneel)…'}
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  rows={2}
                  className={cn('resize-none', reasonNeeded && 'border-amber-400')}
                />
                {reasonNeeded && <p className="text-[11px] text-amber-600">Dit event vereist een reden in de opmerking.</p>}
                <Button className="w-full" onClick={handleAddEvent} disabled={!newType || busy || reasonNeeded}>
                  <Plus className="mr-1.5 h-4 w-4" /> Event toevoegen
                </Button>
              </div>

              {events.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nog geen events gelogd. Voeg ETA, anchored, ETB enz. toe.</p>
              ) : (
                <ol className="relative space-y-1 border-l border-border/60 pl-4">
                  {events.map((e) => {
                    const def = SOF_BY_KEY[e.event_type];
                    const editing = editId === e.id;
                    return (
                      <li key={e.id} className="relative">
                        <span className={cn('absolute -left-[21px] top-2.5 h-2.5 w-2.5 rounded-full border-2 border-card', def ? PHASE_DOT[def.phase] : 'bg-muted-foreground')} />
                        {editing ? (
                          <div className="space-y-2 rounded-lg border border-border/60 p-2">
                            <Input type="datetime-local" value={editTime} onChange={(ev) => setEditTime(ev.target.value)} />
                            <Textarea value={editRemark} onChange={(ev) => setEditRemark(ev.target.value)} rows={2} placeholder="Opmerking…" className="resize-none" />
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" onClick={saveEdit}>
                                <Check className="mr-1 h-3.5 w-3.5" /> Opslaan
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="group rounded-lg px-2 py-1.5 hover:bg-muted/40">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{fmtDateTime(e.event_time)}</span>
                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button onClick={() => startEdit(e)} className="text-muted-foreground hover:text-primary">
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button onClick={() => removeEvent(e.id)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <p className="text-[13px] font-medium text-foreground">{eventLabel(e.event_type)}</p>
                            {e.remark && <p className="text-[12px] text-muted-foreground">{e.remark}</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {/* Nomination dialog */}
      <Dialog open={nomOpen} onOpenChange={setNomOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Nominatie &amp; opbrengst
            </DialogTitle>
            <DialogDescription>Nominatie, opbrengst en planning voor {call.vessel}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-foreground">Genomineerd</p>
                <p className="text-[11px] text-muted-foreground">Schip is aan ons toegewezen voor deze port call.</p>
              </div>
              <Switch checked={nominated} onCheckedChange={setNominated} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Status</Label>
              <select
                value={record?.status ?? 'expected'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {LIFECYCLE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {LIFECYCLE_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Opbrengst / agency fee</Label>
                <div className="flex gap-2">
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Principal</Label>
                <Input value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="Opdrachtgever" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[12px]">ETA</Label>
                <Input type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">ETB</Label>
                <Input type="datetime-local" value={etb} onChange={(e) => setEtb(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">ETD</Label>
                <Input type="datetime-local" value={etd} onChange={(e) => setEtd(e.target.value)} />
              </div>
            </div>
            {amount.trim() && (
              <p className="text-[13px] text-muted-foreground">
                Verdiensten op deze port call: <span className="font-bold text-foreground">{currency} {Number(amount).toLocaleString()}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNomOpen(false)}>
              Sluiten
            </Button>
            <Button onClick={saveNomination} disabled={busy}>
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* n8n draft dialog (concept-only) */}
      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Concept aanmaken</DialogTitle>
            <DialogDescription>n8n maakt alleen een Outlook-concept aan voor {call.vessel}. Er wordt niets verzonden.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Documenttype</Label>
              <select value={draftType} onChange={(e) => onDraftTypeChange(e.target.value as DocType)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                {(['arrival_notice', 'SOF', 'NOR', 'PDA', 'FDA'] as DocType[]).map((tp) => (
                  <option key={tp} value={tp}>
                    {DOC_TYPE_LABEL[tp]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Aan (komma-gescheiden)</Label>
                <Input value={draftTo} onChange={(e) => setDraftTo(e.target.value)} placeholder="ops@principal.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">CC</Label>
                <Input value={draftCc} onChange={(e) => setDraftCc(e.target.value)} placeholder="agency@lbh.cw" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Onderwerp</Label>
              <Input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">n8n webhook-URL</Label>
              <Input value={draftWebhook} onChange={(e) => setDraftWebhook(e.target.value)} placeholder="https://…app.n8n.cloud/webhook/…" />
              <p className="text-[11px] text-muted-foreground">
                Al ingesteld op de LBH-koppeling. De aanroep stuurt altijd <code>draft:true</code> — n8n maakt een Outlook-concept aan, verstuurt nooit.
              </p>
            </div>
            {draftResult && (
              <div className={cn('rounded-lg px-3 py-2 text-[12px]', draftResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                {draftResult.ok ? (
                  draftResult.draft_url ? (
                    <a href={draftResult.draft_url} target="_blank" rel="noreferrer" className="font-medium underline">
                      Concept openen in Outlook →
                    </a>
                  ) : (
                    'Concept aangemaakt in n8n.'
                  )
                ) : (
                  draftResult.error
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraftOpen(false)}>
              Sluiten
            </Button>
            <Button onClick={handleCreateDraft} disabled={draftBusy || !draftWebhook.trim() || !draftTo.trim()}>
              <Mail className="mr-1.5 h-4 w-4" /> {draftBusy ? 'Bezig…' : 'Concept aanmaken'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
