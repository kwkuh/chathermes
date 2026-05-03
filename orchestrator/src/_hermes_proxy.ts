#!/usr/bin/env bun
// ChatHermes — shared Hermes Agent proxy (free tier)
// Listens on :19002, OpenAI-compatible, routes to Nous API.
// Uses NOUS_API_KEY from env or providers DB.
// Enforces rate-limits (free tier shouldn't pound this endpoint).

import { Database } from "bun:sqlite";

const PORT = Number(process.env.HERMES_PROXY_PORT) || 19002;
const DB_PATH = process.env.CHATHERMES_DB || "./data/orchestrator.db";
const UPSTREAM_MODEL = process.env.HERMES_UPSTREAM_MODEL || "Hermes-4-405B";
const NOUS_URL = "https://inference-api.nousresearch.com/v1/chat/completions";
// Fallback ONLY when caller sends no system message — orch always sends a careful one with tool definitions
const FALLBACK_AGENTIC_PROMPT = `You are Hermes Agent — an autonomous agent built on Nous Research's Hermes 4. You reason step-by-step, plan multi-turn actions, and use tools to accomplish goals. You take action — you don't just describe what could be done. Always introduce yourself as ChatHermes when asked.`;

function getNousKey(): string | null {
  // Prefer DB providers row (admin-configured), fall back to env
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const r = db.query("SELECT api_key FROM providers WHERE base_url LIKE '%nousresearch%' AND api_key != '' LIMIT 1").get() as any;
    db.close();
    if (r?.api_key) return r.api_key;
  } catch { /* db unreadable, fall through */ }
  return process.env.NOUS_API_KEY || null;
}

// Simple in-memory rate limiter (per IP)
const buckets = new Map<string, { tokens: number; refilledAt: number }>();
const RATE_LIMIT = Number(process.env.HERMES_RATE_LIMIT) || 60; // req/min
function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: RATE_LIMIT, refilledAt: now };
  const elapsed = now - b.refilledAt;
  if (elapsed > 60_000) { b.tokens = RATE_LIMIT; b.refilledAt = now; }
  if (b.tokens <= 0) { buckets.set(ip, b); return false; }
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}

console.log(`[hermes-proxy] starting on :${PORT}`);

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",  // shared instance binds to localhost only — orch reaches it directly
  async fetch(req) {
    const url = new URL(req.url);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return Response.json({ status: "ok", upstream_model: UPSTREAM_MODEL });
    }
    if (url.pathname === "/v1/models") {
      return Response.json({
        object: "list",
        data: [{ id: "hermes-agent", object: "model", created: 0, owned_by: "chathermes" }],
      });
    }
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      if (!rateLimitOk(ip)) return new Response("rate limited", { status: 429 });
      const nousKey = getNousKey();
      if (!nousKey) return Response.json({ error: { message: "no upstream key configured" } }, { status: 500 });
      const body: any = await req.json().catch(() => ({}));
      // PRESERVE system messages from caller (orch sends carefully-built tool-aware prompt).
      // Inject FALLBACK_AGENTIC_PROMPT only if no system message was supplied.
      const inMessages = body.messages || [];
      const hasSystem = inMessages.some((m: any) => m.role === "system");
      const messages = hasSystem ? inMessages : [{ role: "system", content: FALLBACK_AGENTIC_PROMPT }, ...inMessages];
      const upstreamBody = { ...body, model: UPSTREAM_MODEL, messages };
      const upstream = await fetch(NOUS_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${nousKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(upstreamBody),
      });
      // Pass through (including SSE if streaming)
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
          "X-Powered-By": "ChatHermes-Hermes-Proxy/1.0",
        },
      });
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`[hermes-proxy] ready on :${PORT}, upstream=${UPSTREAM_MODEL}, rate=${RATE_LIMIT}/min`);
