"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Cpu, Crown, Loader2, CheckCircle2, Clock } from "lucide-react";

type CreditsResp = {
  plan: string;
};
type AgentResp = {
  plan: string;
  eligible: boolean;
  status: "none" | "pending" | "provisioning" | "ready" | "failed" | "marked_for_destruction";
  endpoint: string | null;
};

export function UpgradeCTA() {
  const [plan, setPlan] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentResp["status"]>("none");

  async function load() {
    try {
      const [c, a] = await Promise.all([
        fetch("/api/me/credits", { credentials: "include" }).then(r => r.ok ? r.json() : null),
        fetch("/api/me/private-agent", { credentials: "include" }).then(r => r.ok ? r.json() : null),
      ]);
      if (c) setPlan(c.plan);
      if (a) setAgentStatus(a.status || "none");
    } catch {}
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);

  if (!plan) return null;

  // ─── FREE TIER: aggressive upgrade CTA ───
  if (plan === "free") {
    return (
      <Link
        href="/app/billing"
        className="hidden sm:inline-flex items-center gap-2 pl-3 pr-3.5 py-1.5 rounded-md bg-gradient-to-r from-amber/20 via-amber/15 to-amber/20 border border-amber/50 hover:border-amber hover:from-amber/30 hover:to-amber/30 transition-all relative overflow-hidden group"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-amber/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
        <Cpu size={13} className="text-amber relative" />
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.13em] text-amber relative">
          Get Private Agent <span className="hidden md:inline opacity-70">· €20/mo</span>
        </span>
      </Link>
    );
  }

  // ─── PAID TIER: status badge ───
  const statusMap: Record<string, { label: string; color: string; icon: any; pulse: boolean }> = {
    none: { label: "Plan: " + plan, color: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", icon: Crown, pulse: false },
    pending: { label: "Private agent · pending", color: "border-amber/40 text-amber bg-amber/10", icon: Clock, pulse: true },
    provisioning: { label: "Private agent · spinning up", color: "border-blue-500/40 text-blue-300 bg-blue-500/10", icon: Loader2, pulse: true },
    ready: { label: "Private agent · ready", color: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", icon: CheckCircle2, pulse: false },
    failed: { label: "Private agent · error", color: "border-red-500/40 text-red-300 bg-red-500/10", icon: Cpu, pulse: false },
    marked_for_destruction: { label: "Private agent · cleaning up", color: "border-orange-500/40 text-orange-300 bg-orange-500/10", icon: Cpu, pulse: false },
  };
  const s = statusMap[agentStatus] || statusMap.none;
  const Icon = s.icon;

  return (
    <Link
      href="/app/billing"
      className={`hidden sm:inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-md border ${s.color} hover:opacity-80 transition`}
    >
      <Icon size={12} className={s.pulse && agentStatus === "provisioning" ? "animate-spin" : ""} />
      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.13em]">{s.label}</span>
    </Link>
  );
}

// Mobile variant — small icon-only chip
export function UpgradeCTAMobile() {
  const [plan, setPlan] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/me/credits", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((c: any) => c && setPlan(c.plan))
      .catch(() => {});
  }, []);
  if (!plan || plan !== "free") return null;
  return (
    <Link href="/app/billing" className="sm:hidden inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber/15 border border-amber/40 text-amber">
      <Cpu size={12} />
      <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.13em]">Upgrade</span>
    </Link>
  );
}
