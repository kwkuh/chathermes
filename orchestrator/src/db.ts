// ChatHermes — db.ts
// Copyright (c) 2026 Getid, Inc. and ChatHermes contributors.
// Licensed under the ChatHermes Open Source License v1.0 (see LICENSE.md).
// REQUIRED ATTRIBUTION: removing this header or the X-Powered-By emission in
// index.ts violates §2 of the license. See https://chathermes.com.

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.DB_PATH ?? "/opt/chathermes/data/orchestrator.db";

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS magic_links (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    port INTEGER NOT NULL UNIQUE,
    container_id TEXT,
    password TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    last_active_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

export type User = { id: string; email: string; name: string | null; role: "user" | "admin"; created_at: number };

// Migrate older DBs
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch {}

// New tables for real data
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS skills_state (
    user_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, skill_id)
  );
  CREATE TABLE IF NOT EXISTS connectors (
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    handle TEXT,
    secret TEXT,
    config TEXT,
    connected_at INTEGER,
    PRIMARY KEY (user_id, kind)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    kimi_api_key TEXT,
    model TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at);
`);

export type Memory = { id: string; user_id: string; topic: string; body: string; created_at: number };
export type Connector = { user_id: string; kind: string; handle: string | null; secret: string | null; config: string | null; connected_at: number | null };
export type Message = { id: string; user_id: string; role: "user" | "assistant" | "system"; content: string; created_at: number };

export function listMemories(userId: string): Memory[] {
  return db.query("SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Memory[];
}
export function addMemory(userId: string, topic: string, body: string): Memory {
  const m: Memory = { id: newId(), user_id: userId, topic, body, created_at: now() };
  db.run("INSERT INTO memories (id, user_id, topic, body, created_at) VALUES (?, ?, ?, ?, ?)", [m.id, userId, topic, body, m.created_at]);
  return m;
}
export function deleteMemory(userId: string, id: string) {
  db.run("DELETE FROM memories WHERE user_id = ? AND id = ?", [userId, id]);
}

export function getSkillsState(userId: string): Record<string, boolean> {
  const rows = db.query("SELECT skill_id, active FROM skills_state WHERE user_id = ?").all(userId) as { skill_id: string; active: number }[];
  return Object.fromEntries(rows.map((r) => [r.skill_id, !!r.active]));
}
export function setSkillState(userId: string, skillId: string, active: boolean) {
  db.run("INSERT OR REPLACE INTO skills_state (user_id, skill_id, active) VALUES (?, ?, ?)", [userId, skillId, active ? 1 : 0]);
}

export function listConnectors(userId: string): Connector[] {
  return db.query("SELECT * FROM connectors WHERE user_id = ?").all(userId) as Connector[];
}
export function upsertConnector(userId: string, kind: string, data: { handle?: string; secret?: string; config?: string }): Connector {
  const c: Connector = { user_id: userId, kind, handle: data.handle ?? null, secret: data.secret ?? null, config: data.config ?? null, connected_at: now() };
  db.run("INSERT OR REPLACE INTO connectors (user_id, kind, handle, secret, config, connected_at) VALUES (?, ?, ?, ?, ?, ?)", [userId, kind, c.handle, c.secret, c.config, c.connected_at]);
  return c;
}
export function disconnectConnector(userId: string, kind: string) {
  db.run("DELETE FROM connectors WHERE user_id = ? AND kind = ?", [userId, kind]);
}

export function listMessages(userId: string, limit = 100): Message[] {
  return db.query("SELECT * FROM messages WHERE user_id = ? AND (project_id IS NULL OR project_id = '') ORDER BY created_at ASC LIMIT ?").all(userId, limit) as Message[];
}
export function addMessage(userId: string, role: Message["role"], content: string): Message {
  const m: Message = { id: newId(), user_id: userId, role, content, created_at: now() };
  db.run("INSERT INTO messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)", [m.id, userId, role, content, m.created_at]);
  return m;
}

export function getSettings(userId: string): { kimi_api_key: string | null; model: string | null } {
  const r = db.query("SELECT kimi_api_key, model FROM user_settings WHERE user_id = ?").get(userId) as any;
  return { kimi_api_key: r?.kimi_api_key ?? null, model: r?.model ?? null };
}
export function setSettings(userId: string, patch: { kimi_api_key?: string; model?: string }) {
  const cur = getSettings(userId);
  const next = { ...cur, ...patch };
  db.run("INSERT OR REPLACE INTO user_settings (user_id, kimi_api_key, model, updated_at) VALUES (?, ?, ?, ?)", [userId, next.kimi_api_key, next.model, now()]);
}
export type Tenant = {
  id: string;
  user_id: string;
  port: number;
  container_id: string | null;
  password: string;
  status: "created" | "running" | "hibernated" | "error";
  last_active_at: number;
  created_at: number;
};

export const newId = () => randomUUID();
export const now = () => Date.now();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "soeharyo@gmail.com").split(",").map((s) => s.trim().toLowerCase());

export function upsertUser(email: string, name?: string): User {
  const existing = db.query("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  if (existing) return existing;
  const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? "admin" : "user";
  const u: User = { id: newId(), email, name: name ?? null, role, created_at: now() };
  db.run("INSERT INTO users (id, email, name, role, created_at) VALUES (?, ?, ?, ?, ?)", [u.id, u.email, u.name, u.role, u.created_at]);
  return u;
}

export function listUsers(): User[] { return db.query("SELECT * FROM users ORDER BY created_at DESC").all() as User[]; }
export function listTenants(): Tenant[] { return db.query("SELECT * FROM tenants ORDER BY created_at DESC").all() as Tenant[]; }
export function tenantWithUser(): (Tenant & { email: string; role: string })[] {
  return db.query(`SELECT t.*, u.email, u.role FROM tenants t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`).all() as any;
}

export function createSession(userId: string): string {
  const id = newId();
  const expires = now() + 1000 * 60 * 60 * 24 * 30; // 30d
  db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [id, userId, expires]);
  return id;
}

export function getUserBySessionId(sid: string): User | null {
  const row = db.query(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?"
  ).get(sid, now()) as User | undefined;
  return row ?? null;
}

export function createMagicLink(email: string): string {
  const token = newId().replace(/-/g, "");
  const expires = now() + 1000 * 60 * 15; // 15min
  db.run("INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)", [token, email, expires]);
  return token;
}

export function consumeMagicLink(token: string): string | null {
  const row = db.query("SELECT * FROM magic_links WHERE token = ? AND used = 0 AND expires_at > ?").get(token, now()) as
    | { token: string; email: string }
    | undefined;
  if (!row) return null;
  db.run("UPDATE magic_links SET used = 1 WHERE token = ?", [token]);
  return row.email;
}

export function getTenantByUserId(userId: string): Tenant | null {
  return (db.query("SELECT * FROM tenants WHERE user_id = ?").get(userId) as Tenant | undefined) ?? null;
}

export function createTenant(userId: string, port: number, password: string): Tenant {
  const t: Tenant = {
    id: newId(),
    user_id: userId,
    port,
    container_id: null,
    password,
    status: "created",
    last_active_at: now(),
    created_at: now(),
  };
  db.run(
    "INSERT INTO tenants (id, user_id, port, container_id, password, status, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [t.id, t.user_id, t.port, t.container_id, t.password, t.status, t.last_active_at, t.created_at]
  );
  return t;
}

export function updateTenantStatus(id: string, status: Tenant["status"], containerId?: string) {
  if (containerId !== undefined) {
    db.run("UPDATE tenants SET status = ?, container_id = ?, last_active_at = ? WHERE id = ?", [status, containerId, now(), id]);
  } else {
    db.run("UPDATE tenants SET status = ?, last_active_at = ? WHERE id = ?", [status, now(), id]);
  }
}

export function allocatePort(start: number, end: number): number {
  const used = db.query("SELECT port FROM tenants").all() as { port: number }[];
  const usedSet = new Set(used.map((r) => r.port));
  for (let p = start; p <= end; p++) if (!usedSet.has(p)) return p;
  throw new Error("No tenant ports available");
}

// Add to db.ts after existing CREATE TABLE statements
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    html TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);
`);
try { db.exec("ALTER TABLE projects ADD COLUMN files TEXT"); } catch {}
try { db.exec("ALTER TABLE projects ADD COLUMN mode TEXT NOT NULL DEFAULT 'static'"); } catch {}

