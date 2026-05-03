"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cloud, Server, Plus, Power, RotateCw, Trash2, Loader2, Check, AlertCircle, Copy, ExternalLink, MapPin, Cpu, MemoryStick, HardDrive, Lock, Sparkles, X } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type Hetzner = { configured: boolean; prefix: string | null };

type ServerType = { id: number; name: string; cores: number; memory_gb: number; disk_gb: number; cpu_type: string; monthly_eur: string };
type Location = { name: string; description: string; city: string; country: string };
type SshKey = { id: number; name: string; fingerprint: string };

type ManagedServer = {
  id: number; name: string; status: string; ipv4: string; ipv6?: string;
  server_type: string; cores: number; memory_gb: number;
  location: string; city: string; country: string;
  created: string; managed_by_chathermes: boolean;
};

const STATUS_COLOR: Record<string, string> = {
  running: "bg-moss text-moss",
  starting: "bg-amber text-amber animate-pulse",
  stopping: "bg-amber text-amber",
  off: "bg-paper-faint text-paper-faint",
  initializing: "bg-amber text-amber animate-pulse",
  deleting: "bg-rust text-rust",
};

function fmtRel(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h`;
  return `${Math.floor(d / 86400_000)}d`;
}

export default function AdminHetzner() {
  const [token, setToken] = useState<Hetzner | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenErr, setTokenErr] = useState("");

  const [servers, setServers] = useState<ManagedServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  async function loadToken() {
    const r = await fetch("/api/admin/hetzner/token", { credentials: "include" });
    setToken(await r.json());
  }
  async function loadServers() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/hetzner/servers", { credentials: "include" });
      const j = await r.json();
      if (j.ok) setServers(j.servers || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadToken(); }, []);
  useEffect(() => { if (token?.configured) loadServers(); }, [token?.configured]);

  async function saveToken() {
    setTokenBusy(true); setTokenErr("");
    try {
      const r = await fetch("/api/admin/hetzner/token", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "save failed");
      setTokenInput(""); await loadToken();
    } catch (e: any) {
      setTokenErr(e?.message || "save failed");
    } finally { setTokenBusy(false); }
  }
  async function clearToken() {
    if (!confirm("Disconnect Hetzner Cloud? Existing servers stay running but you'll need to reconnect to manage them.")) return;
    await fetch("/api/admin/hetzner/token", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: null }),
    });
    setServers([]); await loadToken();
  }

  async function serverAction(id: number, action: string, label: string) {
    if (action === "delete") {
      const name = servers.find(s => s.id === id)?.name || id;
      if (!confirm(`Permanently delete server "${name}"? This cannot be undone.`)) return;
      await fetch(`/api/admin/hetzner/servers/${id}`, { method: "DELETE", credentials: "include" });
    } else {
      if (!confirm(`${label} this server?`)) return;
      await fetch(`/api/admin/hetzner/servers/${id}/action`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    }
    setTimeout(loadServers, 1500);
  }

  if (!token) return <div className="p-8 text-paper-faint">Loading…</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 sm:px-7 py-6 sm:py-8 max-w-[1200px] mx-auto">
      <PageHeader kicker="admin · hetzner cloud" title="Fleet management." lede="Provision, monitor, and operate ChatHermes servers on Hetzner Cloud — all from here." />

      {/* Token configuration card */}
      {!token.configured ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 bg-amber/10 border-2 border-amber/40 rounded-2xl p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <Lock size={18} className="text-amber shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-[16px]">Connect your Hetzner Cloud account</div>
              <div className="text-paper-dim text-[13.5px] mt-1">Once configured, you can deploy and manage ChatHermes servers from this dashboard.</div>
            </div>
          </div>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="hcloud_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full px-4 py-3 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[13px] focus:outline-none focus:border-amber"
          />
          <details className="mt-3 text-[13px] text-paper-dim">
            <summary className="cursor-pointer hover:text-paper">how to get a token?</summary>
            <ol className="mt-3 ml-5 list-decimal space-y-1 text-paper-dim text-[12.5px]">
              <li>Sign in at <a href="https://console.hetzner.cloud" target="_blank" className="text-amber hover:underline">console.hetzner.cloud</a></li>
              <li>Pick or create a project</li>
              <li>Security → API tokens → Generate new (Read &amp; Write)</li>
              <li>Copy the token (starts with <code className="font-[family-name:var(--font-mono)] text-amber">hcloud_</code>)</li>
            </ol>
          </details>
          {tokenErr && <div className="mt-3 p-3 bg-rust/10 border border-rust/30 rounded-md text-rust text-[13px] flex items-start gap-2"><AlertCircle size={13} className="mt-0.5 shrink-0" />{tokenErr}</div>}
          <button onClick={saveToken} disabled={tokenBusy || !tokenInput} className="mt-4 px-5 py-2.5 rounded-md bg-amber text-ink hover:bg-amber-soft disabled:opacity-50 font-medium text-[14px] inline-flex items-center gap-2">
            {tokenBusy ? <><Loader2 size={14} className="animate-spin" /> validating</> : <><Check size={14} /> Connect</>}
          </button>
        </motion.div>
      ) : (
        <div className="mt-6 sm:mt-8 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-moss/10 border border-moss/30 rounded-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <Check size={14} className="text-moss shrink-0" />
            <span className="text-[13.5px]">Connected to Hetzner Cloud</span>
            <code className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint truncate">{token.prefix}</code>
          </div>
          <button onClick={clearToken} className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint hover:text-rust uppercase tracking-[0.14em] shrink-0">disconnect</button>
        </div>
      )}

      {/* Server list */}
      {token.configured && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-amber uppercase tracking-[0.18em] mb-1">— managed fleet</div>
              <div className="text-[14px] text-paper-dim">{servers.length} server{servers.length === 1 ? "" : "s"}{loading && " · refreshing..."}</div>
            </div>
            <button onClick={() => setShowWizard(true)} className="px-4 py-2 rounded-md bg-amber text-ink hover:bg-amber-soft font-medium text-[14px] inline-flex items-center gap-1.5">
              <Plus size={14} /> Provision new server
            </button>
          </div>

          {servers.length === 0 ? (
            <div className="bg-ink-soft border border-ink-line rounded-2xl p-8 text-center">
              <Cloud size={28} className="text-paper-faint mx-auto mb-3" />
              <div className="text-paper text-[15px] mb-1">No servers in this account yet</div>
              <div className="text-paper-faint text-[13px]">Click "Provision new server" to deploy your first ChatHermes instance.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {servers.map((s) => <ServerCard key={s.id} server={s} onAction={serverAction} />)}
            </div>
          )}
        </div>
      )}

      {/* Provision wizard modal */}
      <AnimatePresence>
        {showWizard && <ProvisionWizard onClose={() => setShowWizard(false)} onSuccess={() => { setShowWizard(false); setTimeout(loadServers, 1000); }} />}
      </AnimatePresence>
    </motion.div>
  );
}

function ServerCard({ server, onAction }: { server: ManagedServer; onAction: (id: number, action: string, label: string) => void }) {
  const statusKey = server.status as keyof typeof STATUS_COLOR;
  const statusClass = STATUS_COLOR[server.status] || "bg-paper-faint text-paper-faint";

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-ink-soft border border-ink-line rounded-xl p-4 sm:p-5 group hover:border-paper-faint transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full ${statusClass.split(' ')[0]}`} />
            <span className="font-[family-name:var(--font-display)] text-[18px] truncate">{server.name}</span>
            {server.managed_by_chathermes && <span className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.16em] px-1.5 py-0.5 bg-amber/10 text-amber border border-amber/30 rounded">chathermes</span>}
          </div>
          <div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim truncate">{server.ipv4}</div>
        </div>
        <span className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${statusClass.split(' ')[1]} bg-${statusClass.split(' ')[0].split('-')[1]}/10 border border-${statusClass.split(' ')[0].split('-')[1]}/30`}>{server.status}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 my-3 text-[12px]">
        <div className="bg-ink/40 border border-ink-line rounded px-2.5 py-1.5">
          <div className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-paper-faint mb-0.5">type</div>
          <div className="font-[family-name:var(--font-mono)] text-paper">{server.server_type}</div>
        </div>
        <div className="bg-ink/40 border border-ink-line rounded px-2.5 py-1.5">
          <div className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-paper-faint mb-0.5">cpu/ram</div>
          <div className="font-[family-name:var(--font-mono)] text-paper">{server.cores}c / {server.memory_gb}gb</div>
        </div>
        <div className="bg-ink/40 border border-ink-line rounded px-2.5 py-1.5">
          <div className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-paper-faint mb-0.5">location</div>
          <div className="font-[family-name:var(--font-mono)] text-paper">{server.location}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-3 border-t border-ink-line">
        {server.managed_by_chathermes && (
          <a href={`http://${server.ipv4}:7000`} target="_blank" rel="noopener" className="flex-1 px-2.5 py-1.5 rounded text-[12px] border border-ink-line text-paper-dim hover:text-paper hover:border-amber/40 inline-flex items-center justify-center gap-1">
            <ExternalLink size={11} /> open
          </a>
        )}
        {server.status === "running" ? (
          <button onClick={() => onAction(server.id, "shutdown", "Shutdown")} className="px-2 py-1.5 rounded text-[12px] border border-ink-line text-paper-dim hover:text-amber hover:border-amber/40" title="shutdown"><Power size={12} /></button>
        ) : (
          <button onClick={() => onAction(server.id, "poweron", "Power on")} className="px-2 py-1.5 rounded text-[12px] border border-ink-line text-paper-dim hover:text-moss hover:border-moss/40" title="power on"><Power size={12} /></button>
        )}
        <button onClick={() => onAction(server.id, "reboot", "Reboot")} className="px-2 py-1.5 rounded text-[12px] border border-ink-line text-paper-dim hover:text-amber hover:border-amber/40" title="reboot"><RotateCw size={12} /></button>
        <button onClick={() => onAction(server.id, "delete", "")} className="px-2 py-1.5 rounded text-[12px] border border-ink-line text-paper-dim hover:text-rust hover:border-rust/40" title="delete"><Trash2 size={12} /></button>
      </div>

      <div className="mt-2 font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint">created {fmtRel(server.created)} ago · ssh root@{server.ipv4}</div>
    </motion.div>
  );
}

