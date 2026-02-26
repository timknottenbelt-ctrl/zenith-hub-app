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
  Hash, Zap, Database, Shield, Anchor, MapPin, ClipboardList, DollarSign,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface KBEntry {
  id: string;
  content: string;
  category?: string;
  topic?: string;
  metadata?: Record<string, unknown>;
}

type SortMode = "newest" | "oldest" | "alpha";
type ViewMode = "list" | "editor" | "detail";

const TABLE = "cargo_agent_knowledge" as const;

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
      const mapped: KBEntry[] = (data || []).map((row) => ({
        id: String(row.id),
        content: row.content || "",
        metadata: row.metadata as Record<string, unknown> | undefined,
        category: (row.metadata as Record<string, unknown> | null)?.category as string | undefined,
        topic: (row.metadata as Record<string, unknown> | null)?.topic as string | undefined,
      }));
      setEntries(mapped);
    } catch {
      toast.error("Could not load knowledge base");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

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
          metadata: { category: formCategory, topic: formTopic || null },
        },
      });
      if (error) throw error;
      toast.success("Entry saved + embedding generated ✓");
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
        <div className="max-w-3xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={backToList} className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to library
          </Button>

          <Card className="card-premium">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold">{editEntry ? "Edit Entry" : "New Knowledge Entry"}</h2>
                <p className="text-sm text-muted-foreground mt-1">The AI reads this verbatim when answering client questions</p>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="label-small">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.filter(c => c.id !== "all").map((cat) => (
                    <Button key={cat.id} variant={formCategory === cat.id ? "default" : "outline"} size="sm"
                      onClick={() => setFormCategory(cat.id)} className="gap-1.5 text-xs">
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
                  placeholder="e.g. visa_requirements, loading_rates" className="h-9" />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label-small">Knowledge Content</label>
                  <span className="text-xs text-muted-foreground">{formContent.length} chars</span>
                </div>
                <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} autoFocus rows={14}
                  placeholder="Write knowledge here. Be specific and factual. Include prices, procedures, limits, and requirements."
                  className="leading-relaxed resize-none" />
                <p className="text-xs text-muted-foreground">The more specific, the better the AI answers.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving || !formContent.trim()} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? savingStatus : editEntry ? "Save Changes" : "Add to Library"}
                </Button>
                <Button variant="ghost" onClick={backToList}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ─────────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────────
  if (viewMode === "detail" && detailEntry) {
    const cat = getCat(detailEntry);
    const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat;
    const topic = getTopic(detailEntry);

    return (
      <DashboardLayout title={t('knowledge.title')}>
        <div className="max-w-3xl mx-auto space-y-6">
          <Button variant="ghost" size="sm" onClick={backToList} className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to library
          </Button>

          <Card className="card-premium">
            <CardContent className="p-6 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{catLabel}</Badge>
                  {topic && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Hash className="w-3 h-3" />{topic}
                    </Badge>
                  )}
                </div>
                <h2 className="text-xl font-semibold leading-snug">{getTitle(detailEntry.content)}</h2>
                <p className="text-xs text-muted-foreground mt-1">{detailEntry.content.length} characters</p>
              </div>

              {/* Content */}
              <div className="bg-muted/30 border border-border/50 rounded-lg p-5">
                <p className="text-sm text-foreground/80 leading-[1.9] whitespace-pre-wrap">{detailEntry.content}</p>
              </div>

              {/* AI notice */}
              <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 flex items-start gap-3">
                <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-primary mb-0.5">Used by AI</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    When a client asks about <span className="font-medium text-foreground">{catLabel.toLowerCase()}</span>, the AI reads this entry and uses it to answer their question.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={() => openEdit(detailEntry)} className="gap-2">
                  <Pencil className="w-4 h-4" /> Edit
                </Button>
                {confirmDeleteId === detailEntry.id ? (
                  <div className="flex items-center gap-2">
                    <Button variant="destructive" onClick={() => handleDelete(detailEntry.id)} disabled={deleting} className="gap-2">
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Confirm Delete
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmDeleteId(detailEntry.id)} className="gap-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ─────────────────────────────────────────────────────
  // MAIN LIBRARY
  // ─────────────────────────────────────────────────────
  return (
    <DashboardLayout title={t('knowledge.title')}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">AI Knowledge Library</h1>
            <p className="text-muted-foreground text-sm">LBH Curacao · {entries.length} entries</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search knowledge base..." className="pl-9 pr-9 h-9" />
              {search && (
                <Button variant="ghost" size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearch("")}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button onClick={openAdd} className="gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add Entry
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar categories */}
          <div className="w-52 shrink-0 hidden lg:block space-y-1">
            <p className="label-small px-2 mb-3">Categories</p>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = counts[cat.id] || 0;
              const isActive = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all
                    ${isActive
                      ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                      : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{cat.label}</span>
                  <span className="text-xs tabular-nums opacity-60">{count}</span>
                </button>
              );
            })}

            {/* Distribution */}
            <div className="mt-6 pt-4 border-t border-border/50 space-y-3">
              <p className="label-small px-2">Distribution</p>
              {CATEGORIES.filter(c => c.id !== "all" && (counts[c.id] || 0) > 0).map(cat => {
                const n = counts[cat.id] || 0;
                const pct = entries.length ? Math.round(n / entries.length * 100) : 0;
                return (
                  <div key={cat.id} className="px-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{cat.label}</span><span>{n}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat.id] || "hsl(var(--primary))" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile category selector */}
          <div className="lg:hidden flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mt-2 mb-2 w-full" style={{ position: 'relative' }}>
            {CATEGORIES.map((cat) => (
              <Button key={cat.id} variant={activeCategory === cat.id ? "default" : "outline"} size="sm"
                onClick={() => setActiveCategory(cat.id)} className="gap-1.5 whitespace-nowrap text-xs shrink-0">
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label} ({counts[cat.id] || 0})
              </Button>
            ))}
          </div>

          {/* Cards grid */}
          <div className="flex-1 min-w-0">
            {/* Sort + filter info */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {loading ? "Loading…" : `${filtered.length}${entries.length !== filtered.length ? ` of ${entries.length}` : ""} entries`}
              </div>
              <div className="flex items-center gap-2">
                {(search || activeCategory !== "all") && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setActiveCategory("all"); }} className="gap-1 text-xs h-7">
                    <X className="w-3 h-3" /> Clear
                  </Button>
                )}
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="bg-background border border-input text-foreground text-xs px-2 py-1.5 rounded-md outline-none cursor-pointer">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="card-premium">
                <CardContent className="py-20 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">{search ? "No matching entries" : "No entries yet"}</p>
                  <Button variant="link" onClick={openAdd} className="mt-2 text-primary">
                    Add first entry →
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((entry) => {
                  const cat = getCat(entry);
                  const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat;
                  const topic = getTopic(entry);
                  const title = getTitle(entry.content);
                  const bodyStart = entry.content.slice(title.length).replace(/^[.\s]+/, "");
                  const preview = truncate(bodyStart, 115);

                  return (
                    <Card key={entry.id}
                      className="card-premium group cursor-pointer hover:border-primary/30 transition-all duration-150"
                      onClick={() => openDetail(entry)}>
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="secondary" className="text-xs">{catLabel}</Badge>
                        </div>

                        <h3 className="text-sm font-semibold leading-snug mb-2 line-clamp-2">{title}</h3>

                        {preview && (
                          <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-3">{preview}</p>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                          {topic ? (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Hash className="w-2.5 h-2.5" />{topic}
                            </Badge>
                          ) : <span />}

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); openEdit(entry); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
