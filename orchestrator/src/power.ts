// ChatHermes — power module: rate limiting, API keys, webhooks, search, GDPR, cron, deep health.
// Imports `db` from db.ts (caller passes it in) to avoid circular deps.

import { Database } from "bun:sqlite";
import * as DB from "./db";

const db = DB.db;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:7000";

// ============================================================
// API KEYS — hash-stored tokens, scope-aware, expiring
// ============================================================
// Format: ck_<rand-32>  (ck = ChatHermes). Stored as SHA-256.

function sha(s: string) {
  const h = new Bun.CryptoHasher("sha256");
  h.update(s);
  return h.digest("hex");
}

export type ApiToken = {
  id: string; user_id: string; name: string; token: string;  // token is hash, NEVER shown
  prefix: string | null;     // first 8 chars of plain token, for UI display
  scopes: string;
  last_used_at: number | null;
  created_at: number;
  expires_at: number | null;
};

export function createApiKey(opts: { userId: string; name: string; scopes?: string; expiresAt?: number | null }): { token: string; record: ApiToken } {
  const id = crypto.randomUUID();
  const raw = "ck_" + Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = sha(raw);
  const prefix = raw.slice(0, 11); // "ck_" + 8 chars
  const now = Date.now();
  db.run(
    "INSERT INTO api_tokens (id, user_id, name, token, prefix, scopes, expires_at, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
    [id, opts.userId, opts.name, hash, prefix, opts.scopes ?? "read,write", opts.expiresAt ?? null, now]
  );
  const record = db.query("SELECT * FROM api_tokens WHERE id = ?").get(id) as ApiToken;
  return { token: raw, record };
}

export function listApiKeys(userId: string): Omit<ApiToken, "token">[] {
  return db.query("SELECT id, user_id, name, prefix, scopes, last_used_at, created_at, expires_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC").all(userId) as any;
}

export function deleteApiKey(userId: string, id: string): boolean {
  const r = db.run("DELETE FROM api_tokens WHERE id = ? AND user_id = ?", [id, userId]);
  return (r as any).changes > 0;
}

export function lookupApiKey(rawToken: string): { user: DB.User; token: ApiToken } | null {
  if (!rawToken || !rawToken.startsWith("ck_")) return null;
  const hash = sha(rawToken);
  const tok = db.query("SELECT * FROM api_tokens WHERE token = ?").get(hash) as ApiToken | undefined;
  if (!tok) return null;
  if (tok.expires_at && tok.expires_at < Date.now()) return null;
  const user = DB.getUserById(tok.user_id);
  if (!user || (user as any).disabled) return null;
  // bump last_used_at async (don't block)
  db.run("UPDATE api_tokens SET last_used_at = ? WHERE id = ?", [Date.now(), tok.id]);
  return { user, token: tok };
}

// ============================================================
// RATE LIMITING — token bucket per (scope, key)
// ============================================================
// Each call decrements 1 token. Refills at `ratePerSec`. Capacity caps the burst.

export type RateLimitOpts = { scope: string; key: string; capacity: number; ratePerSec: number };

export function rateLimitTake(opts: RateLimitOpts): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const row = db.query("SELECT tokens, refilled_at FROM rate_limit_buckets WHERE scope = ? AND key = ?").get(opts.scope, opts.key) as any;
  let tokens = opts.capacity;
  let last = now;
  if (row) {
    last = row.refilled_at;
    const elapsed = (now - last) / 1000;
    tokens = Math.min(opts.capacity, row.tokens + elapsed * opts.ratePerSec);
  }
  if (tokens < 1) {
    const wait = Math.ceil((1 - tokens) / opts.ratePerSec * 1000);
    return { allowed: false, remaining: Math.floor(tokens), resetAt: now + wait };
  }
  tokens -= 1;
  db.run(
    "INSERT INTO rate_limit_buckets (scope, key, tokens, refilled_at) VALUES (?, ?, ?, ?) ON CONFLICT(scope, key) DO UPDATE SET tokens = excluded.tokens, refilled_at = excluded.refilled_at",
    [opts.scope, opts.key, tokens, now]
  );
  return { allowed: true, remaining: Math.floor(tokens), resetAt: now };
}

