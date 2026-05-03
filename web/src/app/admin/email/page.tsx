"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Mail, Send, Globe, AlertCircle, Check, X, Copy, RefreshCw, Eye, MousePointerClick, AlertTriangle } from "lucide-react";

const TEMPLATES = [
  { id: "magic_link", label: "Magic Link", group: "auth" },
  { id: "email_verification", label: "Email Verification", group: "auth" },
  { id: "sign_in_alert", label: "Sign-in Alert", group: "auth" },
  { id: "welcome", label: "Welcome", group: "onboarding" },
  { id: "project_published", label: "Project Published", group: "project" },
  { id: "job_done", label: "Long Job Done", group: "agent" },
  { id: "overnight_digest", label: "Overnight Digest", group: "agent" },
  { id: "order", label: "Order Confirmation", group: "billing" },
  { id: "subscription_updated", label: "Subscription Updated", group: "billing" },
  { id: "subscription_canceled", label: "Subscription Canceled", group: "billing" },
  { id: "renewal_reminder", label: "Renewal Reminder (3d)", group: "billing" },
  { id: "invoice_paid", label: "Invoice Paid", group: "billing" },
  { id: "invoice_failed", label: "Invoice Failed", group: "billing" },
  { id: "trial_ending", label: "Trial Ending", group: "billing" },
  { id: "usage_warning", label: "Usage Warning (80%)", group: "usage" },
  { id: "usage_limit", label: "Usage Limit Hit", group: "usage" },
  { id: "weekly_digest", label: "Weekly Digest", group: "engagement" },
  { id: "account_disabled", label: "Account Disabled", group: "account" },
  { id: "account_reactivated", label: "Account Reactivated", group: "account" },
];

const GROUP_COLOR: Record<string, string> = {
  auth: "bg-amber/15 text-amber border-amber/30",
  onboarding: "bg-moss/15 text-moss border-moss/30",
  project: "bg-plum/15 text-plum border-plum/30",
  agent: "bg-sky/15 text-sky border-sky/30",
  billing: "bg-amber/15 text-amber-soft border-amber/30",
  usage: "bg-rust/15 text-rust border-rust/30",
  engagement: "bg-sage/15 text-sage border-sage/30",
  account: "bg-paper-faint/10 text-paper-dim border-paper-faint/20",
};

const STATUS_COLOR: Record<string, string> = {
  sent: "bg-sage/15 text-sage",
  delivered: "bg-moss/15 text-moss",
  opened: "bg-plum/15 text-plum",
  clicked: "bg-amber/15 text-amber",
  bounced: "bg-rust/15 text-rust",
  complained: "bg-rust/15 text-rust",
  failed: "bg-rust/15 text-rust",
  queued: "bg-paper-faint/10 text-paper-dim",
};

function fmtTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminEmailPage() {
  const [stats, setStats] = useState<any>({ total: 0, delivered: 0, bounced: 0, opened: 0, complained: 0, last_24h: 0 });
  const [emails, setEmails] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [testTo, setTestTo] = useState<string>("");
  const [testTemplate, setTestTemplate] = useState<string>("welcome");
  const [newDomain, setNewDomain] = useState<string>("");
  const [pendingRecords, setPendingRecords] = useState<any[] | null>(null);

  async function loadAll() {
    try {
      const [logRes, domRes] = await Promise.all([
        fetch("/api/admin/email/log", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/email/domains", { credentials: "include" }).then((r) => r.json()),
      ]);
      setEmails(logRes.emails || []);
      setStats(logRes.stats || stats);
      setDomains(domRes.domains || []);
    } catch (e: any) {
      setFlash({ kind: "err", msg: e?.message || "Load failed" });
    }
  }
  useEffect(() => { loadAll(); }, []);

  async function sendTest() {
    setBusy("test");
    setFlash(null);
    try {
      const r = await fetch("/api/admin/email/test", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: testTemplate, to: testTo || undefined }),
      });
      const j = await r.json();
      if (j.ok) setFlash({ kind: "ok", msg: `Sent — ID ${j.id?.slice(0, 8)}…` });
      else setFlash({ kind: "err", msg: j.error || "Send failed" });
      await loadAll();
    } finally { setBusy(null); }
  }

  async function setupDomain() {
    if (!newDomain) return;
    setBusy("domain");
    setFlash(null);
    try {
      const r = await fetch("/api/admin/email/domain/setup", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDomain }),
      });
      const j = await r.json();
      if (j.ok && j.records) {
        setPendingRecords(j.records);
        setFlash({ kind: "ok", msg: "Domain created — add the DNS records below, then click Verify." });
      } else {
        setFlash({ kind: "err", msg: j.error || "Domain create failed" });
      }
      await loadAll();
    } finally { setBusy(null); }
  }

  async function verifyDomain(id: string) {
    setBusy("verify-" + id);
    try {
      const r = await fetch(`/api/admin/email/domain/${id}/verify`, { method: "POST", credentials: "include" });
      const j = await r.json();
      setFlash({ kind: j.ok ? "ok" : "err", msg: j.ok ? `Verification triggered (status: ${j.status || "pending"})` : (j.error || "Failed") });
      await loadAll();
    } finally { setBusy(null); }
  }

  function copy(s: string) {
    navigator.clipboard.writeText(s).then(() => setFlash({ kind: "ok", msg: "Copied" }));
  }

  const successPct = stats.total > 0 ? Math.round(((stats.total - stats.bounced - stats.complained) / stats.total) * 100) : 100;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-4 sm:px-7 py-6 sm:py-8 max-w-[1280px] mx-auto">
      <div className="mb-6 sm:mb-8">
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] sm:text-[12px] text-amber uppercase tracking-[0.18em] mb-2">— admin · email</div>
        <div className="font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] leading-tight">Email automation.</div>
        <div className="text-paper-dim text-[14px] sm:text-[15px] mt-1.5">Templates, delivery log, and domain manager — powered by Resend.</div>
      </div>

      {flash ? (
        <div className={`mb-6 px-5 py-3 rounded-lg flex items-center gap-3 ${flash.kind === "ok" ? "bg-moss/10 border border-moss/30 text-moss" : "bg-rust/10 border border-rust/30 text-rust"}`}>
          {flash.kind === "ok" ? <Check size={16} /> : <AlertCircle size={16} />}
          <div className="flex-1 text-[14px]">{flash.msg}</div>
          <button onClick={() => setFlash(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 mb-8 sm:mb-10">
        <Stat label="total sent" value={stats.total} icon={Mail} />
        <Stat label="last 24h" value={stats.last_24h} icon={Send} />
        <Stat label="delivered" value={stats.delivered} icon={Check} accent="moss" />
        <Stat label="opened" value={stats.opened} icon={Eye} accent="plum" />
        <Stat label="bounced" value={stats.bounced} icon={AlertTriangle} accent="rust" />
        <Stat label="success" value={`${successPct}%`} icon={MousePointerClick} accent="amber" />
      </div>

      {/* Two columns: Test sender + Domain manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-10">
        {/* Send a test */}
        <div className="bg-ink-soft border border-ink-line rounded-2xl px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Send size={14} className="text-amber" />
            <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— send test</div>
          </div>
          <label className="block text-[13px] text-paper-dim mb-1.5">Template</label>
          <select
            value={testTemplate}
            onChange={(e) => setTestTemplate(e.target.value)}
            className="w-full mb-3 bg-ink border border-ink-line rounded-md px-3 py-2 text-paper text-[14px] focus:border-amber outline-none"
          >
            {Object.entries(TEMPLATES.reduce((acc: Record<string, typeof TEMPLATES>, t) => {
              (acc[t.group] = acc[t.group] || []).push(t); return acc;
            }, {})).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
          <label className="block text-[13px] text-paper-dim mb-1.5">To (leave empty = your own email)</label>
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full mb-4 bg-ink border border-ink-line rounded-md px-3 py-2 text-paper text-[14px] focus:border-amber outline-none"
          />
          <button
            onClick={sendTest}
            disabled={busy === "test"}
            className="w-full px-4 py-2.5 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy === "test" ? "Sending…" : <>Send test <Send size={13} /></>}
          </button>
        </div>

        {/* Domain manager */}
        <div className="bg-ink-soft border border-ink-line rounded-2xl px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-amber" />
              <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— domains</div>
            </div>
            <button onClick={loadAll} className="text-paper-faint hover:text-paper" title="Refresh"><RefreshCw size={13} /></button>
          </div>

          <div className="space-y-2 mb-4 max-h-[180px] overflow-y-auto">
            {domains.length === 0 ? (
              <div className="text-paper-faint text-[14px] py-3">No domains yet. Add one below.</div>
            ) : domains.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between px-3 py-2.5 bg-ink rounded-md border border-ink-line">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-[family-name:var(--font-mono)] text-[13.5px] text-paper truncate">{d.name}</span>
                  <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${
                    d.status === "verified" ? "bg-moss/15 text-moss" : d.status === "pending" ? "bg-amber/15 text-amber" : "bg-rust/15 text-rust"
                  }`}>{d.status}</span>
                </div>
                {d.status !== "verified" && (
                  <button
                    onClick={() => verifyDomain(d.id)}
                    disabled={busy === `verify-${d.id}`}
                    className="px-2.5 py-1 text-[12.5px] rounded border border-ink-line text-paper-dim hover:text-paper hover:border-paper-faint"
                  >
                    {busy === `verify-${d.id}` ? "…" : "Verify"}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="flex-1 bg-ink border border-ink-line rounded-md px-3 py-2 text-paper text-[14px] focus:border-amber outline-none"
            />
            <button
              onClick={setupDomain}
              disabled={busy === "domain" || !newDomain}
              className="px-4 py-2 rounded-md bg-amber text-ink text-[14px] font-medium hover:bg-amber-soft disabled:opacity-50"
            >
              {busy === "domain" ? "…" : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Pending DNS records */}
      {pendingRecords ? (
        <div className="mb-8 sm:mb-10 bg-ink-soft border border-amber/30 rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
          <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em] mb-3">— add these DNS records to verify</div>
          <div className="space-y-2">
            {pendingRecords.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-[60px_1fr_28px] sm:grid-cols-[80px_1fr_60px] gap-2 sm:gap-3 px-3 py-2.5 bg-ink rounded-md border border-ink-line items-center">
                <span className="font-[family-name:var(--font-mono)] text-[10.5px] sm:text-[11px] uppercase tracking-[0.14em] text-amber">{r.record}</span>
                <div className="font-[family-name:var(--font-mono)] text-[11.5px] sm:text-[12px] text-paper-dim truncate min-w-0">
                  <span className="text-paper">{r.name}</span> <span className="text-paper-faint">→</span> <span>{r.value}</span>
                </div>
                <button onClick={() => copy(`${r.name}\t${r.value}`)} className="text-paper-faint hover:text-paper shrink-0"><Copy size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Email log table */}
      <div className="flex items-center gap-2 mb-3">
        <Mail size={14} className="text-amber" />
        <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— recent emails ({emails.length})</div>
      </div>
      <div className="bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        {emails.length === 0 ? (
          <div className="px-5 py-12 text-center text-paper-faint text-[14.5px]">No emails sent yet. Try the test sender above.</div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[180px_1fr_220px_120px_140px] px-5 py-3 border-b border-ink-line font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.14em]">
              <div>template</div>
              <div>subject</div>
              <div>to</div>
              <div>status</div>
              <div className="text-right">when</div>
            </div>
            {emails.map((e: any) => (
              <div key={e.id} className="px-4 sm:px-5 py-3 border-b border-ink-line last:border-b-0">
                <div className="md:hidden flex flex-col gap-1.5 text-[13px]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${GROUP_COLOR[TEMPLATES.find((t) => t.id === e.template)?.group ?? "auth"] || GROUP_COLOR.auth}`}>{e.template}</span>
                    <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${STATUS_COLOR[e.status] || STATUS_COLOR.queued}`}>{e.status}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint ml-auto">{fmtTime(e.created_at)}</span>
                  </div>
                  <div className="text-paper truncate" title={e.subject}>{e.subject}</div>
                  <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim truncate">{e.to_email}</div>
                </div>
                <div className="hidden md:grid grid-cols-[180px_1fr_220px_120px_140px] gap-3 items-center text-[13.5px]">
                  <div>
                    <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${GROUP_COLOR[TEMPLATES.find((t) => t.id === e.template)?.group ?? "auth"] || GROUP_COLOR.auth}`}>{e.template}</span>
                  </div>
                  <div className="text-paper truncate" title={e.subject}>{e.subject}</div>
                  <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper-dim truncate">{e.to_email}</div>
                  <div>
                    <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${STATUS_COLOR[e.status] || STATUS_COLOR.queued}`}>{e.status}</span>
                  </div>
                  <div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint text-right">{fmtTime(e.created_at)}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ label, value, icon: Icon, accent = "amber" }: { label: string; value: any; icon: any; accent?: string }) {
  const colorMap: Record<string, string> = { amber: "text-amber", moss: "text-moss", rust: "text-rust", plum: "text-plum" };
  return (
    <div className="bg-ink-soft border border-ink-line rounded-xl px-4 py-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <Icon size={12} className={colorMap[accent] || "text-amber"} />
      </div>
      <div className="font-[family-name:var(--font-display)] text-[26px] leading-none tracking-tight text-paper">{value}</div>
      <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.16em] mt-1">{label}</div>
    </div>
  );
}
