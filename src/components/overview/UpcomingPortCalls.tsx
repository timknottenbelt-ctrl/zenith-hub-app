import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchPortCalls, getCachedPortCalls, type PortCall } from '@/lib/portCalls';
import { lifecycleMeta, isOpenLifecycle } from '@/lib/portCallStatus';
import { cn } from '@/lib/utils';
import { Ship, MapPin, Calendar, ChevronRight, Anchor } from 'lucide-react';

function fmtEta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch {
    return null;
  }
}

/** Compact "upcoming port calls" board for the dashboard home, sorted by ETA. */
export function UpcomingPortCalls() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<PortCall[]>(() => getCachedPortCalls() ?? []);

  useEffect(() => {
    let active = true;
    fetchPortCalls().then((d) => active && setCalls(d));
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => {
    return calls
      .filter((c) => isOpenLifecycle(c.recordStatus))
      .sort((a, b) => {
        if (a.eta && b.eta) return a.eta.localeCompare(b.eta);
        if (a.eta) return -1;
        if (b.eta) return 1;
        return b.lastAt.localeCompare(a.lastAt);
      })
      .slice(0, 6);
  }, [calls]);

  if (!list.length) return null;

  return (
    <Card className="card-premium">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Anchor className="h-5 w-5 text-primary" /> Aankomende port calls
        </CardTitle>
        <button
          onClick={() => navigate('/port-calls')}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          Alle bekijken →
        </button>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-1.5">
          {list.map((c) => {
            const lc = lifecycleMeta(c.recordStatus);
            const eta = fmtEta(c.eta);
            return (
              <button
                key={c.key}
                onClick={() => navigate(`/port-calls/${encodeURIComponent(c.key)}`)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Ship className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">{c.vessel}</p>
                  <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {c.terminal || c.port || 'Terminal n.t.b.'}
                  </p>
                </div>
                {eta && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {eta}
                  </span>
                )}
                {lc && (
                  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', lc.tone)}>
                    {lc.label}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
