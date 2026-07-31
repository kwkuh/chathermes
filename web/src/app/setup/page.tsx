"use client";
import { useEffect, useState } from "react";
import {
  KeyRound, User, Cpu, Check, ArrowRight, CircleAlert, Loader2, PartyPopper,
} from "lucide-react";

// Same list the admin panel offers. Local runtimes are first-class here: a
// self-hoster with Ollama running should be able to finish setup with no paid key.
const PRESETS: { name: string; kind: string; base_url: string; model: string; needsKey: boolean }[] = [
  { name: "Nous (Hermes native)", kind: "openai-compatible", base_url: "https://inference-api.nousresearch.com/v1", model: "nousresearch/hermes-4-405b", needsKey: true },
  { name: "OpenAI", kind: "openai", base_url: "https://api.openai.com/v1", model: "gpt-5", needsKey: true },
  { name: "Anthropic", kind: "anthropic", base_url: "https://api.anthropic.com/v1", model: "claude-sonnet-4-6", needsKey: true },
  { name: "Google Gemini", kind: "openai-compatible", base_url: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-pro", needsKey: true },
  { name: "DeepSeek", kind: "openai-compatible", base_url: "https://api.deepseek.com/v1", model: "deepseek-chat", needsKey: true },
  { name: "OpenRouter", kind: "openai-compatible", base_url: "https://openrouter.ai/api/v1", model: "nousresearch/hermes-4-405b", needsKey: true },
  { name: "Groq", kind: "openai-compatible", base_url: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", needsKey: true },
  { name: "Ollama (local)", kind: "openai-compatible", base_url: "http://127.0.0.1:11434/v1", model: "llama3.1", needsKey: false },
  { name: "LM Studio (local)", kind: "openai-compatible", base_url: "http://127.0.0.1:1234/v1", model: "local-model", needsKey: false },
  { name: "Custom (OpenAI-compatible)", kind: "openai-compatible", base_url: "", model: "", needsKey: false },
];

type Step = 1 | 2 | 3 | 4;

export default function SetupPage() {
  const [ready, setReady] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [siteName, setSiteName] = useState("ChatHermes");
  const [siteUrl, setSiteUrl] = useState("");

  const [presetIdx, setPresetIdx] = useState(0);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].base_url);
  const [modelId, setModelId] = useState(PRESETS[0].model);
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/setup/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setAlreadyDone(!d.needed); setReady(true); })
      .catch(() => setReady(true));
    if (typeof window !== "undefined") setSiteUrl(window.location.origin);
  }, []);

  function pickPreset(i: number) {
    setPresetIdx(i);
    setBaseUrl(PRESETS[i].base_url);
    setModelId(PRESETS[i].model);
    setTestResult(null);
  }

  async function submitToken() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/setup/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Invalid token");
      setStep(2);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  async function testConnection() {
    setBusy(true); setErr(null); setTestResult(null);
    try {
      const r = await fetch("/api/setup/test-llm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), base_url: baseUrl, api_key: apiKey, model_id: modelId }),
      });
      setTestResult(await r.json());
    } catch (e) { setTestResult({ ok: false, error: (e as Error).message }); }
    setBusy(false);
  }

  async function finish() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/setup/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          admin_email: email.trim(),
          site_name: siteName.trim(),
          site_url: siteUrl.trim(),
          provider: baseUrl && modelId ? {
            name: PRESETS[presetIdx].name, kind: PRESETS[presetIdx].kind,
            base_url: baseUrl, api_key: apiKey, model_id: modelId, label: modelId,
          } : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Setup failed");
      setStep(4);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  if (!ready) {
    return <Shell><div className="text-paper-dim text-[15px]">Checking install…</div></Shell>;
  }

  if (alreadyDone && step !== 4) {
    return (
      <Shell>
        <h1 className="font-[family-name:var(--font-display)] text-[38px] leading-[1.05] mb-4">Already set up.</h1>
        <p className="text-paper-dim text-[16px] leading-[1.6] mb-7">
          This install has an admin already, so setup is closed. Sign in instead — or, if you
          have lost access, reset it from the server.
        </p>
        <a href="/auth/login" className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-amber text-ink text-[15px] font-medium hover:bg-amber-soft transition">
          Go to sign in <ArrowRight size={15} />
        </a>
      </Shell>
    );
  }

  return (
    <Shell>
      <Steps current={step} />

      {step === 1 && (
        <>
          <Head icon={KeyRound} title="Prove you own this server" />
          <p className="text-paper-dim text-[15.5px] leading-[1.6] mb-5">
            A token was written when the orchestrator first booted. This is what stops anyone
            who finds this address from claiming your install before you do.
          </p>
          <pre className="overflow-x-auto rounded-md bg-ink border border-ink-line/60 p-3.5 font-[family-name:var(--font-mono)] text-[12.5px] text-paper-dim mb-5 leading-[1.7]">
{`docker logs chathermes | grep -A2 "SETUP REQUIRED"
# or:
cat /data/setup.token`}
          </pre>
          <Field label="Setup token">
            <input
              value={token} onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && token.trim() && submitToken()}
              placeholder="paste the token" autoFocus
              className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[15px] font-[family-name:var(--font-mono)]"
            />
          </Field>
          <Err msg={err} />
          <Next onClick={submitToken} disabled={!token.trim() || busy} busy={busy} label="Continue" />
        </>
      )}

      {step === 2 && (
        <>
          <Head icon={User} title="Your admin account" />
          <p className="text-paper-dim text-[15.5px] leading-[1.6] mb-5">
            This email becomes the first admin. Sign-in is by magic link, so there is no
            password to choose.
          </p>
          <Field label="Admin email">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoFocus
              className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[15px]"
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Site name">
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[15px]" />
            </Field>
            <Field label="Public URL">
              <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://your-domain.com"
                className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[15px] font-[family-name:var(--font-mono)]" />
            </Field>
          </div>
          <Err msg={err} />
          <Next onClick={() => { setErr(null); setStep(3); }} disabled={!email.includes("@")} label="Continue" />
        </>
      )}

      {step === 3 && (
        <>
          <Head icon={Cpu} title="Pick a model" />
          <p className="text-paper-dim text-[15.5px] leading-[1.6] mb-5">
            Anything speaking the OpenAI wire format works. You can add more providers later
            in the admin panel — this one just becomes the default.
          </p>
          <Field label="Provider">
            <select
              value={presetIdx} onChange={(e) => pickPreset(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[15px]"
            >
              {PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
            </select>
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Base URL">
              <input value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null); }}
                className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[14px] font-[family-name:var(--font-mono)]" />
            </Field>
            <Field label="Model ID">
              <input value={modelId} onChange={(e) => { setModelId(e.target.value); setTestResult(null); }}
                className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[14px] font-[family-name:var(--font-mono)]" />
            </Field>
          </div>
          <Field label={PRESETS[presetIdx].needsKey ? "API key" : "API key (leave empty for local runtimes)"}>
            <input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
              placeholder={PRESETS[presetIdx].needsKey ? "sk-…" : "not required"}
              className="w-full px-3.5 py-2.5 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[15px] font-[family-name:var(--font-mono)]" />
          </Field>

          <div className="flex items-center gap-3 flex-wrap mb-2">
            <button onClick={testConnection} disabled={busy || !baseUrl || !modelId}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[14px] transition disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Test connection
            </button>
            {testResult?.ok && <span className="text-moss text-[14px] inline-flex items-center gap-1.5"><Check size={14} /> reachable</span>}
            {testResult && !testResult.ok && (
              <span className="text-rust text-[13.5px] inline-flex items-start gap-1.5 max-w-[46ch]">
                <CircleAlert size={14} className="mt-0.5 shrink-0" /> {testResult.error}
              </span>
            )}
          </div>
          <p className="text-paper-faint text-[13px] leading-[1.6] mb-2">
            A failed test does not block setup — you can fix the key later in Admin → LLM.
          </p>

          <Err msg={err} />
          <Next onClick={finish} disabled={busy} busy={busy} label="Finish setup" />
        </>
      )}

      {step === 4 && (
        <>
          <Head icon={PartyPopper} title="Done." />
          <p className="text-paper-dim text-[16px] leading-[1.65] mb-6">
            You are signed in as <span className="text-paper">{email}</span> with admin rights.
            The setup token has been deleted and this page will not open again.
          </p>
          <ul className="text-paper-dim text-[15px] leading-[1.9] mb-7">
            <li>— Add more models under <span className="text-paper">Admin → LLM</span></li>
            <li>— Email and billing keys go in the orchestrator env, then restart</li>
            <li>— Back up one thing only: the <span className="text-paper">/data</span> volume</li>
          </ul>
          <a href="/app" className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-amber text-ink text-[15px] font-medium hover:bg-amber-soft transition">
            Open the app <ArrowRight size={15} />
          </a>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-paper antialiased flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-[620px]">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-6">— ChatHermes setup</div>
        {children}
      </div>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const labels = ["Token", "Admin", "Model", "Done"];
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((l, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "todo";
        return (
          <div key={l} className="flex items-center gap-2">
            <div className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-2.5 py-1 rounded border ${
              state === "now" ? "border-amber text-amber"
              : state === "done" ? "border-moss/50 text-moss"
              : "border-ink-line text-paper-faint"
            }`}>
              {state === "done" ? "✓ " : ""}{l}
            </div>
            {i < labels.length - 1 && <div className="w-4 h-px bg-ink-line" />}
          </div>
        );
      })}
    </div>
  );
}

function Head({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <Icon size={20} className="text-amber shrink-0" />
      <h1 className="font-[family-name:var(--font-display)] text-[32px] sm:text-[38px] leading-[1.05] tracking-[-0.02em]">{title}</h1>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-2">{label}</div>
      {children}
    </div>
  );
}

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 text-rust text-[14px] mb-4">
      <CircleAlert size={15} className="mt-0.5 shrink-0" /> {msg}
    </div>
  );
}

function Next({ onClick, disabled, busy, label }: { onClick: () => void; disabled?: boolean; busy?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-amber text-ink text-[15px] font-medium hover:bg-amber-soft transition disabled:opacity-40 disabled:cursor-not-allowed mt-2">
      {busy ? <Loader2 size={15} className="animate-spin" /> : null}
      {label} {!busy && <ArrowRight size={15} />}
    </button>
  );
}
