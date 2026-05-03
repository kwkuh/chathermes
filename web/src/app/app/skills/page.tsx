"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, BookOpen, Code2, Search, Mail, Bell, Image as ImageIcon, Mic, Globe, Brain, Eye } from "lucide-react";
import PageHeader from "../_components/page-header";
import { api } from "@/lib/api";

const SKILLS = [
  // — hero (always-on, real tools) —
  { id: "research", icon: Search, name: "Research", desc: "5-tier web search → browse → cite. Tavily, Brave, DuckDuckGo, Wikipedia.", cat: "hero", live: true },
  { id: "code", icon: Code2, name: "Code & Build", desc: "Vibe coding at /app/projects. Live HTML render. Publish to /p/<slug>.", cat: "hero", live: true },
  { id: "memory", icon: Brain, name: "Persistent memory", desc: "Save facts, recall later. Survives across sessions and devices.", cat: "hero", live: true },
  // — productivity —
  { id: "scheduler", icon: Bell, name: "Scheduler", desc: "Natural-language cron. Daily briefings, monitors, recurring tasks at /app/schedules.", cat: "productivity", live: true },
  { id: "telegram", icon: Mail, name: "Telegram push", desc: "Send agent results to your Telegram. Connect at /app/connectors.", cat: "productivity", live: true },
  { id: "subagent", icon: Sparkles, name: "Subagent dispatch", desc: "Delegate sub-tasks to Claude, GPT-5, or Kimi for parallel reasoning.", cat: "productivity", live: true },
  // — creative —
  { id: "imagegen", icon: ImageIcon, name: "Image generation", desc: "Flux (Replicate). Just say 'draw me X' in chat — agent calls generate_image.", cat: "creative", live: true },
  { id: "vision", icon: Eye, name: "Vision analysis", desc: "Look at any image URL — Gemini 2.0 Flash + GPT-4o fallback. Charts, photos, screenshots.", cat: "creative", live: true },
  // — automation —
  { id: "browser", icon: Globe, name: "Browser", desc: "Visit URLs, extract main content, parse JSON. browse() + fetch_url() tools.", cat: "automation", live: true },
  { id: "github", icon: Code2, name: "GitHub recon", desc: "Repo metadata, stars, latest release, license — github_repo() tool.", cat: "automation", live: true },
  { id: "weather", icon: Globe, name: "Weather + News", desc: "Real-time weather (open-meteo) + news headlines (Google News RSS).", cat: "automation", live: true },
  { id: "compute", icon: Code2, name: "Run JS", desc: "Calculations, regex, JSON parsing, date math — run_js() tool.", cat: "automation", live: true },
];

export default function SkillsPage() {
  const [active, setActive] = useState<Record<string, boolean>>({ research: true, drafter: true, code: true });

  useEffect(() => { api.skills.state().then((d) => setActive(d.active)).catch(() => {}); }, []);

  async function toggle(id: string) {
    const next = !active[id];
    setActive((s) => ({ ...s, [id]: next }));
    try { await api.skills.toggle(id, next); } catch { setActive((s) => ({ ...s, [id]: !next })); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="px-7 py-8 max-w-[1080px] mx-auto">
      <PageHeader
        kicker="skills"
        title="Plug-and-play powers."
        lede="The agent already knows how to do these. Toggle to enable."
      />
      <div className="mt-12">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={13} className="text-amber" />
          <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.16em]">— featured</span>
        </div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-12"
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
        >
          {SKILLS.filter((s) => s.cat === "hero").map((s) => <SkillCard key={s.id} {...s} active={!!active[s.id]} onToggle={() => toggle(s.id)} hero />)}
        </motion.div>
        <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper-faint uppercase tracking-[0.16em] mb-4">— all skills</div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.2 } } }}
        >
          {SKILLS.filter((s) => s.cat !== "hero").map((s) => <SkillCard key={s.id} {...s} active={!!active[s.id]} onToggle={() => toggle(s.id)} />)}
        </motion.div>
      </div>
    </motion.div>
  );
}

function SkillCard({ icon: Icon, name, desc, active, hero, onToggle }: any) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`bg-ink-soft border rounded-xl px-5 py-5 transition-colors ${hero ? "border-amber/30" : "border-ink-line hover:border-paper-faint/60"}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${active ? "bg-amber/15 text-amber" : "bg-ink-line text-paper-dim"}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-paper text-[16px] font-medium">{name}</div>
          <div className="text-paper-dim text-[14.5px] mt-1 leading-[1.5]">{desc}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.16em]">{active ? "active" : "off"}</span>
        <button onClick={onToggle} className={`relative w-9 h-5 rounded-full transition-colors ${active ? "bg-amber" : "bg-ink-line"}`}>
          <motion.span animate={{ x: active ? 16 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-0.5 w-4 h-4 rounded-full bg-paper" />
        </button>
      </div>
    </motion.div>
  );
}
