import { useMemo, useCallback, memo, startTransition } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  FileText,
  ArrowRight,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  Inbox,
  AlertCircle,
  Globe,
  TrendingUp,
  Ship,
  ArrowUpRight,
} from 'lucide-react';

// Memoized stat card component
const StatRow = memo(function StatRow({ 
  label, 
  value, 
  className,
  onClick 
}: { 
  label: string; 
  value: number; 
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div 
      className={`flex items-center justify-between p-2 rounded-lg transition-colors ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <span className="text-sm font-medium">{label}</span>
      <Badge variant="secondary" className="font-semibold">{value}</Badge>
    </div>
  );
});

// Compact KPI tile for the hero strip
const KpiTile = memo(function KpiTile({
  label,
  value,
  icon: Icon,
  accent,
  sub,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'primary' | 'success' | 'info' | 'warning';
  sub?: React.ReactNode;
  onClick?: () => void;
}) {
  const accentMap = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
  } as const;
  return (
    <Card
      className={`card-premium group relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-lg transition-all' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg ${accentMap[accent]}`}>
            <Icon className="w-4 h-4" />
          </div>
          {onClick && (
            <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
        <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
        {sub && <div className="mt-2">{sub}</div>}
      </CardContent>
    </Card>
  );
});

// Custom tooltip for the activity chart
function ActivityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-primary" />
        Ontvangen: <span className="font-semibold text-foreground">{payload[0]?.payload?.received ?? 0}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
        <span className="w-2 h-2 rounded-full bg-success" />
        Verzonden: <span className="font-semibold text-foreground">{payload[0]?.payload?.sent ?? 0}</span>
      </div>
    </div>
  );
}

// Fetch all dashboard data in parallel
async function fetchDashboardData() {
  const [
    emailsResult,
    vesselCountResult,
    contactCountResult,
    fdaCreatorCountResult,
    fdaCuracaoCountResult,
    fdaDraftsResult,
    curacaoProjectsResult,
  ] = await Promise.all([
    (supabase.from('email').select('id, subject, email_to_person, created_at, status, "Email Type", vessel_name, missing_information') as any).eq('archived', false),
    supabase.from('vessels').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('fda_projects').select('*', { count: 'exact', head: true }),
    supabase.from('fda_curacao_projects').select('*', { count: 'exact', head: true }),
    supabase.from('fda_email_drafts').select('id, project_id, status'),
    supabase.from('fda_curacao_projects').select('project_id'),
  ]);

  const emails = emailsResult.data || [];
  const fdaDrafts = fdaDraftsResult.data || [];
  const curacaoProjects = curacaoProjectsResult.data || [];
  
  const curacaoProjectIds = new Set(curacaoProjects.map(p => p.project_id));
  const fdaSentDrafts = fdaDrafts.filter(d => d.status === 'sent');
  const fdaCwSentCount = fdaSentDrafts.filter(d => curacaoProjectIds.has(d.project_id)).length;
  const fdaSentCount = fdaSentDrafts.filter(d => !curacaoProjectIds.has(d.project_id)).length;

  const draftEmails = emails.filter(e => e.status === 'draft');
  
  // Count only drafts with a valid Email Type for the breakdown
  const cargoAgent = draftEmails.filter(e => e['Email Type']?.toUpperCase().includes('CARGO')).length;
  const ownersAgent = draftEmails.filter(e => e['Email Type']?.toUpperCase().includes('OWNER')).length;
  const outOfScope = draftEmails.filter(e => 
    e['Email Type']?.toUpperCase().includes('OUT OF SCOPE') || 
    e['Email Type']?.toUpperCase().includes('OUT_OF_SCOPE')
  ).length;
  const incomplete = emails.filter(e => 
    e.missing_information || 
    e['Email Type']?.toUpperCase().includes('INCOMPLETE') ||
    e['Email Type']?.toLowerCase().includes('pending_info')
  ).length;
  
  // Total ready = only emails with a valid category (not null/empty Email Type)
  const totalReady = cargoAgent + ownersAgent + outOfScope;

  // ── 14-day activity series (received vs sent per day) ──
  const DAYS = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series: { key: string; label: string; received: number; sent: number }[] = [];
  const idx: Record<string, number> = {};
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    idx[key] = series.length;
    series.push({
      key,
      label: d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      received: 0,
      sent: 0,
    });
  }
  for (const e of emails) {
    if (!e.created_at) continue;
    const key = new Date(e.created_at).toISOString().slice(0, 10);
    const pos = idx[key];
    if (pos === undefined) continue;
    series[pos].received += 1;
    if (e.status === 'sent') series[pos].sent += 1;
  }
  const last7 = emails.filter((e) => {
    if (!e.created_at) return false;
    const diff = today.getTime() - new Date(e.created_at).getTime();
    return diff >= 0 && diff < 7 * 24 * 3600 * 1000;
  }).length;
  const prev7 = emails.filter((e) => {
    if (!e.created_at) return false;
    const diff = today.getTime() - new Date(e.created_at).getTime();
    return diff >= 7 * 24 * 3600 * 1000 && diff < 14 * 24 * 3600 * 1000;
  }).length;
  const trendPct = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round(((last7 - prev7) / prev7) * 100);

  return {
    activity: series,
    trend: { last7, prev7, trendPct },
    stats: {
      cargoAgent,
      ownersAgent,
      outOfScope,
      incomplete,
      totalReady,
      pdaSent: emails.filter(e => e.status === 'sent').length,
      fdaSent: fdaSentCount,
      fdaCwSent: fdaCwSentCount,
      rejected: emails.filter(e => e.status === 'rejected').length,
      vessels: vesselCountResult.count || 0,
      contacts: contactCountResult.count || 0,
      fdaCreatorCount: fdaCreatorCountResult.count || 0,
      fdaCuracaoCount: fdaCuracaoCountResult.count || 0,
    },
    recentEmails: emails
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
  };
}

