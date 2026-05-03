"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import PageHeader from "../../app/_components/page-header";
import { Power, Trash2, RefreshCw, MoreHorizontal } from "lucide-react";

type T = { id: string; user_id: string; port: number; status: string; container_id: string | null; last_active_at: number; created_at: number; email: string; role: string };

export default function AdminTenantsClient() {
  const [tenants, setTenants] = useState<T[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    try {
      const r = await fetch("/api/admin/tenants", { credentials: "include" });
      const d = await r.json();
      setTenants(d.tenants ?? []);
    } catch {}
  }
  useEffect(() => { reload(); const i = setInterval(reload, 5000); return () => clearInterval(i); }, []);

  async function action(id: string, kind: "hibernate" | "wake" | "delete") {
    if (kind === "delete" && !confirm("Delete this tenant container + all data? This is permanent.")) return;
    setBusy(`${id}:${kind}`);
    setError("");
    try {
      const method = kind === "delete" ? "DELETE" : "POST";
      const path = kind === "delete" ? `/api/admin/tenants/${id}` : `/api/admin/tenants/${id}/${kind}`;
      const r = await fetch(path, { method, credentials: "include" });
      if (!r.ok) {
        const t = await r.text();
        setError(t || `${kind} failed`);
      } else {
        await reload();
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  return (
    <div className="px-5 sm:px-7 py-8 max-w-[1320px] mx-auto">
      <PageHeader kicker="admin / tenants" title="All agents in the cluster." lede="One container per user. Hibernate, wake, or destroy any of them. Auto-refreshes every 5s." />
      {error && (
        <div className="mt-6 px-4 py-3 bg-rust/10 border border-rust/30 rounded-md text-rust text-[14.5px] font-[family-name:var(--font-mono)]">
          {error}
        </div>
      )}
      <div className="mt-10 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_120px_80px_120px_140px_180px] px-5 py-3 border-b border-ink-line font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.16em]">
          <div>email</div><div>tenant</div><div>port</div><div>status</div><div>last active</div><div className="text-right">actions</div>
        </div>
        {tenants.length === 0 ? (
          <div className="px-5 py-12 text-center text-paper-dim text-[15.5px]">No tenants yet. Sign someone up.</div>
        ) : (
          <AnimatePresence>
            {tenants.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-5 py-3 border-b border-ink-line last:border-b-0 grid md:grid-cols-[1fr_120px_80px_120px_140px_180px] gap-2 md:gap-4 items-center text-[14.5px]"
              >
                <div className="min-w-0">
                  <div className="text-paper truncate">{t.email}</div>
                  <div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint mt-0.5">{t.role}</div>
                </div>
                <div className="font-[family-name:var(--font-mono)] text-[13.5px] text-paper-dim truncate">{t.id.slice(0, 8)}</div>
                <div className="font-[family-name:var(--font-mono)] text-[13.5px] text-paper-dim">{t.port}</div>
                <div>
                  <span className={`font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] px-2 py-1 rounded ${
                    t.status === "running" ? "bg-moss/15 text-moss" : t.status === "error" ? "bg-rust/15 text-rust" : "bg-ink-line text-paper-faint"
                  }`}>{t.status}</span>
                </div>
                <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper-dim">
                  {new Date(t.last_active_at).toLocaleString()}
                </div>
                <div className="text-right flex justify-end gap-1.5 flex-wrap">
                  {t.status === "running" ? (
                    <button onClick={() => action(t.id, "hibernate")} disabled={busy === `${t.id}:hibernate`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] border border-ink-line text-paper-dim hover:text-paper hover:border-paper-faint disabled:opacity-50">
                      {busy === `${t.id}:hibernate` ? <RefreshCw size={10} className="animate-spin" /> : <Power size={10} />} hibernate
                    </button>
                  ) : (
                    <button onClick={() => action(t.id, "wake")} disabled={busy === `${t.id}:wake`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] border border-amber/40 text-amber hover:bg-amber/10 disabled:opacity-50">
                      {busy === `${t.id}:wake` ? <RefreshCw size={10} className="animate-spin" /> : <Power size={10} />} wake
                    </button>
                  )}
                  <button onClick={() => action(t.id, "delete")} disabled={busy === `${t.id}:delete`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] text-rust hover:bg-rust/10 disabled:opacity-50">
                    {busy === `${t.id}:delete` ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />} delete
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
