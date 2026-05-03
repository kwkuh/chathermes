"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, AlertCircle, Activity } from "lucide-react";

type StatusResp = {
  status: "operational" | "degraded";
  timestamp: string;
  uptime_sec: number;
  version: string;
  services: Record<string, { status: "operational" | "down"; latency_ms: number | null; message: string | null }>;
};

const SERVICE_LABEL: Record<string, string> = {
  db: "Database",
  hermes_agent: "Hermes Agent runtime",
  stripe: "Stripe billing",
  resend: "Resend email",
};

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResp | null>(null);
  const [err, setErr] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      const j = await r.json();
      setData(j);
      setErr(false);
    } catch { setErr(true); }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  const allUp = data?.status === "operational";

  return (
    <main className="min-h-screen bg-[#0b0a09] text-paper">
      <div className="max-w-[760px] mx-auto px-5 sm:px-7 py-12 sm:py-20">
        <a href="/" className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-paper-faint hover:text-paper">← chathermes.com</a>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 sm:mt-12">
          <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.22em] text-amber mb-3">— status</div>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(36px,6vw,64px)] leading-[1.05] tracking-[-0.025em]">
            {!data ? "Checking…" : allUp ? (
              <>All systems <em className="text-moss not-italic italic">operational.</em></>
            ) : (
              <>Some systems <em className="text-rust not-italic italic">degraded.</em></>
            )}
          </h1>
          <p className="text-paper-dim mt-4 text-[15px] sm:text-[16px]">
            {data ? <>Live from chathermes.com. Updates every 15 seconds.</> : err ? "Couldn't reach the status endpoint." : "Loading…"}
          </p>
        </motion.div>

        <div className="mt-10 sm:mt-12 bg-ink-soft border border-ink-line rounded-2xl overflow-hidden">
          {data && Object.entries(data.services).map(([name, s], i) => (
            <div key={name} className={`px-5 sm:px-6 py-4 ${i > 0 ? "border-t border-ink-line" : ""} flex items-center gap-4`}>
              <div className={`w-2 h-2 rounded-full ${s.status === "operational" ? "bg-moss" : "bg-rust"} ${s.status === "operational" ? "" : "animate-pulse"}`}></div>
              <div className="flex-1 min-w-0">
                <div className="text-paper text-[15px] font-medium">{SERVICE_LABEL[name] || name}</div>
                {s.message && <div className="text-paper-faint text-[12px] mt-0.5 font-[family-name:var(--font-mono)]">{s.message}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] ${s.status === "operational" ? "text-moss" : "text-rust"}`}>{s.status}</div>
                {s.latency_ms !== null && <div className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint mt-0.5">{s.latency_ms}ms</div>}
              </div>
            </div>
          ))}
        </div>

        {data && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Stat label="Uptime" v={fmtUptime(data.uptime_sec)} />
            <Stat label="Version" v={data.version} mono />
            <Stat label="Last check" v={new Date(data.timestamp).toLocaleTimeString()} mono />
          </div>
        )}

        <p className="mt-12 text-center text-paper-faint text-[12.5px]">
          Subscribe to status updates: follow <a href="https://twitter.com/chathermes" className="text-amber hover:underline">@chathermes</a> on X.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, v, mono }: { label: string; v: string; mono?: boolean }) {
  return (
    <div className="bg-ink-soft border border-ink-line rounded-lg px-4 py-3">
      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-paper-faint mb-1">{label}</div>
      <div className={`text-paper ${mono ? "font-[family-name:var(--font-mono)] text-[13px]" : "text-[16px] font-medium"}`}>{v}</div>
    </div>
  );
}
