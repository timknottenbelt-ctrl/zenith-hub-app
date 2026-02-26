import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import {
  Search, Plus, Pencil, Trash2, BookOpen, Package, Ship,
  X, Loader2, ChevronRight, Tag, FileText, Save, ArrowLeft,
  Hash, Zap, Database,
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
  created_at?: string;
}

type SortMode = "newest" | "oldest" | "alpha";

const TABLE = "cargo_agent_knowledge" as const;

const CATEGORIES = [
  { id: "all", label: "All Knowledge", icon: BookOpen, color: "#6ee7b7" },
  { id: "crew_change", label: "Crew Change", icon: Ship, color: "#67e8f9" },
  { id: "cargo", label: "Cargo & Terminals", icon: Package, color: "#fbbf24" },
  { id: "port_formalities", label: "Port Formalities", icon: FileText, color: "#a78bfa" },
  { id: "spares", label: "Spares & Provisions", icon: Database, color: "#fb923c" },
  { id: "other", label: "Other", icon: Tag, color: "#94a3b8" },
];

const CATEGORY_COLORS: Record<string, string> = {
  crew_change: "#67e8f9",
  cargo: "#fbbf24",
  port_formalities: "#a78bfa",
  spares: "#fb923c",
  other: "#94a3b8",
};

function getCat(entry: KBEntry): string {
  if (entry.category) return entry.category;
  if (entry.metadata?.category) return String(entry.metadata.category);
  const c = entry.content.toLowerCase();
  if (c.includes("crew") || c.includes("visa") || c.includes("immigration") || c.includes("launch") || c.includes("cash to master") || c.includes("garbage")) return "crew_change";
  if (c.includes("terminal") || c.includes("loading") || c.includes("isla") || c.includes("bitumen") || c.includes("cargo") || c.includes("discharge")) return "cargo";
  if (c.includes("port") || c.includes("customs") || c.includes("clearance") || c.includes("formali")) return "port_formalities";
  if (c.includes("spare") || c.includes("provision") || c.includes("delivery") || c.includes("dhl") || c.includes("fedex")) return "spares";
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

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─────────────────────────────────────────────────────────
export default function KnowledgeBase() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<KBEntry | null>(null);
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("other");
  const [formTopic, setFormTopic] = useState("");
  const [saving, setSaving] = useState(false);

  // Detail
  const [detailEntry, setDetailEntry] = useState<KBEntry | null>(null);

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("id", { ascending: false });
      if (error) throw error;
      const mapped: KBEntry[] = (data || []).map((row) => ({
        id: String(row.id),
        content: row.content || "",
        metadata: row.metadata as Record<string, unknown> | undefined,
        category: (row.metadata as Record<string, unknown> | null)?.category as string | undefined,
        topic: (row.metadata as Record<string, unknown> | null)?.topic as string | undefined,
        created_at: undefined,
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
  const filtered = entries
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
    });

  const counts: Record<string, number> = { all: entries.length };
  entries.forEach((e) => { const c = getCat(e); counts[c] = (counts[c] || 0) + 1; });

  // ── Editor actions ─────────────────────────────────
  const openAdd = () => {
    setEditEntry(null); setFormContent(""); setFormCategory("other"); setFormTopic("");
    setDetailEntry(null); setEditorOpen(true);
  };
  const openEdit = (entry: KBEntry) => {
    setEditEntry(entry); setFormContent(entry.content);
    setFormCategory(getCat(entry)); setFormTopic(getTopic(entry));
    setDetailEntry(null); setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formContent.trim()) { toast.error("Content cannot be empty"); return; }
    setSaving(true);
    try {
      const payload = { content: formContent.trim(), metadata: { category: formCategory, topic: formTopic } };
      if (editEntry) {
        const { error } = await supabase.from(TABLE).update(payload).eq("id", Number(editEntry.id));
        if (error) throw error;
        toast.success("Entry updated ✓");
      } else {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        toast.success("Entry added to library ✓");
      }
      setEditorOpen(false); fetchEntries();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", Number(id));
      if (error) throw error;
      toast.success("Entry removed");
      setConfirmDeleteId(null); setDetailEntry(null); fetchEntries();
    } catch { toast.error("Failed to delete"); }
    finally { setDeleting(false); }
  };

  // ─────────────────────────────────────────────────────
  // EDITOR VIEW
  // ─────────────────────────────────────────────────────
  if (editorOpen) return (
    <div className="min-h-screen bg-[#07090f] text-white" style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button onClick={() => setEditorOpen(false)} className="flex items-center gap-2 text-[11px] text-white/35 hover:text-white/65 mb-10 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> BACK TO LIBRARY
        </button>

        <div className="mb-8">
          <h1 className="text-xl font-bold">{editEntry ? "Edit Entry" : "New Knowledge Entry"}</h1>
          <p className="text-xs text-white/25 mt-1">The AI reads this verbatim when answering client questions</p>
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="text-[10px] text-white/30 tracking-widest block mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter(c => c.id !== "all").map((cat) => (
              <button key={cat.id} onClick={() => setFormCategory(cat.id)}
                className="px-3 py-1.5 text-[11px] border transition-all"
                style={{
                  borderColor: formCategory === cat.id ? cat.color : "rgba(255,255,255,0.08)",
                  color: formCategory === cat.id ? cat.color : "rgba(255,255,255,0.35)",
                  backgroundColor: formCategory === cat.id ? `${cat.color}12` : "transparent",
                }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        <div className="mb-6">
          <label className="text-[10px] text-white/30 tracking-widest block mb-2">Topic tag (optional)</label>
          <input value={formTopic} onChange={(e) => setFormTopic(e.target.value)}
            placeholder="e.g. visa_requirements, loading_rates, crew_change_fees"
            className="w-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-xs px-3 py-2.5 outline-none focus:border-emerald-500/40 placeholder:text-white/15" />
        </div>

        {/* Content */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-white/30 tracking-widest">Knowledge Content</label>
            <span className="text-[9px] text-white/15">{formContent.length} chars</span>
          </div>
          <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} autoFocus rows={18}
            placeholder={"Write knowledge here. Be specific and factual.\n\nExample:\nCuracao crew change coordination fee is $940 USD for up to 10 passengers including 2 crew members. Each additional crew member is $85 USD. Launch boat service included for vessels at anchorage. All visa and immigration coordination is handled by the agent..."}
            className="w-full bg-white/[0.04] border border-white/[0.08] text-white/85 text-sm px-4 py-3 outline-none focus:border-emerald-500/40 placeholder:text-white/[0.12] leading-[1.8] resize-none" />
          <p className="text-[10px] text-white/20 mt-1.5">Include specific prices, procedures, limits, and requirements. The more specific, the better the AI answers.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving || !formContent.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold tracking-wider disabled:opacity-40 transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {editEntry ? "SAVE CHANGES" : "ADD TO LIBRARY"}
          </button>
          <button onClick={() => setEditorOpen(false)} className="px-4 py-2.5 text-white/25 hover:text-white/55 text-xs tracking-widest transition-colors">CANCEL</button>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────────
  if (detailEntry) {
    const cat = getCat(detailEntry);
    const catColor = CATEGORY_COLORS[cat] || "#94a3b8";
    const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat;
    const topic = getTopic(detailEntry);

    return (
      <div className="min-h-screen bg-[#07090f] text-white" style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <button onClick={() => setDetailEntry(null)} className="flex items-center gap-2 text-[11px] text-white/35 hover:text-white/65 mb-10 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> BACK TO LIBRARY
          </button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[9px] tracking-widest px-2 py-1" style={{ color: catColor, backgroundColor: `${catColor}15`, border: `1px solid ${catColor}25` }}>
                {catLabel.toUpperCase()}
              </span>
              {topic && (
                <span className="text-[9px] text-white/25 flex items-center gap-1">
                  <Hash className="w-2.5 h-2.5" />{topic}
                </span>
              )}
              <span className="text-[9px] text-white/20 ml-auto">{timeAgo(detailEntry.created_at)}</span>
            </div>
            <h1 className="text-xl font-bold leading-snug">{getTitle(detailEntry.content)}</h1>
            <p className="text-[11px] text-white/25 mt-1">{detailEntry.content.length} characters</p>
          </div>

          {/* Content box */}
          <div className="border border-white/[0.08] bg-white/[0.025] p-6 mb-6">
            <p className="text-sm text-white/75 leading-[1.9] whitespace-pre-wrap">{detailEntry.content}</p>
          </div>

          {/* AI notice */}
          <div className="border border-emerald-500/20 bg-emerald-500/[0.04] p-4 mb-8 flex items-start gap-3">
            <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-emerald-400 tracking-widest font-bold mb-1">USED BY AI</p>
              <p className="text-xs text-emerald-200/50 leading-relaxed">
                When a client asks about <span className="text-emerald-300">{catLabel.toLowerCase()}</span>, the AI reads this entry and uses it to answer their question.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => openEdit(detailEntry)}
              className="flex items-center gap-2 px-5 py-2.5 border border-white/[0.12] text-white/55 hover:text-white hover:border-white/25 text-xs tracking-widest transition-colors">
              <Pencil className="w-3.5 h-3.5" /> EDIT
            </button>

            {confirmDeleteId === detailEntry.id ? (
              <div className="flex items-center gap-2">
                <button onClick={() => handleDelete(detailEntry.id)} disabled={deleting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white text-xs tracking-widest transition-colors">
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  CONFIRM DELETE
                </button>
                <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2.5 text-white/30 text-xs">CANCEL</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDeleteId(detailEntry.id)}
                className="flex items-center gap-2 px-5 py-2.5 border border-white/[0.08] text-white/25 hover:text-red-400 hover:border-red-500/30 text-xs tracking-widest transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> DELETE
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // MAIN LIBRARY
  // ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#07090f] text-white" style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}>

      {/* Sticky topbar */}
      <div className="border-b border-white/[0.08] sticky top-0 z-20 bg-[#07090f]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center gap-4">
          <div className="flex items-center gap-3 mr-2">
            <div className="w-8 h-8 bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest text-white">AI KNOWLEDGE LIBRARY</div>
              <div className="text-[9px] text-white/20">LBH Curacao · {entries.length} entries</div>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge base..."
              className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-xs pl-9 pr-8 py-2 outline-none focus:border-emerald-500/35 placeholder:text-white/[0.18]" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/45">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-white/[0.04] border border-white/[0.08] text-white/45 text-[11px] px-3 py-2 outline-none cursor-pointer">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alpha">Alphabetical</option>
          </select>

          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold tracking-wider transition-colors whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" /> ADD ENTRY
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-7 flex gap-7">

        {/* Sidebar */}
        <div className="w-52 shrink-0 space-y-1 hidden md:block">
          <div className="text-[9px] text-white/20 tracking-widest mb-3 uppercase px-1">Categories</div>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = counts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all text-[11px]"
                style={{
                  backgroundColor: isActive ? `${cat.color}10` : "transparent",
                  borderLeft: isActive ? `2px solid ${cat.color}` : "2px solid transparent",
                  color: isActive ? cat.color : "rgba(255,255,255,0.32)",
                }}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">{cat.label}</span>
                <span className="text-[9px] tabular-nums opacity-50">{count}</span>
              </button>
            );
          })}

          {/* Distribution bars */}
          <div className="mt-8 pt-6 border-t border-white/[0.06] space-y-3">
            <div className="text-[9px] text-white/20 tracking-widest uppercase">Distribution</div>
            {CATEGORIES.filter(c => c.id !== "all" && (counts[c.id] || 0) > 0).map(cat => {
              const n = counts[cat.id] || 0;
              const pct = entries.length ? Math.round(n / entries.length * 100) : 0;
              return (
                <div key={cat.id}>
                  <div className="flex justify-between text-[9px] text-white/20 mb-1">
                    <span>{cat.label}</span><span>{n}</span>
                  </div>
                  <div className="h-1 bg-white/[0.05] overflow-hidden">
                    <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cat.color + "99" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cards grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div className="text-xs text-white/25">
              {loading ? "Loading…" : `${filtered.length}${entries.length !== filtered.length ? ` of ${entries.length}` : ""} entries`}
            </div>
            {(search || activeCategory !== "all") && (
              <button onClick={() => { setSearch(""); setActiveCategory("all"); }}
                className="text-[10px] text-white/25 hover:text-white/55 flex items-center gap-1 transition-colors">
                <X className="w-3 h-3" /> clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-36 text-white/[0.18]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-xs tracking-widest">LOADING KNOWLEDGE BASE...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-white/[0.08] py-24 text-center">
              <BookOpen className="w-9 h-9 text-white/[0.08] mx-auto mb-4" />
              <p className="text-xs text-white/[0.22] tracking-widest">{search ? "NO MATCHING ENTRIES" : "NO ENTRIES YET"}</p>
              <button onClick={openAdd} className="mt-5 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors">
                ADD FIRST ENTRY →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((entry) => {
                const cat = getCat(entry);
                const catColor = CATEGORY_COLORS[cat] || "#94a3b8";
                const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat;
                const topic = getTopic(entry);
                const title = getTitle(entry.content);
                const bodyStart = entry.content.slice(title.length).replace(/^[.\s]+/, "");
                const preview = truncate(bodyStart, 115);

                return (
                  <div key={entry.id}
                    className="group border border-white/[0.07] bg-white/[0.018] hover:bg-white/[0.035] hover:border-white/[0.14] transition-all duration-150 cursor-pointer flex flex-col"
                    onClick={() => setDetailEntry(entry)}>
                    {/* Color strip */}
                    <div className="h-[2px]" style={{ backgroundColor: catColor + "80" }} />

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] tracking-widest px-1.5 py-0.5" style={{ color: catColor, backgroundColor: `${catColor}12` }}>
                          {catLabel.toUpperCase()}
                        </span>
                        <span className="text-[9px] text-white/[0.18]">{timeAgo(entry.created_at)}</span>
                      </div>

                      <h3 className="text-xs font-semibold text-white/[0.82] leading-snug mb-2 line-clamp-2">{title}</h3>

                      {preview && (
                        <p className="text-[11px] text-white/[0.28] leading-relaxed flex-1 line-clamp-3">{preview}</p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
                        {topic ? (
                          <span className="text-[9px] text-white/[0.18] flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5" />{topic}
                          </span>
                        ) : <span />}

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                            className="p-1.5 text-white/25 hover:text-emerald-400 transition-colors"
                            title="Edit">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(entry.id); handleDelete(entry.id); }}
                            className="p-1.5 text-white/25 hover:text-red-400 transition-colors"
                            title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-white/[0.18]" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
