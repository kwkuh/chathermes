"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, RefreshCw } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type Sess = { id: string; user_id: string; expires_at: number; email: string };

export default function AdminSessions() {
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/sessions", { credentials: "include" });
    const d = await r.json();
    setSessions(d.sessions ?? []);
  }
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, []);

  async function kill(id: string) {
    if (!confirm("Force this session out? They'll be logged out immediately.")) return;
    setBusy(id);
    await fetch(`/api/admin/sessions/${id}`, { method: "DELETE", credentials: "include" });
    await load();
    setBusy(null);
  }

  return (
    <div className="px-5 sm:px-7 py-8 max-w-[1180px] mx-auto">
      <PageHeader kicker="admin / sessions" title="Active logins." lede={`${sessions.length} live sessions. Auto-refresh every 5s.`} />
      <div className="mt-10 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_220px_180px_120px] px-5 py-3 border-b border-ink-line font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.16em]">
          <div>email</div><div>session</div><div>expires</div><div className="text-right">action</div>
        </div>
        {sessions.length === 0 ? (
          <div className="px-5 py-12 text-center text-paper-dim text-[15.5px]">No active sessions.</div>
        ) : (
          <AnimatePresence>
            {sessions.map((s) => (
              <motion.div key={s.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}
                className="px-5 py-3 border-b border-ink-line last:border-b-0 grid md:grid-cols-[1fr_220px_180px_120px] gap-2 md:gap-4 items-center text-[14.5px]">
                <span className="text-paper truncate">{s.email}</span>
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-paper-faint truncate">{s.id}</span>
                <span className="font-[family-name:var(--font-mono)] text-[13px] text-paper-dim">
                  {new Date(s.expires_at).toLocaleString()}
                </span>
                <div className="text-right">
                  <button onClick={() => kill(s.id)} disabled={busy === s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[13px] text-rust hover:bg-rust/10 disabled:opacity-50">
                    {busy === s.id ? <RefreshCw size={11} className="animate-spin" /> : <LogOut size={11} />} kill
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