try { db.exec("ALTER TABLE messages ADD COLUMN project_id TEXT"); } catch {}

export type Project = { id: string; user_id: string; slug: string; title: string; html: string; published: number; created_at: number; updated_at: number };

const STARTER_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><title>Untitled</title></head><body class="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center font-sans"><div class="text-center"><div class="text-xs uppercase tracking-widest text-amber-400 mb-3">— vibe coding · empty canvas</div><h1 class="text-5xl font-serif italic">Tell your agent what to build.</h1><p class="text-stone-400 mt-4">Anything you say will appear here, live.</p></div></body></html>`;

function genSlug(): string {
  const adj = ["bright","calm","quick","brave","nimble","gentle","loud","mellow","crisp","silver","amber","violet"];
  const noun = ["fox","crow","river","mesa","kite","atlas","comet","oak","dune","quill","ember","tide"];
  return `${adj[Math.floor(Math.random()*adj.length)]}-${noun[Math.floor(Math.random()*noun.length)]}-${Math.random().toString(36).slice(2,6)}`;
}

export function createProject(userId: string, title = "Untitled project"): Project {
  const p: Project = { id: newId(), user_id: userId, slug: genSlug(), title, html: STARTER_HTML, published: 0, created_at: now(), updated_at: now() };
  db.run("INSERT INTO projects (id, user_id, slug, title, html, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [p.id, p.user_id, p.slug, p.title, p.html, p.published, p.created_at, p.updated_at]);
  return p;
}
export function listProjects(userId: string): Project[] {
  return db.query("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as Project[];
}
export function getProject(userId: string, id: string): Project | null {
  return (db.query("SELECT * FROM projects WHERE user_id = ? AND id = ?").get(userId, id) as Project | undefined) ?? null;
}
export function getProjectBySlug(slug: string): Project | null {
  return (db.query("SELECT * FROM projects WHERE slug = ?").get(slug) as Project | undefined) ?? null;
}
export function updateProject(userId: string, id: string, patch: Partial<Pick<Project,"title"|"html"|"published">>) {
  const cur = getProject(userId, id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updated_at: now() };
  db.run("UPDATE projects SET title=?, html=?, published=?, updated_at=? WHERE user_id=? AND id=?",
    [next.title, next.html, next.published, next.updated_at, userId, id]);
  return next;
}
export function deleteProject(userId: string, id: string) {
  db.run("DELETE FROM projects WHERE user_id=? AND id=?", [userId, id]);
  db.run("DELETE FROM messages WHERE user_id=? AND project_id=?", [userId, id]);
}

export function listProjectMessages(userId: string, projectId: string): Message[] {
  return db.query("SELECT * FROM messages WHERE user_id=? AND project_id=? ORDER BY created_at ASC").all(userId, projectId) as Message[];
}
export function addProjectMessage(userId: string, projectId: string, role: Message["role"], content: string): Message {
  const m: Message = { id: newId(), user_id: userId, role, content, created_at: now() };
  db.run("INSERT INTO messages (id, user_id, role, content, created_at, project_id) VALUES (?, ?, ?, ?, ?, ?)",
    [m.id, userId, role, content, m.created_at, projectId]);
  return m;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    kind TEXT NOT NULL,
    meta TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_log(created_at DESC);
`);

