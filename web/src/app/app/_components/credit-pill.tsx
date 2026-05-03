"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, AlertCircle } from "lucide-react";

type CreditsResp = {
  plan: string;
  monthly_grant_per_plan: number;
  balance: { balance: number; monthly_grant: number; lifetime_consumed: number; lifetime_topped_up: number; used_this_period: number; next_reset_at: number };
};

export function CreditPill() {
  const [data, setData] = useState<CreditsResp | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/me/credits", { credentials: "include" });
      if (!r.ok) return;
      setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    // Re-fetch on focus (after returning from Stripe checkout)
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);

  if (!data) return null;
  const bal = data.balance.balance;
  const grant = data.balance.monthly_grant || data.monthly_grant_per_plan;
  const pct = grant > 0 ? Math.min(100, (bal / grant) * 100) : 100;

  const lowBalance = bal < 20 && data.plan === "free";
  const color = lowBalance ? "text-rust" : pct < 30 ? "text-amber" : "text-paper-dim";
  const ringColor = lowBalance ? "stroke-rust" : pct < 30 ? "stroke-amber" : "stroke-sage";

  return (
    <Link
      href="/app/billing"
      title={`${bal.toLocaleString()} credits left · ${data.balance.used_this_period.toLocaleString()} used this period`}
      className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-ink-line hover:border-amber/40 transition-colors"
    >
      {/* Mini circular progress */}
      <div className="relative w-4 h-4">
        <svg viewBox="0 0 16 16" className="w-4 h-4 -rotate-90">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="rgba(124,154,149,0.18)" strokeWidth="1.5" />
          <circle
            cx="8" cy="8" r="6.5"
            fill="none"
            className={`${ringColor} transition-all`}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 6.5}
            strokeDashoffset={2 * Math.PI * 6.5 * (1 - pct / 100)}
          />
        </svg>
        <Coins size={9} className={`absolute inset-0 m-auto ${color}`} />
      </div>
      <span className={`font-[family-name:var(--font-mono)] text-[12px] ${color}`}>
        {bal.toLocaleString()}
        {lowBalance && <AlertCircle size={10} className="inline ml-1" />}
      </span>
    </Link>
  );
}

export function CreditPillMobile() {
  const [data, setData] = useState<CreditsResp | null>(null);
  useEffect(() => {
    fetch("/api/me/credits", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  }, []);
  if (!data) return null;
  return (
    <Link href="/app/billing" className="sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded-md text-paper-dim text-[12px] font-[family-name:var(--font-mono)]">
      <Coins size={11} />
      {data.balance.balance.toLocaleString()}
    </Link>
  );
}


// Compact variant for embedding in dropdowns / panels (no upgrade language, just info)
export function CreditMini() {
  const [data, setData] = useState<CreditsResp | null>(null);
  useEffect(() => {
    fetch("/api/me/credits", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data) return null;
  const bal = data.balance.balance;
  const grant = data.balance.monthly_grant || data.monthly_grant_per_plan;
  return (
    <Link href="/app/billing" className="mt-2 flex items-center justify-between text-[12px] text-paper-dim hover:text-paper transition-colors group">
      <span className="font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] text-[10.5px]">credits</span>
      <span className="font-[family-name:var(--font-mono)] tabular-nums">
        <span className="text-paper">{bal.toLocaleString()}</span>
        {grant > 0 && <span className="text-paper-faint"> / {grant.toLocaleString()}</span>}
      </span>
    </Link>
  );
}
