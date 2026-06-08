import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchPortCalls, getCachedPortCalls, type PortCall, type PCStage } from '@/lib/portCalls';
import { cn } from '@/lib/utils';
import {
  Ship,
  Search,
  RefreshCw,
  Anchor,
  MapPin,
  Mail,
  FileText,
  Package,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

const STAGE_META: Record<PCStage, { key: string; dot: string; badge: string }> = {
  inquiry: { key: 'portCalls.stageInquiry', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  quoted: { key: 'portCalls.stageQuoted', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  fda: { key: 'portCalls.stageFda', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function PortCalls() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<PortCall[]>(() => getCachedPortCalls() ?? []);
  const [loading, setLoading] = useState(!getCachedPortCalls());
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = async () => {
    setRefreshing(true);
    const data = await fetchPortCalls();
    setCalls(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter(
      (c) =>
        c.vessel.toLowerCase().includes(q) ||
        (c.imo || '').toLowerCase().includes(q) ||
        (c.port || '').toLowerCase().includes(q) ||
        (c.terminal || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        (c.cargoType || '').toLowerCase().includes(q),
    );
  }, [calls, query]);

  const kpis = useMemo(() => {
    const open = calls.filter((c) => c.stage === 'inquiry' || c.hasOpen).length;
    const vessels = new Set(calls.map((c) => c.slug)).size;
    const docs = calls.reduce((n, c) => n + c.documents.length, 0);
    return { total: calls.length, open, vessels, docs };
  }, [calls]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-blue-700 p-6 text-white">
          <div className="absolute -right-8 -top-8 opacity-10">
            <Anchor className="h-44 w-44" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-white/70">
              <Ship className="h-4 w-4" /> LBH Curaçao
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{t('portCalls.title')}</h1>
            <p className="mt-1 max-w-xl text-[13px] text-white/80">{t('portCalls.subtitle')}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('portCalls.kpiCalls'), value: kpis.total },
                { label: t('portCalls.kpiOpen'), value: kpis.open },
                { label: t('portCalls.kpiVessels'), value: kpis.vessels },
                { label: t('portCalls.kpiDocs'), value: kpis.docs },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="text-2xl font-bold tabular-nums">{k.value}</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-white/70">{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('portCalls.searchPlaceholder')}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={load} disabled={refreshing} title={t('common.refresh')}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Anchor className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-foreground">{t('portCalls.emptyTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('portCalls.emptyBody')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => {
              const sm = STAGE_META[c.stage];
              return (
                <button
                  key={c.key}
                  onClick={() => navigate(`/port-calls/${encodeURIComponent(c.key)}`)}
                  className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', sm.dot)} />
                        <h3 className="truncate text-[15px] font-bold tracking-tight text-foreground">{c.vessel}</h3>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {c.imo ? `IMO ${c.imo}` : t('portCalls.noImo')}
                        {c.company ? ` · ${c.company}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px]', sm.badge)}>
                      {t(sm.key)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12px]">
                    <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {c.terminal || c.port || t('portCalls.portTbd')}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      {c.cargoType
                        ? `${c.cargoType}${c.cargoQuantity ? ` · ${c.cargoQuantity.toLocaleString()} MT` : ''}`
                        : c.category === 'owners'
                          ? t('portCalls.services')
                          : '—'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[12px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" /> {c.emails.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> {c.documents.length}
                      </span>
                      {c.hasIncomplete && (
                        <span className="flex items-center gap-1 text-amber-600" title={t('portCalls.incomplete')}>
                          <AlertCircle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1">
                      {fmtDate(c.lastAt)}
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
