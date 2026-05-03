import { adminFetch } from "@/lib/auth";
import PageHeader from "../app/_components/page-header";
import { Users, Boxes, Activity, AlertTriangle, Mail, Send, Eye, AlertCircle } from "lucide-react";

type Stats = { users_total: number; tenants_total: number; tenants_running: number; tenants_hibernated: number; tenants_error: number };
type EmailStats = { total: number; delivered: number; bounced: number; opened: number; complained: number; last_24h: number };
type EmailRow = { id: string; to_email: string; template: string; subject: string; status: string; created_at: number };

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

function fmtRel(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default async function AdminOverview() {
  const [stats, emailRes] = await Promise.all([
    adminFetch<Stats>("/api/admin/stats").catch(() => null),
    adminFetch<{ emails: EmailRow[]; stats: EmailStats }>("/api/admin/email/log?limit=8").catch(() => null),
  ]);

  const s = stats ?? { users_total: 0, tenants_total: 0, tenants_running: 0, tenants_hibernated: 0, tenants_error: 0 };
  const es = emailRes?.stats ?? { total: 0, delivered: 0, bounced: 0, opened: 0, complained: 0, last_24h: 0 };
  const recentEmails = emailRes?.emails ?? [];
  const successPct = es.total > 0 ? Math.round(((es.total - es.bounced - es.complained) / es.total) * 100) : 100;

  return (
    <div className="px-4 sm:px-7 py-6 sm:py-8 max-w-[1180px] mx-auto">
      <PageHeader kicker="admin / overview" title="Operate ChatHermes." lede="Live cluster of per-user Hermes Agents. Numbers update in real time." />

      {/* Top stats row — cluster + email */}
      <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <Stat icon={Users} label="Users" value={s.users_total} accent="paper" />
        <Stat icon={Boxes} label="Tenants" value={s.tenants_total} accent="paper" />
        <Stat icon={Activity} label="Running" value={s.tenants_running} accent="moss" />
        <Stat icon={AlertTriangle} label="Errored" value={s.tenants_error} accent={s.tenants_error > 0 ? "rust" : "paper"} />
        <Stat icon={Mail} label="Emails 24h" value={es.last_24h} accent="amber" />
        <Stat icon={Send} label="Email success" value={`${successPct}%`} accent={successPct >= 95 ? "moss" : successPct >= 80 ? "amber" : "rust"} />
      </div>

      {/* Two-column section */}
      <section className="mt-10 sm:mt-14 grid lg:grid-cols-2 gap-3">
        <Block kicker="cluster" title="Capacity">
          <Bar label="Tenants running" value={s.tenants_running} max={Math.max(s.tenants_total, 10)} color="bg-amber" />
          <Bar label="Hibernated" value={s.tenants_hibernated} max={Math.max(s.tenants_total, 10)} color="bg-paper-dim" />
          <Bar label="Errored" value={s.tenants_error} max={Math.max(s.tenants_total, 10)} color="bg-rust" />
        </Block>

        <Block kicker="email" title="Deliverability">
          <Bar label="Total sent" value={es.total} max={Math.max(es.total, 50)} color="bg-amber" />
          <Bar label="Delivered" value={es.delivered} max={Math.max(es.total, 50)} color="bg-moss" />
          <Bar label="Opened" value={es.opened} max={Math.max(es.total, 50)} color="bg-plum" />
          {es.bounced > 0 || es.complained > 0 ? (
            <Bar label="Bounced / complained" value={es.bounced + es.complained} max={Math.max(es.total, 50)} color="bg-rust" />
          ) : null}
        </Block>
      </section>

      {/* Recent emails — real data */}
      <section className="mt-8 sm:mt-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-amber" />
            <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em]">— recent emails</div>
          </div>
          <a href="/admin/email" className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim hover:text-paper uppercase tracking-[0.16em]">view all →</a>
        </div>
        <div className="bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
          {recentEmails.length === 0 ? (
            <div className="px-5 py-10 text-center text-paper-faint text-[14px]">No emails sent yet. Test from <a href="/admin/email" className="text-amber hover:underline">/admin/email</a>.</div>
          ) : recentEmails.map((e) => (
            <div key={e.id} className="px-4 sm:px-5 py-3 border-b border-ink-line last:border-b-0">
              <div className="md:hidden flex flex-col gap-1.5 text-[13px]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-paper-dim">{e.template}</span>
                  <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${STATUS_COLOR[e.status] || STATUS_COLOR.queued}`}>{e.status}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint ml-auto">{fmtRel(e.created_at)}</span>
                </div>
                <div className="text-paper truncate" title={e.subject}>{e.subject}</div>
                <div className="font-[family-name:var(--font-mono)] text-[11px] text-paper-dim truncate">{e.to_email}</div>
              </div>
              <div className="hidden md:grid grid-cols-[160px_1fr_180px_100px_80px] gap-3 items-center text-[13.5px]">
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-paper-dim truncate">{e.template}</span>
                <span className="text-paper truncate" title={e.subject}>{e.subject}</span>
                <span className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim truncate">{e.to_email}</span>
                <span>
                  <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${STATUS_COLOR[e.status] || STATUS_COLOR.queued}`}>{e.status}</span>
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint text-right">{fmtRel(e.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  const colorMap: Record<string, string> = { paper: "text-paper", moss: "text-moss", rust: "text-rust", amber: "text-amber" };
  const valueColor = colorMap[accent] || "text-paper";
  return (
    <div className="bg-ink-soft border border-ink-line rounded-xl px-3 sm:px-4 py-3 sm:py-4">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <Icon size={14} className={accent === "rust" ? "text-rust" : accent === "moss" ? "text-moss" : accent === "amber" ? "text-amber" : "text-paper-dim"} />
        <span className="font-[family-name:var(--font-mono)] text-[9.5px] sm:text-[10.5px] text-paper-faint uppercase tracking-[0.14em] sm:tracking-[0.16em]">{label}</span>
      </div>
      <div className={`font-[family-name:var(--font-display)] text-[28px] sm:text-[36px] leading-none tracking-tight ${valueColor}`}>{value}</div>
    </div>
  );
}

function Block({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ink-soft border border-ink-line rounded-xl px-6 py-6">
      <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.18em] mb-2">— {kicker}</div>
      <h3 className="font-[family-name:var(--font-display)] text-[26px] leading-[1.1] tracking-[-0.02em] mb-5">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(2, (value / Math.max(max, 1)) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-paper-dim text-[14px]">{label}</span>
        <span className="font-[family-name:var(--font-mono)] text-[13.5px] text-paper">{value} / {max}</span>
      </div>
      <div className="h-2 bg-ink-line rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
