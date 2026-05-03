"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Key, Copy, Check, Trash2, AlertTriangle, Plus, ExternalLink, Code2 } from "lucide-react";
import PageHeader from "../_components/page-header";

type ApiKey = { id: string; name: string; prefix: string | null; scopes: string; last_used_at: number | null; created_at: number; expires_at: number | null };

function fmtDate(ms: number | null) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function fmtRel(ms: number | null) {
  if (!ms) return "never";
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
  return `${Math.floor(d / 86400_000)}d ago`;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const r = await fetch("/api/me/api-keys", { credentials: "include" });
    const j = await r.json();
    setKeys(j.keys || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const days = Number(fd.get("expires_days")) || 0;
    if (!name) return;
    setCreating(true);
    try {
      const r = await fetch("/api/me/api-keys", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, expires_days: days || undefined }),
      });
      const j = await r.json();
      if (j.ok && j.token) {
        setNewKey({ token: j.token, name });
        await load();
      }
    } finally { setCreating(false); }
  }

  async function destroy(id: string, name: string) {
    if (!confirm(`Revoke "${name}"? Any apps using it will stop working immediately.`)) return;
    await fetch(`/api/me/api-keys/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  async function copyKey() {
    if (!newKey) return;
    try { await navigator.clipboard.writeText(newKey.token); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 sm:px-7 py-6 sm:py-8 max-w-[980px] mx-auto">
      <PageHeader kicker="api keys" title="Build with ChatHermes." lede="Programmatic access for your scripts, agents, and integrations. Bearer tokens with revocation and expiry." />

      {/* Just-created key reveal */}
      {newKey && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 p-4 sm:p-5 rounded-xl bg-amber/10 border-2 border-amber/40">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
            <div className="flex-1 text-[14px] text-paper">
              <div className="font-medium mb-0.5">Save this token now — you won't see it again.</div>
              <div className="text-paper-dim text-[13px]">If you lose it, revoke and create a new one. Treat it like a password.</div>
            </div>
            <button onClick={() => setNewKey(null)} className="text-paper-faint hover:text-paper text-[18px] -mt-1">×</button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-ink rounded-md border border-ink-line">
            <code className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber truncate flex-1">{newKey.token}</code>
            <button onClick={copyKey} className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint hover:text-paper inline-flex items-center gap-1 shrink-0">
              {copied ? <><Check size={11} /> copied</> : <><Copy size={11} /> copy</>}
            </button>
          </div>
        </motion.div>
      )}

      {/* Create form */}
      <form onSubmit={create} className="mt-8 sm:mt-10 p-4 sm:p-5 rounded-xl bg-ink-soft border border-ink-line">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber mb-3">— create new key</div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2.5 items-end">
          <label className="block">
            <span className="block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-1">Name</span>
            <input name="name" required maxLength={80} placeholder="my-bot, dev-laptop, ci-pipeline…" className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-[14px] text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/50" />
          </label>
          <label className="block">
            <span className="block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-1">Expires</span>
            <select name="expires_days" className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-[14px] text-paper focus:outline-none focus:border-amber/50">
              <option value="0">never</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
          </label>
          <button type="submit" disabled={creating} className="px-4 py-2 rounded-md bg-amber text-ink hover:bg-amber-soft disabled:opacity-50 text-[14px] font-medium inline-flex items-center justify-center gap-1.5">
            <Plus size={14} /> {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </form>

      {/* Existing keys */}
      <div className="mt-8 sm:mt-10">
        <div className="flex items-center justify-between mb-3">
          <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber">— your keys ({keys.length})</div>
          <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer" className="font-[family-name:var(--font-mono)] text-[11px] text-paper-dim hover:text-paper uppercase tracking-[0.14em] inline-flex items-center gap-1">
            <Code2 size={11} /> openapi spec <ExternalLink size={9} />
          </a>
        </div>
        <div className="bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
          {loading ? (
            <div className="px-5 py-12 text-center text-paper-faint text-[14px]">loading…</div>
          ) : keys.length === 0 ? (
            <div className="px-5 py-12 text-center text-paper-faint text-[14px]">No API keys yet. Create one above to call the public REST API.</div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[1fr_180px_120px_120px_100px_60px] px-5 py-2.5 border-b border-ink-line font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint">
                <div>name</div><div>prefix</div><div>last used</div><div>created</div><div>expires</div><div></div>
              </div>
              {keys.map((k) => (
                <div key={k.id} className="px-4 sm:px-5 py-3 border-b border-ink-line last:border-b-0">
                  {/* Mobile */}
                  <div className="md:hidden flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-paper text-[14px] font-medium truncate">{k.name}</span>
                      <button onClick={() => destroy(k.id, k.name)} className="text-paper-faint hover:text-rust"><Trash2 size={13} /></button>
                    </div>
                    <code className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim">{k.prefix}…</code>
                    <div className="flex items-center gap-3 font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.12em]">
                      <span>used {fmtRel(k.last_used_at)}</span>
                      <span>·</span>
                      <span>expires {fmtDate(k.expires_at)}</span>
                    </div>
                  </div>
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-[1fr_180px_120px_120px_100px_60px] gap-3 items-center text-[13.5px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Key size={12} className="text-paper-faint shrink-0" />
                      <span className="text-paper truncate">{k.name}</span>
                    </div>
                    <code className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper-dim truncate">{k.prefix}…</code>
                    <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim">{fmtRel(k.last_used_at)}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim">{fmtDate(k.created_at)}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim">{fmtDate(k.expires_at)}</span>
                    <button onClick={() => destroy(k.id, k.name)} className="text-paper-faint hover:text-rust justify-self-end"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Quick start */}
      <div className="mt-10 sm:mt-12 p-5 sm:p-6 bg-ink-soft border border-ink-line rounded-xl">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber mb-3">— quickstart</div>
        <p className="text-paper-dim text-[14px] leading-[1.55] mb-4">Use your key as a Bearer token. Public API root: <code className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber">{typeof window !== "undefined" ? window.location.origin : ""}/api/v1</code></p>
        <pre className="bg-[#0d1117] border border-ink-line rounded-md px-4 py-3 overflow-x-auto text-[12.5px] font-[family-name:var(--font-mono)] text-paper">
{`curl -H "Authorization: Bearer ck_xxx" \\
  ${typeof window !== "undefined" ? window.location.origin : "https://chathermes.com"}/api/v1/me`}
        </pre>
      </div>
    </motion.div>
  );
}
