"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Search, MessageSquare, Brain, Code2, X, Command } from "lucide-react";

type SearchResult = {
  q: string;
  counts: { messages: number; memories: number; projects: number };
  messages: Array<{ id: string; session_id: string; role: string; snippet: string; created_at: number; session_title: string }>;
  memories: Array<{ id: string; topic: string; body: string; snippet: string; created_at: number }>;
  projects: Array<{ id: string; slug: string; title: string; mode: string; published: number }>;
};

const debounce = <T extends (...a: any[]) => void>(fn: T, ms: number) => {
  let t: any;
  return (...args: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(debounce(async (term: string) => {
    if (term.length < 2) { setData(null); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/me/search?q=${encodeURIComponent(term)}`, { credentials: "include" });
      const j = await r.json();
      setData(j);
      setActiveIdx(0);
    } finally { setLoading(false); }
  }, 200), []);

  useEffect(() => { search(q); }, [q, search]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  // Keyboard: ESC close, ↑/↓ navigate, Enter to open
  const flatItems: Array<{ kind: "message" | "memory" | "project"; href: string; title: string; sub: string }> = [];
  if (data) {
    for (const m of data.messages) flatItems.push({ kind: "message", href: `/app?session=${m.session_id}`, title: m.session_title, sub: m.snippet });
    for (const m of data.memories) flatItems.push({ kind: "memory", href: `/app/memory`, title: m.topic, sub: m.snippet });
    for (const p of data.projects) flatItems.push({ kind: "project", href: `/dev/${p.id}`, title: p.title, sub: p.mode + (p.published ? " · published" : "") });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(flatItems.length - 1, i + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
      if (e.key === "Enter") {
        const item = flatItems[activeIdx];
        if (item) { window.location.href = item.href; onClose(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatItems, activeIdx, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-ink/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 top-[10vh] sm:left-1/2 sm:-translate-x-1/2 sm:inset-x-auto sm:w-[640px] z-[91] bg-ink-soft border border-ink-line rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-ink-line">
              <Search size={16} className="text-paper-faint" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages, memory, projects…"
                className="flex-1 bg-transparent text-[15px] text-paper placeholder:text-paper-faint focus:outline-none"
              />
              <kbd className="hidden sm:inline-flex font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-paper-faint px-1.5 py-0.5 border border-ink-line rounded">esc</kbd>
              <button onClick={onClose} className="text-paper-faint hover:text-paper sm:hidden"><X size={14} /></button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.length < 2 ? (
                <Hints />
              ) : loading && !data ? (
                <div className="px-5 py-8 text-center text-paper-faint text-[13.5px]">searching…</div>
              ) : !data || flatItems.length === 0 ? (
                <div className="px-5 py-8 text-center text-paper-faint text-[13.5px]">no results for &quot;{q}&quot;</div>
              ) : (
                <div className="py-2">
                  {data.counts.messages > 0 && <Section title="Messages" items={flatItems.filter(i => i.kind === "message")} startIdx={0} activeIdx={activeIdx} onClose={onClose} />}
                  {data.counts.memories > 0 && <Section title="Memory" items={flatItems.filter(i => i.kind === "memory")} startIdx={data.counts.messages} activeIdx={activeIdx} onClose={onClose} />}
                  {data.counts.projects > 0 && <Section title="Projects" items={flatItems.filter(i => i.kind === "project")} startIdx={data.counts.messages + data.counts.memories} activeIdx={activeIdx} onClose={onClose} />}
                </div>
              )}
            </div>

            <div className="px-4 sm:px-5 py-2.5 border-t border-ink-line flex items-center justify-between text-[11.5px] text-paper-faint font-[family-name:var(--font-mono)] uppercase tracking-[0.14em]">
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 border border-ink-line rounded text-[10px]">↑↓</kbd> navigate</span>
                <span className="hidden sm:inline-flex items-center gap-1"><kbd className="px-1.5 py-0.5 border border-ink-line rounded text-[10px]">↵</kbd> open</span>
              </div>
              <span>{data ? `${flatItems.length} result${flatItems.length === 1 ? "" : "s"}` : ""}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, items, startIdx, activeIdx, onClose }: { title: string; items: any[]; startIdx: number; activeIdx: number; onClose: () => void }) {
  const ICON = { message: MessageSquare, memory: Brain, project: Code2 } as any;
  return (
    <div className="mb-1">
      <div className="px-4 sm:px-5 py-1.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-paper-faint">{title}</div>
      {items.map((it, i) => {
        const Icon = ICON[it.kind];
        const idx = startIdx + i;
        const active = idx === activeIdx;
        return (
          <Link
            key={`${it.kind}-${i}`}
            href={it.href}
            onClick={onClose}
            className={`block px-4 sm:px-5 py-2 mx-1 rounded-lg ${active ? "bg-amber/10 border-amber/30 border" : "border border-transparent hover:bg-ink-line/30"} transition-colors`}
          >
            <div className="flex items-center gap-3">
              <Icon size={13} className={active ? "text-amber" : "text-paper-faint"} />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] text-paper truncate">{it.title}</div>
                <div className="text-[12px] text-paper-dim truncate">{it.sub}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Hints() {
  return (
    <div className="px-5 py-6 text-[13px] text-paper-dim space-y-3">
      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-paper-faint">— search across</div>
      <div className="grid grid-cols-3 gap-2">
        <div className="px-3 py-3 rounded-md bg-ink-line/30 border border-ink-line text-center">
          <MessageSquare size={14} className="text-paper-faint mx-auto mb-1" />
          <div className="text-[12px] text-paper">Messages</div>
        </div>
        <div className="px-3 py-3 rounded-md bg-ink-line/30 border border-ink-line text-center">
          <Brain size={14} className="text-paper-faint mx-auto mb-1" />
          <div className="text-[12px] text-paper">Memory</div>
        </div>
        <div className="px-3 py-3 rounded-md bg-ink-line/30 border border-ink-line text-center">
          <Code2 size={14} className="text-paper-faint mx-auto mb-1" />
          <div className="text-[12px] text-paper">Projects</div>
        </div>
      </div>
      <div className="text-[11.5px] text-paper-faint pt-2">type 2+ characters to search</div>
    </div>
  );
}

// Global hotkey hook + button
export function useSearchHotkey(setOpen: (v: boolean) => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
