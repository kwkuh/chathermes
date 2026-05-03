"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, ExternalLink } from "lucide-react";
import PageHeader from "../_components/page-header";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [me, setMe] = useState<any>(null);
  const [kimi, setKimi] = useState("");
  const [model, setModel] = useState("kimi-k2-0711-preview");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.me().then((d) => { setMe(d); if (d.settings?.model) setModel(d.settings.model); }).catch(() => {}); }, []);

  async function save() {
    setBusy(true);
    try {
      const patch: any = { model };
      if (kimi.trim()) patch.kimi_api_key = kimi.trim();
      await api.settings.update(patch);
      setKimi("");
      setSaved(true);
      const refreshed = await api.me();
      setMe(refreshed);
      setTimeout(() => setSaved(false), 2400);
    } catch (e) { alert((e as Error).message); }
    setBusy(false);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="px-7 py-8 max-w-[820px] mx-auto">
      <PageHeader kicker="settings" title="Tune the agent." lede="Defaults that stick. Override per-project at any time." />
      <div className="mt-10 grid gap-3">
        <Card label="account">
          <Row label="Email" value={me?.user?.email ?? "—"} />
          <Row label="Role" value={me?.user?.role ?? "user"} />
          <Row label="Agent ID" value={me?.tenant?.id?.slice(0, 8) ?? "not provisioned"} mono />
          <Row label="Status" value={me?.tenant?.status ?? "—"} />
        </Card>

        <Card label="model" footer={
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              {saved && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="font-[family-name:var(--font-mono)] text-[13px] text-moss inline-flex items-center gap-1">
                  <Check size={12} /> saved
                </motion.span>
              )}
            </div>
            <button onClick={save} disabled={busy} className="px-4 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        }>
          <div className="px-3 py-3 border-b border-ink-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-paper-dim text-[14.5px]">Kimi API key</span>
              {me?.settings?.has_kimi_key ? (
                <span className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] px-2 py-0.5 rounded bg-moss/15 text-moss">configured</span>
              ) : (
                <span className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] px-2 py-0.5 rounded bg-ink-line text-paper-faint">required</span>
              )}
            </div>
            <input
              type="password" value={kimi} onChange={(e) => setKimi(e.target.value)}
              placeholder={me?.settings?.has_kimi_key ? "•••••••• (paste a new one to replace)" : "sk-…"}
              className="w-full mt-1 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[14.5px] font-[family-name:var(--font-mono)]"
            />
            <a href="https://platform.moonshot.ai/console/api-keys" target="_blank" className="inline-flex items-center gap-1 mt-2 text-[13px] text-paper-faint hover:text-amber transition-colors">
              get a key from moonshot.ai <ExternalLink size={10} />
            </a>
          </div>
          <div className="px-3 py-3 border-b border-ink-line">
            <div className="flex items-center justify-between">
              <span className="text-paper-dim text-[14.5px]">Default model</span>
            </div>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full mt-2 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper text-[14.5px] focus:outline-none focus:border-amber/60 font-[family-name:var(--font-mono)]">
              <option value="kimi-k2-0711-preview">kimi-k2-0711-preview</option>
              <option value="moonshot-v1-8k">moonshot-v1-8k</option>
              <option value="moonshot-v1-32k">moonshot-v1-32k</option>
              <option value="moonshot-v1-128k">moonshot-v1-128k</option>
            </select>
          </div>
          <Row label="Temperature" value="0.7" />
          <Row label="Max tokens" value="32768" />
        </Card>

        <Card label="agent runtime">
          <Row label="Container" value={me?.tenant ? `chathermes-engine-${me.tenant.id.slice(0, 8)}` : "—"} mono />
          <Row label="Memory limit" value="512 MB" />
          <Row label="CPU limit" value="0.5 cores" />
          <Row label="Idle timeout" value="30 min before hibernation" />
        </Card>

        <Card label="danger zone">
          <button className="w-full text-left px-4 py-3 text-rust hover:bg-rust/10 rounded-md text-[15px] transition-colors">Reset memory</button>
          <button className="w-full text-left px-4 py-3 text-rust hover:bg-rust/10 rounded-md text-[15px] transition-colors">Delete agent + all data</button>
        </Card>
      </div>
    </motion.div>
  );
}

function Card({ label, children, footer }: { label: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-ink-line font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.18em]">— {label}</div>
      <div className="px-2 py-2">{children}</div>
      {footer && <div className="border-t border-ink-line">{footer}</div>}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-3 py-2.5 flex items-center justify-between">
      <span className="text-paper-dim text-[15px]">{label}</span>
      <span className={`text-paper text-[15px] ${mono ? "font-[family-name:var(--font-mono)] text-[14px]" : ""}`}>{value}</span>
    </div>
  );
}