export type Activity = { id: string; user_id: string | null; kind: string; meta: string | null; created_at: number };

export function logActivity(userId: string | null, kind: string, meta?: any) {
  const id = newId();
  const metaStr = meta ? JSON.stringify(meta) : null;
  db.run("INSERT INTO activity_log (id, user_id, kind, meta, created_at) VALUES (?, ?, ?, ?, ?)", [id, userId, kind, metaStr, now()]);
}

export function listActivity(limit = 200): (Activity & { email: string | null })[] {
  return db.query(`
    SELECT a.*, u.email FROM activity_log a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT ?
  `).all(limit) as any;
}

export function dbStats() {
  const tables = ["users", "sessions", "magic_links", "tenants", "memories", "skills_state", "connectors", "messages", "user_settings", "projects", "activity_log"];
  const stats: { table: string; rows: number }[] = [];
  for (const t of tables) {
    try {
      const r = db.query(`SELECT COUNT(*) as n FROM ${t}`).get() as { n: number };
      stats.push({ table: t, rows: r.n });
    } catch {}
  }
  return stats;
}

export function userDetail(userId: string) {
  const user = db.query("SELECT * FROM users WHERE id = ?").get(userId) as User | undefined;
  if (!user) return null;
  const tenant = getTenantByUserId(userId);
  const memories = db.query("SELECT COUNT(*) as n FROM memories WHERE user_id = ?").get(userId) as { n: number };
  const messages = db.query("SELECT COUNT(*) as n FROM messages WHERE user_id = ?").get(userId) as { n: number };
  const projects = db.query("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20").all(userId) as Project[];
  const recent = db.query("SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 30").all(userId) as Activity[];
  return { user, tenant, counts: { memories: memories.n, messages: messages.n, projects: projects.length }, projects, recent };
}

