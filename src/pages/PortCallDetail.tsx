import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
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
  type PortCallRecord,
  type PortCallEvent,
  type PortCallDoc,
} from '@/lib/portCallOps';
import { resolvePortLoc, osmEmbedUrl, marineTrafficUrl } from '@/lib/curacaoPorts';
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

// Logging certain milestones advances the dossier's high-level lifecycle.
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

const DOC_STATUS_CYCLE = ['pending', 'sent', 'received'] as const;
const DOC_STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-emerald-100 text-emerald-700',
};

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

  // Nomination form
  const [nominated, setNominated] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [principal, setPrincipal] = useState('');
  const [eta, setEta] = useState('');
  const [etb, setEtb] = useState('');
  const [etd, setEtd] = useState('');

  // New custom doc
  const [docLabel, setDocLabel] = useState('');
  const [docUrl, setDocUrl] = useState('');

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
        const [evs, dcs] = await Promise.all([loadEvents(rec.id), loadDocs(rec.id)]);
        if (!active) return;
        setEvents(evs);
        setDocs(dcs);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedKey]);

  const opsStatus = useMemo(() => deriveOpsStatus(events), [events]);
  const portLoc = useMemo(
    () => resolvePortLoc(record?.terminal, call?.terminal, call?.port),
    [record?.terminal, call?.terminal, call?.port],
  );
  const comms = useMemo(() => (call ? [...call.emails].reverse() : []), [call]);
  const arrivalDocs = docs.filter((d) => d.doc_kind === 'arrival');
  const arrivalDone = arrivalDocs.filter((d) => d.status !== 'pending').length;

  async function reloadEvents(id: string) {
    setEvents(await loadEvents(id));
  }
  async function reloadDocs(id: string) {
    setDocs(await loadDocs(id));
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
    // Events that need a reason can't be one-click logged — open the form instead.
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
    toast({ title: 'Opgeslagen' });
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
    { icon: Building2, label: t('portCalls.client'), value: principal || call.company },
  ].filter((p) => p.value);

  const etaRow = [
    { label: 'ETA', value: record?.eta },
    { label: 'ETB', value: record?.etb },
    { label: 'ETD', value: record?.etd },
  ];

  // Call type drives which SOF events / arrival docs are relevant.
  const callType: AppliesTo | null =
    call.category === 'cargo' ? 'cargo_agent' : call.category === 'owners' ? 'owners_agent' : null;
  const filterType = showAllEvents ? null : callType;
  const quickKeys = QUICK_KEYS.filter((k) => SOF_BY_KEY[k] && eventApplies(SOF_BY_KEY[k], filterType));
  const newDef = newType ? SOF_BY_KEY[newType] : null;
  const reasonNeeded = !!newDef?.requiresReason && !newRemark.trim();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/port-calls')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('portCalls.back')}
        </Button>

        {/* Vessel header */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-primary to-blue-700 px-6 py-5 text-white">
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
            </div>
          </div>

          {/* ETA / ETB / ETD strip */}
          <div className="grid grid-cols-3 divide-x divide-border/50 border-b border-border/50">
            {etaRow.map((r) => (
              <div key={r.label} className="px-6 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</div>
                <div className="text-[13px] font-medium text-foreground">{fmtDateTime(r.value ?? null)}</div>
              </div>
            ))}
          </div>

          {/* Particulars */}
          {particulars.length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4 sm:grid-cols-3 lg:grid-cols-6">
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
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT: tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overzicht</TabsTrigger>
                <TabsTrigger value="documents">
                  Documenten
                  {(arrivalDocs.length > 0 || call.documents.length > 0) && (
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {arrivalDocs.length + call.documents.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="comms">
                  Communicatie <span className="ml-1.5 text-[11px] text-muted-foreground">{comms.length}</span>
                </TabsTrigger>
              </TabsList>

              {/* OVERVIEW: map + nomination/revenue */}
              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Navigation className="h-4 w-4 text-primary" /> {portLoc.name}
                    </CardTitle>
                    <a href={marineTrafficUrl(call.imo, call.vessel)} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        Live op MarineTraffic <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </CardHeader>
                  <CardContent>
                    <iframe
                      title="port-map"
                      className="h-[280px] w-full rounded-xl border border-border/60"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={osmEmbedUrl(portLoc)}
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Kaart toont de terminal/ligplaats. Live AIS-positie via de MarineTraffic-knop.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-4 w-4 text-primary" /> Nominatie &amp; opbrengst
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Genomineerd</p>
                        <p className="text-[11px] text-muted-foreground">Schip is aan ons toegewezen voor deze aanloop.</p>
                      </div>
                      <Switch checked={nominated} onCheckedChange={setNominated} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[12px]">Opbrengst / agency fee</Label>
                        <div className="flex gap-2">
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
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

                    <div className="flex items-center justify-between">
                      {amount.trim() ? (
                        <p className="text-[13px] text-muted-foreground">
                          Verdiensten op deze aanloop:{' '}
                          <span className="font-bold text-foreground">
                            {currency} {Number(amount).toLocaleString()}
                          </span>
                        </p>
                      ) : (
                        <span />
                      )}
                      <Button onClick={saveNomination} disabled={busy}>
                        Opslaan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* DOCUMENTS */}
              <TabsContent value="documents" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ListChecks className="h-4 w-4 text-primary" /> Arrival documents
                      {arrivalDocs.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          {arrivalDone}/{arrivalDocs.length}
                        </span>
                      )}
                    </CardTitle>
                    {arrivalDocs.length === 0 && (
                      <Button size="sm" variant="outline" onClick={handleSeedArrivalDocs} disabled={busy}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Standaardlijst
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {arrivalDocs.length === 0 ? (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        Voeg de standaard arrival-documenten toe zodra het schip genomineerd is.
                      </p>
                    ) : (
                      arrivalDocs.map((d) => (
                        <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{d.label}</span>
                          <button
                            onClick={() => cycleDocStatus(d)}
                            className={cn(
                              'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
                              DOC_STATUS_CLS[d.status] || 'bg-muted text-muted-foreground',
                            )}
                            title="Klik om status te wisselen"
                          >
                            {d.status === 'pending' ? 'openstaand' : d.status === 'sent' ? 'verzonden' : 'ontvangen'}
                          </button>
                          <button onClick={() => removeDoc(d.id)} className="text-muted-foreground/50 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-primary" /> EDA / PDA / FDA &amp; bijlagen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {call.documents.length === 0 && docs.filter((d) => d.doc_kind === 'other').length === 0 ? (
                      <p className="py-2 text-center text-sm text-muted-foreground">{t('portCalls.noDocs')}</p>
                    ) : (
                      <>
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
                                <a
                                  href={d.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground hover:text-primary"
                                >
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
                      </>
                    )}
                    <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                      <Input
                        placeholder="Documentnaam"
                        value={docLabel}
                        onChange={(e) => setDocLabel(e.target.value)}
                        className="sm:flex-1"
                      />
                      <Input
                        placeholder="URL (optioneel)"
                        value={docUrl}
                        onChange={(e) => setDocUrl(e.target.value)}
                        className="sm:flex-1"
                      />
                      <Button variant="outline" onClick={handleAddDoc} disabled={!docLabel.trim()}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Toevoegen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* COMMUNICATIONS */}
              <TabsContent value="comms">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mail className="h-4 w-4 text-primary" /> {t('portCalls.timeline')}
                      <span className="text-sm font-normal text-muted-foreground">({comms.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT: SOF event log */}
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> Statement of Facts
                <span className="text-sm font-normal text-muted-foreground">({events.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Call-type filter toggle */}
              {callType && (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    {showAllEvents ? 'Alle events' : callType === 'cargo_agent' ? 'Cargo-events' : 'Owner’s-events'}
                  </span>
                  <button
                    onClick={() => setShowAllEvents((v) => !v)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
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
                {reasonNeeded && (
                  <p className="text-[11px] text-amber-600">Dit event vereist een reden in de opmerking.</p>
                )}
                <Button className="w-full" onClick={handleAddEvent} disabled={!newType || busy || reasonNeeded}>
                  <Plus className="mr-1.5 h-4 w-4" /> Event toevoegen
                </Button>
              </div>

              {events.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nog geen events gelogd. Voeg ETA, anchored, ETB enz. toe.
                </p>
              ) : (
                <ol className="relative space-y-1 border-l border-border/60 pl-4">
                  {events.map((e) => {
                    const def = SOF_BY_KEY[e.event_type];
                    const editing = editId === e.id;
                    return (
                      <li key={e.id} className="relative">
                        <span
                          className={cn(
                            'absolute -left-[21px] top-2.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                            def ? PHASE_DOT[def.phase] : 'bg-muted-foreground',
                          )}
                        />
                        {editing ? (
                          <div className="space-y-2 rounded-lg border border-border/60 p-2">
                            <Input type="datetime-local" value={editTime} onChange={(ev) => setEditTime(ev.target.value)} />
                            <Textarea
                              value={editRemark}
                              onChange={(ev) => setEditRemark(ev.target.value)}
                              rows={2}
                              placeholder="Opmerking…"
                              className="resize-none"
                            />
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
                              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                                {fmtDateTime(e.event_time)}
                              </span>
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
      </div>
    </DashboardLayout>
  );
}
