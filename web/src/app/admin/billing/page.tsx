"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Crown, Zap, Building2, Plus, DollarSign } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

const PLAN_ICONS: any = { free: Zap, pro: Crown, team: Building2, enterprise: Building2 };

function fmtMoney(cents: number) {
  if (cents === 0) return "—";
  const sign = cents < 0 ? "−" : "";
  const v = Math.abs(cents) / 100;
  return `${sign}$${v.toFixed(v % 1 === 0 ? 0 : 2)}`;
}

export default function AdminBilling() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/billing", { credentials: "include" });
    const d = await r.json();
    setRows(d.rows ?? []);
  }
  useEffect(() => { load(); }, []);

  async function changePlan(userId: string, plan: string) {
    setBusy(userId);
    await fetch(`/api/admin/users/${userId}/plan`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    await load();
    setBusy(null);
  }
  async function credit(userId: string) {
    const amt = prompt("Credit amount in USD (e.g. 10 for $10)");
    if (!amt) return;
    const cents = Math.round(parseFloat(amt) * 100);
    if (!cents) return;
    const desc = prompt("Description (optional)") ?? "Admin credit";
    await fetch(`/api/admin/users/${userId}/credit`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount_cents: cents, description: desc }) });
    await load();
  }

  const totals = rows.reduce((acc, r) => {
    acc.users++;
    if (r.subscription.plan !== "free") acc.paid++;
    acc.mrr_cents += r.subscription.plan === "pro" ? 2000 : r.subscription.plan === "team" ? 5000 : 0;
    acc.invoiced_cents += r.invoices_total_cents;
    return acc;
  }, { users: 0, paid: 0, mrr_cents: 0, invoiced_cents: 0 });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-5 sm:px-7 py-8 max-w-[1280px] mx-auto">
      <PageHeader kicker="admin / billing" title="Subscriptions & revenue." lede="Manage every user's plan, override credits, see usage at a glance." />

      <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Users" value={totals.users} />
        <Stat label="Paying" value={totals.paid} accent="amber" />
        <Stat label="MRR" value={fmtMoney(totals.mrr_cents)} accent="moss" />
        <Stat label="Lifetime" value={fmtMoney(totals.invoiced_cents)} />
      </div>

      <div className="mt-10 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.5fr_140px_140px_140px_220px] px-5 py-3 border-b border-ink-line font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.16em]">
          <div>email</div><div>plan</div><div>messages</div><div>invoiced</div><div className="text-right">actions</div>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-paper-dim text-[15.5px]">No users yet.</div>
        ) : rows.map((r: any) => {
          const Icon = PLAN_ICONS[r.subscription.plan] ?? Zap;
          return (
            <div key={r.user.id} className="px-5 py-3 border-b border-ink-line last:border-b-0 grid md:grid-cols-[1.5fr_140px_140px_140px_220px] gap-2 md:gap-4 items-center text-[14.5px]">
              <div className="min-w-0">
                <div className="text-paper truncate">{r.user.email}</div>
                <div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint mt-0.5">{r.user.role}</div>
              </div>
              <div>
                <span className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] px-2 py-1 rounded ${
                  r.subscription.plan === "free" ? "bg-ink-line text-paper-faint" : r.subscription.plan === "pro" ? "bg-amber/15 text-amber" : r.subscription.plan === "team" ? "bg-plum/15 text-plum" : "bg-moss/15 text-moss"
                }`}>
                  <Icon size={10} /> {r.subscription.plan}
                </span>
              </div>
              <div className="font-[family-name:var(--font-mono)] text-[13.5px] text-paper-dim">{r.usage.messages.toLocaleString()}</div>
              <div className="font-[family-name:var(--font-mono)] text-[13.5px] text-paper">{fmtMoney(r.invoices_total_cents)}</div>
              <div className="text-right flex justify-end gap-1.5 flex-wrap">
                <select
                  defaultValue={r.subscription.plan}
                  disabled={busy === r.user.id}
                  onChange={(e) => changePlan(r.user.id, e.target.value)}
                  className="px-2 py-1 rounded text-[13px] bg-ink border border-ink-line text-paper-dim font-[family-name:var(--font-mono)]"
                >
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                  <option value="team">team</option>
                  <option value="enterprise">enterprise</option>
                </select>
                <button onClick={() => credit(r.user.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[13px] border border-amber/40 text-amber hover:bg-amber/10">
                  <DollarSign size={10} /> credit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div className="bg-ink-soft border border-ink-line rounded-xl px-5 py-5">
      <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.16em] mb-2">{label}</div>
      <div className={`font-[family-name:var(--font-display)] text-[34px] leading-none tracking-tight ${accent === "amber" ? "text-amber" : accent === "moss" ? "text-moss" : "text-paper"}`}>{value}</div>
    </div>
  );
}
