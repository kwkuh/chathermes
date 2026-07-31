"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus, Trash2, Save, Check, CircleAlert, GripVertical } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

type PlanRow = {
  id: string; name: string; price_cents: number; currency: string; interval: string;
  stripe_price_id: string; features: string; limits: string; sort: number; enabled: number;
};

type Limits = {
  messagesPerMonth?: number; projectsPerMonth?: number;
  hermesAgentNative?: boolean; teamSeats?: number;
};

function parseFeatures(s: string): string[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
function parseLimits(s: string): Limits {
  try { return JSON.parse(s) ?? {}; } catch { return {}; }
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/plans", { credentials: "include" });
      const d = await r.json();
      setPlans(d.plans ?? []);
      setErr(null);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createPlan() {
    const id = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!id) return;
    setCreating(true); setErr(null);
    try {
      const r = await fetch("/api/admin/plans", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: id[0].toUpperCase() + id.slice(1), price_cents: 0, features: [], limits: {} }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not create plan");
      setNewId("");
      await load();
    } catch (e) { setErr((e as Error).message); }
    setCreating(false);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-5 sm:px-7 py-8 max-w-[880px] mx-auto">
      <PageHeader
        kicker="admin / plans"
        title="Pricing is data, not code."
        lede="Change a price, a limit, or a feature list here. It applies immediately — no redeploy."
      />

      {err && (
        <div className="mt-6 flex items-start gap-2 text-rust text-[14px]">
          <CircleAlert size={15} className="mt-0.5 shrink-0" /> {err}
        </div>
      )}

      <div className="mt-8 grid gap-3">
        {loading && <div className="text-paper-dim text-[15px]">Loading…</div>}
        {!loading && plans.map((p) => (
          <PlanCard key={p.id} plan={p} onSaved={load} onDeleted={load} setErr={setErr} />
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <input
          value={newId} onChange={(e) => setNewId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createPlan()}
          placeholder="new plan id, e.g. studio"
          className="px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[14px] font-[family-name:var(--font-mono)]"
        />
        <button onClick={createPlan} disabled={creating || !newId.trim()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[14px] transition disabled:opacity-40">
          <Plus size={14} /> Add plan
        </button>
      </div>

      <p className="text-paper-faint text-[13px] leading-[1.6] mt-6">
        Stripe price IDs still come from Stripe — create the price there, paste the
        <code className="text-paper-dim"> price_…</code> id here. Changing an amount on this page
        does not change what Stripe charges an existing subscriber; it changes what this
        install shows and what new checkouts use.
      </p>
    </motion.div>
  );
}

function PlanCard({ plan, onSaved, onDeleted, setErr }: {
  plan: PlanRow; onSaved: () => void; onDeleted: () => void; setErr: (s: string | null) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState((plan.price_cents / 100).toString());
  const [currency, setCurrency] = useState(plan.currency);
  const [interval, setInterval] = useState(plan.interval);
  const [priceId, setPriceId] = useState(plan.stripe_price_id);
  const [features, setFeatures] = useState(parseFeatures(plan.features).join("\n"));
  const [limits, setLimits] = useState<Limits>(parseLimits(plan.limits));
  const [enabled, setEnabled] = useState(!!plan.enabled);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const isFree = plan.id === "free";

  async function save() {
    setBusy(true); setErr(null);
    try {
      const cents = Math.round(parseFloat(price || "0") * 100);
      if (!Number.isFinite(cents) || cents < 0) throw new Error("Price must be zero or more");
      const r = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, price_cents: cents, currency, interval, stripe_price_id: priceId,
          features: features.split("\n").map((f) => f.trim()).filter(Boolean),
          limits, enabled,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not save");
      setSaved(true); setTimeout(() => setSaved(false), 1800);
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`Delete the "${plan.id}" plan?`)) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not delete");
      onDeleted();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-ink-line bg-ink-soft/20 p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <GripVertical size={14} className="text-paper-faint" />
        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-amber border border-amber/30 rounded px-2 py-0.5">{plan.id}</span>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-1.5 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[15px]" />
        {!isFree && (
          <label className="inline-flex items-center gap-2 text-[13px] text-paper-dim">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> enabled
          </label>
        )}
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-3">
        <Field label="Price">
          <div className="flex items-center gap-1.5">
            <span className="text-paper-faint text-[14px]">{currency === "usd" ? "$" : ""}</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal"
              className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[15px] font-[family-name:var(--font-mono)]" />
          </div>
        </Field>
        <Field label="Currency">
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toLowerCase())}
            className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[15px] font-[family-name:var(--font-mono)]" />
        </Field>
        <Field label="Interval">
          <select value={interval} onChange={(e) => setInterval(e.target.value)}
            className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[15px]">
            <option value="month">month</option>
            <option value="year">year</option>
          </select>
        </Field>
        <Field label="Stripe price ID">
          <input value={priceId} onChange={(e) => setPriceId(e.target.value)} placeholder="price_…"
            className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[13.5px] font-[family-name:var(--font-mono)]" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-3">
        <Field label="Messages / month">
          <NumField value={limits.messagesPerMonth} onChange={(v) => setLimits({ ...limits, messagesPerMonth: v })} />
        </Field>
        <Field label="Projects / month">
          <NumField value={limits.projectsPerMonth} onChange={(v) => setLimits({ ...limits, projectsPerMonth: v })} />
        </Field>
        <Field label="Team seats">
          <NumField value={limits.teamSeats} onChange={(v) => setLimits({ ...limits, teamSeats: v })} />
        </Field>
        <Field label="Native Hermes Agent">
          <label className="inline-flex items-center gap-2 text-[14px] text-paper-dim px-1 py-2">
            <input type="checkbox" checked={!!limits.hermesAgentNative}
              onChange={(e) => setLimits({ ...limits, hermesAgentNative: e.target.checked })} /> allowed
          </label>
        </Field>
      </div>

      <Field label="Features — one per line, shown on the pricing page">
        <textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={4}
          className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper focus:outline-none focus:border-amber/60 text-[14px] leading-[1.6]" />
      </Field>

      <div className="flex items-center gap-3 mt-3">
        <button onClick={save} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber text-ink text-[14px] font-medium hover:bg-amber-soft transition disabled:opacity-50">
          <Save size={14} /> Save
        </button>
        {saved && <span className="text-moss text-[13.5px] inline-flex items-center gap-1"><Check size={13} /> saved</span>}
        <div className="ml-auto">
          {!isFree && (
            <button onClick={remove} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-rust hover:bg-rust/10 text-[13.5px] transition disabled:opacity-50">
              <Trash2 size={13} /> Delete
            </button>
          )}
          {isFree && <span className="text-paper-faint text-[12.5px]">the fallback plan cannot be removed</span>}
        </div>
      </div>
    </div>
  );
}

function NumField({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <input
      value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} inputMode="numeric"
      placeholder="-1 = unlimited"
      className="w-full px-3 py-2 bg-ink border border-ink-line rounded-md text-paper placeholder:text-paper-faint focus:outline-none focus:border-amber/60 text-[15px] font-[family-name:var(--font-mono)]"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-paper-faint mb-1.5">{label}</div>
      {children}
    </div>
  );
}
