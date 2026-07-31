// ChatHermes — credits / coins module.
// 1 credit = 1 chat message (or 1 vibe-code generation × MULTIPLIER).
// Free plan = 100 credits/month, Pro = 5000, Team = 25000.
// Top-up packs are one-time Stripe purchases that never expire.

import * as DB from "./db";
const db = DB.db;

// ============================================================
// PLAN GRANTS — credits/month per subscription tier
// ============================================================

export const PLAN_CREDITS: Record<string, number> = {
  free: 100,
  pro: 5_000,
  team: 25_000,
};

// Cost in credits per action. All ints.
export const COST: Record<string, number> = {
  chat_min: 1,        // minimum charge per chat (covers tiny messages)
  vibe_min: 3,        // minimum charge per vibe-code generation
  tool: 0,            // tool calls — covered by message + token usage
  project_publish: 0, // free
  // legacy aliases
  chat: 1,
  vibe: 3,
};

// ============================================================
// MODEL RATES — credits per 1,000 tokens (combined input + output)
// ============================================================
// Self-hosters: configure your own rates via env var CHATHERMES_MODEL_RATES
// as a JSON object. Example:
//
//   CHATHERMES_MODEL_RATES='{"nousresearch/hermes-4-405b":1,"openai/gpt-5":6}'
//
// Default: empty (every model = DEFAULT_RATE). Tune for your margins.
//
// ChatHermes Cloud uses bulk-contract LLM pricing not available standalone.
// See https://chathermes.com if you'd rather not configure pricing yourself.
// ============================================================

function loadRatesFromEnv(): Record<string, number> {
  try {
    const raw = process.env.CHATHERMES_MODEL_RATES;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    }
    return out;
  } catch (e) {
    console.warn("[credits] CHATHERMES_MODEL_RATES env var is not valid JSON:", (e as any)?.message);
    return {};
  }
}

export const MODEL_CREDITS_PER_1K: Record<string, number> = loadRatesFromEnv();

const DEFAULT_RATE = Number(process.env.CHATHERMES_DEFAULT_RATE) || 1;

export function rateForModel(modelId: string): number {
  return MODEL_CREDITS_PER_1K[modelId] ?? DEFAULT_RATE;
}

// Compute cost in credits (rounded UP) for a chat completion.
// kind: "chat" | "vibe" — vibe gets a 3x multiplier on token cost.
export function creditsForUsage(opts: { model: string; tokensIn: number; tokensOut: number; kind?: "chat" | "vibe" }): number {
  const rate = rateForModel(opts.model);
  const totalK = (opts.tokensIn + opts.tokensOut) / 1000;
  const multiplier = opts.kind === "vibe" ? 3 : 1;
  const tokenCost = Math.ceil(totalK * rate * multiplier);
  const minCost = opts.kind === "vibe" ? COST.vibe_min : COST.chat_min;
  return Math.max(minCost, tokenCost);
}

// Estimate token count from text (rough — 1 token ≈ 4 chars for English+code).
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}


// ============================================================
// TOP-UP PACKS — one-time Stripe purchases
// ============================================================

export type TopUpPack = {
  id: string;          // pack_xxx
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  bonus_pct: number;   // marketing — extra credits over base $/credit rate
  stripe_price_id: string;
};

export const TOP_UP_PACKS: TopUpPack[] = [
  { id: "starter", name: "Starter",  credits: 500,    price_cents: 500,   currency: "usd", bonus_pct: 0,   stripe_price_id: process.env.STRIPE_PRICE_PACK_STARTER || "" },
  { id: "builder", name: "Builder",  credits: 2_500,  price_cents: 2_000, currency: "usd", bonus_pct: 25,  stripe_price_id: process.env.STRIPE_PRICE_PACK_BUILDER || "" },
  { id: "power",   name: "Power",    credits: 7_000,  price_cents: 5_000, currency: "usd", bonus_pct: 40,  stripe_price_id: process.env.STRIPE_PRICE_PACK_POWER   || "" },
  { id: "max",     name: "Max",      credits: 20_000, price_cents: 10_000,currency: "usd", bonus_pct: 100, stripe_price_id: process.env.STRIPE_PRICE_PACK_MAX     || "" },
];

