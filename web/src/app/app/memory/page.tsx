"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, X } from "lucide-react";
import PageHeader from "../_components/page-header";
import { api } from "@/lib/api";
import { ShakeImage, FadeUpOnView } from "@/app/_components/interactive-image";

type M = { id: string; topic: string; body: string; created_at: number };

export default function MemoryPage() {
  const [items, setItems] = useState<M[]>([]);
  const [adding, setAdding] = useState(false);
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.memory.list().then((d) => setItems(d.memories)).catch(() => {}); }, []);

  async function add() {
    if (!topic.trim() || !body.trim() || busy) return;
    setBusy(true);
    try {
      const { memory } = await api.memory.add(topic, body);
      setItems((xs) => [memory, ...xs]);
      setTopic(""); setBody(""); setAdding(false);
    } catch (e) { alert((e as Error).message); }
    setBusy(false);
  }
  async function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    try { await api.memory.remove(id); } catch {}
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="px-7 py-8 max-w-[1080px] mx-auto">
      <PageHeader
        kicker="memory"
        title="What your agent knows."
        lede="Browse, edit, and curate. Memory is reviewable, never opaque. Add facts and your agent will use them next chat."
        action={
          <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-ink text-[15px] font-medium hover:bg-amber-soft transition-colors">
            {adding ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add memory</>}
          </button>
        }
      />

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 32 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-ink-soft border border-amber/30 rounded-xl p-5">
              <input
                value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="topic — e.g. 'voice', 'stack', 'reading list'"
                className="w-full bg-transparent border-b border-ink-line text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber py-2 text-[15.5px] mb-3"
                autoFocus
              />
              <textarea
                value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="The fact. e.g. 'Prefers terse, declarative sentences.'"
                className="w-full bg-transparent text-paper placeholder:text-paper-faint focus:outline-none py-2 text-[15.5px] resize-none"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <button onClick={add} disabled={busy} className="px-4 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft disabled:opacity-50">
                  {busy ? "Saving…" : "Save memory"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 grid gap-3">
        <AnimatePresence>
          {items.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-paper-dim flex flex-col items-center text-center">
              <div className="mb-3 max-w-[360px] relative">
                <ShakeImage src="/illustrations/memory-empty.png" alt="" width={600} height={600} className="w-full h-auto bleed-soft halo-warm float-slow" />
              </div>
              <p className="text-[14px] text-paper-faint max-w-[40ch] font-[family-name:var(--font-mono)] uppercase tracking-[0.14em] mt-2">— add a memory above, or just chat</p>
            </motion.div>
          ) : items.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="group bg-ink-soft border border-ink-line rounded-xl px-6 py-5 hover:border-paper-faint/60 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.16em]">{m.topic}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint">{relTime(m.created_at)}</span>
                </div>
                <button onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-paper-dim hover:text-rust transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-[15px] text-paper leading-[1.55]">{m.body}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function relTime(ts: number) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
