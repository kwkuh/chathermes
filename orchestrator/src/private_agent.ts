// ChatHermes — private_agent.ts
// Manages per-user private Hermes Agent deployments on Hetzner Cloud.
// Free users share the local :19002 proxy; paid users get dedicated servers.
// Copyright (c) 2026 Getid, Inc. and ChatHermes contributors.

import * as DB from "./db";

const HETZNER_API = "https://api.hetzner.cloud/v1";
const SHARED_ENDPOINT = process.env.SHARED_HERMES_ENDPOINT || "http://127.0.0.1:19002/v1";

export type PrivateAgentStatus = "none" | "pending" | "provisioning" | "ready" | "failed" | "marked_for_destruction";

export interface PrivateAgent {
  user_id: string;
  server_id: number | null;
  endpoint: string | null;
  status: PrivateAgentStatus;
  provisioned_at: number | null;
  error: string | null;
  ipv4: string | null;
}

function getHetznerToken(): string | null {
  const r = (DB.db as any).query("SELECT value FROM system_settings WHERE key = 'hetzner_api_token'").get() as any;
  return r?.value || process.env.HETZNER_API_TOKEN || null;
}

export function getPrivateAgent(userId: string): PrivateAgent | null {
  const r = (DB.db as any).query(
    "SELECT private_agent_server_id, private_agent_endpoint, private_agent_status, private_agent_provisioned_at, private_agent_error, private_agent_ipv4 FROM users WHERE id = ?"
  ).get(userId) as any;
  if (!r) return null;
  return {
    user_id: userId,
    server_id: r.private_agent_server_id || null,
    endpoint: r.private_agent_endpoint || null,
    status: (r.private_agent_status || "none") as PrivateAgentStatus,
    provisioned_at: r.private_agent_provisioned_at || null,
    error: r.private_agent_error || null,
    ipv4: r.private_agent_ipv4 || null,
  };
}

function setPrivateAgent(userId: string, patch: Partial<PrivateAgent>): void {
  const fields: string[] = [];
  const vals: any[] = [];
  const map: Record<string, string> = {
    server_id: "private_agent_server_id",
    endpoint: "private_agent_endpoint",
    status: "private_agent_status",
    provisioned_at: "private_agent_provisioned_at",
    error: "private_agent_error",
    ipv4: "private_agent_ipv4",
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) { fields.push(`${col} = ?`); vals.push((patch as any)[k]); }
  }
  if (!fields.length) return;
  vals.push(userId);
  (DB.db as any).run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, vals);
}

export function listAllPrivateAgents(): PrivateAgent[] {
  const rows = (DB.db as any).query(
    "SELECT id, private_agent_server_id, private_agent_endpoint, private_agent_status, private_agent_provisioned_at, private_agent_error, private_agent_ipv4 FROM users WHERE private_agent_status IS NOT NULL AND private_agent_status != 'none'"
  ).all() as any[];
  return rows.map((r) => ({
    user_id: r.id,
    server_id: r.private_agent_server_id || null,
    endpoint: r.private_agent_endpoint || null,
    status: (r.private_agent_status || "none") as PrivateAgentStatus,
    provisioned_at: r.private_agent_provisioned_at || null,
    error: r.private_agent_error || null,
    ipv4: r.private_agent_ipv4 || null,
  }));
}

/**
 * Decide endpoint for a user's hermes-agent request.
 * - free / no plan / private not ready → shared local proxy
 * - paid + private ready → user's private endpoint
 */
export function resolveHermesEndpoint(userId: string, plan: string): { endpoint: string; mode: "shared" | "private" } {
  if (plan === "free" || !plan) return { endpoint: SHARED_ENDPOINT, mode: "shared" };
  const pa = getPrivateAgent(userId);
  if (pa?.status === "ready" && pa.endpoint) return { endpoint: pa.endpoint, mode: "private" };
  return { endpoint: SHARED_ENDPOINT, mode: "shared" };
}