// Convenience policies
export const POLICIES = {
  AUTH_REQUEST: { capacity: 5, ratePerSec: 5 / 60 },          // 5 req / min per IP
  CHAT: { capacity: 60, ratePerSec: 60 / 60 },                // 60 / min per user
  API_PUBLIC: { capacity: 120, ratePerSec: 120 / 60 },        // 120 / min per API key
  WEBHOOK_OUT: { capacity: 100, ratePerSec: 100 / 60 },       // 100 / min per user
};

// ============================================================
// LOGIN ATTEMPTS — for throttling + new-device alerts
// ============================================================

export function recordLoginAttempt(opts: { email: string; ip: string; userAgent?: string; success: boolean }) {
  db.run("INSERT INTO login_attempts (id, email, ip, user_agent, success, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [crypto.randomUUID(), opts.email, opts.ip, opts.userAgent ?? null, opts.success ? 1 : 0, Date.now()]);
}

export function recentFailedLogins(email: string, withinMs = 15 * 60 * 1000): number {
  const since = Date.now() - withinMs;
  const r = db.query("SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND success = 0 AND created_at >= ?").get(email, since) as any;
  return r?.n ?? 0;
}

export function isFirstSeenIp(userId: string, ip: string): boolean {
  // Have we seen this user logged in from this IP before?
  const u = DB.getUserById(userId);
  if (!u) return false;
  const r = db.query(
    "SELECT 1 FROM login_attempts WHERE email = ? AND ip = ? AND success = 1 AND created_at < ?"
  ).get(u.email, ip, Date.now() - 60_000) as any;
  return !r;
}

// ============================================================
// OUTBOUND WEBHOOKS — user-registered, fires on lifecycle events
// ============================================================

export type WebhookSubscription = {
  id: string; user_id: string; url: string; secret: string;
  events: string;  // JSON array
  active: number; created_at: number;
  last_delivery_at: number | null; last_delivery_status: string | null;
};

export const WEBHOOK_EVENTS = [
  "session.created",
  "message.created",
  "tool.called",
  "project.published",
  "project.unpublished",
  "memory.created",
  "subscription.updated",
  "invoice.paid",
  "user.signed_in",
] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export function createWebhook(opts: { userId: string; url: string; events: string[] }): { record: WebhookSubscription; secret: string } {
  const id = crypto.randomUUID();
  const secret = "whsec_ch_" + Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");
  db.run("INSERT INTO outbound_webhooks (id, user_id, url, secret, events, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
    [id, opts.userId, opts.url, secret, JSON.stringify(opts.events), Date.now()]);
  const record = db.query("SELECT * FROM outbound_webhooks WHERE id = ?").get(id) as WebhookSubscription;
  return { record, secret };
}

export function listWebhooks(userId: string): WebhookSubscription[] {
  return db.query("SELECT * FROM outbound_webhooks WHERE user_id = ? ORDER BY created_at DESC").all(userId) as WebhookSubscription[];
}

export function deleteWebhook(userId: string, id: string): boolean {
  const r = db.run("DELETE FROM outbound_webhooks WHERE id = ? AND user_id = ?", [id, userId]);
  return (r as any).changes > 0;
}

export function listWebhookLog(webhookId: string, limit = 50) {
  return db.query("SELECT * FROM outbound_webhook_log WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?").all(webhookId, limit);
}

// Fire a webhook event for a user (best-effort, queued for retry on fail)
export async function emitWebhook(userId: string, event: WebhookEvent, payload: Record<string, any>) {
  const subs = db.query("SELECT * FROM outbound_webhooks WHERE user_id = ? AND active = 1").all(userId) as WebhookSubscription[];
  for (const sub of subs) {
    let events: string[] = [];
    try { events = JSON.parse(sub.events); } catch {}
    if (!events.includes(event) && !events.includes("*")) continue;
    const eventId = crypto.randomUUID();
    const body = JSON.stringify({ id: eventId, type: event, created_at: Date.now(), data: payload });
    deliverWebhook(sub, event, body, 1).catch(() => {});
  }
}

async function deliverWebhook(sub: WebhookSubscription, event: string, body: string, attempt: number) {
  const sig = signHmac(sub.secret, body);
  const logId = crypto.randomUUID();
  db.run("INSERT INTO outbound_webhook_log (id, webhook_id, event_type, payload, attempt, delivered, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
    [logId, sub.id, event, body, attempt, Date.now()]);
  try {
    const r = await fetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ChatHermes-Webhooks/1.0",
        "X-ChatHermes-Event": event,
        "X-ChatHermes-Signature": sig,
        "X-ChatHermes-Delivery": logId,
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const respText = await r.text().catch(() => "");
    db.run("UPDATE outbound_webhook_log SET status_code = ?, response_body = ?, delivered = ?, error = NULL WHERE id = ?",
      [r.status, respText.slice(0, 1000), r.ok ? 1 : 0, logId]);
    db.run("UPDATE outbound_webhooks SET last_delivery_at = ?, last_delivery_status = ? WHERE id = ?",
      [Date.now(), r.ok ? "delivered" : `${r.status}`, sub.id]);
    if (!r.ok && attempt < 4) {
      // Exponential retry: 30s, 5m, 1h
      const delay = [0, 30_000, 5 * 60_000, 60 * 60_000][attempt] ?? 0;
      const next = Date.now() + delay;
      db.run("UPDATE outbound_webhook_log SET next_retry_at = ? WHERE id = ?", [next, logId]);
    }
  } catch (e: any) {
    db.run("UPDATE outbound_webhook_log SET error = ? WHERE id = ?", [String(e?.message || e).slice(0, 500), logId]);
    db.run("UPDATE outbound_webhooks SET last_delivery_at = ?, last_delivery_status = ? WHERE id = ?",
      [Date.now(), "error", sub.id]);
    if (attempt < 4) {
      const delay = [0, 30_000, 5 * 60_000, 60 * 60_000][attempt] ?? 0;
      db.run("UPDATE outbound_webhook_log SET next_retry_at = ? WHERE id = ?", [Date.now() + delay, logId]);
    }
  }
}

function signHmac(secret: string, body: string): string {
  const h = new Bun.CryptoHasher("sha256", secret);
  h.update(body);
  return "sha256=" + h.digest("hex");
}

// Periodic retry sweep — pick up pending failed deliveries
export async function processWebhookRetries() {
  const now = Date.now();
  const pending = db.query("SELECT * FROM outbound_webhook_log WHERE delivered = 0 AND next_retry_at IS NOT NULL AND next_retry_at <= ? LIMIT 50").all(now) as any[];
  for (const log of pending) {
    const sub = db.query("SELECT * FROM outbound_webhooks WHERE id = ? AND active = 1").get(log.webhook_id) as WebhookSubscription | undefined;
    if (!sub) {
      db.run("UPDATE outbound_webhook_log SET delivered = 1 WHERE id = ?", [log.id]); // mark dead
      continue;
    }
    db.run("UPDATE outbound_webhook_log SET next_retry_at = NULL WHERE id = ?", [log.id]);
    deliverWebhook(sub, log.event_type, log.payload, log.attempt + 1).catch(() => {});
  }
}

// ============================================================
// SEARCH — across messages, projects, memory
// ============================================================

export function search(userId: string, q: string, limit = 20) {
  const term = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const messages = db.query(
    "SELECT m.id, m.session_id, m.role, m.content, m.created_at, s.title AS session_title FROM messages m JOIN chat_sessions s ON m.session_id = s.id WHERE m.user_id = ? AND m.content LIKE ? ESCAPE '\\' ORDER BY m.created_at DESC LIMIT ?"
  ).all(userId, term, limit) as any[];

  const memories = db.query(
    "SELECT id, topic, body, created_at FROM memories WHERE user_id = ? AND (topic LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT ?"
  ).all(userId, term, term, limit) as any[];

  const projects = db.query(
    "SELECT id, slug, title, mode, published, updated_at FROM projects WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR html LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT ?"
  ).all(userId, term, term, limit) as any[];

  return {
    q,
    counts: { messages: messages.length, memories: memories.length, projects: projects.length },
    messages: messages.map((m) => ({ ...m, snippet: snippet(m.content, q) })),
    memories: memories.map((m) => ({ ...m, snippet: snippet(m.body, q) })),
    projects,
  };
}

function snippet(text: string, q: string, len = 140): string {
  if (!text) return "";
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, len);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 100);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

