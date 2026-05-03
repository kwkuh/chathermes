"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Ban, LogOut, Trash2, UserPlus, Check, X, RefreshCw } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type U = { id: string; email: string; role: "user" | "admin"; disabled?: number; created_at: number };

export default function AdminUsers() {
  const [users, setUsers] = useState<U[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/users", { credentials: "include" });
    const d = await r.json();
    setUsers(d.users ?? []);
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, patch: any) {
    setBusy(id);
    await fetch(`/api/admin/users/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await load(); setBusy(null);
  }
  async function killSessions(id: string) {
    if (!confirm("Kick this user out of all sessions?")) return;
    setBusy(id);
    await fetch(`/api/admin/users/${id}/kill-sessions`, { method: "POST", credentials: "include" });
    setBusy(null);
  }
  async function remove(id: string) {
    if (!confirm("PERMANENTLY delete this user and all their data? Cannot be undone.")) return;
    setBusy(id);
    await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" });
    await load(); setBusy(null);
  }

  return (
    <div className="px-5 sm:px-7 py-8 max-w-[1240px] mx-auto">
      <PageHeader kicker="admin / users" title="People." lede={`${users.length} signed up. Promote, disable, or wipe.`}
        action={
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-ink text-[15px] font-medium hover:bg-amber-soft">
            <UserPlus size={14} /> Create user
          </button>
        }
      />
      <div className="mt-10 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_120px_160px_320px] px-5 py-3 border-b border-ink-line font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.16em]">
          <div>email</div><div>role</div><div>joined</div><div className="text-right">actions</div>
        </div>
        <AnimatePresence>
          {users.map((u) => (
            <motion.div key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}
              className={`px-5 py-3 border-b border-ink-line last:border-b-0 grid md:grid-cols-[1fr_120px_160px_320px] gap-2 md:gap-4 items-center text-[14.5px] ${u.disabled ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <div className="text-paper truncate">{u.email}</div>
                {u.disabled ? <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-rust uppercase tracking-[0.14em]">disabled</span> : null}
              </div>
              <div>
                <span className={`font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] px-2 py-1 rounded ${u.role === "admin" ? "bg-amber/15 text-amber" : "bg-ink-line text-paper-faint"}`}>{u.role}</span>
              </div>
              <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper-dim">{new Date(u.created_at).toLocaleString()}</div>
              <div className="text-right flex justify-end gap-1.5 flex-wrap">
                <button onClick={() => update(u.id, { role: u.role === "admin" ? "user" : "admin" })} disabled={busy === u.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] border border-ink-line text-paper-dim hover:text-amber hover:border-amber/40">
                  <Shield size={10} /> {u.role === "admin" ? "demote" : "promote"}
                </button>
                <button onClick={() => update(u.id, { disabled: !u.disabled })} disabled={busy === u.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] border border-ink-line text-paper-dim hover:text-paper">
                  <Ban size={10} /> {u.disabled ? "enable" : "disable"}
                </button>
                <button onClick={() => killSessions(u.id)} disabled={busy === u.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] border border-ink-line text-paper-dim hover:text-rust">
                  <LogOut size={10} /> kick
                </button>
                <button onClick={() => remove(u.id)} disabled={busy === u.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] text-rust hover:bg-rust/10">
                  {busy === u.id ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />} delete
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} onSaved={load} />}
      </AnimatePresence>
    </div>
  );
}

function CreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await fetch("/api/admin/users/create", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    setBusy(false); onSaved(); onClose();
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-center justify-center p-7">
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        className="w-full max-w-[420px] bg-ink-soft border border-ink-line rounded-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— create user</div>
          <button onClick={onClose} className="p-1 text-paper-dim hover:text-paper"><X size={16} /></button>
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-[26px] mt-2 mb-5">Add a user manually.</h3>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@somewhere.com"
          className="w-full px-3 py-2.5 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint text-[14.5px] focus:outline-none focus:border-amber/60 mb-3" />
        <select value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full px-3 py-2.5 bg-ink border border-ink-line rounded-md text-paper text-[14.5px] focus:outline-none focus:border-amber/60 mb-5 font-[family-name:var(--font-mono)]">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button onClick={save} disabled={!email || busy} className="w-full px-4 py-3 rounded-md bg-amber text-ink text-[15.5px] font-medium hover:bg-amber-soft disabled:opacity-50">
          {busy ? "Creating…" : "Create"}
        </button>
      </motion.div>
    </motion.div>
  );
}