export function findPackByPriceId(priceId: string): TopUpPack | null {
  return TOP_UP_PACKS.find((p) => p.stripe_price_id === priceId) || null;
}
export function findPackById(id: string): TopUpPack | null {
  return TOP_UP_PACKS.find((p) => p.id === id) || null;
}

// ============================================================
// CORE: get / consume / grant
// ============================================================

export type Balance = {
  user_id: string;
  balance: number;
  monthly_grant: number;
  granted_this_period_at: number;
  lifetime_consumed: number;
  lifetime_topped_up: number;
  updated_at: number;
};

function ensureBalance(userId: string, plan: string): Balance {
  const row = db.query("SELECT * FROM credit_balances WHERE user_id = ?").get(userId) as Balance | undefined;
  if (row) return row;
  const grant = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;
  const now = Date.now();
  db.run(
    "INSERT INTO credit_balances (user_id, balance, monthly_grant, granted_this_period_at, lifetime_consumed, lifetime_topped_up, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?)",
    [userId, grant, grant, now, now]
  );
  // Log the initial grant
  recordTx(userId, +grant, "grant", null, { plan, initial: true }, grant);
  return db.query("SELECT * FROM credit_balances WHERE user_id = ?").get(userId) as Balance;
}

export function getBalance(userId: string, plan = "free"): Balance {
  return ensureBalance(userId, plan);
}

export function getBalanceWithSummary(userId: string, plan = "free") {
  const bal = ensureBalance(userId, plan);
  const used_this_period = (db.query(
    "SELECT COALESCE(SUM(-delta), 0) AS used FROM credit_transactions WHERE user_id = ? AND delta < 0 AND created_at >= ?"
  ).get(userId, bal.granted_this_period_at) as any)?.used ?? 0;
  const topped_up_this_period = (db.query(
    "SELECT COALESCE(SUM(delta), 0) AS u FROM credit_transactions WHERE user_id = ? AND reason = 'topup' AND created_at >= ?"
  ).get(userId, bal.granted_this_period_at) as any)?.u ?? 0;
  const next_reset = bal.granted_this_period_at + 30 * 86_400_000;
  return { ...bal, used_this_period, topped_up_this_period, next_reset_at: next_reset };
}