// ============================================================
// GDPR — full export + cascade delete
// ============================================================

export function exportUserData(userId: string) {
  const u = DB.getUserById(userId);
  if (!u) return null;
  return {
    exported_at: new Date().toISOString(),
    user: u,
    profile: DB.getProfile(userId),
    settings: DB.getSettings(userId),
    subscription: DB.getSubscription(userId),
    invoices: DB.listInvoices(userId),
    chat_sessions: db.query("SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at").all(userId),
    messages: db.query("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at").all(userId),
    projects: db.query("SELECT id, slug, title, mode, published, html, files, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY created_at").all(userId),
    memories: DB.listMemories(userId),
    connectors: db.query("SELECT id, kind, created_at FROM connectors WHERE user_id = ?").all(userId), // omit secrets
    api_tokens: listApiKeys(userId),
    webhooks: listWebhooks(userId).map((w) => ({ ...w, secret: "[REDACTED]" })),
    notifications: db.query("SELECT * FROM notifications WHERE user_id = ?").all(userId),
    activity_log: db.query("SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at").all(userId),
    email_log: db.query("SELECT * FROM email_log WHERE user_id = ? ORDER BY created_at").all(userId),
    usage: db.query("SELECT * FROM usage_meter WHERE user_id = ?").all(userId),
  };
}