db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS llm_models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    label TEXT NOT NULL,
    context_window INTEGER,
    is_default INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quotas (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free',
    msgs_per_day INTEGER NOT NULL DEFAULT 200,
    projects_max INTEGER NOT NULL DEFAULT 5,
    memories_max INTEGER NOT NULL DEFAULT 200,
    container_ram_mb INTEGER NOT NULL DEFAULT 512,
    disabled INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_models_provider ON llm_models(provider_id);
`);

try { db.exec("ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0"); } catch {}

export type Provider = { id: string; name: string; kind: string; base_url: string; api_key: string | null; enabled: number; created_at: number };
export type LLMModel = { id: string; provider_id: string; model_id: string; label: string; context_window: number | null; is_default: number; enabled: number; created_at: number };
export type ApiToken = { id: string; user_id: string; name: string; token: string; last_used_at: number | null; created_at: number };
export type Quota = { user_id: string; plan: string; msgs_per_day: number; projects_max: number; memories_max: number; container_ram_mb: number; disabled: number; notes: string | null; updated_at: number };

// Providers
export function listProviders(): Provider[] { return db.query("SELECT * FROM providers ORDER BY created_at").all() as Provider[]; }
export function getProvider(id: string): Provider | null { return (db.query("SELECT * FROM providers WHERE id = ?").get(id) as Provider | undefined) ?? null; }
export function createProvider(p: { name: string; kind: string; base_url: string; api_key?: string; enabled?: number }): Provider {
  const row: Provider = { id: newId(), name: p.name, kind: p.kind, base_url: p.base_url, api_key: p.api_key ?? null, enabled: p.enabled ?? 1, created_at: now() };
  db.run("INSERT INTO providers (id, name, kind, base_url, api_key, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [row.id, row.name, row.kind, row.base_url, row.api_key, row.enabled, row.created_at]);
  return row;
}
export function updateProvider(id: string, patch: Partial<Provider>) {
  const cur = getProvider(id); if (!cur) return null;
  const next = { ...cur, ...patch };
  db.run("UPDATE providers SET name=?, kind=?, base_url=?, api_key=?, enabled=? WHERE id=?",
    [next.name, next.kind, next.base_url, next.api_key, next.enabled, id]);
  return next;
}
export function deleteProvider(id: string) { db.run("DELETE FROM providers WHERE id = ?", [id]); db.run("DELETE FROM llm_models WHERE provider_id = ?", [id]); }

// Models
export function listModels(): (LLMModel & { provider_name: string; provider_kind: string; provider_base_url: string; provider_api_key: string | null })[] {
  return db.query(`SELECT m.*, p.name as provider_name, p.kind as provider_kind, p.base_url as provider_base_url, p.api_key as provider_api_key
    FROM llm_models m JOIN providers p ON p.id = m.provider_id ORDER BY m.is_default DESC, m.created_at DESC`).all() as any;
}
export function createModel(p: { provider_id: string; model_id: string; label: string; context_window?: number; is_default?: number; enabled?: number }): LLMModel {
  if (p.is_default) db.run("UPDATE llm_models SET is_default = 0");
  const row: LLMModel = { id: newId(), provider_id: p.provider_id, model_id: p.model_id, label: p.label, context_window: p.context_window ?? null, is_default: p.is_default ?? 0, enabled: p.enabled ?? 1, created_at: now() };
  db.run("INSERT INTO llm_models (id, provider_id, model_id, label, context_window, is_default, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [row.id, row.provider_id, row.model_id, row.label, row.context_window, row.is_default, row.enabled, row.created_at]);
  return row;
}
export function updateModel(id: string, patch: Partial<LLMModel>) {
  if (patch.is_default) db.run("UPDATE llm_models SET is_default = 0");
  const cur = db.query("SELECT * FROM llm_models WHERE id = ?").get(id) as LLMModel | undefined;
  if (!cur) return null;
  const next = { ...cur, ...patch };
  db.run("UPDATE llm_models SET model_id=?, label=?, context_window=?, is_default=?, enabled=? WHERE id=?",
    [next.model_id, next.label, next.context_window, next.is_default, next.enabled, id]);
  return next;
}
export function deleteModel(id: string) { db.run("DELETE FROM llm_models WHERE id = ?", [id]); }

export function getDefaultModelInfo(): { provider: Provider; model: LLMModel } | null {
  const row = db.query(`SELECT m.*, p.name as p_name, p.kind as p_kind, p.base_url as p_base, p.api_key as p_key, p.enabled as p_enabled
    FROM llm_models m JOIN providers p ON p.id = m.provider_id
    WHERE m.is_default = 1 AND m.enabled = 1 AND p.enabled = 1 LIMIT 1`).get() as any;
  if (!row) return null;
  return {
    model: { id: row.id, provider_id: row.provider_id, model_id: row.model_id, label: row.label, context_window: row.context_window, is_default: 1, enabled: 1, created_at: row.created_at },
    provider: { id: row.provider_id, name: row.p_name, kind: row.p_kind, base_url: row.p_base, api_key: row.p_key, enabled: row.p_enabled, created_at: 0 },
  };
}

// System settings (k/v)
export function getSetting(key: string): string | null {
  const r = db.query("SELECT value FROM system_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return r?.value ?? null;
}
export function setSetting(key: string, value: string) {
  db.run("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)", [key, value, now()]);
}
export function listSettings(): { key: string; value: string }[] {
  return db.query("SELECT key, value FROM system_settings").all() as any;
}

// API tokens
export function listUserTokens(userId: string): ApiToken[] { return db.query("SELECT * FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC").all(userId) as ApiToken[]; }
export function createUserToken(userId: string, name: string): ApiToken {
  const tok = "ch_" + randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
  const row: ApiToken = { id: newId(), user_id: userId, name, token: tok, last_used_at: null, created_at: now() };
  db.run("INSERT INTO api_tokens (id, user_id, name, token, last_used_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [row.id, userId, name, tok, null, row.created_at]);
  return row;
}
export function deleteUserToken(userId: string, id: string) { db.run("DELETE FROM api_tokens WHERE user_id = ? AND id = ?", [userId, id]); }
export function findUserByToken(token: string): User | null {
  const r = db.query(`SELECT u.* FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?`).get(token) as User | undefined;
  if (r) db.run("UPDATE api_tokens SET last_used_at = ? WHERE token = ?", [now(), token]);
  return r ?? null;
}

// Quotas
export function getQuota(userId: string): Quota {
  const r = db.query("SELECT * FROM quotas WHERE user_id = ?").get(userId) as Quota | undefined;
  if (r) return r;
  return { user_id: userId, plan: "free", msgs_per_day: 200, projects_max: 5, memories_max: 200, container_ram_mb: 512, disabled: 0, notes: null, updated_at: 0 };
}
export function setQuota(userId: string, patch: Partial<Quota>) {
  const cur = getQuota(userId);
  const next = { ...cur, ...patch, updated_at: now() };
  db.run("INSERT OR REPLACE INTO quotas (user_id, plan, msgs_per_day, projects_max, memories_max, container_ram_mb, disabled, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [userId, next.plan, next.msgs_per_day, next.projects_max, next.memories_max, next.container_ram_mb, next.disabled, next.notes, next.updated_at]);
  return next;
}

// Sessions admin
export function listAllSessions(): { id: string; user_id: string; expires_at: number; email: string }[] {
  return db.query(`SELECT s.id, s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.expires_at > ? ORDER BY s.expires_at DESC`).all(now()) as any;
}
export function killSession(id: string) { db.run("DELETE FROM sessions WHERE id = ?", [id]); }
export function killAllUserSessions(userId: string) { db.run("DELETE FROM sessions WHERE user_id = ?", [userId]); }

// User actions
export function setUserRole(userId: string, role: "user" | "admin") { db.run("UPDATE users SET role = ? WHERE id = ?", [role, userId]); }
export function setUserDisabled(userId: string, disabled: boolean) { db.run("UPDATE users SET disabled = ? WHERE id = ?", [disabled ? 1 : 0, userId]); }
export function deleteUser(userId: string) {
  // Cascade: messages, memories, skills_state, connectors, projects, tenants, api_tokens, sessions, magic_links, quotas, user_settings
  for (const t of ["messages","memories","skills_state","connectors","projects","tenants","api_tokens","sessions","user_settings","quotas"]) {
    try { db.run(`DELETE FROM ${t} WHERE user_id = ?`, [userId]); } catch {}
  }
  db.run("DELETE FROM users WHERE id = ?", [userId]);
}

// randomUUID is from node:crypto already imported at top

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New chat',
    last_message_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id, last_message_at DESC);
`);
try { db.exec("ALTER TABLE messages ADD COLUMN session_id TEXT"); } catch {}

