"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Check, Crown, Building2, Zap, AlertCircle, X, ArrowRight, Cpu, Clock,
  Loader2, CheckCircle2, Sparkles, Shield, Gauge, Users, Receipt, Download,
  ExternalLink, ChevronDown, Server, Lock, Rocket
} from "lucide-react";
import PageHeader from "../_components/page-header";

const PLAN_ICONS: any = { free: Zap, pro: Crown, team: Building2, enterprise: Building2 };

function fmtMoney(cents: number) {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

type AgentStatus = "none" | "pending" | "provisioning" | "ready" | "failed" | "marked_for_destruction";

export default function BillingPage() {
  const [data, setData] = useState<any>(null);
  const [agent, setAgent] = useState<{ status: AgentStatus; eligible: boolean; endpoint: string | null } | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  async function load() {
    const [billing, plans, ag] = await Promise.all([
      fetch("/api/me/billing", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/billing/plans", { credentials: "include" }).then((r) => r.json()).catch(() => ({ stripe_enabled: false })),
      fetch("/api/me/private-agent", { credentials: "include" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    setData(billing);
    setStripeEnabled(!!plans.stripe_enabled);
    if (ag) setAgent({ status: ag.status, eligible: ag.eligible, endpoint: ag.endpoint });
  }

  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      const c = u.searchParams.get("checkout");
      if (c === "success") setFlash({ kind: "ok", msg: "Welcome to Pro. Your private agent is being provisioned." });
      if (c === "cancel") setFlash({ kind: "err", msg: "Checkout cancelled. No charges made." });
      if (c) {
        u.searchParams.delete("checkout");
        u.searchParams.delete("session_id");
        window.history.replaceState({}, "", u.pathname + (u.search || ""));
      }
    }
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  async function changePlan(plan: string) {
    setBusy(plan); setFlash(null);
    try {
      if (stripeEnabled && plan !== "free") {
        const r = await fetch("/api/me/billing/checkout", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const j = await r.json();
        if (r.ok && j.url) { window.location.href = j.url; return; }
        if (r.status !== 503) { setFlash({ kind: "err", msg: j.error || "Checkout failed" }); setBusy(null); return; }
      }
      const msg = plan === "free" ? "Cancel paid subscription at end of period?" : `Switch to ${plan}?`;
      if (!confirm(msg)) { setBusy(null); return; }
      const r = await fetch("/api/me/billing/change", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await r.json();
      if (!r.ok) setFlash({ kind: "err", msg: j.error || "Plan change failed" });
      else { setFlash({ kind: "ok", msg: `Switched to ${plan}.` }); await load(); }
    } finally { setBusy(null); }
  }

  async function cancel() {
    if (!confirm("Cancel subscription at end of period?")) return;
    setBusy("cancel");
    await fetch("/api/me/billing/cancel", { method: "POST", credentials: "include" });
    await load();
    setBusy(null);
  }
  async function resume() {
    setBusy("resume");
    await fetch("/api/me/billing/resume", { method: "POST", credentials: "include" });
    await load();
    setBusy(null);
  }

  if (!data) return <div className="p-7 text-paper-faint">Loading…</div>;
  const sub = data.subscription;
  const usage = data.usage;
  const invoices = data.invoices ?? [];
  const planMeta = data.plan_meta;
  const allPlans = Object.fromEntries(
    Object.entries(data.all_plans || {}).filter(([id]) => ["free", "pro", "team"].includes(id))
  );
  const isFree = sub.plan === "free";
  const PlanIcon = PLAN_ICONS[sub.plan] ?? Zap;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 sm:px-7 py-6 sm:py-10 max-w-[1180px] mx-auto">
      {flash && (
        <div className={`mb-6 px-5 py-3.5 rounded-xl flex items-center gap-3 ${flash.kind === "ok" ? "bg-moss/10 border border-moss/30 text-moss" : "bg-rust/10 border border-rust/30 text-rust"}`}>
          {flash.kind === "ok" ? <Check size={16} /> : <AlertCircle size={16} />}
          <div className="flex-1 text-[14.5px]">{flash.msg}</div>
          <button onClick={() => setFlash(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* ═══════════════ HERO — branches by plan ═══════════════ */}
      {isFree ? <FreeUserHero changePlan={changePlan} busy={busy} /> : <PaidUserHero plan={sub.plan} agent={agent} planMeta={planMeta} sub={sub} />}

      {/* ═══════════════ THE PITCH (free users only) ═══════════════ */}
      {isFree && <ConversionPitch />}

      {/* ═══════════════ PRICING CARDS ═══════════════ */}
      <div className="mt-14 mb-2 text-center">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-amber uppercase tracking-[0.22em]">— pricing</div>
        <h2 className="font-[family-name:var(--font-display)] text-[32px] sm:text-[40px] tracking-[-0.02em] leading-[1.1] mt-3">
          {isFree ? "Pick your plan" : "Manage your plan"}
        </h2>
        {isFree && <p className="text-paper-dim text-[15px] mt-3 max-w-[480px] mx-auto">Cancel anytime, no commitment. All plans include credits, models, and tools — only the agent is private.</p>}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.values(allPlans).map((p: any) => {
          const Icon = PLAN_ICONS[p.id];
          const active = p.id === sub.plan;
          const isPro = p.id === "pro";
          return (
            <motion.div
              key={p.id}
              whileHover={{ y: -2 }}
              className={`relative rounded-2xl px-6 py-6 flex flex-col transition-all ${
                isPro
                  ? "bg-gradient-to-b from-amber/[0.08] to-amber/[0.02] border-2 border-amber/50 shadow-2xl shadow-amber/10"
                  : "bg-ink-soft border border-ink-line"
              } ${active ? "ring-1 ring-amber/40" : ""}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber text-ink px-3 py-1 rounded-full text-[10.5px] font-[family-name:var(--font-mono)] uppercase tracking-[0.18em] font-medium whitespace-nowrap">
                  Most popular
                </div>
              )}
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                  isPro ? "bg-amber/20 border-amber/40 text-amber" :
                  p.id === "team" ? "bg-plum/15 border-plum/40 text-plum" :
                  "bg-ink-line/40 border-ink-line text-paper-dim"
                }`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1">
                  <div className="text-paper text-[15.5px] font-medium">{p.name}</div>
                  {active && <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-amber uppercase tracking-[0.18em]">current</div>}
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-display)] text-[36px] tracking-[-0.025em] leading-none">{fmtMoney(p.price_cents)}</span>
                {p.price_cents > 0 && <span className="text-paper-dim text-[14px]">/mo</span>}
              </div>
              {p.price_cents === 0 && <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.16em] mt-1">forever, no card</div>}
              {p.price_cents > 0 && <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.16em] mt-1">cancel anytime</div>}

              <ul className="mt-5 text-[14px] text-paper-dim space-y-2 mb-5 flex-1">
                {p.features.map((f: string) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={12} className={`${isPro ? "text-amber" : "text-moss"} mt-1 shrink-0`} />
                    <span>{f}</span>
                  </li>
                ))}
                {/* Inject private agent line */}
                {p.id !== "free" && (
                  <li className="flex items-start gap-2 pt-1.5 border-t border-ink-line/60">
                    <Cpu size={12} className={`${isPro ? "text-amber" : "text-plum"} mt-1 shrink-0`} />
                    <span className="text-paper">Your own private Hermes Agent server</span>
                  </li>
                )}
              </ul>

              {active ? (
                sub.cancel_at_period_end ? (
                  <button onClick={resume} disabled={busy === "resume"} className="w-full px-3 py-2.5 rounded-md bg-amber text-ink text-[14px] font-medium hover:bg-amber-soft">Keep plan</button>
                ) : (
                  <button onClick={cancel} disabled={busy === "cancel" || p.id === "free"} className="w-full px-3 py-2.5 rounded-md border border-ink-line text-paper-dim hover:text-rust hover:border-rust/40 text-[14px] disabled:opacity-40">
                    {p.id === "free" ? "Current" : busy === "cancel" ? "Cancelling…" : "Cancel"}
                  </button>
                )
              ) : (
                <button
                  onClick={() => changePlan(p.id)}
                  disabled={busy === p.id || (p.price_cents > 0 && !p.has_stripe_price)}
                  className={`w-full px-3 py-3 rounded-md text-[14px] font-medium transition disabled:opacity-50 ${
                    isPro
                      ? "bg-amber text-ink hover:bg-amber-soft shadow-lg shadow-amber/20"
                      : "border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim"
                  }`}
                >
                  {busy === p.id ? "Loading…" : p.price_cents === 0 ? "Downgrade" : (
                    <span className="inline-flex items-center gap-1.5">
                      Get {p.name} <ArrowRight size={13} />
                    </span>
                  )}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ═══════════════ TRUST BAR ═══════════════ */}
      {isFree && (
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <TrustItem icon={Shield} label="30-day refund" />
          <TrustItem icon={X} label="Cancel anytime" />
          <TrustItem icon={Lock} label="Stripe secure" />
          <TrustItem icon={Rocket} label="Setup in 90 sec" />
        </div>
      )}

      {/* ═══════════════ USAGE (all users — minimal display) ═══════════════ */}
      <div className="mt-14">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={13} className="text-paper-dim" />
          <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim uppercase tracking-[0.18em]">— this month</div>
        </div>
        <div className="bg-ink-soft border border-ink-line rounded-2xl px-5 sm:px-7 py-5 grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-7">
          <Stat label="Messages" value={usage.messages.toLocaleString()} />
          <Stat label="Tools used" value={usage.tool_calls.toLocaleString()} />
          <Stat label="Conversations" value={(data.subscription?.session_count ?? "—").toLocaleString?.() ?? "—"} />
          <Stat label="Renews" value={fmtDate(sub.period_end)} />
        </div>
      </div>

      {/* ═══════════════ FAQ ═══════════════ */}
      {isFree && (
        <div className="mt-14">
          <div className="text-center mb-8">
            <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-amber uppercase tracking-[0.22em]">— frequently asked</div>
            <h3 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[32px] tracking-[-0.02em] mt-3">Got questions?</h3>
          </div>
          <div className="max-w-[720px] mx-auto space-y-2">
            {FAQS.map((f, i) => (
              <button
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className={`w-full text-left bg-ink-soft border rounded-xl px-5 py-4 transition-all ${openFaq === i ? "border-amber/40" : "border-ink-line hover:border-ink-line"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-paper text-[15px] font-medium">{f.q}</span>
                  <ChevronDown size={16} className={`text-paper-dim transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </div>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="text-paper-dim text-[14.5px] leading-[1.65] pt-3">{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ INVOICES (paid only) ═══════════════ */}
      {!isFree && invoices.length > 0 && (
        <div className="mt-14">
          <div className="flex items-center gap-2 mb-3">
            <Receipt size={13} className="text-amber" />
            <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— invoices</div>
          </div>
          <div className="bg-ink-soft border border-ink-line rounded-2xl overflow-hidden">
            {invoices.slice(0, 8).map((inv: any) => (
              <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-3 border-b border-ink-line last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${inv.status === "paid" ? "bg-moss" : "bg-rust"}`} />
                  <div className="text-paper text-[14px] truncate">{inv.description}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper">${(inv.amount_cents / 100).toFixed(2)}</div>
                  <div className="text-paper-dim text-[12.5px]">{fmtDate(inv.paid_at || inv.period_end)}</div>
                  {inv.pdf_url && (
                    <a
                      href={inv.pdf_url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber/10 hover:bg-amber/20 border border-amber/30 text-amber text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.12em]"
                      title="Download PDF receipt"
                    >
                      <Download size={11} /> PDF
                    </a>
                  )}
                  {inv.hosted_invoice_url && (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-ink-line hover:border-paper-dim text-paper-dim hover:text-paper text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.12em]"
                      title="View on Stripe"
                    >
                      <ExternalLink size={11} /> View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FREE USER HERO — full conversion energy
// ═══════════════════════════════════════════════════════════════
function FreeUserHero({ changePlan, busy }: { changePlan: (p: string) => void; busy: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber/[0.06] via-ink-soft to-plum/[0.04] border border-amber/20 px-6 sm:px-10 py-8 sm:py-12 mb-10">
      {/* Ambient glow */}
      <div className="absolute -top-20 -right-20 w-[300px] h-[300px] bg-amber/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-plum/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber/10 border border-amber/30 mb-4">
            <Sparkles size={11} className="text-amber" />
            <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-amber">Founder pricing · ends soon</span>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-[32px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] text-paper">
            You're sharing.<br />
            <span className="text-amber">Your agent shouldn't be.</span>
          </h1>
          <p className="text-paper-dim text-[15.5px] sm:text-[16.5px] mt-5 leading-[1.55] max-w-[520px]">
            Free tier shares one agent across <strong className="text-paper">every other free user</strong>. Upgrade to Pro and get your own dedicated Hermes Agent — isolated CPU, your own rate limits, your own credentials boundary, on a server that's literally yours.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => changePlan("pro")}
              disabled={busy === "pro"}
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-md bg-amber text-ink font-medium text-[15px] hover:bg-amber-soft transition shadow-2xl shadow-amber/20 hover:shadow-amber/40 disabled:opacity-50 relative overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Crown size={15} className="relative" />
              <span className="relative">{busy === "pro" ? "Loading…" : "Get Pro · $20/mo"}</span>
              <ArrowRight size={14} className="relative group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => document.getElementById("compare")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[14.5px] transition"
            >
              See what you get
            </button>
          </div>
          <div className="mt-4 flex items-center gap-4 text-[12px] text-paper-faint">
            <span className="inline-flex items-center gap-1.5"><Check size={11} className="text-moss" /> Cancel anytime</span>
            <span className="inline-flex items-center gap-1.5"><Check size={11} className="text-moss" /> Setup in 90 seconds</span>
            <span className="inline-flex items-center gap-1.5 hidden sm:inline-flex"><Check size={11} className="text-moss" /> 30-day refund</span>
          </div>
        </div>

        {/* Visual: shared (cramped) vs private (premium) */}
        <div className="relative hidden lg:block">
          <SharedVsPrivate />
        </div>
      </div>
    </div>
  );
}

// Visual diagram: cramped shared vs premium private
function SharedVsPrivate() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-ink-soft border border-ink-line px-4 py-5 opacity-60">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-paper-faint mb-3">— free</div>
        <div className="relative h-[140px] rounded-lg bg-ink-line/40 border border-ink-line p-2">
          <div className="text-center text-paper-faint text-[10.5px] mb-2 font-[family-name:var(--font-mono)]">shared agent</div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-3 rounded bg-stone-600/40" />
            ))}
          </div>
          <div className="absolute bottom-2 left-2 right-2 text-[9px] text-paper-faint text-center font-[family-name:var(--font-mono)]">queue: ~7 ahead of you</div>
        </div>
        <div className="mt-3 text-[11.5px] text-paper-faint">slow during peaks · rate limited</div>
      </div>

      <div className="relative rounded-2xl bg-gradient-to-br from-amber/15 to-amber/5 border-2 border-amber/40 px-4 py-5">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-amber mb-3">— pro</div>
        <div className="relative h-[140px] rounded-lg bg-amber/10 border border-amber/30 p-2 flex items-center justify-center">
          <div className="text-center">
            <Cpu size={28} className="text-amber mx-auto mb-1.5" />
            <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-amber/80">your private agent</div>
            <div className="font-[family-name:var(--font-mono)] text-[9px] text-amber/60 mt-1">cpx11 · hetzner</div>
          </div>
        </div>
        <div className="mt-3 text-[11.5px] text-amber/80">always available · isolated</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAID USER HERO — celebration + private agent status
// ═══════════════════════════════════════════════════════════════
function PaidUserHero({ plan, agent, planMeta, sub }: any) {
  const Icon = PLAN_ICONS[plan] || Crown;
  const agentBadge = agent?.status === "ready" ? { color: "moss", label: "Private agent · ready", icon: CheckCircle2 } :
    agent?.status === "provisioning" ? { color: "amber", label: "Spinning up your agent…", icon: Loader2 } :
    agent?.status === "pending" ? { color: "amber", label: "Provisioning soon", icon: Clock } :
    agent?.status === "failed" ? { color: "rust", label: "Provisioning failed — contact support", icon: AlertCircle } :
    null;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-moss/[0.05] to-ink-soft border border-moss/20 px-6 sm:px-9 py-7 sm:py-9 mb-10">
      <div className="flex items-start gap-5">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber/15 border border-amber/40 flex items-center justify-center text-amber shrink-0">
          <Icon size={26} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-amber mb-1">— you're on {planMeta.name}</div>
          <h1 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[32px] tracking-[-0.02em] leading-[1.15] text-paper">Welcome to the inside.</h1>
          {agentBadge && (
            <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-${agentBadge.color}/10 border border-${agentBadge.color}/30 text-${agentBadge.color}`}>
              <agentBadge.icon size={12} className={agent?.status === "provisioning" ? "animate-spin" : ""} />
              <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em]">{agentBadge.label}</span>
            </div>
          )}
          {agent?.endpoint && agent.status === "ready" && (
            <div className="mt-2 font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint">{agent.endpoint}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONVERSION PITCH — visual feature comparison
// ═══════════════════════════════════════════════════════════════
function ConversionPitch() {
  return (
    <div id="compare" className="mt-12">
      <div className="text-center mb-10">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-amber uppercase tracking-[0.22em]">— what changes</div>
        <h2 className="font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] tracking-[-0.02em] leading-[1.1] mt-3">From shared to sovereign.</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <FeatureCard
          icon={Server}
          title="Your own server"
          desc="Dedicated Hetzner CPX11 (2 vCPU, 2GB RAM) running your isolated Hermes Agent. Not shared. Not throttled."
        />
        <FeatureCard
          icon={Gauge}
          title="No queue, no waits"
          desc="Free users share rate limits. Pro users get your own. Heavy work doesn't slow you down — it slows nothing down."
        />
        <FeatureCard
          icon={Lock}
          title="Your boundary"
          desc="Your credentials, your tokens, your tool memory. Nothing crosses to other users. Yours, end-to-end."
        />
      </div>

      <div className="rounded-2xl bg-ink-soft border border-ink-line overflow-hidden">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-ink-line">
              <th className="text-left px-5 py-4 text-paper-dim font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em]">Feature</th>
              <th className="text-center px-5 py-4 text-paper-dim font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em]">Free</th>
              <th className="text-center px-5 py-4 text-amber font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em]">Pro</th>
            </tr>
          </thead>
          <tbody>
            <CompareRow feature="Hermes Agent" free="Shared" pro="Private dedicated server" />
            <CompareRow feature="Models" free="All 10 included" pro="All 10 included" />
            <CompareRow feature="Memory + Skills" free="Yes" pro="Yes" />
            <CompareRow feature="Vibe coding (build apps)" free="Yes" pro="Yes" />
            <CompareRow feature="Public REST API" free="Yes" pro="Yes" />
            <CompareRow feature="Rate limits" free="60 req/min shared" pro="Your own pool" highlight />
            <CompareRow feature="Cold-start when idle" free="Could be slow" pro="Hot, your CPU" highlight />
            <CompareRow feature="Tool tokens isolated" free="Shared instance" pro="Your server" highlight />
            <CompareRow feature="Setup time" free="Instant" pro="~90 seconds" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: any) {
  return (
    <div className="rounded-2xl bg-ink-soft border border-ink-line px-5 py-5 hover:border-amber/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-amber/15 border border-amber/30 flex items-center justify-center text-amber mb-3">
        <Icon size={17} />
      </div>
      <div className="font-[family-name:var(--font-display)] text-[19px] tracking-[-0.01em] mb-1.5">{title}</div>
      <div className="text-paper-dim text-[14px] leading-[1.55]">{desc}</div>
    </div>
  );
}

function CompareRow({ feature, free, pro, highlight }: { feature: string; free: string; pro: string; highlight?: boolean }) {
  return (
    <tr className={`border-b border-ink-line/60 last:border-0 ${highlight ? "bg-amber/[0.03]" : ""}`}>
      <td className="px-5 py-3.5 text-paper text-[14px]">{feature}</td>
      <td className="px-5 py-3.5 text-center text-paper-dim text-[13.5px]">{free}</td>
      <td className={`px-5 py-3.5 text-center text-[13.5px] ${highlight ? "text-amber font-medium" : "text-paper"}`}>{pro}</td>
    </tr>
  );
}

function TrustItem({ icon: Icon, label }: any) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-ink-soft border border-ink-line">
      <Icon size={13} className="text-moss shrink-0" />
      <span className="text-paper-dim text-[12.5px]">{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.18em] mb-1">{label}</div>
      <div className="font-[family-name:var(--font-display)] text-[20px] sm:text-[22px] text-paper tracking-[-0.01em]">{value}</div>
    </div>
  );
}

const FAQS = [
  {
    q: "What's a 'private agent' and why should I care?",
    a: "Free users share one Hermes Agent instance. Under load, your prompt waits in queue with everyone else's. Pro provisions a dedicated Hetzner Cloud server (CPX11 — 2 vCPU, 2GB RAM, NVMe SSD, 20TB traffic) running only your Hermes Agent. Your prompts hit your CPU. Your tools run with your tokens. Nobody else can throttle you.",
  },
  {
    q: "How fast does my private agent actually deploy?",
    a: "About 90 seconds from clicking Upgrade to your agent answering its first message. Hetzner spawns the server (~30s), cloud-init installs Bun + the proxy + a per-user auth token (~45s), and we probe readiness automatically. You get a live status badge in the topbar — pending → spinning up → ready.",
  },
  {
    q: "Can I cancel and what happens to my data?",
    a: "Yes, cancel anytime from this page. Your subscription stays active until the period ends, then your private agent is destroyed. All your messages, memory, projects, and settings live on the main ChatHermes app — those stay regardless of plan.",
  },
  {
    q: "Where does the server live? Can I pick the region?",
    a: "By default we deploy to Hillsboro, OR (closest to chathermes.com origin for low latency). We're adding region picker for Helsinki, Nuremberg, Falkenstein, and Singapore in the next release. Email us if you need a specific region today.",
  },
  {
    q: "Is the source open?",
    a: "Yes — full source is on GitHub under the ChatHermes Open Source License (AGPL-3.0 + required attribution). You can self-host the entire stack including the deploy logic. Pro hosting at chathermes.com pays our team to operate the cloud infrastructure.",
  },
  {
    q: "What if my private agent goes down?",
    a: "We auto-fall-back to the shared instance immediately, so chats never break. The admin dashboard shows your agent status; if it's failed for >5 min we'll notify you and re-provision automatically.",
  },
];
