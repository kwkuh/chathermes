// ChatHermes — tenants.ts
// Copyright (c) 2026 Getid, Inc. and ChatHermes contributors.
// Licensed under the ChatHermes Open Source License v1.0 (see LICENSE.md).
// REQUIRED ATTRIBUTION: removing this header or the X-Powered-By emission in
// index.ts violates §2 of the license. See https://chathermes.com.

import { spawn } from "node:child_process";
import { mkdirSync, chownSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import * as DB from "./db";

const ENGINE_UID = Number(process.env.ENGINE_UID ?? 1025);
const ENGINE_GID = Number(process.env.ENGINE_GID ?? 1025);

const DATA_ROOT = process.env.DATA_ROOT ?? "/opt/chathermes/data";
const PORT_START = Number(process.env.TENANT_PORT_START ?? 7100);
const PORT_END = Number(process.env.TENANT_PORT_END ?? 7999);
const ENGINE_IMAGE = process.env.ENGINE_IMAGE ?? "chathermes/engine:latest";
const KIMI_API_KEY = process.env.KIMI_API_KEY ?? "";
const KIMI_BASE_URL = process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "kimi-k2-0711-preview";

function sh(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code: code ?? 0, stdout: out, stderr: err }));
  });
}

export async function ensureTenant(userId: string): Promise<DB.Tenant> {
  const existing = DB.getTenantByUserId(userId);
  if (existing) return existing;
  const port = DB.allocatePort(PORT_START, PORT_END);
  const password = randomBytes(24).toString("hex");
  const tenant = DB.createTenant(userId, port, password);
  const home = join(DATA_ROOT, tenant.id, ".hermes");
  const stateDir = join(DATA_ROOT, tenant.id, "state");
  mkdirSync(home, { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  try {
    chownSync(home, ENGINE_UID, ENGINE_GID);
    chownSync(stateDir, ENGINE_UID, ENGINE_GID);
    chownSync(join(DATA_ROOT, tenant.id), ENGINE_UID, ENGINE_GID);
  } catch (e) {
    console.warn(`[tenant ${tenant.id}] chown failed:`, (e as Error).message);
  }
  return tenant;
}

export async function startTenant(tenant: DB.Tenant): Promise<DB.Tenant> {
  const home = join(DATA_ROOT, tenant.id, ".hermes");
  const stateDir = join(DATA_ROOT, tenant.id, "state");
  const containerName = `chathermes-engine-${tenant.id.slice(0, 8)}`;

  await sh("docker", ["rm", "-f", containerName]);

  const args = [
    "run", "-d", "--name", containerName,
    "--restart", "unless-stopped",
    "-p", `127.0.0.1:${tenant.port}:8787`,
    "-e", `HERMES_WEBUI_PORT=8787`,
    "-e", `HERMES_WEBUI_HOST=0.0.0.0`,
    "-e", `HERMES_WEBUI_PASSWORD=${tenant.password}`,
    "-e", `HERMES_HOME=/data/.hermes`,
    "-e", `HERMES_WEBUI_STATE_DIR=/data/state`,
    "-e", `HERMES_WEBUI_DEFAULT_MODEL=${DEFAULT_MODEL}`,
    "-e", `OPENAI_API_KEY=${KIMI_API_KEY}`,
    "-e", `OPENAI_BASE_URL=${KIMI_BASE_URL}`,
    "-v", `${home}:/data/.hermes`,
    "-v", `${stateDir}:/data/state`,
    "--memory", "512m",
    "--cpus", "0.5",
    ENGINE_IMAGE,
  ];

  const r = await sh("docker", args);
  if (r.code !== 0) {
    DB.updateTenantStatus(tenant.id, "error");
    throw new Error(`docker run failed: ${r.stderr}`);
  }
  const containerId = r.stdout.trim();
  DB.updateTenantStatus(tenant.id, "running", containerId);
  return { ...tenant, container_id: containerId, status: "running" };
}

export async function hibernateTenant(tenant: DB.Tenant) {
  if (!tenant.container_id) return;
  await sh("docker", ["stop", tenant.container_id]);
  DB.updateTenantStatus(tenant.id, "hibernated");
}

export async function wakeTenant(tenant: DB.Tenant): Promise<DB.Tenant> {
  if (tenant.status === "running") return tenant;
  if (tenant.container_id) {
    const r = await sh("docker", ["start", tenant.container_id]);
    if (r.code === 0) {
      DB.updateTenantStatus(tenant.id, "running");
      return { ...tenant, status: "running" };
    }
  }
  return startTenant(tenant);
}