export type ChatSession = { id: string; user_id: string; title: string; last_message_at: number; created_at: number };

export function listChatSessions(userId: string): ChatSession[] {
  return db.query("SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY last_message_at DESC").all(userId) as ChatSession[];
}
export function createChatSession(userId: string, title = "New chat"): ChatSession {
  const cs: ChatSession = { id: newId(), user_id: userId, title, last_message_at: now(), created_at: now() };
  db.run("INSERT INTO chat_sessions (id, user_id, title, last_message_at, created_at) VALUES (?, ?, ?, ?, ?)", [cs.id, cs.user_id, cs.title, cs.last_message_at, cs.created_at]);
  return cs;
}
export function getChatSession(userId: string, id: string): ChatSession | null {
  return (db.query("SELECT * FROM chat_sessions WHERE user_id = ? AND id = ?").get(userId, id) as ChatSession | undefined) ?? null;
}
export function updateChatSession(userId: string, id: string, patch: { title?: string; last_message_at?: number }) {
  const cur = getChatSession(userId, id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  db.run("UPDATE chat_sessions SET title = ?, last_message_at = ? WHERE user_id = ? AND id = ?", [next.title, next.last_message_at, userId, id]);
  return next;
}
export function deleteChatSession(userId: string, id: string) {
  db.run("DELETE FROM chat_sessions WHERE user_id = ? AND id = ?", [userId, id]);
  db.run("DELETE FROM messages WHERE user_id = ? AND session_id = ?", [userId, id]);
}

export function listSessionMessages(userId: string, sessionId: string): Message[] {
  return db.query("SELECT * FROM messages WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC").all(userId, sessionId) as Message[];
}
export function addSessionMessage(userId: string, sessionId: string, role: Message["role"], content: string): Message {
  const m: Message = { id: newId(), user_id: userId, role, content, created_at: now() };
  db.run("INSERT INTO messages (id, user_id, role, content, created_at, session_id) VALUES (?, ?, ?, ?, ?, ?)", [m.id, userId, role, content, m.created_at, sessionId]);
  db.run("UPDATE chat_sessions SET last_message_at = ? WHERE user_id = ? AND id = ?", [now(), userId, sessionId]);
  return m;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    timezone TEXT,
    locale TEXT,
    company TEXT,
    location TEXT,
    website TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT,
    notes TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL,
    description TEXT,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    paid_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS usage_meter (
    user_id TEXT NOT NULL,
    period TEXT NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    projects INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, period)
  );
  CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, created_at DESC);
