"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu, Sparkles, Activity, ShieldCheck, Loader2, Clock, AlertCircle,
  Wifi, WifiOff, Crown, Zap
} from "lucide-react";

type AgentInfo = {
  plan: string;
  eligible: boolean;
  status: "none" | "pending" | "provisioning" | "ready" | "failed" | "marked_for_destruction";
  endpoint: string | null;
  ipv4: string | null;
};

interface Props {
  activeModel: string;
  modelLabel: string;
  streaming: boolean;
}

// Reflects WHICH backend the chat is actually hitting:
// - hermes-agent + free → SHARED
// - hermes-agent + paid + ready → PRIVATE
// - hermes-agent + paid + (pending/provisioning/failed) → SHARED (fallback)
// - any other model → DIRECT (Nous/Anthropic/OpenAI/etc.)
export function WorkspaceStatusBar({ activeModel, modelLabel, streaming }: Props) {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);

  async function loadAgent() {
    try {
      const r = await fetch("/api/me/private-agent", { credentials: "include" });
      if (r.ok) setAgent(await r.json());
    } catch {}
  }
  async function pingHealth() {
    const t0 = performance.now();
    try {
      await fetch("/api/healthz", { credentials: "include", cache: "no-store" }).catch(() => {});
      setPingMs(Math.round(performance.now() - t0));
    } catch { setPingMs(null); }
  }
  useEffect(() => {
    loadAgent(); pingHealth();
    const t1 = setInterval(loadAgent, 15_000);
    const t2 = setInterval(pingHealth, 30_000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const isHermesAgent = activeModel === "hermes-agent" || activeModel?.endsWith("/hermes-agent");
  const isPaid = agent?.plan && agent.plan !== "free";
  const isPrivateReady = isHermesAgent && isPaid && agent?.status === "ready";
  const isPrivateProv = isHermesAgent && isPaid && (agent?.status === "provisioning" || agent?.status === "pending");
  const isPrivateFailed = isHermesAgent && isPaid && agent?.status === "failed";
  const usingShared = isHermesAgent && !isPrivateReady;

  // Compute status chip
  let chip: { color: string; bg: string; border: string; label: string; sub?: string; icon: any; pulse?: boolean };
  if (isPrivateReady) {
    chip = { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/40", label: "Private agent", sub: "your server", icon: ShieldCheck };
  } else if (isPrivateProv) {
    chip = { color: "text-amber", bg: "bg-amber/10", border: "border-amber/40", label: agent?.status === "provisioning" ? "Spinning up your agent" : "Pending", sub: "using shared", icon: Loader2, pulse: agent?.status === "provisioning" };
  } else if (isPrivateFailed) {
    chip = { color: "text-rust", bg: "bg-rust/10", border: "border-rust/40", label: "Agent error", sub: "using shared", icon: AlertCircle };
  } else if (usingShared) {
    chip = { color: "text-paper-dim", bg: "bg-amber/[0.04]", border: "border-amber/20", label: "Shared agent", sub: agent?.plan === "free" ? "free tier" : undefined, icon: Cpu };
  } else {
    // Other model — direct upstream
    chip = { color: "text-paper-dim", bg: "bg-ink-line/30", border: "border-ink-line", label: "Direct", sub: "upstream", icon: Sparkles };
  }
  const Icon = chip.icon;

  return (
    <div className="px-3 sm:px-7 pt-2.5 pb-2 border-b border-ink-line/40 bg-gradient-to-b from-ink/40 to-transparent overflow-x-auto scrollbar-hide">
      <div className="max-w-[1180px] mx-auto flex items-center gap-2 sm:gap-2.5 flex-nowrap sm:flex-wrap whitespace-nowrap">
        {/* Live activity dot */}
        <div className="flex items-center gap-1.5">
          <span className={`relative flex w-2 h-2`}>
            <span className={`absolute inset-0 rounded-full ${streaming ? "bg-amber animate-ping" : pingMs && pingMs < 200 ? "bg-emerald-400" : pingMs ? "bg-amber" : "bg-paper-faint"}`} />
            <span className={`relative inline-flex rounded-full w-2 h-2 ${streaming ? "bg-amber" : pingMs && pingMs < 200 ? "bg-emerald-400" : pingMs ? "bg-amber" : "bg-paper-faint"}`} />
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint">
            {streaming ? "thinking" : pingMs ? `${pingMs}ms` : "idle"}
          </span>
        </div>

        <div className="w-px h-3 bg-ink-line" />

        {/* Model chip */}
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-ink-soft border border-ink-line">
          <Sparkles size={10} className="text-amber" />
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-paper truncate max-w-[140px]">{modelLabel}</span>
        </div>

        {/* Agent backend chip — only when Hermes Agent OR very informative */}
        {isHermesAgent && (
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${chip.bg} border ${chip.border}`}>
            <Icon size={10} className={`${chip.color} ${chip.pulse ? "animate-spin" : ""}`} />
            <span className={`font-[family-name:var(--font-mono)] text-[11px] ${chip.color}`}>{chip.label}</span>
            {chip.sub && <span className="font-[family-name:var(--font-mono)] text-[10px] text-paper-faint">· {chip.sub}</span>}
          </div>
        )}

        {/* Plan chip */}
        {agent?.plan && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
            agent.plan === "free" ? "bg-ink-line/40 border border-ink-line text-paper-faint" : "bg-amber/10 border border-amber/30 text-amber"
          }`}>
            {agent.plan === "free" ? <Zap size={10} /> : <Crown size={10} />}
            <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em]">{agent.plan}</span>
          </div>
        )}

        {/* Push-right: upgrade CTA for free + Hermes Agent users (highest intent moment) */}
        <div className="ml-auto flex items-center gap-2">
          {agent?.plan === "free" && isHermesAgent && (
            <Link
              href="/app/billing"
              className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber/15 hover:bg-amber/25 border border-amber/40 hover:border-amber/60 text-amber transition-all"
              title="Get your own private agent"
            >
              <Cpu size={10} />
              <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em]">Upgrade · go private</span>
            </Link>
          )}
          {isPrivateProv && (
            <Link href="/app/billing" className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-amber hover:text-amber-soft">
              Track →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
