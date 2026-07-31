// ChatHermes — first-run web setup.
//
// A fresh install has no admin and no model, so the web UI sends the operator
// to /setup instead of a login screen they cannot pass.
//
// SECURITY: this endpoint creates the first admin, so it cannot be a plain open
// form. Anyone scanning the IP of a fresh box would otherwise claim the install
// before its owner does — self-hosted panels that "first registration wins" get
// taken over exactly this way. Instead, a token is generated on first boot,
// written to $DATA_ROOT/setup.token (0600) and printed to the log. Whoever can
// read the server can set it up; nobody else can. The token is deleted the
// moment setup completes, and every setup route then refuses to run.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import * as DB from "./db";

const DATA_ROOT = process.env.DATA_ROOT ?? "./data";
const TOKEN_PATH = process.env.SETUP_TOKEN_PATH ?? join(DATA_ROOT, "setup.token");

export function isSetupComplete(): boolean {
  if (DB.getSetting("setup_completed") === "1") return true;
  // An install that predates this wizard already has users; treat it as done so
  // an upgrade never reopens setup on a live instance.
  try {
    const n = (DB.db.query("SELECT COUNT(*) as n FROM users").get() as any)?.n ?? 0;
    if (n > 0) {
      DB.setSetting("setup_completed", "1");
      return true;
    }
  } catch { /* table may not exist yet on a truly fresh boot */ }
  return false;
}

export function getOrCreateSetupToken(): string {
  if (existsSync(TOKEN_PATH)) {
    const t = readFileSync(TOKEN_PATH, "utf8").trim();
    if (t) return t;
  }
  const token = randomBytes(24).toString("base64url");
  try {
    mkdirSync(dirname(TOKEN_PATH), { recursive: true });
    writeFileSync(TOKEN_PATH, token + "\n", { mode: 0o600 });
    chmodSync(TOKEN_PATH, 0o600);
  } catch { /* read-only fs: the log line below is then the only copy */ }
  return token;
}

export function verifySetupToken(given: string): boolean {
  if (isSetupComplete()) return false;
  const expected = getOrCreateSetupToken();
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function clearSetupToken() {
  try { if (existsSync(TOKEN_PATH)) unlinkSync(TOKEN_PATH); } catch { /* best effort */ }
}

// Printed on every boot while setup is pending, so `docker logs` is enough.
export function printSetupBanner(publicUrl: string) {
  if (isSetupComplete()) return;
  const token = getOrCreateSetupToken();
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────┐");
  console.log("  │  SETUP REQUIRED                                     │");
  console.log("  └─────────────────────────────────────────────────────┘");
  console.log(`  Open:  ${publicUrl.replace(/\/$/, "")}/setup`);
  console.log(`  Token: ${token}`);
  console.log(`  (also at ${TOKEN_PATH})`);
  console.log("");
}

export type SetupPayload = {
  token: string;
  admin_email: string;
  site_url?: string;
  site_name?: string;
  provider?: {
    name: string;
    kind: string;
    base_url: string;
    api_key: string;
    model_id: string;
    label?: string;
  };
};

// Reachable without a key on some providers, so a failure here is reported as a
// warning in the UI rather than blocking setup.
export async function testLlm(p: { base_url: string; api_key: string; model_id: string }): Promise<{ ok: boolean; error?: string }> {
  const base = p.base_url.replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.api_key}` },
      body: JSON.stringify({ model: p.model_id, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) return { ok: true };
    const body = await r.text();
    return { ok: false, error: `HTTP ${r.status}: ${body.slice(0, 180)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function completeSetup(p: SetupPayload): { userId: string } {
  const email = p.admin_email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("A valid admin email is required");

  const user = DB.upsertUser(email);
  // upsertUser derives the role from ADMIN_EMAILS, which a fresh install has no
  // reason to have set — the operator running setup is the admin by definition.
  DB.db.run("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);

  if (p.site_name) DB.setSetting("site_name", p.site_name.trim());
  if (p.site_url) DB.setSetting("public_base_url", p.site_url.trim().replace(/\/$/, ""));

  if (p.provider && p.provider.base_url && p.provider.model_id) {
    const prov = DB.createProvider({
      name: p.provider.name || "Default provider",
      kind: p.provider.kind || "openai-compatible",
      base_url: p.provider.base_url.replace(/\/$/, ""),
      api_key: p.provider.api_key || "",
      enabled: 1,
    });
    DB.createModel({
      provider_id: prov.id,
      model_id: p.provider.model_id,
      label: p.provider.label || p.provider.model_id,
      is_default: 1,
      enabled: 1,
    });
  }

  DB.setSetting("setup_completed", "1");
  DB.setSetting("setup_completed_at", String(Date.now()));
  clearSetupToken();
  return { userId: user.id };
}
