// ChatHermes — deploy.ts
// Copyright (c) 2026 Getid, Inc. and ChatHermes contributors.
// Licensed under the ChatHermes Open Source License v1.0 (see LICENSE.md).
// One-click deploy to Hetzner Cloud.
//
// Flow:
//   1. User provides Hetzner API token (passed-through, never stored)
//   2. We POST /v1/servers with cloud-init user_data
//   3. cloud-init bootstraps Docker + clones ChatHermes repo + writes .env
//   4. ~90 seconds later: ChatHermes is reachable at the new server IP

const HETZNER_API = "https://api.hetzner.cloud/v1";

// ── Helpers ─────────────────────────────────────────────────────────

async function hetzner(token: string, path: string, init?: RequestInit) {
  const r = await fetch(`${HETZNER_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "ChatHermes-Deploy/1.0 (https://chathermes.com)",
      ...(init?.headers || {}),
    },
  });
  const body = await r.text();
  let parsed: any;
  try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }
  if (!r.ok) throw new Error(parsed?.error?.message || `Hetzner ${r.status}: ${body.slice(0, 200)}`);
  return parsed;
}

// ── Public catalogue (cached, no auth needed via our backend) ───────

export async function listServerTypes(token: string) {
  const r = await hetzner(token, "/server_types?per_page=50");
  // Filter to recommended sizes for ChatHermes (≥2GB RAM)
  return (r.server_types || [])
    .filter((s: any) => s.memory >= 2)
    .map((s: any) => ({
      id: s.id,
      name: s.name,
      cores: s.cores,
      memory_gb: s.memory,
      disk_gb: s.disk,
      cpu_type: s.cpu_type,
      monthly_eur: s.prices?.[0]?.price_monthly?.gross,
      hourly_eur: s.prices?.[0]?.price_hourly?.gross,
    }))
    .sort((a: any, b: any) => parseFloat(a.monthly_eur) - parseFloat(b.monthly_eur));
}

export async function listLocations(token: string) {
  const r = await hetzner(token, "/locations");
  return (r.locations || []).map((l: any) => ({
    name: l.name,
    description: l.description,
    city: l.city,
    country: l.country,
  }));
}

// ── Cloud-init script ───────────────────────────────────────────────

export function buildCloudInit(opts: {
  hostname: string;
  publicBaseUrl: string;
  sessionSecret: string;
  llmKeys: { nous?: string; kimi?: string; anthropic?: string; openai?: string };
  resendKey?: string;
  resendFrom?: string;
  stripeSecret?: string;
  domain?: string;
  enableCaddy?: boolean;
  repoUrl?: string;
}): string {
  const repo = opts.repoUrl || "https://github.com/chathermes/chathermes.git";

  // Build env block
  const envLines: string[] = [
    `PUBLIC_BASE_URL=${opts.publicBaseUrl}`,
    `SESSION_SECRET=${opts.sessionSecret}`,
    `NODE_ENV=production`,
    `DATA_ROOT=/data`,
    `PORT=7010`,
    `ORCH_URL=http://orch:7010`,
  ];
  if (opts.llmKeys.nous) envLines.push(`NOUS_API_KEY=${opts.llmKeys.nous}`);
  if (opts.llmKeys.kimi) envLines.push(`KIMI_API_KEY=${opts.llmKeys.kimi}`);
  if (opts.llmKeys.anthropic) envLines.push(`ANTHROPIC_API_KEY=${opts.llmKeys.anthropic}`);
  if (opts.llmKeys.openai) envLines.push(`OPENAI_API_KEY=${opts.llmKeys.openai}`);
  if (opts.resendKey) envLines.push(`RESEND_API_KEY=${opts.resendKey}`);
  if (opts.resendFrom) envLines.push(`RESEND_FROM=${opts.resendFrom}`);
  if (opts.stripeSecret) envLines.push(`STRIPE_SECRET_KEY=${opts.stripeSecret}`);
  envLines.push(`DEFAULT_MODEL=${opts.llmKeys.kimi ? "moonshotai/kimi-k2.6" : "nousresearch/hermes-4-405b"}`);

  const envContent = envLines.join("\n");

  // Cloud-init YAML — 32KB max, keep tight
  const caddyBlock = opts.enableCaddy && opts.domain ? `
  - apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  - apt-get update
  - apt-get install -y caddy
  - |
    cat > /etc/caddy/Caddyfile <<'CADDY'
    ${opts.domain} {
      reverse_proxy localhost:7000 {
        flush_interval -1
      }
    }
    CADDY
  - systemctl restart caddy
` : "";

  return `#cloud-config
package_update: true
package_upgrade: false
packages:
  - docker.io
  - docker-compose-plugin
  - git
  - curl

write_files:
  - path: /opt/chathermes/.env
    permissions: '0600'
    content: |
${envContent.split("\n").map((l) => "      " + l).join("\n")}

runcmd:
  - systemctl enable --now docker
  - mkdir -p /opt/chathermes/data
  - cd /opt/chathermes
  - git clone ${repo} repo
  - cp -r repo/. .
  - rm -rf repo
  - docker compose up -d --build
${caddyBlock}
  - echo "ChatHermes deployed at $(date -u)" > /opt/chathermes/.deployed_at

final_message: "ChatHermes is deploying. Open http://$(hostname -I | awk '{print $1}'):7000 in ~90 seconds."
`;
}

