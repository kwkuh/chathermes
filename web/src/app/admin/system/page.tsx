"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Cpu, HardDrive, MemoryStick, Box, Activity } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type Metrics = {
  memory: { total: number; available: number; used: number };
  disk: { total: number; available: number; used: number };
  load: { one: number; five: number; fifteen: number };
  containers: { name: string; cpu: string; mem: string; memPct: string }[];
  timestamp: number;
};

function fmtBytes(n: number) {
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(1) + " GB";
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(0) + " MB";
  return n + "";
}

export default function AdminSystem() {
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/admin/system/metrics", { credentials: "include" });
        if (alive) setM(await r.json());
      } catch {}
    }
    load();
    const i = setInterval(load, 3000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  const memPct = m ? (m.memory.used / m.memory.total) * 100 : 0;
  const diskPct = m ? (m.disk.used / m.disk.total) * 100 : 0;

  return (
    <div className="px-5 sm:px-7 py-8 max-w-[1180px] mx-auto">
      <PageHeader kicker="admin / system" title="Live cluster." lede="Updates every 3 seconds. Real numbers from /proc + docker stats." />

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Metric icon={MemoryStick} label="RAM" main={m ? fmtBytes(m.memory.used) : "—"} sub={m ? `of ${fmtBytes(m.memory.total)}` : ""} pct={memPct} color="amber" />
        <Metric icon={HardDrive} label="Disk" main={m ? fmtBytes(m.disk.used) : "—"} sub={m ? `of ${fmtBytes(m.disk.total)}` : ""} pct={diskPct} color="amber" />
        <Metric icon={Cpu} label="Load (1m)" main={m ? m.load.one.toFixed(2) : "—"} sub={m ? `5m ${m.load.five.toFixed(2)} · 15m ${m.load.fifteen.toFixed(2)}` : ""} pct={m ? Math.min(100, m.load.one * 25) : 0} color={m && m.load.one > 3 ? "rust" : "amber"} />
      </div>

      <div className="mt-10 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-line flex items-center justify-between">
          <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.18em]">— containers</div>
          <div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint inline-flex items-center gap-1.5">
            <Activity size={11} className="text-moss animate-pulse-soft" />
            live · {m ? m.containers.length : 0} active
          </div>
        </div>
        {m && m.containers.length === 0 ? (
          <div className="px-5 py-8 text-center text-paper-dim text-[14.5px]">No tenant containers running.</div>
        ) : (
          <div>
            <div className="hidden md:grid grid-cols-[1fr_120px_180px_120px] px-5 py-2.5 border-b border-ink-line font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.14em]">
              <div>name</div><div>cpu</div><div>memory</div><div>mem %</div>
            </div>
            {m?.containers.map((c) => (
              <motion.div key={c.name} layout className="px-5 py-3 grid md:grid-cols-[1fr_120px_180px_120px] gap-2 md:gap-4 items-center text-[14px]">
                <span className="font-[family-name:var(--font-mono)] text-paper truncate">{c.name}</span>
                <span className="font-[family-name:var(--font-mono)] text-paper-dim">{c.cpu}</span>
                <span className="font-[family-name:var(--font-mono)] text-paper-dim">{c.mem}</span>
                <span className="font-[family-name:var(--font-mono)] text-amber">{c.memPct}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, main, sub, pct, color }: any) {
  return (
    <div className="bg-ink-soft border border-ink-line rounded-xl px-5 py-5">
      <div className="flex items-center justify-between mb-3">
        <Icon size={15} className="text-paper-dim" />
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="font-[family-name:var(--font-display)] text-[34px] leading-none tracking-tight text-paper">{main}</div>
      <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper-faint mt-1.5">{sub}</div>
      <div className="mt-4 h-1.5 bg-ink-line rounded-full overflow-hidden">
        <motion.div animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: 0.6 }} className={`h-full rounded-full ${color === "rust" ? "bg-rust" : "bg-amber"}`} />
      </div>
    </div>
  );
}