function buildPrivateCloudInit(opts: {
  user_id: string;
  agent_token: string;
  nous_api_key: string;
}): string {
  return `#cloud-config
package_update: true
package_upgrade: false
packages: [curl, ufw]
write_files:
  - path: /opt/hermes-proxy/proxy.ts
    permissions: '0644'
    content: |
      // ChatHermes — private hermes-agent proxy (per-user)
      // Listens on :19002, OpenAI-compatible, routes to Nous API.
      const PORT = 19002;
      const NOUS_KEY = process.env.NOUS_API_KEY!;
      const AGENT_TOKEN = process.env.AGENT_TOKEN!;
      const UPSTREAM_MODEL = process.env.UPSTREAM_MODEL || "Hermes-4-405B";
      const NOUS_URL = "https://inference-api.nousresearch.com/v1/chat/completions";
      const AGENTIC_PROMPT = "You are Hermes Agent — an autonomous agent. Tools: web_search, run_js, fetch_url, save_memory, recall_memory. Be concise, decisive, helpful.";
      Bun.serve({
        port: PORT, hostname: "0.0.0.0",
        async fetch(req) {
          const url = new URL(req.url);
          const auth = req.headers.get("authorization") || "";
          if (auth !== "Bearer " + AGENT_TOKEN) return new Response("unauthorized", { status: 401 });
          if (url.pathname === "/v1/models") return Response.json({ data: [{ id: "hermes-agent", object: "model" }] });
          if (url.pathname === "/v1/chat/completions") {
            const body: any = await req.json().catch(() => ({}));
            body.model = UPSTREAM_MODEL;
            body.messages = [{ role: "system", content: AGENTIC_PROMPT }, ...(body.messages || []).filter((m: any) => m.role !== "system")];
            const r = await fetch(NOUS_URL, { method: "POST", headers: { "Authorization": "Bearer " + NOUS_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
            return new Response(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json" } });
          }
          return new Response("not found", { status: 404 });
        },
      });
      console.log("private hermes-agent proxy listening on :" + PORT);
  - path: /etc/systemd/system/hermes-proxy.service
    permissions: '0644'
    content: |
      [Unit]
      Description=Private Hermes Agent Proxy
      After=network.target
      [Service]
      Environment=NOUS_API_KEY=${opts.nous_api_key}
      Environment=AGENT_TOKEN=${opts.agent_token}
      Environment=UPSTREAM_MODEL=Hermes-4-405B
      ExecStart=/usr/local/bin/bun run /opt/hermes-proxy/proxy.ts
      Restart=on-failure
      [Install]
      WantedBy=multi-user.target
runcmd:
  - curl -fsSL https://bun.sh/install | bash
  - cp /root/.bun/bin/bun /usr/local/bin/bun
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw allow 19002/tcp
  - ufw --force enable
  - systemctl daemon-reload
  - systemctl enable --now hermes-proxy
  - echo "private hermes agent ready for user ${opts.user_id}"
`;
}

/**
 * Provision a new Hetzner server running hermes-agent proxy for this user.
 * Triggered async when user upgrades to paid plan. Idempotent: skips if already provisioning/ready.
 */
export async function provisionPrivateAgent(userId: string): Promise<{ ok: boolean; error?: string }> {
  const token = getHetznerToken();
  if (!token) return { ok: false, error: "Hetzner token not configured (admin: /admin/hetzner)" };

  // Get user + check current state
  const u = DB.getUserById(userId);
  if (!u) return { ok: false, error: "user not found" };
  const existing = getPrivateAgent(userId);
  if (existing && (existing.status === "ready" || existing.status === "provisioning")) {
    return { ok: true, error: "already " + existing.status };
  }

  // Get default Nous key from providers DB or env
  const provider = (DB.db as any).query("SELECT api_key FROM providers WHERE base_url LIKE '%nousresearch%' AND api_key != '' LIMIT 1").get() as any;
  const nousKey = provider?.api_key || process.env.NOUS_API_KEY;
  if (!nousKey) return { ok: false, error: "no Nous API key available (admin: /admin/llm)" };

  // Generate per-agent shared secret
  const agentToken = crypto.randomUUID().replace(/-/g, "");
  const serverName = `chathermes-agent-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
  const cloudInit = buildPrivateCloudInit({ user_id: userId, agent_token: agentToken, nous_api_key: nousKey });

  setPrivateAgent(userId, { status: "provisioning", error: null });

  try {
    const resp = await fetch(`${HETZNER_API}/servers`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: serverName,
        server_type: "cpx11",
        location: "hil",  // Hillsboro OR — close to chathermes.com aicoid
        image: "ubuntu-24.04",
        user_data: cloudInit,
        labels: { app: "chathermes-private-agent", user_id: userId, plan: "paid" },
        start_after_create: true,
      }),
    });
    const data: any = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || `hetzner ${resp.status}`;
      setPrivateAgent(userId, { status: "failed", error: msg });
      return { ok: false, error: msg };
    }
    const ipv4 = data.server?.public_net?.ipv4?.ip;
    setPrivateAgent(userId, {
      server_id: data.server.id,
      ipv4: ipv4 || null,
      endpoint: ipv4 ? `http://${ipv4}:19002/v1` : null,
      status: "provisioning",
      provisioned_at: Date.now(),
    });

    // Store agent_token securely in system_settings keyed by user
    (DB.db as any).run(
      "INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      [`private_agent_token:${userId}`, agentToken, Date.now()]
    );

    // Schedule readiness check after 90s
    setTimeout(() => checkReadiness(userId).catch(() => {}), 90_000);

    DB.logActivity(userId, "private_agent.provisioned", { server_id: data.server.id, ipv4 });
    return { ok: true };
  } catch (e: any) {
    setPrivateAgent(userId, { status: "failed", error: e?.message || "provision threw" });
    return { ok: false, error: e?.message };
  }
}