export default function Overview() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
  const firstName = (user?.user_metadata?.name || user?.email || '').split(/[ @]/)[0];
  
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchDashboardData,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  const stats = data?.stats || {
    cargoAgent: 0, ownersAgent: 0, outOfScope: 0, incomplete: 0, totalReady: 0,
    pdaSent: 0, fdaSent: 0, fdaCwSent: 0, rejected: 0,
    vessels: 0, contacts: 0, fdaCreatorCount: 0, fdaCuracaoCount: 0,
  };
  const recentEmails = data?.recentEmails || [];
  const activity = data?.activity || [];
  const trend = data?.trend || { last7: 0, prev7: 0, trendPct: 0 };
  const fdaTotalSent = stats.fdaSent + stats.fdaCwSent;

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4" />;
      case 'approved': return <Send className="w-4 h-4" />;
      case 'sent': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  }, []);

  const getStatusBadgeClass = useCallback((status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'approved': return 'bg-info/10 text-info';
      case 'sent': return 'bg-success/10 text-success';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  }, []);

  const navigateTo = useCallback(
    (path: string) => () => {
      startTransition(() => navigate(path));
    },
    [navigate]
  );

  if (isLoading) {
    return (
      <DashboardLayout title={t('overview.title')}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('overview.title')}>
      <div className="space-y-8">
        {/* ── Command-center hero ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 text-white"
          style={{ background: 'linear-gradient(135deg, #0c2b63 0%, #0a1c45 48%, #070f24 100%)' }}>
          <div className="absolute -top-20 -left-10 w-[28rem] h-[28rem] rounded-full bg-[#1e63d4]/25 blur-[110px] pointer-events-none" />
          <div className="absolute bottom-[-8rem] right-[-4rem] w-[24rem] h-[24rem] rounded-full bg-[#0bb6c9]/12 blur-[120px] pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
          <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-7">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.25em] text-[#5fa8ff]/80 uppercase mb-2">LBH Command Center</p>
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight">
                {greeting}{firstName ? `, ${firstName}` : ''}.
              </h1>
              <p className="text-white/60 text-[14.5px] mt-2 leading-relaxed max-w-xl">
                <span className="text-white font-semibold">{stats.totalReady}</span> aanvragen wachten op review ·{' '}
                <span className="text-white font-semibold">{trend.last7}</span> binnen deze week ·{' '}
                <span className="text-white font-semibold">{stats.pdaSent}</span> PDA's verzonden.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 mt-5">
                <Button onClick={navigateTo('/inquiries')} className="h-10 rounded-xl bg-white text-[#0a1c45] font-semibold hover:bg-white/90 gap-2">
                  AI Aanvragen <ArrowRight className="w-4 h-4" />
                </Button>
                <Button onClick={navigateTo('/da-creator')} variant="outline" className="h-10 rounded-xl bg-white/[0.06] border-white/15 text-white hover:bg-white/[0.12] hover:text-white gap-2">
                  <FileText className="w-4 h-4" /> DA / PDA maken
                </Button>
                <Button onClick={navigateTo('/fda')} variant="outline" className="h-10 rounded-xl bg-white/[0.06] border-white/15 text-white hover:bg-white/[0.12] hover:text-white gap-2">
                  <FileText className="w-4 h-4" /> Nieuwe FDA
                </Button>
              </div>
            </div>
            {/* big focus number */}
            <div className="shrink-0 self-stretch lg:self-center">
              <div className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 px-7 py-5 text-center min-w-[180px]">
                <p className="text-5xl font-bold tabular-nums leading-none">{stats.totalReady}</p>
                <p className="text-[11px] uppercase tracking-widest text-white/55 mt-2">Wachten op review</p>
                <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend.trendPct >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                  <TrendingUp className={`w-3 h-3 ${trend.trendPct < 0 ? 'rotate-180' : ''}`} />
                  {trend.trendPct >= 0 ? '+' : ''}{trend.trendPct}% vs vorige week
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile
            label="Aanvragen klaar"
            value={stats.totalReady}
            icon={Inbox}
            accent="primary"
            onClick={navigateTo('/inquiries')}
            sub={
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <AlertCircle className="w-3 h-3 text-warning" /> {stats.incomplete} incompleet
              </span>
            }
          />
          <KpiTile
            label="PDA's verzonden"
            value={stats.pdaSent}
            icon={Send}
            accent="success"
            onClick={navigateTo('/inquiries/sent')}
          />
          <KpiTile
            label="FDA's verzonden"
            value={fdaTotalSent}
            icon={FileText}
            accent="info"
            onClick={navigateTo('/fda/history')}
            sub={
              <span className="text-xs text-muted-foreground">
                {stats.fdaSent} std · {stats.fdaCwSent} CW
              </span>
            }
          />
          <KpiTile
            label="Schepen"
            value={stats.vessels}
            icon={Ship}
            accent="primary"
          />
        </div>

        {/* Activity Chart */}
        <Card className="card-premium">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <CardTitle className="text-lg font-semibold">Activiteit</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Aanvragen per dag · laatste 14 dagen</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={`gap-1 font-semibold ${trend.trendPct >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
              >
                <TrendingUp className={`w-3.5 h-3.5 ${trend.trendPct < 0 ? 'rotate-180' : ''}`} />
                {trend.trendPct >= 0 ? '+' : ''}{trend.trendPct}%
              </Badge>
              <span className="text-xs text-muted-foreground">vs vorige week</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ActivityTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="received"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#gReceived)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    fill="url(#gSent)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-5 mt-3 pl-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Ontvangen
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-success" /> Verzonden
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Hero Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nieuwe Aanvragen */}
          <Card 
            className="card-premium bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-lg transition-all cursor-pointer group"
            onClick={navigateTo('/inquiries')}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nieuwe Aanvragen</p>
                  <p className="text-4xl font-bold text-primary">{stats.totalReady}</p>
                  <p className="text-xs text-muted-foreground mt-1">Klaar voor review</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Inbox className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <StatRow label="Cargo Agent" value={stats.cargoAgent} className="bg-background/50" />
                <StatRow label="Owners Agent" value={stats.ownersAgent} className="bg-background/50" />
                <StatRow label="Out of Scope" value={stats.outOfScope} className="bg-background/50" />
              </div>
              
              <div className="pt-3 border-t border-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{stats.incomplete} Incompleet</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verzonden Status */}
          <Card className="card-premium">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">Verzonden Status</p>
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
              <div className="space-y-3">
                <StatRow 
                  label="PDA's Sent" 
                  value={stats.pdaSent} 
                  className="bg-success/5 hover:bg-success/10" 
                  onClick={navigateTo('/inquiries/sent')} 
                />
                <StatRow 
                  label="FDA's Sent" 
                  value={stats.fdaSent} 
                  className="bg-primary/5 hover:bg-primary/10" 
                  onClick={navigateTo('/fda/history')} 
                />
                <StatRow 
                  label="FDA CW Sent" 
                  value={stats.fdaCwSent} 
                  className="bg-info/5 hover:bg-info/10" 
                  onClick={navigateTo('/fda-curacao/history')} 
                />
                <StatRow 
                  label="Rejected" 
                  value={stats.rejected} 
                  className="bg-destructive/5 hover:bg-destructive/10" 
                  onClick={navigateTo('/inquiries')} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FDA Overview Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="card-premium bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all cursor-pointer group"
            onClick={navigateTo('/fda')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">FDA Creator</p>
                  <p className="text-3xl font-bold mt-1">{stats.fdaCreatorCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Totaal projecten</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="card-premium bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all cursor-pointer group"
            onClick={navigateTo('/fda-curacao')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="p-4 rounded-2xl bg-info/10 group-hover:bg-info/20 transition-colors">
                  <Globe className="w-8 h-8 text-info" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">FDA Curaçao</p>
                  <p className="text-3xl font-bold mt-1">{stats.fdaCuracaoCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Totaal projecten</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Emails */}
        <Card className="card-premium">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold">Recente Aanvragen</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Laatste activiteit in AI Aanvragen</p>
            </div>
            <Button variant="outline" size="sm" onClick={navigateTo('/inquiries')} className="gap-2 w-full sm:w-auto">
              Bekijk alles <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentEmails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nog geen emails</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEmails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-start sm:items-center gap-3 p-3 sm:p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/50"
                    onClick={navigateTo('/inquiries')}
                  >
                    <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${getStatusBadgeClass(email.status)}`}>
                      {getStatusIcon(email.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{email.subject || 'No subject'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{email.email_to_person}</p>
                      {/* Mobile: Show status and date inline below */}
                      <div className="flex items-center gap-2 mt-1 sm:hidden">
                        <Badge className={`${getStatusBadgeClass(email.status)} font-medium text-xs`} variant="secondary">
                          {email.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(email.created_at).toLocaleDateString('nl-NL')}
                        </span>
                      </div>
                    </div>
                    {/* Desktop: Show status and date on the right */}
                    <div className="hidden sm:flex items-center gap-4 shrink-0">
                      <Badge className={`${getStatusBadgeClass(email.status)} font-medium`} variant="secondary">
                        {email.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground min-w-[80px] text-right">
                        {new Date(email.created_at).toLocaleDateString('nl-NL')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