// ── Provision a new server ──────────────────────────────────────────

export type DeployRequest = {
  token: string;
  server_type: string;     // e.g. "cx22"
  location: string;        // e.g. "nbg1"
  ssh_key_ids?: number[];  // existing keys in user's account
  domain?: string;         // optional — enables Caddy + auto-HTTPS
  name?: string;
  llm_keys: { nous?: string; kimi?: string; anthropic?: string; openai?: string };
  resend_key?: string;
  stripe_secret?: string;
};

export async function deployToHetzner(req: DeployRequest) {
  if (!req.token) throw new Error("Hetzner API token required");
  if (Object.values(req.llm_keys).every((k) => !k)) {
    throw new Error("At least one LLM API key required (Nous, Kimi, Anthropic, or OpenAI)");
  }

  const name = (req.name || `chathermes-${Math.random().toString(36).slice(2, 8)}`)
    .toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const sessionSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  // Public URL: domain if provided, otherwise placeholder (cloud-init will inject IP)
  const publicBaseUrl = req.domain ? `https://${req.domain}` : `http://_PLACEHOLDER_:7000`;

  const userData = buildCloudInit({
    hostname: name,
    publicBaseUrl,
    sessionSecret,
    llmKeys: req.llm_keys,
    resendKey: req.resend_key,
    stripeSecret: req.stripe_secret,
    domain: req.domain,
    enableCaddy: !!req.domain,
  });

  const body: any = {
    name,
    server_type: req.server_type,
    image: "ubuntu-24.04",
    location: req.location,
    user_data: userData,
    start_after_create: true,
    labels: { app: "chathermes", deployed_by: "chathermes.com" },
  };
  if (req.ssh_key_ids?.length) body.ssh_keys = req.ssh_key_ids;

  const resp = await hetzner(req.token, "/servers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const server = resp.server;
  const action = resp.action;

  return {
    server_id: server.id,
    name: server.name,
    ipv4: server.public_net?.ipv4?.ip,
    ipv6: server.public_net?.ipv6?.ip,
    status: server.status,
    location: server.datacenter?.location?.name,
    server_type: server.server_type?.name,
    action_id: action?.id,
    estimated_url: req.domain
      ? `https://${req.domain}`
      : `http://${server.public_net?.ipv4?.ip}:7000`,
    ssh_command: `ssh root@${server.public_net?.ipv4?.ip}`,
  };
}

export async function getDeployStatus(token: string, serverId: number) {
  const r = await hetzner(token, `/servers/${serverId}`);
  const s = r.server;
  return {
    id: s.id,
    name: s.name,
    status: s.status,           // initializing, starting, running, off, deleting
    ipv4: s.public_net?.ipv4?.ip,
    created: s.created,
    estimated_url: `http://${s.public_net?.ipv4?.ip}:7000`,
  };
}

export async function listSshKeys(token: string) {
  const r = await hetzner(token, "/ssh_keys");
  return (r.ssh_keys || []).map((k: any) => ({ id: k.id, name: k.name, fingerprint: k.fingerprint }));
}
