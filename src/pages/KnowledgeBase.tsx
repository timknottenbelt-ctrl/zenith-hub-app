import { useState, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import {
  Search, Plus, Pencil, Trash2, BookOpen, Package, Ship,
  X, Loader2, ChevronRight, Tag, FileText, Save, ArrowLeft,
  Hash, Zap, Shield, Anchor, MapPin, ClipboardList, DollarSign, Clock,
  ChevronLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface KBEntry {
  id: string;
  content: string;
  category?: string;
  topic?: string;
  metadata?: Record<string, unknown>;
  last_edited?: string;
}

type SortMode = "newest" | "oldest" | "alpha";
type ViewMode = "list" | "editor" | "detail";

const TABLE = "cargo_agent_knowledge" as const;
const PAGE_SIZE = 15;

const CATEGORIES = [
  { id: "all", label: "All Knowledge", icon: BookOpen },
  { id: "cargo_operations", label: "Cargo & Terminals", icon: Package },
  { id: "crew_change", label: "Crew Change", icon: Ship },
  { id: "owners_agent_tariffs", label: "Tariffs & Rates", icon: DollarSign },
  { id: "other", label: "Other", icon: Tag },
  { id: "documentation", label: "Documentation", icon: FileText },
  { id: "terminals", label: "Terminals", icon: Anchor },
  { id: "port_restrictions", label: "Port Restrictions", icon: Shield },
  { id: "safety", label: "Safety", icon: Shield },
  { id: "operational_planning", label: "Operational Planning", icon: ClipboardList },
  { id: "port_formalities", label: "Port Formalities", icon: MapPin },
];

const CATEGORY_COLORS: Record<string, string> = {
  cargo_operations: "bg-amber-50 text-amber-700",
  crew_change: "bg-cyan-50 text-cyan-700",
  owners_agent_tariffs: "bg-fuchsia-50 text-fuchsia-700",
  other: "bg-slate-50 text-slate-600",
  documentation: "bg-violet-50 text-violet-700",
  terminals: "bg-emerald-50 text-emerald-700",
  port_restrictions: "bg-red-50 text-red-700",
  safety: "bg-orange-50 text-orange-700",
  operational_planning: "bg-blue-50 text-blue-700",
  port_formalities: "bg-green-50 text-green-700",
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  cargo_operations: "#fbbf24",
  crew_change: "#67e8f9",
  owners_agent_tariffs: "#e879f9",
  other: "#94a3b8",
  documentation: "#a78bfa",
  terminals: "#34d399",
  port_restrictions: "#f87171",
  safety: "#fb923c",
  operational_planning: "#60a5fa",
  port_formalities: "#4ade80",
};

function getCat(entry: KBEntry): string {
  if (entry.category) return entry.category;
  if (entry.metadata?.category) return String(entry.metadata.category);
  const c = entry.content.toLowerCase();
  if (c.includes("crew change") || c.includes("cash to master") || c.includes("garbage") || c.includes("visa")) return "crew_change";
  if (c.includes("isla") || c.includes("bitumen") || c.includes("terminal") || c.includes("bunkering") || c.includes("bulk")) return "cargo_operations";
  if (c.includes("pilotage") || c.includes("tug") || c.includes("anchorage") || c.includes("loa limit")) return "port_restrictions";
  if (c.includes("safety") || c.includes("isgott") || c.includes("hse") || c.includes("ppe")) return "safety";
  if (c.includes("fee") || c.includes("tariff") || c.includes("coordination fee")) return "owners_agent_tariffs";
  return "other";
}

function getTopic(entry: KBEntry): string {
  if (entry.topic) return entry.topic;
  if (entry.metadata?.topic) return String(entry.metadata.topic);
  return "";
}

function getTitle(content: string): string {
  const first = content.split(/[.!?\n]/)[0].trim();
  return first.length > 72 ? first.slice(0, 69) + "…" : first;
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ─────────────────────────────────────────────────────────
export default function KnowledgeBase() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);

  // Editor
  const [editEntry, setEditEntry] = useState<KBEntry | null>(null);
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("other");
  const [formTopic, setFormTopic] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState("");

  // Detail
  const [detailEntry, setDetailEntry] = useState<KBEntry | null>(null);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("id, content, metadata")
        .order("id", { ascending: false });
      if (error) throw error;
      const mapped: KBEntry[] = (data || []).map((row) => {
        const meta = row.metadata as Record<string, unknown> | null;
        return {
          id: String(row.id),
          content: row.content || "",
          metadata: meta || undefined,
          category: meta?.category as string | undefined,
          topic: meta?.topic as string | undefined,
          last_edited: meta?.last_edited as string | undefined,
        };
      });
      setEntries(mapped);
    } catch {
      toast.error("Could not load knowledge base");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, activeCategory, sortMode]);

  // ── Filter + sort ──────────────────────────────────
  const filtered = useMemo(() => entries
    .filter((e) => {
      const matchCat = activeCategory === "all" || getCat(e) === activeCategory;
      const matchSearch = !search ||
        e.content.toLowerCase().includes(search.toLowerCase()) ||
        getTopic(e).toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortMode === "newest") return Number(b.id) - Number(a.id);
      if (sortMode === "oldest") return Number(a.id) - Number(b.id);
      return getTitle(a.content).localeCompare(getTitle(b.content));
    }), [entries, activeCategory, search, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showFrom = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(page * PAGE_SIZE, filtered.length);

  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    entries.forEach((e) => { const cat = getCat(e); c[cat] = (c[cat] || 0) + 1; });
    return c;
  }, [entries]);

  // ── Editor actions ─────────────────────────────────
  const openAdd = () => {
    setEditEntry(null); setFormContent(""); setFormCategory("other"); setFormTopic("");
    setDetailEntry(null); setViewMode("editor");
  };
  const openEdit = (entry: KBEntry) => {
    setEditEntry(entry); setFormContent(entry.content);
    setFormCategory(getCat(entry)); setFormTopic(getTopic(entry));
    setDetailEntry(null); setViewMode("editor");
  };
  const openDetail = (entry: KBEntry) => {
    setDetailEntry(entry); setViewMode("detail");
  };
  const backToList = () => {
    setViewMode("list"); setDetailEntry(null); setEditEntry(null); setConfirmDeleteId(null);
  };

  const handleSave = async () => {
    if (!formContent.trim()) { toast.error("Content cannot be empty"); return; }
    setSaving(true);
    setSavingStatus("Generating embedding...");
    try {
      const { error } = await supabase.functions.invoke("upsert-kb-entry", {
        body: {
          id: editEntry?.id ? Number(editEntry.id) : null,
          content: formContent.trim(),
          metadata: { category: formCategory, topic: formTopic || null, last_edited: new Date().toISOString() },
        },
      });
      if (error) throw error;
      toast.success("Entry saved + embedding generated");
      setViewMode("list"); fetchEntries();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
      setSavingStatus("");
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", Number(id));
      if (error) throw error;
      toast.success("Entry removed");
      setConfirmDeleteId(null); backToList(); fetchEntries();
    } catch { toast.error("Failed to delete"); }
    finally { setDeleting(false); }
  };

  // ─────────────────────────────────────────────────────
  // EDITOR VIEW
  // ─────────────────────────────────────────────────────
  if (viewMode === "editor") {
    return (
      <DashboardLayout title={t('knowledge.title')}>
        <div className="max-w-3xl mx-auto space-y-5">
          <Button variant="ghost" size="sm" onClick={backToList} className="gap-2 text-muted-foreground rounded-lg">
            <ArrowLeft className="w-4 h-4" /> Back to library
          </Button>

          <div className="card-premium p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{editEntry ? "Edit Entry" : "New Knowledge Entry"}</h2>
              <p className="text-sm text-muted-foreground/60 mt-1">The AI reads this verbatim when answering client questions</p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="label-small">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.filter(c => c.id !== "all").map((cat) => (
                  <Button key={cat.id} variant={formCategory === cat.id ? "default" : "outline"} size="sm"
                    onClick={() => setFormCategory(cat.id)} className="gap-1.5 text-xs rounded-lg">
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <label className="label-small">Topic tag (optional)</label>
              <Input value={formTopic} onChange={(e) => setFormTopic(e.target.value)}
                placeholder="e.g. visa_requirements, loading_rates" className="h-9 rounded-xl" />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label-small">Knowledge Content</label>
                <span className="text-xs text-muted-foreground/50">{formContent.length} chars</span>
              </div>
              <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} autoFocus rows={14}
                placeholder="Write knowledge here. Be specific and factual. Include prices, procedures, limits, and requirements."
                className="leading-relaxed resize-none rounded-xl" />
              <p className="text-xs text-muted-foreground/50">The more specific, the better the AI answers.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving || !formContent.trim()} className="gap-2 rounded-lg"
                style={{ boxShadow: '0 4px 14px -3px rgba(0,128,255,0.4)' }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? savingStatus : editEntry ? "Save Changes" : "Add to Library"}
              </Button>
              <Button variant="ghost" onClick={backToList} className="rounded-lg">Cancel</Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─────────────────────────────────────────────────────
  // MAIN LIBRARY — Table/list layout
  // ─────────────────────────────────────────────────────
  return (
    <DashboardLayout title={t('knowledge.title')}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">AI Knowledge Library</h1>
            <span className="text-xs font-semibold text-muted-foreground/50 bg-black/[0.03] px-2.5 py-1 rounded-lg">
              {entries.length} entries
            </span>
          </div>
          <Button onClick={openAdd} className="gap-2 whitespace-nowrap rounded-lg h-10 px-5 font-semibold"
            style={{ boxShadow: '0 4px 14px -3px rgba(0,128,255,0.4)' }}>
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </div>

        {/* Search + Sort bar */}
        <div className="card-premium p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search knowledge base..."
                className="pl-9 pr-9 h-10 bg-black/[0.02] border-transparent hover:bg-black/[0.04] focus:bg-card focus:border-primary/20 rounded-xl text-sm" />
              {search && (
                <Button variant="ghost" size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-lg"
                  onClick={() => setSearch("")}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(search || activeCategory !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setActiveCategory("all"); }} className="gap-1 text-xs h-8 rounded-lg">
                  <X className="w-3 h-3" /> Clear filters
                </Button>
              )}
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-black/[0.02] border-0 text-foreground text-xs px-3 py-2 rounded-lg outline-none cursor-pointer hover:bg-black/[0.04] transition-colors">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-5">
          {/* Sidebar categories */}
          <div className="w-52 shrink-0 hidden lg:block">
            <div className="card-premium p-3 space-y-0.5">
              <p className="label-small px-2 mb-2">Categories</p>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count = counts[cat.id] || 0;
                const isActive = activeCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] transition-all duration-150",
                      isActive
                        ? "bg-primary text-white font-medium"
                        : "text-foreground/60 hover:bg-black/[0.03] hover:text-foreground"
                    )}
                    style={isActive ? { boxShadow: '0 2px 8px -2px rgba(0,128,255,0.4)' } : undefined}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{cat.label}</span>
                    <span className={cn("text-[11px] tabular-nums", isActive ? "text-white/70" : "text-muted-foreground/40")}>{count}</span>
                  </button>
                );
              })}

              {/* Distribution */}
              <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                <p className="label-small px-2">Distribution</p>
                {CATEGORIES.filter(c => c.id !== "all" && (counts[c.id] || 0) > 0).map(cat => {
                  const n = counts[cat.id] || 0;
                  const pct = entries.length ? Math.round(n / entries.length * 100) : 0;
                  return (
                    <div key={cat.id} className="px-2">
                      <div className="flex justify-between text-[11px] text-muted-foreground/50 mb-1">
                        <span>{cat.label}</span><span>{n}</span>
                      </div>
                      <div className="h-1 bg-black/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: CATEGORY_BAR_COLORS[cat.id] || "hsl(var(--primary))" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile category selector */}
          <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mt-2 mb-2 w-full" style={{ position: 'relative' }}>
            {CATEGORIES.map((cat) => (
              <Button key={cat.id} variant={activeCategory === cat.id ? "default" : "outline"} size="sm"
                onClick={() => setActiveCategory(cat.id)} className="gap-1.5 whitespace-nowrap text-xs shrink-0 rounded-lg">
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label} ({counts[cat.id] || 0})
              </Button>
            ))}
          </div>

          {/* ── Table list ── */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-premium">
                <div className="py-20 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground/60">{search ? "No matching entries" : "No entries yet"}</p>
                  <Button variant="link" onClick={openAdd} className="mt-2 text-primary">
                    Add first entry
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="card-premium overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_180px_120px_80px_44px] gap-3 px-5 py-3 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span>Entry</span>
                    <span>Category</span>
                    <span>Tag</span>
                    <span>Date</span>
                    <span></span>
                  </div>

                  {/* Rows */}
                  {paged.map((entry) => {
                    const cat = getCat(entry);
                    const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat;
                    const catColor = CATEGORY_COLORS[cat] || "bg-slate-50 text-slate-600";
                    const topic = getTopic(entry);
                    const title = getTitle(entry.content);
                    const bodyStart = entry.content.slice(title.length).replace(/^[.\s]+/, "");
                    const preview = truncate(bodyStart, 90);

                    return (
                      <div key={entry.id}
                        className="group grid grid-cols-[1fr_180px_120px_80px_44px] gap-3 items-center px-5 py-3 cursor-pointer transition-colors hover:bg-primary/[0.03]"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}
                        onClick={() => openDetail(entry)}>
                        {/* Title + preview */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug truncate">{title}</p>
                          {preview && <p className="text-xs text-muted-foreground/50 truncate mt-0.5">{preview}</p>}
                        </div>

                        {/* Category badge */}
                        <div>
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium", catColor)}>
                            {catLabel}
                          </span>
                        </div>

                        {/* Topic tag */}
                        <div>
                          {topic ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
                              <Hash className="w-2.5 h-2.5" />{truncate(topic, 14)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/30">—</span>
                          )}
                        </div>

                        {/* Date */}
                        <div>
                          {entry.last_edited ? (
                            <span className="text-[11px] text-muted-foreground/40">
                              {format(new Date(entry.last_edited), "d MMM", { locale: nl })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/30">—</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 rounded-md hover:bg-black/[0.05] transition-colors"
                            onClick={(e) => { e.stopPropagation(); openEdit(entry); }}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground/40" />
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 px-1">
                  <span className="text-xs text-muted-foreground/50">
                    Showing {showFrom}–{showTo} of {filtered.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled={page <= 1}
                      onClick={() => setPage(page - 1)} className="h-8 w-8 p-0 rounded-lg">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (page <= 4) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <Button key={pageNum} variant={page === pageNum ? "default" : "ghost"} size="sm"
                          onClick={() => setPage(pageNum)}
                          className={cn("h-8 w-8 p-0 rounded-lg text-xs",
                            page === pageNum && "pointer-events-none"
                          )}
                          style={page === pageNum ? { boxShadow: '0 2px 6px -2px rgba(0,128,255,0.3)' } : undefined}>
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button variant="ghost" size="sm" disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)} className="h-8 w-8 p-0 rounded-lg">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail Dialog ── */}
      <Dialog open={viewMode === "detail" && !!detailEntry} onOpenChange={(open) => { if (!open) backToList(); }}>
        <DialogContent className="max-w-2xl bg-popover rounded-2xl border-0 p-0 gap-0 overflow-hidden"
          style={{ boxShadow: '0 24px 64px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)' }}>
          <DialogTitle className="sr-only">Knowledge Entry Detail</DialogTitle>
          {detailEntry && (() => {
            const cat = getCat(detailEntry);
            const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat;
            const catColor = CATEGORY_COLORS[cat] || "bg-slate-50 text-slate-600";
            const topic = getTopic(detailEntry);
            return (
              <div className="p-6 space-y-5">
                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium", catColor)}>
                      {catLabel}
                    </span>
                    {topic && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50 bg-black/[0.03] px-2 py-1 rounded-lg">
                        <Hash className="w-3 h-3" />{topic}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold leading-snug">{getTitle(detailEntry.content)}</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-xs text-muted-foreground/50">{detailEntry.content.length} characters</p>
                    {detailEntry.last_edited && (
                      <p className="text-xs text-muted-foreground/50 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(detailEntry.last_edited), "d MMM yyyy, HH:mm", { locale: nl })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="bg-black/[0.02] rounded-xl p-5 max-h-[40vh] overflow-y-auto"
                  style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)' }}>
                  <p className="text-sm text-foreground/80 leading-[1.9] whitespace-pre-wrap">{detailEntry.content}</p>
                </div>

                {/* AI notice */}
                <div className="bg-primary/[0.04] rounded-xl p-4 flex items-start gap-3"
                  style={{ boxShadow: '0 0 0 1px rgba(0,128,255,0.08)' }}>
                  <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-0.5">Used by AI</p>
                    <p className="text-xs text-muted-foreground/60 leading-relaxed">
                      When a client asks about <span className="font-medium text-foreground">{catLabel.toLowerCase()}</span>, the AI reads this entry and uses it to answer their question.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <Button variant="outline" onClick={() => openEdit(detailEntry)} className="gap-2 rounded-lg">
                    <Pencil className="w-4 h-4" /> Edit
                  </Button>
                  {confirmDeleteId === detailEntry.id ? (
                    <div className="flex items-center gap-2">
                      <Button variant="destructive" onClick={() => handleDelete(detailEntry.id)} disabled={deleting} className="gap-2 rounded-lg">
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Confirm Delete
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} className="rounded-lg">Cancel</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirmDeleteId(detailEntry.id)} className="gap-2 text-muted-foreground/50 hover:text-destructive rounded-lg">
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