export function deleteUserCompletely(userId: string): { ok: boolean; deletedRows: Record<string, number> } {
  const tables = [
    "messages", "chat_sessions", "memories", "projects", "connectors",
    "api_tokens", "outbound_webhooks", "notifications", "activity_log",
    "email_log", "usage_meter", "invoices", "subscriptions", "profiles",
    "user_settings", "skills_state", "sessions", "magic_links",
    "login_attempts",
  ];
  const counts: Record<string, number> = {};
  // login_attempts uses email, magic_links uses email — handle separately
  const u = DB.getUserById(userId);
  if (!u) return { ok: false, deletedRows: counts };
  // Webhook log via webhook_id cascade
  const whIds = db.query("SELECT id FROM outbound_webhooks WHERE user_id = ?").all(userId) as { id: string }[];
  for (const w of whIds) {
    const r = db.run("DELETE FROM outbound_webhook_log WHERE webhook_id = ?", [w.id]);
    counts.webhook_log = (counts.webhook_log ?? 0) + ((r as any).changes ?? 0);
  }
  for (const t of tables) {
    if (t === "login_attempts" || t === "magic_links") {
      const r = db.run(`DELETE FROM ${t} WHERE email = ?`, [u.email]);
      counts[t] = (r as any).changes ?? 0;
    } else {
      const r = db.run(`DELETE FROM ${t} WHERE user_id = ?`, [userId]);
      counts[t] = (r as any).changes ?? 0;
    }
  }
  const r = db.run("DELETE FROM users WHERE id = ?", [userId]);
  counts.users = (r as any).changes ?? 0;
  return { ok: true, deletedRows: counts };
}

// ============================================================
// CRON SCHEDULER — in-process, persisted state
// ============================================================

type CronJob = { name: string; intervalMs: number; run: () => Promise<void> | void };
const JOBS: CronJob[] = [];
let cronStarted = false;

export function defineCron(j: CronJob) { JOBS.push(j); }