export function listTransactions(userId: string, limit = 50) {
  return db.query("SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit);
}

function recordTx(userId: string, delta: number, reason: string, refId: string | null, meta: any, balanceAfter: number) {
  db.run(
    "INSERT INTO credit_transactions (id, user_id, delta, reason, ref_id, meta, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [crypto.randomUUID(), userId, delta, reason, refId, meta ? JSON.stringify(meta) : null, balanceAfter, Date.now()]
  );
}

// Atomic consume — returns { ok, balance, needed } and never goes negative.
export function consume(userId: string, plan: string, amount: number, opts: { reason: string; refId?: string; meta?: any }): { ok: boolean; balance: number; needed: number } {
  if (amount <= 0) {
    const b = ensureBalance(userId, plan);
    return { ok: true, balance: b.balance, needed: 0 };
  }
  const b = ensureBalance(userId, plan);
  if (b.balance < amount) return { ok: false, balance: b.balance, needed: amount - b.balance };
  const newBal = b.balance - amount;
  const now = Date.now();
  db.run(
    "UPDATE credit_balances SET balance = ?, lifetime_consumed = lifetime_consumed + ?, updated_at = ? WHERE user_id = ?",
    [newBal, amount, now, userId]
  );
  recordTx(userId, -amount, opts.reason, opts.refId ?? null, opts.meta ?? null, newBal);
  return { ok: true, balance: newBal, needed: 0 };
}

// ============================================================
// GRANTS — monthly reset + top-ups
// ============================================================

export function applyMonthlyGrant(userId: string, plan: string): { granted: number; balance: number } {
  const b = ensureBalance(userId, plan);
  const now = Date.now();
  const due = (now - b.granted_this_period_at) >= 30 * 86_400_000;
  if (!due) return { granted: 0, balance: b.balance };

  const grant = PLAN_CREDITS[plan] ?? PLAN_CREDITS.free;
  // Carry over leftover up to the new grant amount (so heavy top-uppers don't lose credits)
  // Simpler model: just SET to grant, let any unused expire.
  // Hybrid: keep top-up surplus, replace monthly portion.
  // Approach: balance = max(grant, current_balance) — top-up packs preserve, monthly refills the floor.
  const newBal = Math.max(grant, b.balance);
  db.run(
    "UPDATE credit_balances SET balance = ?, monthly_grant = ?, granted_this_period_at = ?, updated_at = ? WHERE user_id = ?",
    [newBal, grant, now, now, userId]
  );
  const granted = newBal - b.balance;
  if (granted > 0) recordTx(userId, +granted, "grant", null, { plan, period_start: now }, newBal);
  return { granted, balance: newBal };
}

export function applyAllPendingGrants(): { users: number; total_granted: number } {
  const due = db.query(
    "SELECT b.user_id, COALESCE(s.plan, 'free') AS plan FROM credit_balances b LEFT JOIN subscriptions s ON s.user_id = b.user_id WHERE b.granted_this_period_at < ?"
  ).all(Date.now() - 30 * 86_400_000) as any[];
  let total = 0;
  for (const r of due) {
    const result = applyMonthlyGrant(r.user_id, r.plan);
    total += result.granted;
  }
  return { users: due.length, total_granted: total };
}

export function applyTopUp(userId: string, plan: string, credits: number, opts: { stripePaymentIntent?: string; packId?: string; amountCents?: number }): { balance: number } {
  const b = ensureBalance(userId, plan);
  const newBal = b.balance + credits;
  const now = Date.now();
  db.run(
    "UPDATE credit_balances SET balance = ?, lifetime_topped_up = lifetime_topped_up + ?, updated_at = ? WHERE user_id = ?",
    [newBal, credits, now, userId]
  );
  recordTx(userId, +credits, "topup", opts.stripePaymentIntent ?? null, { pack_id: opts.packId, amount_cents: opts.amountCents }, newBal);
  return { balance: newBal };
}

export function adminAdjust(userId: string, delta: number, note: string) {
  const b = ensureBalance(userId, "free");
  const newBal = Math.max(0, b.balance + delta);
  const actualDelta = newBal - b.balance;
  db.run("UPDATE credit_balances SET balance = ?, updated_at = ? WHERE user_id = ?", [newBal, Date.now(), userId]);
  recordTx(userId, actualDelta, "admin_adjust", null, { note }, newBal);
  return { balance: newBal, delta: actualDelta };
}

// On plan change (Stripe webhook), re-grant if upgrade increases ceiling
export function onPlanChange(userId: string, newPlan: string) {
  const b = ensureBalance(userId, newPlan);
  const newGrant = PLAN_CREDITS[newPlan] ?? PLAN_CREDITS.free;
  if (newGrant > b.monthly_grant) {
    // Top up the difference immediately so upgrade feels instant
    const bonus = newGrant - b.monthly_grant;
    const newBal = b.balance + bonus;
    const now = Date.now();
    db.run(
      "UPDATE credit_balances SET balance = ?, monthly_grant = ?, granted_this_period_at = ?, updated_at = ? WHERE user_id = ?",
      [newBal, newGrant, now, now, userId]
    );
    recordTx(userId, +bonus, "grant", null, { plan: newPlan, plan_upgrade: true }, newBal);
  } else {
    db.run("UPDATE credit_balances SET monthly_grant = ?, updated_at = ? WHERE user_id = ?", [newGrant, Date.now(), userId]);
  }
}

// ============================================================
// HELPERS
// ============================================================

export function planFor(userId: string): string {
  const sub = (db.query("SELECT plan FROM subscriptions WHERE user_id = ?").get(userId) as any)?.plan;
  return sub || "free";
}

// Aggregate: credits used per day for last N days (for chart)
export function dailyConsumption(userId: string, days = 30) {
  const since = Date.now() - days * 86_400_000;
  const rows = db.query(
    `SELECT
      strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch')) AS day,
      SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS used,
      SUM(CASE WHEN delta > 0 AND reason = 'topup' THEN delta ELSE 0 END) AS topped_up,
      SUM(CASE WHEN delta > 0 AND reason = 'grant' THEN delta ELSE 0 END) AS granted
     FROM credit_transactions
     WHERE user_id = ? AND created_at >= ?
     GROUP BY day ORDER BY day`
  ).all(userId, since) as any[];
  return rows;
}
