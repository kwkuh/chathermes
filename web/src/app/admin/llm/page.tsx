"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, X, Check, Star, Zap, Search, Loader2 } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type Provider = { id: string; name: string; kind: string; base_url: string; api_key: string | null; enabled: number };
type Model = { id: string; provider_id: string; provider_name: string; model_id: string; label: string; context_window: number | null; is_default: number; enabled: number };

const PRESETS = [
  { name: "Nous (Hermes native)", kind: "openai-compatible", base_url: "https://inference-api.nousresearch.com/v1" },
  { name: "Kimi (Moonshot)", kind: "openai-compatible", base_url: "https://api.moonshot.ai/v1" },
  { name: "OpenAI", kind: "openai", base_url: "https://api.openai.com/v1" },
  { name: "Anthropic", kind: "anthropic", base_url: "https://api.anthropic.com/v1" },
  { name: "Together AI", kind: "openai-compatible", base_url: "https://api.together.xyz/v1" },
  { name: "Groq", kind: "openai-compatible", base_url: "https://api.groq.com/openai/v1" },
  { name: "Custom (OpenAI-compatible)", kind: "openai-compatible", base_url: "" },
];

const HERMES_MODEL_PRESETS = [
  { id: "Hermes-3-Llama-3.1-405B", label: "Hermes 3 — Llama 3.1 405B", ctx: 128000 },
  { id: "Hermes-3-Llama-3.1-70B", label: "Hermes 3 — Llama 3.1 70B", ctx: 128000 },
  { id: "DeepHermes-3-Llama-3-8B-Preview", label: "DeepHermes 3 — 8B (Preview)", ctx: 32768 },
  { id: "DeepHermes-3-Mistral-24B-Preview", label: "DeepHermes 3 — Mistral 24B", ctx: 32768 },
];