`);

export type Profile = { user_id: string; display_name: string | null; avatar_url: string | null; bio: string | null; timezone: string | null; locale: string | null; company: string | null; location: string | null; website: string | null; updated_at: number };
export type Subscription = { user_id: string; plan: string; status: string; period_start: number; period_end: number; cancel_at_period_end: number; payment_method: string | null; notes: string | null; updated_at: number };
export type Invoice = { id: string; user_id: string; amount_cents: number; currency: string; status: string; description: string | null; period_start: number; period_end: number; paid_at: number | null; created_at: number };
export type UsageMeter = { user_id: string; period: string; messages: number; tokens_in: number; tokens_out: number; tool_calls: number; projects: number };

export const PLANS = {
  free:   { id: "free",   name: "Free",       price_cents: 0,    msgs_per_month: 200,   models: ["hermes-agent", "stepfun/step-3.5-flash", "moonshotai/kimi-k2-thinking"], tools: 6,  tokens: 100000,  features: ["Hermes 4 405B", "6 tools", "Memory", "1 Telegram bot"] },
  pro:    { id: "pro",    name: "Pro",        price_cents: 2000, msgs_per_month: 5000,  models: "all", tools: "all", tokens: 5000000, features: ["All models", "40+ tools (native Hermes)", "Priority queue", "Vibe coding unlimited", "Email support"] },
  team:   { id: "team",   name: "Team",       price_cents: 5000, msgs_per_month: 25000, models: "all", tools: "all", tokens: 25000000, features: ["Everything in Pro", "Shared memory", "Audit log", "API access", "Custom integrations"] },
  enterprise: { id: "enterprise", name: "Enterprise", price_cents: 0, msgs_per_month: 0, models: "all", tools: "all", tokens: 0, features: ["Custom SLA", "Dedicated agent runtime", "SSO", "On-prem", "24/7 support"] },
} as const;

const MS_30D = 30 * 24 * 60 * 60 * 1000;

function periodKey(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getProfile(userId: string): Profile {
  const r = db.query("SELECT * FROM profiles WHERE user_id = ?").get(userId) as Profile | undefined;
  if (r) return r;
  return { user_id: userId, display_name: null, avatar_url: null, bio: null, timezone: null, locale: null, company: null, location: null, website: null, updated_at: 0 };
}
export function setProfile(userId: string, patch: Partial<Profile>): Profile {
  const cur = getProfile(userId);
  const next = { ...cur, ...patch, user_id: userId, updated_at: now() };
  db.run("INSERT OR REPLACE INTO profiles (user_id, display_name, avatar_url, bio, timezone, locale, company, location, website, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [next.user_id, next.display_name, next.avatar_url, next.bio, next.timezone, next.locale, next.company, next.location, next.website, next.updated_at]);
  return next;
}

export function getSubscription(userId: string): Subscription {
  const r = db.query("SELECT * FROM subscriptions WHERE user_id = ?").get(userId) as Subscription | undefined;
  if (r) return r;
  // Auto-create free subscription
  const sub: Subscription = { user_id: userId, plan: "free", status: "active", period_start: now(), period_end: now() + MS_30D, cancel_at_period_end: 0, payment_method: null, notes: null, updated_at: now() };
  db.run("INSERT INTO subscriptions (user_id, plan, status, period_start, period_end, cancel_at_period_end, payment_method, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [sub.user_id, sub.plan, sub.status, sub.period_start, sub.period_end, sub.cancel_at_period_end, sub.payment_method, sub.notes, sub.updated_at]);
  return sub;
}
export function setSubscription(userId: string, patch: Partial<Subscription>): Subscription {
  const cur = getSubscription(userId);
  const next = { ...cur, ...patch, user_id: userId, updated_at: now() };
  db.run("UPDATE subscriptions SET plan=?, status=?, period_start=?, period_end=?, cancel_at_period_end=?, payment_method=?, notes=?, updated_at=? WHERE user_id=?",
    [next.plan, next.status, next.period_start, next.period_end, next.cancel_at_period_end, next.payment_method, next.notes, next.updated_at, userId]);
  return next;
}
export function changeUserPlan(userId: string, plan: string): Subscription {
  const cur = getSubscription(userId);
  // Generate invoice for plan change
  const planMeta = (PLANS as any)[plan];
  if (planMeta && planMeta.price_cents > 0 && cur.plan !== plan) {
    const inv: Invoice = {
      id: newId(), user_id: userId, amount_cents: planMeta.price_cents, currency: "USD",
      status: "paid", description: `${planMeta.name} plan — monthly`,
      period_start: now(), period_end: now() + MS_30D, paid_at: now(), created_at: now(),
    };
    db.run("INSERT INTO invoices (id, user_id, amount_cents, currency, status, description, period_start, period_end, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [inv.id, inv.user_id, inv.amount_cents, inv.currency, inv.status, inv.description, inv.period_start, inv.period_end, inv.paid_at, inv.created_at]);
  }
  return setSubscription(userId, { plan, period_start: now(), period_end: now() + MS_30D, status: "active", cancel_at_period_end: 0 });
}

export function listInvoices(userId: string): Invoice[] {
  return db.query("SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Invoice[];
}

export function getUsage(userId: string, period?: string): UsageMeter {
  const p = period ?? periodKey();
  const r = db.query("SELECT * FROM usage_meter WHERE user_id = ? AND period = ?").get(userId, p) as UsageMeter | undefined;
  if (r) return r;
  return { user_id: userId, period: p, messages: 0, tokens_in: 0, tokens_out: 0, tool_calls: 0, projects: 0 };
}
export function bumpUsage(userId: string, patch: Partial<Pick<UsageMeter, "messages" | "tokens_in" | "tokens_out" | "tool_calls" | "projects">>) {
  const p = periodKey();
  const cur = getUsage(userId, p);
  const next = {
    ...cur,
    messages: cur.messages + (patch.messages ?? 0),
    tokens_in: cur.tokens_in + (patch.tokens_in ?? 0),
    tokens_out: cur.tokens_out + (patch.tokens_out ?? 0),
    tool_calls: cur.tool_calls + (patch.tool_calls ?? 0),
    projects: cur.projects + (patch.projects ?? 0),
  };
  db.run("INSERT OR REPLACE INTO usage_meter (user_id, period, messages, tokens_in, tokens_out, tool_calls, projects) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, p, next.messages, next.tokens_in, next.tokens_out, next.tool_calls, next.projects]);
}

export function adminBillingOverview(): { user: User; subscription: Subscription; usage: UsageMeter; invoices_total_cents: number }[] {
  const users = listUsers();
  return users.map((u) => {
    const sub = getSubscription(u.id);
    const usage = getUsage(u.id);
    const inv = (db.query("SELECT COALESCE(SUM(amount_cents), 0) as total FROM invoices WHERE user_id = ? AND status = 'paid'").get(u.id) as any)?.total ?? 0;
    return { user: u, subscription: sub, usage, invoices_total_cents: inv };
  });
}

// ============================================================
// Stripe helpers (added 2026-05-01)
// ============================================================

export function getUserByStripeCustomerId(customerId: string): User | null {
  const r = db.query("SELECT * FROM users WHERE stripe_customer_id = ?").get(customerId) as User | undefined;
  return r || null;
}

export function setUserStripeCustomerId(userId: string, customerId: string): void {
  db.run("UPDATE users SET stripe_customer_id = ? WHERE id = ?", [customerId, userId]);
}

export function getUserById(userId: string): User | null {
  const r = db.query("SELECT * FROM users WHERE id = ?").get(userId) as User | undefined;
  return r || null;
}

export function countUserSignIns(userId: string): number {
  const r = db.query("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(userId) as { n: number };
  return r?.n ?? 0;
}

export function setStripeSubscription(userId: string, opts: {
  plan: string;
  status: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  period_start: number;
  period_end: number;
  cancel_at_period_end: number;
}): void {
  // Upsert subscription with all Stripe fields
  const existing = db.query("SELECT user_id FROM subscriptions WHERE user_id = ?").get(userId);
  if (existing) {
    db.run(`UPDATE subscriptions SET plan=?, status=?, stripe_subscription_id=?, stripe_price_id=?, period_start=?, period_end=?, cancel_at_period_end=?, payment_method=?, updated_at=? WHERE user_id=?`,
      [opts.plan, opts.status, opts.stripe_subscription_id, opts.stripe_price_id, opts.period_start, opts.period_end, opts.cancel_at_period_end, "stripe", Date.now(), userId]);
  } else {
    db.run(`INSERT INTO subscriptions (user_id, plan, status, stripe_subscription_id, stripe_price_id, period_start, period_end, cancel_at_period_end, payment_method, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, opts.plan, opts.status, opts.stripe_subscription_id, opts.stripe_price_id, opts.period_start, opts.period_end, opts.cancel_at_period_end, "stripe", null, Date.now()]);
  }
}

