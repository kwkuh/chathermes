"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Server, Loader2, Check, AlertCircle, Copy, ExternalLink, Cloud, Cpu, MemoryStick, HardDrive, MapPin, Key, Sparkles, ArrowRight, Lock } from "lucide-react";
import Image from "next/image";

type ServerType = { id: number; name: string; cores: number; memory_gb: number; disk_gb: number; cpu_type: string; monthly_eur: string; hourly_eur: string };
type Location = { name: string; description: string; city: string; country: string };
type SshKey = { id: number; name: string; fingerprint: string };

type DeployResult = {
  server_id: number;
  name: string;
  ipv4: string;
  ipv6?: string;
  estimated_url: string;
  ssh_command: string;
  server_type: string;
  location: string;
};

export default function DeployHetznerPage() {
  const [step, setStep] = useState<"token" | "configure" | "deploying" | "done" | "error">("token");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [catalogue, setCatalogue] = useState<{ server_types: ServerType[]; locations: Location[]; ssh_keys: SshKey[] } | null>(null);

  const [config, setConfig] = useState({
    server_type: "cx22",
    location: "nbg1",
    domain: "",
    nous_key: "",
    kimi_key: "",
    resend_key: "",
    ssh_key_id: "" as string,
  });
  const [deployment, setDeployment] = useState<DeployResult | null>(null);
  const [pollStatus, setPollStatus] = useState<string>("initializing");

  async function loadCatalogue() {
    if (!token.startsWith("hcloud_")) {
      setErr("Token must start with hcloud_ (Hetzner Cloud format)");
      return;
    }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/deploy/hetzner/catalogue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load Hetzner catalogue");
      setCatalogue(j);
      // Sensible default: smallest 4GB RAM
      const default_st = j.server_types.find((s: ServerType) => s.memory_gb >= 4)?.name || j.server_types[0]?.name;
      const default_loc = j.locations.find((l: Location) => l.name === "nbg1")?.name || j.locations[0]?.name;
      setConfig((c) => ({ ...c, server_type: default_st, location: default_loc }));
      setStep("configure");
    } catch (e: any) {
      setErr(e?.message || "Failed to validate token");
    } finally {
      setBusy(false);
    }
  }

  async function deploy() {
    if (!config.nous_key && !config.kimi_key) {
      setErr("Enter at least one LLM API key (Nous or Kimi).");
      return;
    }
    setBusy(true); setErr(""); setStep("deploying");
    try {
      const r = await fetch("/api/deploy/hetzner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          server_type: config.server_type,
          location: config.location,
          domain: config.domain || undefined,
          ssh_key_ids: config.ssh_key_id ? [parseInt(config.ssh_key_id)] : [],
          llm_keys: { nous: config.nous_key, kimi: config.kimi_key },
          resend_key: config.resend_key || undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Deploy failed");
      setDeployment(j);
      pollDeployStatus(j.server_id);
    } catch (e: any) {
      setErr(e?.message || "Deploy failed");
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  async function pollDeployStatus(serverId: number) {
    const tries = 60;  // up to 5 minutes
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch("/api/deploy/hetzner/status", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, server_id: serverId }),
        });
        const j = await r.json();
        if (j.ok) {
          setPollStatus(j.status);
          if (j.status === "running") {
            // Server is up; cloud-init still running. Wait 60s more for ChatHermes to start.
            setPollStatus("running cloud-init...");
            setTimeout(() => setStep("done"), 60_000);
            return;
          }
        }
      } catch {}
      await new Promise((res) => setTimeout(res, 5_000));
    }
    setStep("done");  // bail out — show URL anyway
  }

  return (
    <main className="min-h-screen bg-[#0b0a09] text-paper">
      {/* Hero */}
      <div className="max-w-[920px] mx-auto px-5 sm:px-7 py-12 sm:py-16">
        <a href="/" className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-paper-faint hover:text-paper">← chathermes.com</a>

        <div className="mt-8 sm:mt-12 mb-12 flex items-start gap-5">
          <div className="hidden sm:flex w-14 h-14 rounded-xl bg-amber/15 border border-amber/30 items-center justify-center shrink-0">
            <Cloud size={26} className="text-amber" />
          </div>
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[11px] sm:text-[12px] text-amber uppercase tracking-[0.22em] mb-2">— one-click deploy</div>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(34px,5vw,52px)] leading-[1.05] tracking-[-0.025em]">
              Deploy ChatHermes to <em className="not-italic italic text-amber">Hetzner</em>.
            </h1>
            <p className="text-paper-dim mt-4 text-[15px] sm:text-[17px] max-w-[58ch] leading-[1.55]">
              Your own ChatHermes instance, running on a fresh Hetzner Cloud server in under 90 seconds. AGPL-3.0, full source, your data, your domain.
            </p>
          </div>
        </div>

        {/* Step: token */}
        {step === "token" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-ink-soft border border-ink-line rounded-2xl p-5 sm:p-7">
            <div className="flex items-start gap-3 mb-5">
              <Key size={18} className="text-amber shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-[16px]">Hetzner API token</div>
                <div className="text-paper-dim text-[13.5px] mt-1">Used once to provision your server. Never stored.</div>
              </div>
            </div>
            <input
              type="password"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="hcloud_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[13px] focus:outline-none focus:border-amber"
            />
            <details className="mt-3 text-[13px] text-paper-dim">
              <summary className="cursor-pointer hover:text-paper">how to get a token?</summary>
              <ol className="mt-3 ml-5 list-decimal space-y-1.5 text-paper-dim">
                <li>Sign in at <a href="https://console.hetzner.cloud" target="_blank" className="text-amber hover:underline">console.hetzner.cloud</a></li>
                <li>Pick a project (or create one)</li>
                <li>Security → API tokens → "Generate API token"</li>
                <li>Permission: <b>Read &amp; Write</b></li>
                <li>Copy the token (starts with <code className="font-[family-name:var(--font-mono)] text-amber">hcloud_</code>) and paste here</li>
              </ol>
            </details>

            {err && <div className="mt-4 p-3 bg-rust/10 border border-rust/30 rounded-md text-rust text-[13.5px] flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0" />{err}</div>}

            <button
              onClick={loadCatalogue}
              disabled={busy || !token}
              className="mt-5 w-full px-5 py-3 rounded-md bg-amber text-ink hover:bg-amber-soft disabled:opacity-50 font-medium inline-flex items-center justify-center gap-2"
            >
              {busy ? <><Loader2 size={16} className="animate-spin" /> validating</> : <>Continue <ArrowRight size={16} /></>}
            </button>

            <div className="mt-5 pt-5 border-t border-ink-line flex items-center gap-2 text-[12px] text-paper-faint">
              <Lock size={11} /> Your token never touches our database. We use it once and discard.
            </div>
          </motion.div>
        )}

        {/* Step: configure */}
        {step === "configure" && catalogue && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <Section icon={Server} title="Server type" subtitle="Pick what fits your workload">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {catalogue.server_types.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setConfig((c) => ({ ...c, server_type: s.name }))}
                    className={`text-left p-3 rounded-lg border transition-colors ${config.server_type === s.name ? "border-amber bg-amber/5" : "border-ink-line bg-ink-soft hover:border-paper-faint"}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] text-paper">{s.name}</span>
                      <span className="text-[11.5px] text-paper-dim">€{parseFloat(s.monthly_eur).toFixed(2)}/mo</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-paper-faint font-[family-name:var(--font-mono)]">
                      <span><Cpu size={9} className="inline" /> {s.cores} {s.cpu_type === "shared" ? "vCPU" : "CPU"}</span>
                      <span><MemoryStick size={9} className="inline" /> {s.memory_gb} GB</span>
                      <span><HardDrive size={9} className="inline" /> {s.disk_gb} GB</span>
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            <Section icon={MapPin} title="Location" subtitle="Closer = faster latency">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {catalogue.locations.map((l) => (
                  <button
                    key={l.name}
                    onClick={() => setConfig((c) => ({ ...c, location: l.name }))}
                    className={`text-left px-3 py-2.5 rounded-lg border ${config.location === l.name ? "border-amber bg-amber/5" : "border-ink-line bg-ink-soft hover:border-paper-faint"}`}
                  >
                    <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-paper">{l.name}</div>
                    <div className="text-[12px] text-paper-dim mt-0.5">{l.city}, {l.country}</div>
                  </button>
                ))}
              </div>
            </Section>

            <Section icon={Sparkles} title="LLM API keys" subtitle="At least one required — bake into the server's .env">
              <input value={config.nous_key} onChange={(e) => setConfig((c) => ({ ...c, nous_key: e.target.value }))} type="password" placeholder="Nous Inference API key (from portal.nousresearch.com)" className="w-full mb-2 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[12.5px] focus:outline-none focus:border-amber" />
              <input value={config.kimi_key} onChange={(e) => setConfig((c) => ({ ...c, kimi_key: e.target.value }))} type="password" placeholder="Moonshot Kimi API key (optional, from platform.moonshot.ai)" className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[12.5px] focus:outline-none focus:border-amber" />
            </Section>

            <Section icon={Cloud} title="Optional" subtitle="">
              <input value={config.domain} onChange={(e) => setConfig((c) => ({ ...c, domain: e.target.value }))} placeholder="Domain (e.g. agent.your-company.com — auto-HTTPS via Caddy)" className="w-full mb-2 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint text-[13px] focus:outline-none focus:border-amber" />
              <input value={config.resend_key} onChange={(e) => setConfig((c) => ({ ...c, resend_key: e.target.value }))} type="password" placeholder="Resend API key (for transactional email)" className="w-full mb-2 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint font-[family-name:var(--font-mono)] text-[12.5px] focus:outline-none focus:border-amber" />
              {catalogue.ssh_keys.length > 0 && (
                <select value={config.ssh_key_id} onChange={(e) => setConfig((c) => ({ ...c, ssh_key_id: e.target.value }))} className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper text-[13px] focus:outline-none focus:border-amber">
                  <option value="">Add an SSH key (optional)</option>
                  {catalogue.ssh_keys.map((k) => <option key={k.id} value={k.id}>{k.name} — {k.fingerprint.slice(0, 24)}...</option>)}
                </select>
              )}
            </Section>

            {err && <div className="p-3 bg-rust/10 border border-rust/30 rounded-md text-rust text-[13.5px] flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0" />{err}</div>}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep("token")} className="px-4 py-3 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-faint text-[14px]">← back</button>
              <button onClick={deploy} disabled={busy} className="flex-1 px-5 py-3 rounded-md bg-amber text-ink hover:bg-amber-soft disabled:opacity-50 font-medium inline-flex items-center justify-center gap-2 text-[15px]">
                <Server size={16} /> Deploy ChatHermes ({config.server_type} @ {config.location})
              </button>
            </div>

            <div className="text-[12px] text-paper-faint text-center">By deploying, you agree to Hetzner's terms. ChatHermes is licensed under <a href="https://github.com/chathermes/chathermes/blob/main/LICENSE.md" className="hover:text-paper underline">ChatHermes Open Source License</a>.</div>
          </motion.div>
        )}

        {/* Step: deploying */}
        {step === "deploying" && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-ink-soft border border-ink-line rounded-2xl p-7 sm:p-10 text-center">
            <Loader2 size={36} className="text-amber animate-spin mx-auto mb-5" />
            <h2 className="font-[family-name:var(--font-display)] text-[28px] mb-2">Deploying your ChatHermes…</h2>
            <p className="text-paper-dim text-[14.5px] mb-6">~90 seconds. Hetzner is provisioning the server, then cloud-init installs Docker + ChatHermes.</p>
            <div className="space-y-1.5 text-[12.5px] font-[family-name:var(--font-mono)] text-paper-dim text-left max-w-[400px] mx-auto">
              <div className="flex items-center gap-2"><span className="text-moss">✓</span> server requested</div>
              <div className="flex items-center gap-2"><Loader2 size={11} className="animate-spin text-amber" /> {pollStatus}</div>
              {deployment?.ipv4 && <div className="flex items-center gap-2"><span className="text-moss">✓</span> assigned IP {deployment.ipv4}</div>}
              <div className="flex items-center gap-2 opacity-50"><span>○</span> bootstrapping Docker + ChatHermes…</div>
              <div className="flex items-center gap-2 opacity-50"><span>○</span> first chat ready</div>
            </div>
          </motion.div>
        )}

        {/* Step: done */}
        {step === "done" && deployment && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-moss/10 to-ink-soft border-2 border-moss/30 rounded-2xl p-7 sm:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-moss/20 border border-moss/40 flex items-center justify-center"><Check size={20} className="text-moss" /></div>
              <h2 className="font-[family-name:var(--font-display)] text-[28px]">Your ChatHermes is live.</h2>
            </div>

            <div className="space-y-3 mb-6">
              <KV k="URL" v={deployment.estimated_url} link />
              <KV k="Public IP" v={deployment.ipv4} />
              <KV k="Server" v={`${deployment.server_type} @ ${deployment.location}`} mono />
              <KV k="SSH access" v={deployment.ssh_command} mono />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <a href={deployment.estimated_url} target="_blank" className="flex-1 px-5 py-3 rounded-md bg-amber text-ink hover:bg-amber-soft text-center font-medium inline-flex items-center justify-center gap-2"><ExternalLink size={15} /> Open my ChatHermes</a>
              <a href="https://chathermes.com" className="px-5 py-3 rounded-md border border-ink-line text-paper-dim hover:text-paper text-[14px] inline-flex items-center justify-center gap-2">← chathermes.com</a>
            </div>

            <div className="mt-6 pt-6 border-t border-ink-line">
              <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-paper-faint mb-2">— first 90 seconds</div>
              <ol className="text-[13px] text-paper-dim space-y-1 list-decimal ml-5">
                <li>Open the URL above (might say "connection refused" for ~60s while Docker boots)</li>
                <li>Sign in with any email — you'll see the magic link in the orchestrator log via SSH</li>
                <li>Try a chat. Try vibe coding. It's all yours.</li>
              </ol>
            </div>
          </motion.div>
        )}

        {/* Step: error */}
        {step === "error" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-rust/10 border-2 border-rust/30 rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-4"><AlertCircle size={24} className="text-rust" /><h2 className="font-[family-name:var(--font-display)] text-[24px]">Deploy failed</h2></div>
            <p className="text-paper-dim text-[14px] mb-4">{err}</p>
            <button onClick={() => { setStep("configure"); setErr(""); }} className="px-4 py-2 rounded-md bg-amber text-ink hover:bg-amber-soft">Try again</button>
          </motion.div>
        )}
      </div>
    </main>
  );
}

function Section({ icon: Icon, title, subtitle, children }: any) {
  return (
    <div className="bg-ink-soft border border-ink-line rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <Icon size={16} className="text-amber shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-medium text-[15px]">{title}</div>
          {subtitle && <div className="text-paper-dim text-[12.5px] mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function KV({ k, v, link, mono }: { k: string; v: string; link?: boolean; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 group">
      <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint w-24 shrink-0">{k}</span>
      <div className="flex-1 min-w-0">
        {link ? (
          <a href={v} target="_blank" className="text-amber hover:underline truncate block">{v}</a>
        ) : (
          <span className={`${mono ? "font-[family-name:var(--font-mono)] text-[13px]" : "text-[14px]"} text-paper truncate block`}>{v}</span>
        )}
      </div>
      <button onClick={() => { navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="opacity-0 group-hover:opacity-100 text-paper-faint hover:text-paper">
        {copied ? <Check size={12} className="text-moss" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