export default function AdminLLM() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [showProvider, setShowProvider] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);

  async function load() {
    try {
      const [p, m] = await Promise.all([
        fetch("/api/admin/providers", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/models", { credentials: "include" }).then((r) => r.json()),
      ]);
      setProviders(p.providers ?? []);
      setModels(m.models ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  async function deleteProvider(id: string) {
    if (!confirm("Delete this provider and all its models?")) return;
    await fetch(`/api/admin/providers/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  async function toggleProvider(p: Provider) {
    await fetch(`/api/admin/providers/${p.id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: p.enabled ? 0 : 1 }) });
    await load();
  }

  async function setDefaultModel(id: string) {
    await fetch(`/api/admin/models/${id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_default: 1 }) });
    await load();
  }

  async function deleteModel(id: string) {
    if (!confirm("Delete this model?")) return;
    await fetch(`/api/admin/models/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  return (
    <div className="px-5 sm:px-7 py-8 max-w-[1180px] mx-auto">
      <PageHeader
        kicker="admin / llm"
        title="Models & providers."
        lede="Add any OpenAI-compatible provider. Define which models are available platform-wide. Set the global default."
      />

      {providers.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-amber/[0.06] border border-amber/30 rounded-2xl px-6 py-5 flex items-center gap-5">
          <div className="flex-1">
            <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.18em] mb-2">— quick start</div>
            <h3 className="font-[family-name:var(--font-display)] text-[22px] leading-tight">Bootstrap with native Hermes.</h3>
            <p className="text-paper-dim text-[15px] mt-2 max-w-[60ch]">One click adds the Nous Research provider + 4 Hermes models (405B, 70B, DeepHermes 8B + Mistral 24B). You only need to paste a Nous API key.</p>
          </div>
          <button onClick={async () => { const key = prompt("Nous API key (from portal.nousresearch.com)"); if (!key) return; const provR = await fetch("/api/admin/providers", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Nous (Hermes native)", kind: "openai-compatible", base_url: "https://inference-api.nousresearch.com/v1", api_key: key }) }); const { provider } = await provR.json(); for (const m of HERMES_MODEL_PRESETS) { await fetch("/api/admin/models", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider_id: provider.id, model_id: m.id, label: m.label, context_window: m.ctx, is_default: m.id === "Hermes-3-Llama-3.1-70B" ? 1 : 0 }) }); } load(); }}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-md bg-amber text-ink text-[15px] font-medium hover:bg-amber-soft shadow-[0_0_30px_rgba(232,165,71,0.4)]">
            <Zap size={14} /> Bootstrap Hermes
          </button>
        </motion.div>
      )}

      {/* Providers */}
      <div className="mt-10 flex items-center justify-between mb-4">
        <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— providers</div>
        <button onClick={() => setShowProvider(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft">
          <Plus size={13} /> Add provider
        </button>
      </div>

      <div className="grid gap-3">
        {providers.length === 0 ? (
          <div className="bg-ink-soft border border-ink-line rounded-xl px-6 py-10 text-center text-paper-dim text-[15.5px]">
            No providers. Add one to start serving real LLM responses.
          </div>
        ) : providers.map((p) => (
          <motion.div key={p.id} layout className="bg-ink-soft border border-ink-line rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-paper text-[15px] font-medium">{p.name}</span>
                <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] px-2 py-0.5 rounded bg-ink-line text-paper-faint">{p.kind}</span>
                {p.api_key ? (
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] px-2 py-0.5 rounded bg-moss/15 text-moss inline-flex items-center gap-1">
                    <Check size={9} /> key
                  </span>
                ) : (
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] px-2 py-0.5 rounded bg-rust/15 text-rust">no key</span>
                )}
              </div>
              <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper-faint mt-1">{p.base_url}</div>
            </div>
            <button onClick={() => toggleProvider(p)} className={`relative w-10 h-5 rounded-full transition-colors ${p.enabled ? "bg-amber" : "bg-ink-line"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-paper transition-transform ${p.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
            <button onClick={() => deleteProvider(p.id)} className="p-2 rounded text-paper-dim hover:text-rust hover:bg-rust/10">
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Models */}
      {/* Featured: Step 3.5 Flash */}
      {providers.length > 0 && !models.find((m: any) => m.model_id === "stepfun/step-3.5-flash") && (
        <div className="mt-10 bg-gradient-to-r from-amber/10 to-amber/[0.02] border border-amber/30 rounded-2xl px-6 py-5 flex items-center gap-5">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-amber/20 border border-amber/40 flex items-center justify-center">
            <Zap size={20} className="text-amber" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.18em] mb-1">— featured</div>
            <h3 className="font-[family-name:var(--font-display)] text-[20px] leading-tight">Step 3.5 Flash</h3>
            <p className="text-paper-dim text-[14px] mt-1">Lightning-fast Chinese-tuned model. Great for multilingual chat. 128k context.</p>
          </div>
          <button onClick={async () => {
            await fetch("/api/admin/models", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider_id: providers[0].id, model_id: "stepfun/step-3.5-flash", label: "Step 3.5 Flash", context_window: 128000, is_default: 0 }) });
            load();
          }} className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft">
            <Plus size={13} /> Add now
          </button>
        </div>
      )}

      <div className="mt-12 flex items-center justify-between mb-4">
        <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— models</div>
        <div className="flex gap-2">
          <button onClick={() => setShowBrowse(true)} disabled={providers.length === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-amber/40 text-amber text-[14.5px] font-medium hover:bg-amber/10 disabled:opacity-40 disabled:cursor-not-allowed">
            <Search size={13} /> Browse all
          </button>
          <button onClick={() => setShowModel(true)} disabled={providers.length === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={13} /> Add custom
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {models.length === 0 ? (
          <div className="bg-ink-soft border border-ink-line rounded-xl px-6 py-10 text-center text-paper-dim text-[15.5px]">No models defined.</div>
        ) : models.map((m) => (
          <motion.div key={m.id} layout className="bg-ink-soft border border-ink-line rounded-xl px-5 py-4 flex items-center gap-4">
            <button onClick={() => !m.is_default && setDefaultModel(m.id)} className={`p-1 rounded ${m.is_default ? "text-amber" : "text-paper-faint hover:text-amber"}`}>
              <Star size={16} fill={m.is_default ? "currentColor" : "none"} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-paper text-[16px] font-medium">{m.label}</span>
                {m.is_default ? <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] px-2 py-0.5 rounded bg-amber/15 text-amber">default</span> : null}
              </div>
              <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper-faint mt-1">
                {m.provider_name} · <span className="text-paper-dim">{m.model_id}</span>
                {m.context_window ? <> · {(m.context_window / 1000).toFixed(0)}k context</> : null}
              </div>
            </div>
            <button onClick={() => deleteModel(m.id)} className="p-2 rounded text-paper-dim hover:text-rust hover:bg-rust/10">
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showProvider && <ProviderModal onClose={() => setShowProvider(false)} onSaved={load} />}
        {showModel && <ModelModal providers={providers} onClose={() => setShowModel(false)} onSaved={load} />}
        {showBrowse && <BrowseModal providers={providers} existing={models} onClose={() => setShowBrowse(false)} onSaved={load} />}
      </AnimatePresence>
    </div>
  );
}

function ProviderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  function pickPreset(p: typeof PRESETS[number]) {
    setName(p.name); setKind(p.kind); setBaseUrl(p.base_url);
  }

  async function save() {
    if (!name || !baseUrl) return;
    setBusy(true);
    await fetch("/api/admin/providers", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, kind, base_url: baseUrl, api_key: apiKey || undefined }) });
    setBusy(false);
    onSaved(); onClose();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-center justify-center p-7" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        className="w-full max-w-[500px] bg-ink-soft border border-ink-line rounded-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— add provider</div>
          <button onClick={onClose} className="p-1 text-paper-dim hover:text-paper"><X size={16} /></button>
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-[26px] mt-2 mb-1">Connect an LLM.</h3>
        <p className="text-paper-dim text-[14.5px] mb-5">Pick a preset or fill in custom values. Any OpenAI-compatible API works.</p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => pickPreset(p)} className="text-left px-3 py-2 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-amber/40 text-[14px]">
              {p.name}
            </button>
          ))}
        </div>

        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="My Kimi key" /></Field>
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            <option value="openai-compatible">openai-compatible</option>
            <option value="openai">openai</option>
            <option value="anthropic">anthropic</option>
          </select>
        </Field>
        <Field label="Base URL"><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={inputCls} placeholder="https://api.moonshot.ai/v1" /></Field>
        <Field label="API Key"><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputCls} placeholder="sk-…" /></Field>

        <button onClick={save} disabled={busy || !name || !baseUrl} className="w-full mt-5 px-4 py-3 rounded-md bg-amber text-ink text-[15.5px] font-medium hover:bg-amber-soft disabled:opacity-50">
          {busy ? "Saving…" : "Save provider"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function ModelModal({ providers, onClose, onSaved }: { providers: Provider[]; onClose: () => void; onSaved: () => void }) {
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [modelId, setModelId] = useState("");
  const [label, setLabel] = useState("");
  const [ctx, setCtx] = useState("128000");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!providerId || !modelId || !label) return;
    setBusy(true);
    await fetch("/api/admin/models", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      provider_id: providerId, model_id: modelId, label, context_window: parseInt(ctx) || null, is_default: isDefault ? 1 : 0,
    }) });
    setBusy(false);
    onSaved(); onClose();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-center justify-center p-7" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        className="w-full max-w-[500px] bg-ink-soft border border-ink-line rounded-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— add model</div>
          <button onClick={onClose} className="p-1 text-paper-dim hover:text-paper"><X size={16} /></button>
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-[26px] mt-2 mb-5">Define a model.</h3>

        <Field label="Provider">
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={inputCls}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Model ID (sent to provider)"><input value={modelId} onChange={(e) => setModelId(e.target.value)} className={inputCls} placeholder="kimi-k2-0711-preview" /></Field>
        <Field label="Display label"><input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="Kimi K2 (preview)" /></Field>
        <Field label="Context window (tokens)"><input value={ctx} onChange={(e) => setCtx(e.target.value)} className={inputCls} placeholder="128000" /></Field>
        <label className="flex items-center gap-2 mt-3">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          <span className="text-paper text-[14.5px]">Set as global default</span>
        </label>

        <button onClick={save} disabled={busy} className="w-full mt-5 px-4 py-3 rounded-md bg-amber text-ink text-[15.5px] font-medium hover:bg-amber-soft disabled:opacity-50">
          {busy ? "Saving…" : "Save model"}
        </button>
      </motion.div>
    </motion.div>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-ink border border-ink-line rounded-md text-paper text-[14.5px] focus:outline-none focus:border-amber/60 transition-colors font-[family-name:var(--font-mono)]";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3"><div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.16em] mb-1.5">{label}</div>{children}</div>;
}


function BrowseModal({ providers, existing, onClose, onSaved }: { providers: Provider[]; existing: Model[]; onClose: () => void; onSaved: () => void }) {
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [allModels, setAllModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const existingIds = new Set(existing.map((m: any) => m.model_id));

  async function load() {
    if (!providerId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/providers/${providerId}/upstream-models`, { credentials: "include" });
      const d = await r.json();
      setAllModels(d.models ?? []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [providerId]);

  const filtered = allModels.filter((id) => id.toLowerCase().includes(filter.toLowerCase()));
  const orgs = Array.from(new Set(allModels.map((id) => id.split("/")[0]))).sort();

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  }

  async function bulkAdd() {
    setBusy(true);
    const list = Array.from(picked).map((id) => ({ model_id: id, label: id.split("/").slice(-1)[0].replace(/-/g, " "), context_window: 128000 }));
    await fetch("/api/admin/models/bulk", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider_id: providerId, models: list }) });
    setBusy(false);
    onSaved();
    onClose();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-7">
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        className="w-full max-w-[760px] max-h-[85vh] bg-ink-soft border border-ink-line rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-ink-line flex items-start justify-between">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— browse models</div>
            <h3 className="font-[family-name:var(--font-display)] text-[24px] mt-1">{allModels.length} models from {providers.find((p: any) => p.id === providerId)?.name ?? "—"}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-paper-dim hover:text-paper"><X size={16} /></button>
        </div>

        <div className="px-6 py-3 border-b border-ink-line flex gap-2 items-center">
          <Search size={14} className="text-paper-faint shrink-0" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter (try: hermes, kimi, gpt, claude…)"
            className="flex-1 bg-transparent text-paper text-[14.5px] focus:outline-none placeholder:text-paper-faint" />
          <span className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint">{filtered.length} match · {picked.size} picked</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-paper-dim text-[14.5px] flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Fetching…
            </div>
          ) : (
            filtered.map((id) => {
              const has = existingIds.has(id);
              const checked = picked.has(id);
              return (
                <button key={id} disabled={has}
                  onClick={() => toggle(id)}
                  className={`w-full text-left px-6 py-2 border-b border-ink-line flex items-center gap-3 transition-colors ${
                    has ? "opacity-40 cursor-not-allowed" : checked ? "bg-amber/10" : "hover:bg-ink-line/30"
                  }`}>
                  <span className={`w-3.5 h-3.5 rounded border-2 ${has ? "border-moss bg-moss/20" : checked ? "border-amber bg-amber" : "border-ink-line"} flex items-center justify-center`}>
                    {has && <Check size={10} className="text-moss" />}
                    {checked && !has && <Check size={10} className="text-ink" />}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[14px] text-paper truncate">{id}</span>
                  {has && <span className="ml-auto font-[family-name:var(--font-mono)] text-[11.5px] text-moss uppercase tracking-[0.14em]">added</span>}
                </button>
              );
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-ink-line flex items-center justify-between bg-ink/40">
          <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper-dim uppercase tracking-[0.14em]">{picked.size} selected</div>
          <button onClick={bulkAdd} disabled={picked.size === 0 || busy}
            className="px-5 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft disabled:opacity-40">
            {busy ? "Adding…" : `Add ${picked.size} models`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