export function recordStripeInvoice(opts: {
  user_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  description: string;
  period_start: number;
  period_end: number;
  paid_at: number | null;
  hosted_invoice_url?: string | null;
  pdf_url?: string | null;
  stripe_invoice_id?: string | null;
}): void {
  // Idempotent: if stripe_invoice_id already exists, update instead of duplicate insert
  if (opts.stripe_invoice_id) {
    const existing = db.query("SELECT id FROM invoices WHERE stripe_invoice_id = ?").get(opts.stripe_invoice_id) as any;
    if (existing) {
      db.run(
        `UPDATE invoices SET amount_cents=?, currency=?, status=?, description=?, period_start=?, period_end=?, paid_at=?, hosted_invoice_url=?, pdf_url=? WHERE stripe_invoice_id=?`,
        [opts.amount_cents, opts.currency, opts.status, opts.description, opts.period_start, opts.period_end, opts.paid_at, opts.hosted_invoice_url || null, opts.pdf_url || null, opts.stripe_invoice_id]
      );
      return;
    }
  }
  db.run(
    `INSERT INTO invoices (id, user_id, amount_cents, currency, status, description, period_start, period_end, paid_at, created_at, hosted_invoice_url, pdf_url, stripe_invoice_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), opts.user_id, opts.amount_cents, opts.currency, opts.status, opts.description, opts.period_start, opts.period_end, opts.paid_at, Date.now(), opts.hosted_invoice_url || null, opts.pdf_url || null, opts.stripe_invoice_id || null]
  );
}

// ============================================================
// Email log helpers (added 2026-05-01)
// ============================================================

export type EmailLog = {
  id: string;
  user_id: string | null;
  to_email: string;
  template: string;
  subject: string;
  status: string;
  resend_id: string | null;
  error: string | null;
  meta: string | null;
  created_at: number;
  delivered_at: number | null;
  opened_at: number | null;
  clicked_at: number | null;
  bounced_at: number | null;
  complained_at: number | null;
};

export function logEmail(opts: {
  user_id: string | null;
  to_email: string;
  template: string;
  subject: string;
  status: string;
  resend_id: string | null;
  error: string | null;
  meta: any;
}): string {
  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO email_log (id, user_id, to_email, template, subject, status, resend_id, error, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, opts.user_id, opts.to_email, opts.template, opts.subject, opts.status, opts.resend_id, opts.error, opts.meta ? JSON.stringify(opts.meta) : null, Date.now()]
  );
  return id;
}

export function listEmails(opts?: { user_id?: string; limit?: number }): EmailLog[] {
  const limit = Math.min(opts?.limit ?? 100, 500);
  if (opts?.user_id) {
    return db.query("SELECT * FROM email_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(opts.user_id, limit) as EmailLog[];
  }
  return db.query("SELECT * FROM email_log ORDER BY created_at DESC LIMIT ?").all(limit) as EmailLog[];
}

export function updateEmailStatus(resendId: string, patch: { status?: string; delivered_at?: number; opened_at?: number; clicked_at?: number; bounced_at?: number; complained_at?: number; error?: string }): boolean {
  const cur = db.query("SELECT * FROM email_log WHERE resend_id = ?").get(resendId) as EmailLog | undefined;
  if (!cur) return false;
  const fields: string[] = [];
  const vals: any[] = [];
  for (const k of ["status", "delivered_at", "opened_at", "clicked_at", "bounced_at", "complained_at", "error"] as const) {
    if (patch[k] !== undefined) { fields.push(`${k} = ?`); vals.push(patch[k]); }
  }
  if (fields.length === 0) return false;
  vals.push(resendId);
  db.run(`UPDATE email_log SET ${fields.join(", ")} WHERE resend_id = ?`, vals);
  return true;
}

export function emailStats(): { total: number; delivered: number; bounced: number; opened: number; complained: number; last_24h: number } {
  const since = Date.now() - 86400000;
  const total = (db.query("SELECT COUNT(*) AS n FROM email_log").get() as any)?.n ?? 0;
  const delivered = (db.query("SELECT COUNT(*) AS n FROM email_log WHERE delivered_at IS NOT NULL").get() as any)?.n ?? 0;
  const bounced = (db.query("SELECT COUNT(*) AS n FROM email_log WHERE bounced_at IS NOT NULL").get() as any)?.n ?? 0;
  const opened = (db.query("SELECT COUNT(*) AS n FROM email_log WHERE opened_at IS NOT NULL").get() as any)?.n ?? 0;
  const complained = (db.query("SELECT COUNT(*) AS n FROM email_log WHERE complained_at IS NOT NULL").get() as any)?.n ?? 0;
  const last_24h = (db.query("SELECT COUNT(*) AS n FROM email_log WHERE created_at >= ?").get(since) as any)?.n ?? 0;
  return { total, delivered, bounced, opened, complained, last_24h };
}

export function findUserByEmail(email: string): User | null {
  const r = db.query("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  return r || null;
}
