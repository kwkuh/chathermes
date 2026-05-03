"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Webhook, Plus, Trash2, AlertCircle, Copy, Check, Send, Eye, Code2 } from "lucide-react";
import PageHeader from "../_components/page-header";

type Sub = { id: string; url: string; secret: string; events: string; active: number; created_at: number; last_delivery_at: number | null; last_delivery_status: string | null };
type LogEntry = { id: string; event_type: string; payload: string; status_code: number | null; delivered: number; attempt: number; created_at: number; error: string | null };

function fmtRel(ms: number | null) {
  if (!ms) return "never";
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h ago`;
  return `${Math.floor(d / 86400_000)}d ago`;
}

export default function WebhooksPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState<string | null>(null);
  const [logRows, setLogRows] = useState<LogEntry[]>([]);

  async function load() {
    const r = await fetch("/api/me/webhooks", { credentials: "include" });
    const j = await r.json();
    setSubs(j.webhooks || []);
    setEvents(j.available_events || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const url = String(fd.get("url") || "").trim();
    const selected = events.filter((ev) => fd.get(`evt_${ev}`));
    if (!url || selected.length === 0) return;
    setCreating(true);
    try {
      const r = await fetch("/api/me/webhooks", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selected }),
      });
      const j = await r.json();
      if (j.ok && j.secret) setNewSecret(j.secret);
      await load();
      (e.target as HTMLFormElement).reset();
    } finally { setCreating(false); }
  }

  async function destroy(id: string, url: string) {
    if (!confirm(`Delete webhook to ${url}?`)) return;
    await fetch(`/api/me/webhooks/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  async function testFire(id: string) {
    await fetch(`/api/me/webhooks/${id}/test`, { method: "POST", credentials: "include" });
    setTimeout(() => { if (logOpen === id) viewLog(id); }, 600);
  }

  async function viewLog(id: string) {
    if (logOpen === id) { setLogOpen(null); return; }
    setLogOpen(id);
    const r = await fetch(`/api/me/webhooks/${id}/log`, { credentials: "include" });
    const j = await r.json();
    setLogRows(j.log || []);
  }

  const [copied, setCopied] = useState(false);
  async function copySecret() {
    if (!newSecret) return;
    try { await navigator.clipboard.writeText(newSecret); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 sm:px-7 py-6 sm:py-8 max-w-[1100px] mx-auto">
      <PageHeader kicker="outbound webhooks" title="React in real time." lede="ChatHermes pushes events to your URL the moment they happen. Sessions, projects, billing — yours to listen to." />

      {newSecret && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 p-4 sm:p-5 rounded-xl bg-amber/10 border-2 border-amber/40">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle size={16} className="text-amber shrink-0 mt-0.5" />
            <div className="flex-1 text-[14px] text-paper">
              <div className="font-medium mb-0.5">Save this signing secret.</div>
              <div className="text-paper-dim text-[13px]">Use it to verify the <code className="font-[family-name:var(--font-mono)] text-[12px] text-amber">X-ChatHermes-Signature</code> HMAC on incoming requests.</div>
            </div>
            <button onClick={() => setNewSecret(null)} className="text-paper-faint hover:text-paper text-[18px] -mt-1">×</button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-ink rounded-md border border-ink-line">
            <code className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber truncate flex-1">{newSecret}</code>
            <button onClick={copySecret} className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint hover:text-paper inline-flex items-center gap-1 shrink-0">
              {copied ? <><Check size={11} /> copied</> : <><Copy size={11} /> copy</>}
            </button>
          </div>
        </motion.div>
      )}

      <form onSubmit={create} className="mt-8 sm:mt-10 p-4 sm:p-5 rounded-xl bg-ink-soft border border-ink-line">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber mb-3">— add webhook</div>
        <label className="block mb-3">
          <span className="block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-1">Endpoint URL</span>
          <input name="url" required type="url" placeholder="https://your-app.com/webhooks/chathermes" className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-[14px] text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/50 font-[family-name:var(--font-mono)]" />
        </label>
        <div className="block mb-4">
          <span className="block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-2">Subscribe to events</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {events.map((ev) => (
              <label key={ev} className="flex items-center gap-2 px-2.5 py-1.5 bg-ink rounded-md border border-ink-line hover:border-amber/40 transition-colors cursor-pointer">
                <input type="checkbox" name={`evt_${ev}`} className="accent-amber" />
                <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim">{ev}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={creating} className="px-4 py-2 rounded-md bg-amber text-ink hover:bg-amber-soft disabled:opacity-50 text-[14px] font-medium inline-flex items-center gap-1.5">
          <Plus size={14} /> {creating ? "Creating…" : "Create webhook"}
        </button>
      </form>

      <div className="mt-8 sm:mt-10">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber mb-3">— your subscriptions ({subs.length})</div>
        <div className="bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
          {loading ? <div className="px-5 py-12 text-center text-paper-faint text-[14px]">loading…</div>
            : subs.length === 0 ? <div className="px-5 py-12 text-center text-paper-faint text-[14px]">No webhooks yet.</div>
            : subs.map((s) => {
              let evList: string[] = []; try { evList = JSON.parse(s.events); } catch {}
              const isOpen = logOpen === s.id;
              return (
                <div key={s.id} className="border-b border-ink-line last:border-b-0">
                  <div className="px-4 sm:px-5 py-3.5">
                    <div className="flex items-start gap-3 flex-wrap">
                      <Webhook size={14} className="text-paper-faint shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper truncate">{s.url}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {evList.slice(0, 6).map((ev) => (
                            <span key={ev} className="px-1.5 py-0.5 bg-ink-line/50 rounded text-[10.5px] font-[family-name:var(--font-mono)] text-paper-dim">{ev}</span>
                          ))}
                          {evList.length > 6 && <span className="text-[10.5px] text-paper-faint">+{evList.length - 6}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-paper-faint">
                          <span>last: {fmtRel(s.last_delivery_at)}</span>
                          {s.last_delivery_status && (
                            <span className={s.last_delivery_status === "delivered" ? "text-moss" : "text-rust"}>{s.last_delivery_status}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => testFire(s.id)} title="test fire" className="p-1.5 text-paper-faint hover:text-amber rounded"><Send size={14} /></button>
                        <button onClick={() => viewLog(s.id)} title="view log" className={`p-1.5 rounded ${isOpen ? "text-amber" : "text-paper-faint hover:text-paper"}`}><Eye size={14} /></button>
                        <button onClick={() => destroy(s.id, s.url)} className="p-1.5 text-paper-faint hover:text-rust rounded"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-4 sm:px-5 py-3 bg-ink/40 border-t border-ink-line">
                      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-paper-faint mb-2">recent deliveries</div>
                      {logRows.length === 0 ? <div className="text-paper-faint text-[12.5px]">no deliveries yet — try test fire</div> :
                        <div className="space-y-1.5 max-h-[280px] overflow-auto">
                          {logRows.map((l) => (
                            <div key={l.id} className="flex items-center gap-2 text-[12px] py-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${l.delivered ? "bg-moss" : "bg-rust"}`}></span>
                              <span className="font-[family-name:var(--font-mono)] text-paper-dim">{l.event_type}</span>
                              <span className="font-[family-name:var(--font-mono)] text-paper-faint">{l.status_code ?? "—"}</span>
                              <span className="font-[family-name:var(--font-mono)] text-paper-faint">attempt {l.attempt}</span>
                              <span className="ml-auto font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint">{fmtRel(l.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      }
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div className="mt-10 sm:mt-12 p-5 sm:p-6 bg-ink-soft border border-ink-line rounded-xl">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.18em] text-amber mb-3">— how to verify</div>
        <p className="text-paper-dim text-[14px] leading-[1.55] mb-3">Each delivery has a header <code className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber">X-ChatHermes-Signature: sha256=&lt;hex&gt;</code> = HMAC-SHA256 of the raw body using your signing secret.</p>
        <pre className="bg-[#0d1117] border border-ink-line rounded-md px-4 py-3 overflow-x-auto text-[12px] font-[family-name:var(--font-mono)] text-paper leading-[1.55]">
{`// Node.js
import crypto from "node:crypto";
const sig = req.headers["x-chathermes-signature"];
const expected = "sha256=" + crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
if (sig !== expected) return res.status(400).end("bad signature");`}
        </pre>
        <p className="text-paper-faint text-[12.5px] mt-3">Failed deliveries retry 3x with exponential backoff (30s, 5m, 1h).</p>
      </div>
    </motion.div>
  );
}
