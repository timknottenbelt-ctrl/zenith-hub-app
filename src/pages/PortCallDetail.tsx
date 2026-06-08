import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchPortCalls, getCachedPortCalls, type PortCall, type PCStage, type PCEmail } from '@/lib/portCalls';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Ship,
  Anchor,
  MapPin,
  Package,
  Calendar,
  Building2,
  FileText,
  ExternalLink,
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  Hash,
  Ruler,
  Gauge,
} from 'lucide-react';

const STAGE_ORDER: PCStage[] = ['inquiry', 'quoted', 'fda'];
const STAGE_LABEL: Record<PCStage, string> = {
  inquiry: 'portCalls.stageInquiry',
  quoted: 'portCalls.stageQuoted',
  fda: 'portCalls.stageFda',
};

function fmtDateTime(iso: string): string {
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

function statusMeta(status: string | null): { label: string; cls: string } {
  switch (status) {
    case 'sent':
      return { label: 'Sent', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'approved':
      return { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
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

function emailCategory(type: string | null): string | null {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t.includes('CARGO') || t.includes('LOADING') || t.includes('DISCHARGE')) return 'Cargo';
  if (t.includes('OWNER')) return 'Owners';
  if (t.includes('OUT')) return 'Off-scope';
  return null;
}

export default function PortCallDetail() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { key = '' } = useParams();
  const decodedKey = decodeURIComponent(key);

  const [call, setCall] = useState<PortCall | null>(() => getCachedPortCalls()?.find((c) => c.key === decodedKey) ?? null);
  const [loading, setLoading] = useState(!call);

  useEffect(() => {
    let active = true;
    if (call) return;
    (async () => {
      const data = await fetchPortCalls();
      if (!active) return;
      setCall(data.find((c) => c.key === decodedKey) ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decodedKey]);

  // Timeline newest-first.
  const timeline = useMemo(() => (call ? [...call.emails].reverse() : []), [call]);

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

  const reachedIdx = STAGE_ORDER.indexOf(call.stage);
  const particulars = [
    { icon: Hash, label: 'IMO', value: call.imo },
    { icon: Gauge, label: 'GT', value: call.grt ? call.grt.toLocaleString() : null },
    { icon: Ruler, label: 'LOA', value: call.loa ? `${call.loa} m` : null },
    { icon: Calendar, label: 'ETA', value: call.eta ? fmtDateTime(call.eta) : null },
    { icon: MapPin, label: t('portCalls.terminal'), value: call.terminal || call.port },
    {
      icon: Package,
      label: t('portCalls.cargo'),
      value: call.cargoType
        ? `${call.cargoType}${call.cargoQuantity ? ` · ${call.cargoQuantity.toLocaleString()} MT` : ''}`
        : call.category === 'owners'
          ? t('portCalls.services')
          : null,
    },
    { icon: Building2, label: t('portCalls.client'), value: call.company },
  ].filter((p) => p.value);

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
                  {t('portCalls.voyageSince')} {fmtDateTime(call.firstAt).split(',')[0]}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              {call.category === 'cargo'
                ? t('portCalls.cargoAgent')
                : call.category === 'owners'
                  ? t('portCalls.ownersAgent')
                  : t('portCalls.general')}
            </Badge>
          </div>

          {/* Lifecycle strip */}
          <div className="flex items-center gap-1 px-6 py-4">
            {STAGE_ORDER.map((s, i) => {
              const done = i <= reachedIdx;
              const Icon = i < reachedIdx ? CheckCircle2 : i === reachedIdx ? Clock : Anchor;
              return (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium',
                      done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t(STAGE_LABEL[s])}
                  </div>
                  {i < STAGE_ORDER.length - 1 && (
                    <div className={cn('h-px flex-1', i < reachedIdx ? 'bg-primary/40' : 'bg-border')} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Particulars */}
          {particulars.length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border/50 px-6 py-4 sm:grid-cols-3 lg:grid-cols-4">
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
          {/* Timeline */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-primary" /> {t('portCalls.timeline')}
                <span className="text-sm font-normal text-muted-foreground">({timeline.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-1 border-l border-border/60 pl-5">
                {timeline.map((e: PCEmail) => {
                  const sm = statusMeta(e.status);
                  const cat = emailCategory(e['Email Type']);
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                      <button
                        onClick={() => navigate(`/inquiries?emailId=${e.id}`)}
                        className="group w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">{fmtDateTime(e.sent_at || e.created_at)}</span>
                          <div className="flex items-center gap-1.5">
                            {cat && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {cat}
                              </span>
                            )}
                            <Badge variant="outline" className={cn('text-[10px]', sm.cls)}>
                              {sm.label}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px] font-medium text-foreground group-hover:text-primary">
                          {e.subject || t('portCalls.noSubject')}
                        </p>
                        {(e.contact_name || e.missing_information) && (
                          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            {e.contact_name && <span>{e.contact_name}</span>}
                            {e.missing_information && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <AlertCircle className="h-3 w-3" /> {t('portCalls.incomplete')}
                              </span>
                            )}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" /> {t('portCalls.documents')}
                <span className="text-sm font-normal text-muted-foreground">({call.documents.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {call.documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('portCalls.noDocs')}</p>
              ) : (
                <div className="space-y-2">
                  {call.documents.map((d, i) => (
                    <a
                      key={`${d.url}-${i}`}
                      href={d.url || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 transition-colors',
                        d.url ? 'hover:border-primary/40 hover:bg-muted/40' : 'pointer-events-none opacity-60',
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{d.label}</p>
                        {d.at && <p className="text-[11px] text-muted-foreground">{fmtDateTime(d.at).split(',')[0]}</p>}
                      </div>
                      {d.url && <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
