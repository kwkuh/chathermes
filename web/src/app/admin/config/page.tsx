"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Save, Check, CircleAlert, Eye, MailCheck, Loader2 } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type Field = {
  key: string; group: string; label: string; hint?: string;
  secret: boolean; source: "db" | "env" | "unset"; value: string | null; set: boolean;
};

const GROUP_ORDER = ["General", "Email", "Billing", "Credits", "Tools", "Infrastructure"];

export default function AdminConfig() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; provider?: string; error?: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/config", { credentials: "include" });
      const d = await r.json();
      setFields(d.fields ?? []);
      setErr(null);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function testEmail() {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch("/api/admin/email/verify-transport", { method: "POST", credentials: "include" });
      setTestResult(await r.json());
    } catch (e) { setTestResult({ ok: false, error: (e as Error).message }); }
    setTesting(false);
  }

  const groups = GROUP_ORDER.filter((g) => fields.some((f) => f.group === g));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-5 sm:px-7 py-8 max-w-[880px] mx-auto">
      <PageHeader
        kicker="admin / configuration"
        title="Keys and toggles."
        lede="These used to live in .env behind an SSH session. Saved here they apply immediately, and override whatever the environment sets."
      />

      {err && <div className="mt-6 flex items-start gap-2 text-rust text-[14px]"><CircleAlert size={15} className="mt-0.5" /> {err}</div>}
      {loading && <div className="mt-8 text-paper-dim text-[15px]">Loading…</div>}

      {groups.map((g) => (
        <section key={g} className="mt-9">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-amber">— {g}</h2>
            {g === "Email" && (
              <>
                <button onClick={testEmail} disabled={testing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[12.5px] transition disabled:opacity-50">
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <MailCheck size={12} />} Test connection
                </button>
                {testResult?.ok && <span className="text-moss text-[13px] inline-flex items-center gap-1"><Check size={13} /> {testResult.provider} reachable</span>}
                {testResult && !testResult.ok && <span className="text-rust text-[12.5px] max-w-[40ch]">{testResult.error}</span>}
              </>
            )}
          </div>
          <div className="grid gap-2.5">
            {fields.filter((f) => f.group === g).map((f) => (
              <Row key={f.key} field={f} onSaved={load} setErr={setErr} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-paper-faint text-[13px] leading-[1.6] mt-10">
        Secrets are shown masked and never sent back to this page in full. Clearing a field
        removes the override, and the environment value applies again.
      </p>
    </motion.div>
  );
}

function Row({ field, onSaved, setErr }: { field: Field; onSaved: () => void; setErr: (s: string | null) => void }) {
  // A secret's real value never reaches the browser, so the box starts empty and
  // only sends something when the admin actually types a replacement.
  const [value, setValue] = useState(field.secret ? "" : (field.value ?? ""));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(next?: string) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/config/${field.key}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next !== undefined ? next : value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not save");
      setSaved(true); setTimeout(() => setSaved(false), 1600);
      if (field.secret) setValue("");
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="rounded-md border border-ink-line bg-ink-soft/20 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1.5">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-paper text-[14.5px]">{field.label}</span>
          <code className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint">{field.key}</code>
          <SourceTag source={field.source} />
        </div>
        {field.secret && field.set && (
          <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint inline-flex items-center gap-1">
            <Eye size={11} /> {field.value}
          </span>
        )}
      </div>
      {field.hint && <div className="text-paper-faint text-[12.5px] leading-[1.5] mb-2">{field.hint}</div>}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type={field.secret ? "password" : "text"}
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={field.secret ? (field.set ? "paste a new value to replace" : "not set") : "not set"}
          className="flex-1 min-w-[220px] px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[14px] font-[family-name:var(--font-mono)]"
        />
        <button onClick={() => save()} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[13.5px] transition disabled:opacity-50">
          <Save size={13} /> Save
        </button>
        {field.source === "db" && (
          <button onClick={() => { setValue(""); save(""); }} disabled={busy}
            className="px-3 py-2 rounded-md text-paper-faint hover:text-rust text-[13px] transition disabled:opacity-50">
            clear
          </button>
        )}
        {saved && <span className="text-moss text-[13px] inline-flex items-center gap-1"><Check size={13} /> saved</span>}
      </div>
    </div>
  );
}

function SourceTag({ source }: { source: "db" | "env" | "unset" }) {
  const map = {
    db: { label: "panel", cls: "border-amber/40 text-amber" },
    env: { label: "env", cls: "border-ink-line text-paper-faint" },
    unset: { label: "not set", cls: "border-ink-line text-paper-faint" },
  } as const;
  const m = map[source];
  return (
    <span className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${m.cls}`}>
      {m.label}
    </span>
  );
}
