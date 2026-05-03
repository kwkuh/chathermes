"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, Mail, MessageSquare, Phone, Hash, GitBranch, X, ExternalLink } from "lucide-react";
import PageHeader from "../_components/page-header";
import { api } from "@/lib/api";
import { HoverPopImage } from "@/app/_components/interactive-image";

const CONNECTORS = [
  { id: "telegram", icon: MessageCircle, name: "Telegram", desc: "Two-way chat with your agent.", supported: true },
  { id: "email", icon: Mail, name: "Email", desc: "Send drafts, daily digests, replies.", supported: false },
  { id: "slack", icon: Hash, name: "Slack", desc: "Drop into your workspace as a teammate.", supported: false },
  { id: "discord", icon: MessageSquare, name: "Discord", desc: "Bot in your server. Optional DM bridge.", supported: false },
  { id: "whatsapp", icon: Phone, name: "WhatsApp", desc: "Messaging via WA Business API.", supported: false },
  { id: "github", icon: GitBranch, name: "GitHub", desc: "Watch repos, open PRs, comment.", supported: false },
];

export default function Connectors() {
  const [connected, setConnected] = useState<Record<string, any>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { reload(); }, []);
  async function reload() {
    try {
      const { connectors } = await api.connectors.list();
      const map: any = {};
      for (const c of connectors) map[c.kind] = c;
      setConnected(map);
    } catch {}
  }

  async function connect(kind: string) {
    if (kind !== "telegram") return;
    if (!token.trim()) { setError("paste a bot token"); return; }
    setBusy(true); setError("");
    try {
      await api.connectors.save(kind, { secret: token.trim() });
      setToken(""); setOpen(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function disconnect(kind: string) {
    if (!confirm(`Disconnect ${kind}?`)) return;
    await api.connectors.remove(kind);
    await reload();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="px-7 py-8 max-w-[1080px] mx-auto">
      <PageHeader kicker="connectors" title="One agent, every surface." lede="Memory and skills carry across every place you connect. Same agent, same voice." action={<div className="hidden md:block"><HoverPopImage src="/illustrations/mascot-orbit.png" alt="" width={160} height={160} className="w-[140px] h-[140px] bleed-soft halo-warm float-drift" /></div>} />
      <motion.div
        className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3"
        initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      >
        {CONNECTORS.map((c) => {
          const isConn = !!connected[c.id];
          return (
            <motion.div
              key={c.id}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              className="bg-ink-soft border border-ink-line rounded-xl px-5 py-5 hover:border-paper-faint/60 transition-colors"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isConn ? "bg-amber/15 text-amber" : "bg-ink-line text-paper-dim"}`}>
                  <c.icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-paper text-[15px] font-medium">{c.name}</span>
                    {isConn ? (
                      <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] px-2 py-0.5 rounded bg-moss/15 text-moss">connected</span>
                    ) : !c.supported ? (
                      <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] px-2 py-0.5 rounded bg-ink-line text-paper-faint">soon</span>
                    ) : null}
                  </div>
                  <div className="text-paper-dim text-[14.5px] mt-1 leading-[1.5]">{c.desc}</div>
                  {isConn && connected[c.id].handle && (
                    <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper-faint mt-2">{connected[c.id].handle}</div>
                  )}
                </div>
              </div>
              {isConn ? (
                <button onClick={() => disconnect(c.id)} className="w-full px-4 py-2 rounded-md text-[14.5px] border border-ink-line text-paper-dim hover:text-rust hover:border-rust/40">
                  Disconnect
                </button>
              ) : c.supported ? (
                <button onClick={() => { setOpen(c.id); setError(""); }} className="w-full px-4 py-2 rounded-md text-[14.5px] font-medium bg-amber text-ink hover:bg-amber-soft transition-colors">
                  Connect →
                </button>
              ) : (
                <button disabled className="w-full px-4 py-2 rounded-md text-[14.5px] border border-ink-line text-paper-faint cursor-not-allowed">
                  Coming soon
                </button>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {open === "telegram" && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-center justify-center p-7"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[480px] bg-ink-soft border border-ink-line rounded-2xl p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— connect telegram</div>
                <button onClick={() => setOpen(null)} className="p-1 rounded text-paper-dim hover:text-paper"><X size={16} /></button>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-[28px] leading-[1.1] tracking-[-0.02em] mt-2">Paste your bot token.</h3>
              <p className="text-paper-dim text-[15px] mt-3 leading-[1.55]">
                Open Telegram, talk to <a href="https://t.me/BotFather" target="_blank" className="text-amber underline inline-flex items-center gap-0.5">@BotFather <ExternalLink size={11} /></a>, send <span className="font-[family-name:var(--font-mono)] text-paper">/newbot</span>, name it whatever you want, and paste the token here.
              </p>
              <input
                value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="w-full mt-5 px-4 py-3 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber transition-colors font-[family-name:var(--font-mono)] text-[14px]"
                autoFocus
              />
              {error && <div className="text-rust text-[14.5px] mt-2 font-[family-name:var(--font-mono)]">{error}</div>}
              <button
                onClick={() => connect("telegram")} disabled={busy || !token.trim()}
                className="w-full mt-5 px-4 py-3 rounded-md bg-amber text-ink text-[15.5px] font-medium hover:bg-amber-soft disabled:opacity-50"
              >
                {busy ? "Verifying with Telegram…" : "Verify & connect"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
