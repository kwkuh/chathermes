// ChatHermes — runtime configuration.
//
// Everything an operator might want to change lives in the database first and
// falls back to the environment. That ordering is the whole point: a key set in
// the admin panel takes effect without an SSH session, an edit to .env, or a
// restart — while existing installs that only have env vars keep working
// untouched.
//
// Values are cached for a beat because these are read on hot paths (every chat
// turn reads model rates). setConfig() bumps the generation so a change in the
// panel is visible immediately rather than after the TTL.

import * as DB from "./db";

const TTL_MS = 5_000;

type Entry = { value: string | null; at: number };
const cache = new Map<string, Entry>();
let generation = 0;

export type ConfigKey =
  // email
  | "RESEND_API_KEY" | "RESEND_FROM" | "RESEND_REPLY_TO"
  | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASS" | "SMTP_SECURE" | "SMTP_FROM"
  | "EMAIL_PROVIDER"
  // billing
  | "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET" | "STRIPE_PUBLISHABLE_KEY"
  // credits
  | "CHATHERMES_MODEL_RATES" | "CHATHERMES_DEFAULT_RATE"
  // tools
  | "REPLICATE_API_TOKEN" | "GEMINI_API_KEY" | "OPENAI_API_KEY"
  // infra
  | "HETZNER_API_TOKEN" | "AUTO_PROVISION_PRIVATE_AGENT" | "PUBLIC_BASE_URL"
  // branding
  | "SITE_NAME";

// Keys whose values must never be returned to a browser in full.
export const SECRET_KEYS: string[] = [
  "RESEND_API_KEY", "SMTP_PASS", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "REPLICATE_API_TOKEN", "GEMINI_API_KEY", "OPENAI_API_KEY", "HETZNER_API_TOKEN",
];

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.includes(key);
}

/** Shows enough of a secret to recognise it, never enough to use it. */
export function maskSecret(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 8) return "••••••••";
  return `${v.slice(0, 3)}••••••••${v.slice(-4)}`;
}

/** DB value if set, else the environment, else null. */
export function get(key: string): string | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let value: string | null = null;
  try {
    const fromDb = DB.getSetting(`cfg:${key}`);
    if (fromDb !== null && fromDb !== "") value = fromDb;
  } catch { /* settings table not ready during first boot */ }
  if (value === null) {
    const fromEnv = process.env[key];
    if (fromEnv !== undefined && fromEnv !== "") value = fromEnv;
  }

  cache.set(key, { value, at: Date.now() });
  return value;
}

export function getOr(key: string, fallback: string): string {
  return get(key) ?? fallback;
}

export function getBool(key: string, fallback = false): boolean {
  const v = get(key);
  if (v === null) return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export function getNumber(key: string, fallback: number): number {
  const v = get(key);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Writing an empty string clears the override so the env value applies again. */
export function set(key: string, value: string | null) {
  DB.setSetting(`cfg:${key}`, value ?? "");
  cache.delete(key);
  generation++;
}

/** Where a value is actually coming from — shown in the admin panel. */
export function sourceOf(key: string): "db" | "env" | "unset" {
  try {
    const fromDb = DB.getSetting(`cfg:${key}`);
    if (fromDb !== null && fromDb !== "") return "db";
  } catch { /* ignore */ }
  const fromEnv = process.env[key];
  if (fromEnv !== undefined && fromEnv !== "") return "env";
  return "unset";
}

/** Bumped on every write; clients that cache a built object compare against it. */
export function getGeneration(): number {
  return generation;
}

export function clearCache() {
  cache.clear();
  generation++;
}
