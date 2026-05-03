"use client";
import { useEffect, useState } from "react";
import { Cpu, Loader2, AlertTriangle, CheckCircle2, Trash2, Power, RefreshCw, Clock } from "lucide-react";

type Agent = {
  user_id: string;
  email?: string;
  plan?: string;
  sub_status?: string;
  server_id: number | null;
  endpoint: string | null;
  ipv4: string | null;
  status: "none" | "pending" | "provisioning" | "ready" | "failed" | "marked_for_destruction";
  provisioned_at: number | null;
  error: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  none: "bg-stone-700/40 text-stone-400 border-stone-600/40",
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  provisioning: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  ready: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  failed: "bg-red-500/20 text-red-300 border-red-500/40",
  marked_for_destruction: "bg-orange-500/20 text-orange-300 border-orange-500/40",
};

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  provisioning: Loader2,
  ready: CheckCircle2,
  failed: AlertTriangle,
  marked_for_destruction: Trash2,
  none: Power,
};

export default function PrivateAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState<boolean>(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/private-agents", { credentials: "include" });
      if (!r.ok) {
        if (r.status === 401) { window.location.href = "/auth/login"; return; }
        throw new Error("HTTP " + r.status);
      }
      const j = await r.json();
      setAgents(j.agents || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Auto-refresh every 5s while there are non-terminal statuses
    const interval = setInterval(async () => {
      // Probe readiness for any provisioning agents (server-side check)
      const provisioning = agents.filter(a => a.status === "provisioning");
      for (const a of provisioning) {
        await fetch(`/api/admin/private-agents/${a.user_id}/check`, { method: "POST", credentials: "include" }).catch(() => {});
      }
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, [agents.length, agents.map(a=>a.status).join(",")]);

  async function provision(userId: string) {
    if (!confirm(`Provision a dedicated Hetzner server for user ${userId.slice(0,8)}?`)) return;
    setBusy(userId);
    try {
      const r = await fetch(`/api/admin/private-agents/${userId}/provision`, { method: "POST", credentials: "include" });
      const j = await r.json();
      if (!r.ok) alert("Provision failed: " + (j.error || r.status));
      else alert("Provisioning started! Check back in ~90s.");
      await load();
    } finally { setBusy(null); }
  }

  async function check(userId: string) {
    setBusy(userId);
    try {
      const r = await fetch(`/api/admin/private-agents/${userId}/check`, { method: "POST", credentials: "include" });
      const j = await r.json();
      alert(j.ready ? "Ready ✓" : `Not ready yet (status: ${j.agent?.status})`);
      await load();
    } finally { setBusy(null); }
  }

  async function destroy(userId: string) {
    if (!confirm(`DESTROY this user's private agent server? This deletes the Hetzner server immediately.`)) return;
    setBusy(userId);
    try {
      const r = await fetch(`/api/admin/private-agents/${userId}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) alert("Destroy failed: " + (j.error || r.status));
      await load();
    } finally { setBusy(null); }
  }

  const grouped = {
    pending: agents.filter(a => a.status === "pending"),
    provisioning: agents.filter(a => a.status === "provisioning"),
    ready: agents.filter(a => a.status === "ready"),
    failed: agents.filter(a => a.status === "failed"),
    marked_for_destruction: agents.filter(a => a.status === "marked_for_destruction"),
  };

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber/15 border border-amber/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-amber" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[28px] tracking-[-0.015em]">Private Agents</h1>
            <p className="text-paper-dim text-[13px]">Per-user Hermes Agent fleet · Free tier shares the local proxy on :19002</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Auto-refreshing
          </span>
          <button onClick={load} className="px-3 py-2 text-[12px] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] border border-stone-600 hover:border-stone-400 rounded-md flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 mb-8 p-4 rounded-xl bg-amber/[0.06] border border-amber/30">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-amber mb-1">— gated mode</div>
        <p className="text-paper-dim text-[13px] leading-[1.55]">
          When a user upgrades to a paid plan, they appear in <span className="text-amber">pending</span> below. Click <strong className="text-paper">Provision</strong> to spawn a dedicated Hetzner Cloud server running their isolated Hermes Agent on <code className="text-[12px] text-amber/80 bg-amber/10 px-1.5 py-0.5 rounded">:19002</code>. Routing is automatic — paid users with <span className="text-emerald-400">ready</span> agents bypass the shared proxy.
        </p>
        <p className="text-paper-dim text-[12px] mt-2">
          To enable full auto-provisioning on Stripe webhook, set <code className="text-[11px] text-amber/80 bg-amber/10 px-1.5 py-0.5 rounded">AUTO_PROVISION_PRIVATE_AGENT=true</code> in <code className="text-[11px] text-amber/80">.env</code>.
        </p>
      </div>

      {loading ? (
        <div className="text-paper-dim text-[14px]">Loading fleet…</div>
      ) : agents.length === 0 ? (
        <div className="rounded-xl bg-stone-900/40 border border-stone-700/40 px-6 py-10 text-center">
          <div className="text-paper-dim text-[14px] mb-1">No private agents yet</div>
          <div className="text-stone-500 text-[12px]">Free users are sharing the local proxy on :19002. Paid signups will appear here for provisioning.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {(["pending","provisioning","ready","failed","marked_for_destruction"] as const).map((bucket) => {
            const list = grouped[bucket];
            if (list.length === 0) return null;
            return (
              <section key={bucket}>
                <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-paper-dim mb-2">
                  — {bucket.replace(/_/g," ")} ({list.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map((a) => {
                    const Icon = STATUS_ICON[a.status] || Power;
                    const isBusy = busy === a.user_id;
                    return (
                      <div key={a.user_id} className={"rounded-xl border px-4 py-3 " + STATUS_COLOR[a.status]}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`w-4 h-4 ${a.status === "provisioning" ? "animate-spin" : ""}`} />
                              <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em]">{a.status}</span>
                            </div>
                            <div className="font-medium text-paper text-[14px] truncate">{a.email || a.user_id.slice(0,12)}</div>
                            <div className="text-paper-dim text-[12px] mt-0.5">
                              Plan: <span className="text-paper">{a.plan || "—"}</span>
                              {a.sub_status && <span className="text-stone-500"> · {a.sub_status}</span>}
                            </div>
                            {a.ipv4 && <div className="text-paper-dim text-[11.5px] mt-1 font-[family-name:var(--font-mono)]">{a.ipv4}:19002</div>}
                            {a.error && <div className="text-red-300/80 text-[11.5px] mt-1.5 line-clamp-2">⚠ {a.error}</div>}
                            {a.provisioned_at && <div className="text-stone-500 text-[10.5px] mt-1">since {new Date(a.provisioned_at).toLocaleString()}</div>}
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {(a.status === "pending" || a.status === "failed" || a.status === "none") && (
                              <button onClick={() => provision(a.user_id)} disabled={isBusy} className="px-2.5 py-1 text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded text-emerald-200 disabled:opacity-50">
                                {isBusy ? "…" : "Provision"}
                              </button>
                            )}
                            {a.status === "provisioning" && (
                              <button onClick={() => check(a.user_id)} disabled={isBusy} className="px-2.5 py-1 text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 rounded text-blue-200 disabled:opacity-50">
                                {isBusy ? "…" : "Check"}
                              </button>
                            )}
                            {(a.status === "ready" || a.status === "marked_for_destruction") && (
                              <button onClick={() => destroy(a.user_id)} disabled={isBusy} className="px-2.5 py-1 text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-[0.12em] bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded text-red-200 disabled:opacity-50">
                                {isBusy ? "…" : "Destroy"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
