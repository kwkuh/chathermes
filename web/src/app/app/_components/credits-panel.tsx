"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Coins, TrendingUp, Sparkles, Check, ArrowUpRight } from "lucide-react";

type CreditsData = {
  plan: string;
  monthly_grant_per_plan: number;
  cost: Record<string, number>;
  balance: { balance: number; monthly_grant: number; lifetime_consumed: number; lifetime_topped_up: number; used_this_period: number; topped_up_this_period: number; next_reset_at: number };
  packs: Array<{ id: string; name: string; credits: number; price_cents: number; currency: string; bonus_pct: number; has_stripe_price: boolean }>;
  model_rates: Array<{ model_id: string; label: string; credits_per_1k: number }>;
  plans: Record<string, number>;
};

type Tx = { id: string; delta: number; reason: string; ref_id: string | null; meta: string | null; balance_after: number; created_at: number };

function fmtRel(ms: number) {
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
  return `${Math.floor(d / 86400_000)}d ago`;
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const REASON_LABEL: Record<string, { label: string; color: string }> = {
  chat: { label: "Chat", color: "text-paper-dim" },
  vibe: { label: "Build", color: "text-amber" },
  grant: { label: "Monthly grant", color: "text-moss" },
  topup: { label: "Top-up", color: "text-moss" },
  refund: { label: "Refund", color: "text-sage" },
  admin_adjust: { label: "Adjustment", color: "text-paper-dim" },
};

export default function CreditsPanel() {
  const [data, setData] = useState<CreditsData | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [a, b] = await Promise.all([
      fetch("/api/me/credits", { credentials: "include" }).then(r => r.json()),
      fetch("/api/me/credits/transactions", { credentials: "include" }).then(r => r.json()),
    ]);
    setData(a);
    setTxs(b.transactions || []);
  }
  useEffect(() => {
    load();
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      if (u.searchParams.get("topup") === "success") setTimeout(load, 1500);  // give webhook time to fire
    }
  }, []);

  async function topup(packId: string) {
    setBusy(packId);
    try {
      const r = await fetch("/api/me/credits/topup", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pack: packId }) });
      const j = await r.json();
      if (j.ok && j.url) window.location.href = j.url;
      else alert(j.error || "checkout failed");
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-paper-faint text-[14px]">Loading credits…</div>;

  const bal = data.balance;
  const pct = bal.monthly_grant > 0 ? Math.min(100, (bal.balance / bal.monthly_grant) * 100) : 100;

  return (
    <div>
      {/* Headline balance card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-amber/[0.08] to-ink-soft border border-amber/20 rounded-2xl p-5 sm:p-6 mb-6"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-[family-name:var(--font-mono)] text-[11px] text-amber uppercase tracking-[0.18em] mb-1.5">— credits</div>
            <div className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-display)] text-[44px] sm:text-[56px] leading-none tracking-tight text-paper">{bal.balance.toLocaleString()}</span>
              <span className="text-paper-dim text-[14px]">/ {bal.monthly_grant.toLocaleString()} monthly</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[13px] text-paper-dim">
              <span><span className="text-paper">{bal.used_this_period.toLocaleString()}</span> used this period</span>
              <span className="text-paper-faint">·</span>
              <span>resets {fmtDate(bal.next_reset_at)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-1">Plan</div>
            <div className="font-[family-name:var(--font-display)] text-[22px] capitalize">{data.plan}</div>
          </div>
        </div>
        <div className="mt-5 h-1.5 bg-ink-line rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct < 20 ? "bg-rust" : pct < 50 ? "bg-amber" : "bg-moss"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </motion.div>

      {/* Top-up packs */}
      <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber mb-3">— top up (one-time, never expires)</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-8">
        {data.packs.map((p, i) => {
          const baseRate = data.packs[0]?.credits / data.packs[0]?.price_cents || 1;
          const thisRate = p.credits / p.price_cents;
          const bonusVisible = p.bonus_pct > 0;
          const popular = i === 1;  // Builder pack
          return (
            <motion.button
              key={p.id}
              whileHover={{ y: -2 }}
              onClick={() => topup(p.id)}
              disabled={!p.has_stripe_price || busy === p.id}
              className={`relative text-left rounded-xl border p-4 transition-colors disabled:opacity-50 ${
                popular ? "bg-amber/5 border-amber/40 hover:border-amber" : "bg-ink-soft border-ink-line hover:border-paper-faint"
              }`}
            >
              {popular && (
                <span className="absolute -top-2 left-3 px-2 py-0.5 bg-amber text-ink text-[10px] font-medium uppercase tracking-[0.14em] rounded">Popular</span>
              )}
              <div className="flex items-center gap-1.5 mb-2">
                <Coins size={12} className={popular ? "text-amber" : "text-paper-faint"} />
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-paper-dim">{p.name}</span>
              </div>
              <div className="font-[family-name:var(--font-display)] text-[28px] leading-none tracking-tight text-paper">{p.credits.toLocaleString()}</div>
              <div className="text-[11.5px] text-paper-faint mt-0.5">credits</div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="font-[family-name:var(--font-display)] text-[18px] text-paper">{fmtMoney(p.price_cents)}</span>
                {bonusVisible && <span className="text-[11px] text-moss">+{p.bonus_pct}% bonus</span>}
              </div>
              {busy === p.id && <div className="absolute inset-0 bg-ink/60 rounded-xl flex items-center justify-center text-[12px] text-paper-dim">opening checkout…</div>}
            </motion.button>
          );
        })}
      </div>

      {/* Activity (formerly transactions — softened framing, no meta exposed) */}
      <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber mb-3">— activity</div>
      <div className="bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        {txs.length === 0 ? (
          <div className="px-5 py-10 text-center text-paper-faint text-[13.5px]">Nothing yet.</div>
        ) : (
          <>
            {txs.slice(0, 30).map((t) => {
              const reasonInfo = REASON_LABEL[t.reason] || { label: t.reason, color: "text-paper-dim" };
              const sign = t.delta > 0 ? "+" : "";
              return (
                <div key={t.id} className="px-4 sm:px-5 py-2.5 border-b border-ink-line last:border-b-0 flex items-center gap-3 text-[13.5px]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.delta > 0 ? "bg-moss" : "bg-paper-faint"}`}></span>
                  <span className={`text-[13.5px] ${reasonInfo.color}`}>{reasonInfo.label}</span>
                  <span className="ml-auto font-[family-name:var(--font-mono)] text-[11px] text-paper-faint shrink-0">{fmtRel(t.created_at)}</span>
                  <span className={`font-[family-name:var(--font-mono)] text-[13.5px] font-medium tabular-nums w-14 text-right shrink-0 ${t.delta > 0 ? "text-moss" : "text-paper"}`}>{sign}{Math.abs(t.delta).toLocaleString()}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function safeJSON(s: string) { try { return JSON.parse(s); } catch { return null; } }