export function startCron() {
  if (cronStarted) return;
  cronStarted = true;
  // Light scheduler: every 30s, check which jobs are due
  setInterval(async () => {
    const now = Date.now();
    for (const job of JOBS) {
      const row = db.query("SELECT * FROM cron_jobs WHERE name = ?").get(job.name) as any;
      const lastRun = row?.last_run_at ?? 0;
      const enabled = row ? row.enabled : 1;
      if (!enabled) continue;
      if (now - lastRun < job.intervalMs) continue;
      // Mark first to claim the slot (single-process safe)
      db.run(
        "INSERT INTO cron_jobs (name, last_run_at, last_status, enabled) VALUES (?, ?, 'running', 1) ON CONFLICT(name) DO UPDATE SET last_run_at = excluded.last_run_at, last_status = 'running'",
        [job.name, now]
      );
      try {
        await job.run();
        db.run("UPDATE cron_jobs SET last_status = 'ok', last_error = NULL WHERE name = ?", [job.name]);
      } catch (e: any) {
        db.run("UPDATE cron_jobs SET last_status = 'error', last_error = ? WHERE name = ?", [String(e?.message || e).slice(0, 500), job.name]);
        console.error(`[cron:${job.name}]`, e);
      }
    }
  }, 30_000).unref?.();
}

export function listCronJobs() {
  return db.query("SELECT * FROM cron_jobs ORDER BY name").all();
}

// ============================================================
// NOTIFICATIONS — in-app
// ============================================================

export function notify(userId: string, opts: { kind: string; title: string; body?: string; url?: string }) {
  const id = crypto.randomUUID();
  db.run("INSERT INTO notifications (id, user_id, kind, title, body, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, userId, opts.kind, opts.title, opts.body ?? null, opts.url ?? null, Date.now()]);
  return id;
}

export function listNotifications(userId: string, limit = 20) {
  return db.query("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit);
}

export function unreadNotificationCount(userId: string): number {
  const r = db.query("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").get(userId) as any;
  return r?.n ?? 0;
}

export function markNotificationRead(userId: string, id: string) {
  db.run("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?", [Date.now(), id, userId]);
}

export function markAllNotificationsRead(userId: string) {
  db.run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [Date.now(), userId]);
}

// ============================================================
// DEEP HEALTH CHECK — verify all integrations
// ============================================================

export async function deepHealthCheck() {
  const checks: Record<string, { ok: boolean; latency_ms?: number; error?: string; detail?: string }> = {};

  // DB
  try {
    const t0 = Date.now();
    db.query("SELECT 1").get();
    checks.db = { ok: true, latency_ms: Date.now() - t0 };
  } catch (e: any) {
    checks.db = { ok: false, error: String(e?.message || e) };
  }

  // Hermes Agent native
  if (process.env.HERMES_AGENT_URL || process.env.HERMES_AGENT_PORT) {
    const url = (process.env.HERMES_AGENT_URL || `http://127.0.0.1:${process.env.HERMES_AGENT_PORT || 19002}`) + "/v1/models";
    try {
      const t0 = Date.now();
      const r = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      checks.hermes_agent = { ok: r.ok, latency_ms: Date.now() - t0, detail: `http ${r.status}` };
    } catch (e: any) {
      checks.hermes_agent = { ok: false, error: String(e?.message || e) };
    }
  }

  // Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const t0 = Date.now();
      const r = await fetch("https://api.stripe.com/v1/products?limit=1", {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        signal: AbortSignal.timeout(3_000),
      });
      checks.stripe = { ok: r.ok, latency_ms: Date.now() - t0, detail: `http ${r.status}` };
    } catch (e: any) {
      checks.stripe = { ok: false, error: String(e?.message || e) };
    }
  }

  // Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const t0 = Date.now();
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(3_000),
      });
      checks.resend = { ok: r.ok, latency_ms: Date.now() - t0, detail: `http ${r.status}` };
    } catch (e: any) {
      checks.resend = { ok: false, error: String(e?.message || e) };
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return { ok: allOk, ts: new Date().toISOString(), version: process.env.CHATHERMES_VERSION || "dev", uptime_sec: Math.floor(process.uptime()), checks };
}

// ============================================================
// Security headers — applied via Hono middleware
// ============================================================

export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  };
}
