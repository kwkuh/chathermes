"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Plus, Code2, Globe, Trash2, Zap, Crown, AlertCircle, ArrowRight, Sparkles, Layers } from "lucide-react";
import PageHeader from "../_components/page-header";
import { api } from "@/lib/api";

type Quota = {
  plan: string;
  used_this_month: number;
  limit_per_month: number;
  is_unlimited: boolean;
  remaining: number;
  pct: number;
  lifetime_total: number;
  lifetime_published: number;
};

const TEMPLATES = [
  { icon: "🌐", title: "Landing page", prompt: "Build me a landing page for a domain registrar called \"reg\". Minimal, monospace, dark mode with amber accents. Hero, 3 features, CTA, footer." },
  { icon: "📊", title: "Dashboard", prompt: "Build a metrics dashboard with 4 KPI cards (revenue, users, conversion, churn), a line chart for the last 30 days, and a recent-activity feed. Use Tailwind, no charts library — pure SVG." },
  { icon: "💼", title: "SaaS pricing", prompt: "Build a SaaS pricing page with 3 plan cards (Free / Pro highlighted / Enterprise), feature checklist, FAQ accordion, and a sticky 'Get started' CTA." },
  { icon: "🎨", title: "Portfolio", prompt: "Build a designer portfolio: hero with name and tagline, 6-project grid with hover effects, about section, contact form. Dark mode, serif headings, monospace meta." },
  { icon: "📅", title: "Booking app", prompt: "Build a calendly-style booking page: choose a service, pick a date from a mini calendar, pick a time slot, fill in name+email, confirm. Animate transitions between steps." },
  { icon: "🛒", title: "E-commerce", prompt: "Build a single-product page: hero image, 3 thumbnails, title + price + 'Add to cart' button, description tabs, reviews section with star ratings." },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const router = useRouter();

  async function load() {
    try {
      const [p, q] = await Promise.all([
        api.projects.list().then((d) => d.projects),
        fetch("/api/me/projects/quota", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      ]);
      setProjects(p);
      if (q) setQuota(q);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  async function newProject(initialPrompt?: string) {
    setBusy(true);
    try {
      const { project } = await api.projects.create();
      if (initialPrompt) {
        sessionStorage.setItem("ch:first-prompt", initialPrompt);
      }
      router.push(`/dev/${project.id}`);
    } catch (e: any) {
      // Surface limit-exceeded error gracefully
      const msg = e?.message || "Could not create project";
      if (msg.toLowerCase().includes("limit")) {
        alert(msg + "\n\nUpgrade at /app/billing");
        router.push("/app/billing");
      } else {
        alert(msg);
      }
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project? This can't be undone.")) return;
    setProjects((xs) => xs.filter((x) => x.id !== id));
    await api.projects.remove(id);
    load(); // refresh quota
  }

  const overLimit = quota && !quota.is_unlimited && quota.remaining === 0;
  const nearLimit = quota && !quota.is_unlimited && quota.pct >= 70 && !overLimit;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="px-4 sm:px-7 py-6 sm:py-8 max-w-[1180px] mx-auto">
      <PageHeader
        kicker="ChatHermes.dev"
        title="Vibe coding."
        lede="Describe what you want. Watch it appear, live. Each project gets its own URL."
        action={
          <button
            onClick={() => setShowTemplates((v) => !v)}
            disabled={busy || !!overLimit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber text-ink text-[13.5px] font-medium hover:bg-amber-soft transition-colors shadow-[0_0_24px_rgba(232,165,71,0.35)] disabled:opacity-50"
          >
            {busy ? "Creating…" : <><Plus size={14} /> New project</>}
          </button>
        }
      />

      {/* Quota strip */}
      {quota && (
        <div className={`mt-6 rounded-xl px-5 py-4 border flex items-center justify-between gap-4 flex-wrap ${
          overLimit ? "bg-rust/10 border-rust/30" :
          nearLimit ? "bg-amber/10 border-amber/30" :
          "bg-ink-soft border-ink-line"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${
              quota.plan === "free" ? "bg-ink-line/50 border-ink-line text-paper-dim" : "bg-amber/15 border-amber/40 text-amber"
            }`}>
              {quota.plan === "free" ? <Zap size={15} /> : <Crown size={15} />}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-0.5">— this month</div>
              <div className="text-paper text-[14.5px]">
                {quota.is_unlimited ? (
                  <><span className="font-medium">Unlimited</span> projects · {quota.used_this_month} used this month</>
                ) : (
                  <>
                    <span className="font-medium">{quota.used_this_month} / {quota.limit_per_month}</span> projects used
                    {quota.remaining > 0 && <span className="text-paper-dim"> · {quota.remaining} remaining</span>}
                  </>
                )}
              </div>
              {!quota.is_unlimited && (
                <div className="mt-1.5 w-[180px] h-1 rounded-full bg-ink-line/60 overflow-hidden">
                  <div className={`h-full transition-all ${overLimit ? "bg-rust" : nearLimit ? "bg-amber" : "bg-moss"}`} style={{ width: `${quota.pct}%` }} />
                </div>
              )}
            </div>
          </div>

          {(overLimit || nearLimit) && (
            <Link href="/app/billing" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber text-ink text-[13px] font-medium hover:bg-amber-soft transition">
              {overLimit ? "Upgrade for unlimited" : "Get unlimited"}
              <ArrowRight size={12} />
            </Link>
          )}

          {!overLimit && !nearLimit && quota.plan === "free" && (
            <div className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint flex items-center gap-1">
              <Sparkles size={11} className="text-amber" />
              <span>Pro: unlimited builds + 3× faster generation</span>
            </div>
          )}
        </div>
      )}

      {/* Credit-cost note (always visible, subtle) */}
      <div className="mt-3 text-[12.5px] text-paper-faint flex items-center gap-1.5">
        <Sparkles size={11} className="text-amber" />
        <span>Vibe-coding generations consume credits at a slightly higher rate than chat — roughly 3× per generation.</span>
      </div>

      {/* Templates strip — collapsible */}
      <motion.div
        initial={false}
        animate={{ height: showTemplates ? "auto" : 0, opacity: showTemplates ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="mt-6 pt-2">
          <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-amber mb-3 flex items-center gap-2">
            <Layers size={11} /> Pick a starting template
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => newProject(t.prompt)}
                disabled={busy || !!overLimit}
                className="text-left px-4 py-4 rounded-xl border border-ink-line bg-ink-soft hover:border-amber/40 hover:bg-amber/[0.04] transition-all disabled:opacity-50 group"
              >
                <div className="text-[24px] mb-2">{t.icon}</div>
                <div className="text-paper text-[14px] font-medium mb-1">{t.title}</div>
                <div className="text-paper-faint text-[12px] line-clamp-2">{t.prompt.slice(0, 80)}…</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => newProject()}
            disabled={busy || !!overLimit}
            className="mt-4 w-full text-center px-4 py-3 rounded-xl border border-dashed border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[13px] disabled:opacity-50"
          >
            …or start from a blank canvas
          </button>
        </div>
      </motion.div>

      {/* Projects grid */}
      <div className="mt-10">
        {projects.length === 0 && !showTemplates ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 sm:py-20 flex flex-col items-center text-center">
            <Image src="/illustrations/winged-helmet.png" alt="" width={140} height={140} className="w-[100px] sm:w-[120px] h-auto mb-6 bleed-soft halo-amber float-drift" />
            <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-amber uppercase tracking-[0.18em] mb-3">— blank slate</div>
            <h2 className="font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] leading-[1.1] tracking-[-0.02em] max-w-[20ch]">
              Your first <em className="text-amber">build</em> starts here.
            </h2>
            <p className="text-paper-dim mt-3 text-[14.5px] max-w-[44ch]">
              Tell the agent what to make. It writes the code. You watch it appear, live.
            </p>
            <div className="flex gap-3 mt-7">
              <button onClick={() => setShowTemplates(true)} disabled={busy} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber text-ink text-[14px] font-medium hover:bg-amber-soft transition-colors">
                <Layers size={15} /> Browse templates
              </button>
              <button onClick={() => newProject()} disabled={busy} className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[14px]">
                <Plus size={15} /> Blank canvas
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          >
            {projects.map((p) => (
              <motion.div
                key={p.id}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="group relative bg-ink-soft border border-ink-line rounded-2xl overflow-hidden hover:border-amber/40 transition-colors"
              >
                <Link href={`/dev/${p.id}`} className="block">
                  <div className="aspect-[16/10] overflow-hidden bg-paper-soft relative">
                    <iframe srcDoc={p.html} title={p.title} sandbox="" className="w-full h-full border-0 pointer-events-none scale-[0.5] origin-top-left" style={{ width: "200%", height: "200%" }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-soft/80 via-transparent to-transparent" />
                  </div>
                  <div className="px-5 py-4 border-t border-ink-line">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-paper text-[15px] font-medium truncate flex-1">{p.title}</h3>
                      {p.published ? (
                        <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded bg-moss/15 text-moss inline-flex items-center gap-1 shrink-0">
                          <Globe size={9} /> live
                        </span>
                      ) : null}
                    </div>
                    <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint">{p.slug}</div>
                  </div>
                </Link>
                <button onClick={() => remove(p.id)} className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1.5 rounded-md bg-ink/80 backdrop-blur text-paper-dim hover:text-rust transition-all">
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