function ProvisionWizard({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [catalogue, setCatalogue] = useState<{ server_types: ServerType[]; locations: Location[]; ssh_keys: SshKey[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [config, setConfig] = useState({
    name: "",
    server_type: "cx22",
    location: "nbg1",
    domain: "",
    nous_key: "",
    kimi_key: "",
    resend_key: "",
    ssh_key_id: "",
  });

  useEffect(() => {
    fetch("/api/admin/hetzner/catalogue", { credentials: "include" })
      .then(r => r.json())
      .then(j => { if (j.ok) setCatalogue(j); });
  }, []);

  async function provision() {
    if (!config.nous_key && !config.kimi_key) { setErr("At least one LLM API key required"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/hetzner/deploy", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name || undefined,
          server_type: config.server_type,
          location: config.location,
          domain: config.domain || undefined,
          ssh_key_ids: config.ssh_key_id ? [parseInt(config.ssh_key_id)] : [],
          llm_keys: { nous: config.nous_key, kimi: config.kimi_key },
          resend_key: config.resend_key || undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "deploy failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[80] bg-ink/70 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="fixed inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-[5vh] sm:w-[640px] z-[81] bg-ink-soft border border-ink-line rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 sm:px-7 py-4 border-b border-ink-line flex items-center justify-between sticky top-0 bg-ink-soft z-10">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-amber">— provision</div>
            <div className="font-[family-name:var(--font-display)] text-[20px] mt-0.5">New ChatHermes server</div>
          </div>
          <button onClick={onClose} className="text-paper-faint hover:text-paper"><X size={16} /></button>
        </div>

        <div className="px-5 sm:px-7 py-5 space-y-5">
          {!catalogue ? (
            <div className="text-paper-faint text-[13px] py-8 text-center"><Loader2 size={18} className="animate-spin mx-auto" /></div>
          ) : (
            <>
              {/* Name */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-1.5 block">name (optional)</label>
                <input value={config.name} onChange={(e) => setConfig(c => ({ ...c, name: e.target.value }))} placeholder="auto-generated if blank" className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper text-[13.5px] focus:outline-none focus:border-amber" />
              </div>

              {/* Server type */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-2 block">server type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catalogue.server_types.slice(0, 6).map(s => (
                    <button key={s.id} onClick={() => setConfig(c => ({ ...c, server_type: s.name }))} className={`text-left p-2.5 rounded border transition-colors ${config.server_type === s.name ? "border-amber bg-amber/5" : "border-ink-line bg-ink hover:border-paper-faint"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em] text-paper">{s.name}</span>
                        <span className="text-[11px] text-paper-dim">€{parseFloat(s.monthly_eur).toFixed(2)}/mo</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10.5px] text-paper-faint font-[family-name:var(--font-mono)]">
                        <span>{s.cores}c</span>
                        <span>{s.memory_gb}GB</span>
                        <span>{s.disk_gb}GB</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-2 block">location</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {catalogue.locations.map(l => (
                    <button key={l.name} onClick={() => setConfig(c => ({ ...c, location: l.name }))} className={`text-left px-2.5 py-2 rounded border ${config.location === l.name ? "border-amber bg-amber/5" : "border-ink-line bg-ink hover:border-paper-faint"}`}>
                      <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-paper">{l.name}</div>
                      <div className="text-[10.5px] text-paper-dim">{l.city}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* LLM keys */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-1.5 block">llm api keys (≥1 required)</label>
                <input value={config.nous_key} onChange={(e) => setConfig(c => ({ ...c, nous_key: e.target.value }))} type="password" placeholder="Nous API key" className="w-full mb-1.5 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[12.5px] focus:outline-none focus:border-amber" />
                <input value={config.kimi_key} onChange={(e) => setConfig(c => ({ ...c, kimi_key: e.target.value }))} type="password" placeholder="Kimi API key" className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[12.5px] focus:outline-none focus:border-amber" />
              </div>

              {/* Optional */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-1.5 block">optional</label>
                <input value={config.domain} onChange={(e) => setConfig(c => ({ ...c, domain: e.target.value }))} placeholder="domain (auto-Caddy + HTTPS)" className="w-full mb-1.5 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint text-[12.5px] focus:outline-none focus:border-amber" />
                <input value={config.resend_key} onChange={(e) => setConfig(c => ({ ...c, resend_key: e.target.value }))} type="password" placeholder="Resend API key" className="w-full mb-1.5 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[12.5px] focus:outline-none focus:border-amber" />
                {catalogue.ssh_keys.length > 0 && (
                  <select value={config.ssh_key_id} onChange={(e) => setConfig(c => ({ ...c, ssh_key_id: e.target.value }))} className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper text-[12.5px] focus:outline-none focus:border-amber">
                    <option value="">No SSH key</option>
                    {catalogue.ssh_keys.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                )}
              </div>

              {err && <div className="p-3 bg-rust/10 border border-rust/30 rounded-md text-rust text-[12.5px] flex items-start gap-2"><AlertCircle size={13} className="mt-0.5 shrink-0" />{err}</div>}
            </>
          )}
        </div>

        <div className="px-5 sm:px-7 py-4 border-t border-ink-line bg-ink-soft sticky bottom-0 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded text-[13px] border border-ink-line text-paper-dim hover:text-paper">cancel</button>
          <button onClick={provision} disabled={busy || !catalogue} className="px-4 py-2 rounded-md bg-amber text-ink hover:bg-amber-soft disabled:opacity-50 font-medium text-[13.5px] inline-flex items-center gap-1.5">
            {busy ? <><Loader2 size={13} className="animate-spin" /> deploying</> : <><Sparkles size={13} /> Provision</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}
