"use client";
import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { Activity, Filter, RefreshCw, Search } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type Row = { id: string; user_id: string | null; email: string | null; kind: string; meta: string | null; created_at: number };

const KIND_COLORS: Record<string, string> = {
  "auth.login": "text-moss bg-moss/10 border-moss/30",
  "auth.logout": "text-paper-dim bg-ink-line/40 border-ink-line",
  "project.create": "text-amber bg-amber/10 border-amber/30",
  "project.publish": "text-amber bg-amber/15 border-amber/40",
  "tenant.create": "text-paper bg-paper/5 border-ink-line",
  "tenant.hibernate": "text-paper-dim bg-ink-line/40 border-ink-line",
  "tenant.wake": "text-moss bg-moss/10 border-moss/30",
  "tenant.delete": "text-rust bg-rust/10 border-rust/30",
  "billing.change": "text-plum bg-plum/10 border-plum/30",
  "billing.cancel": "text-rust bg-rust/10 border-rust/30",
  "api_key.create": "text-amber bg-amber/10 border-amber/30",
  "api_key.delete": "text-rust bg-rust/10 border-rust/30",
  "webhook.create": "text-sage bg-sage/10 border-sage/30",
  "webhook.delete": "text-rust bg-rust/10 border-rust/30",
  "gdpr.export": "text-paper bg-paper/5 border-ink-line",
};

function fmtRel(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
  return `${Math.floor(d / 86400_000)}d ago`;
}

export default function AdminActivity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [kindFilter, setKindFilter] = useState<string>("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/activity", { credentials: "include" });
    const j = await r.json();
    setRows(j.activity || j.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const kinds = useMemo(() => Array.from(new Set(rows.map(r => r.kind))).sort(), [rows]);
  const filtered = useMemo(() => {
    let r = rows;
    if (kindFilter) r = r.filter(x => x.kind === kindFilter);
    if (filter) {
      const q = filter.toLowerCase();
      r = r.filter(x => (x.email || "").toLowerCase().includes(q) || x.kind.toLowerCase().includes(q) || (x.meta || "").toLowerCase().includes(q));
    }
    return r;
  }, [rows, filter, kindFilter]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 sm:px-7 py-6 sm:py-8 max-w-[1180px] mx-auto">
      <PageHeader kicker="admin / activity" title="Audit trail." lede="Every privileged action, every billing event, every webhook fire — persisted and searchable." />

      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-faint" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter by email, kind, meta…"
            className="w-full pl-8 pr-3 py-2 bg-ink-soft border border-ink-line rounded-md text-[14px] text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/50"
          />
        </div>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="px-3 py-2 bg-ink-soft border border-ink-line rounded-md text-[14px] text-paper focus:outline-none focus:border-amber/50"
        >
          <option value="">all kinds</option>
          {kinds.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <button onClick={load} disabled={loading} className="px-3 py-2 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-faint text-[13px] disabled:opacity-50 inline-flex items-center gap-1.5">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> refresh
        </button>
      </div>

      <div className="mt-4 sm:mt-6 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-paper-faint text-[13.5px]">loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-paper-faint text-[13.5px]">{rows.length === 0 ? "No events yet." : "No events match the filter."}</div>
        ) : (
          <>
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[110px_180px_1fr_120px] gap-3 px-5 py-2.5 border-b border-ink-line font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint">
              <div>when</div><div>kind</div><div>actor + meta</div><div className="text-right">id</div>
            </div>
            {filtered.slice(0, 200).map((r) => {
              const meta = r.meta ? safeJSON(r.meta) : null;
              const kindClass = KIND_COLORS[r.kind] ?? "text-paper-dim bg-ink-line/40 border-ink-line";
              return (
                <div key={r.id} className="px-4 sm:px-5 py-3 border-b border-ink-line last:border-b-0">
                  {/* Mobile */}
                  <div className="md:hidden flex flex-col gap-1.5 text-[13px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${kindClass}`}>{r.kind}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint ml-auto">{fmtRel(r.created_at)}</span>
                    </div>
                    <div className="text-paper truncate">{r.email || "system"}</div>
                    {meta && <pre className="font-[family-name:var(--font-mono)] text-[11px] text-paper-dim truncate">{JSON.stringify(meta)}</pre>}
                  </div>
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-[110px_180px_1fr_120px] gap-3 items-center text-[13.5px]">
                    <span className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint">{fmtRel(r.created_at)}</span>
                    <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${kindClass} truncate`}>{r.kind}</span>
                    <div className="min-w-0 flex items-baseline gap-3">
                      <span className="text-paper truncate">{r.email || "system"}</span>
                      {meta && <code className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim truncate">{JSON.stringify(meta)}</code>}
                    </div>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint text-right truncate">{r.id.slice(0, 8)}</span>
                  </div>
                </div>
              );
            })}
            {filtered.length > 200 && (
              <div className="px-5 py-3 text-center font-[family-name:var(--font-mono)] text-[11px] text-paper-faint uppercase tracking-[0.14em]">
                showing first 200 of {filtered.length}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function safeJSON(s: string) { try { return JSON.parse(s); } catch { return null; } }