/**
 * Probe the private agent endpoint; if responsive, mark ready.
 */
export async function checkReadiness(userId: string): Promise<boolean> {
  const pa = getPrivateAgent(userId);
  if (!pa?.endpoint) return false;
  const tokenRow = (DB.db as any).query("SELECT value FROM system_settings WHERE key = ?").get(`private_agent_token:${userId}`) as any;
  const agentToken = tokenRow?.value;
  if (!agentToken) return false;
  try {
    const r = await fetch(pa.endpoint + "/models", {
      headers: { "Authorization": `Bearer ${agentToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      setPrivateAgent(userId, { status: "ready", error: null });
      DB.logActivity(userId, "private_agent.ready", { endpoint: pa.endpoint });
      return true;
    }
  } catch { /* not ready yet */ }
  return false;
}

/**
 * Destroy private agent server (called on subscription cancellation after grace period).
 */
export async function destroyPrivateAgent(userId: string): Promise<{ ok: boolean; error?: string }> {
  const token = getHetznerToken();
  if (!token) return { ok: false, error: "Hetzner token not configured" };
  const pa = getPrivateAgent(userId);
  if (!pa?.server_id) {
    setPrivateAgent(userId, { status: "none", server_id: null, endpoint: null, ipv4: null });
    return { ok: true };
  }
  try {
    const resp = await fetch(`${HETZNER_API}/servers/${pa.server_id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!resp.ok && resp.status !== 204 && resp.status !== 404) {
      const data: any = await resp.json().catch(() => ({}));
      return { ok: false, error: data?.error?.message || `hetzner ${resp.status}` };
    }
    setPrivateAgent(userId, { status: "none", server_id: null, endpoint: null, ipv4: null, error: null });
    (DB.db as any).run("DELETE FROM system_settings WHERE key = ?", [`private_agent_token:${userId}`]);
    DB.logActivity(userId, "private_agent.destroyed", { server_id: pa.server_id });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
}

export function getAgentToken(userId: string): string | null {
  const r = (DB.db as any).query("SELECT value FROM system_settings WHERE key = ?").get(`private_agent_token:${userId}`) as any;
  return r?.value || null;
}

/** Mark a user as eligible for private agent provisioning (gated mode — admin must click). */
export function markPending(userId: string): void {
  const existing = getPrivateAgent(userId);
  if (existing && (existing.status === "ready" || existing.status === "provisioning")) return;
  setPrivateAgent(userId, { status: "pending", error: null });
  DB.logActivity(userId, "private_agent.pending", { gated: true });
}

/** Mark a private agent for destruction (called on subscription cancel; admin or cron sweeps it later). */
export function markForDestruction(userId: string): void {
  setPrivateAgent(userId, { status: "marked_for_destruction" as PrivateAgentStatus });
  DB.logActivity(userId, "private_agent.marked_for_destruction", {});
}

/** Cron sweep: destroy any agents marked_for_destruction older than 24h. */
export async function sweepDestroyMarked(): Promise<{ destroyed: number }> {
  const cutoff = Date.now() - 86_400_000; // 24h
  const rows = (DB.db as any).query(
    "SELECT id FROM users WHERE private_agent_status = 'marked_for_destruction' AND private_agent_provisioned_at < ?"
  ).all(cutoff) as any[];
  let n = 0;
  for (const r of rows) {
    const result = await destroyPrivateAgent(r.id);
    if (result.ok) n++;
  }
  return { destroyed: n };
}
