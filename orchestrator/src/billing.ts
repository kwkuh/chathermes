// ChatHermes — Stripe subscription billing
// Plans: free / pro / team — defined in PLANS below.
// All Stripe IDs (price_xxx) come from env. Webhook handler keeps DB in sync.

import Stripe from "stripe";
import * as DB from "./db";
import * as Config from "./config";

// Stripe is built on demand instead of at import time: a key pasted into the
// admin panel has to take effect without restarting the orchestrator. The
// client is rebuilt whenever the key changes.
let _stripe: Stripe | null = null;
let _stripeKey = "";

function stripeClient(): Stripe | null {
  const key = Config.get("STRIPE_SECRET_KEY") ?? "";
  if (!key) { _stripe = null; _stripeKey = ""; return null; }
  if (!_stripe || key !== _stripeKey) {
    _stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" as any });
    _stripeKey = key;
  }
  return _stripe;
}

// Kept as a property-style export so existing `stripe?.x` call sites still work.
export const stripe = new Proxy({} as any, {
  get(_t, prop) {
    const c = stripeClient();
    if (!c) return undefined;
    const v = (c as any)[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
  has(_t, prop) { const c = stripeClient(); return !!c && prop in (c as any); },
}) as unknown as Stripe | null;

export const isStripeEnabled = () => stripeClient() !== null;

const STRIPE_WEBHOOK_SECRET_FN = () => Config.get("STRIPE_WEBHOOK_SECRET") ?? "";
const PUBLIC_BASE_URL_FN = () => Config.getOr("PUBLIC_BASE_URL", "http://localhost:7000");

// ============================================================
// PLAN DEFINITIONS — single source of truth
// ============================================================

export type PlanId = "free" | "pro" | "team";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
  stripePriceId: string;
  features: string[];
  limits: {
    messagesPerMonth: number;       // -1 means unlimited
    projectsPerMonth: number;       // -1 unlimited
    hermesAgentNative: boolean;
    teamSeats: number;
  };
};

// Defaults only. These seed the plans table on first boot; after that the
// database wins and the admin panel edits it.
export const DEFAULT_PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    currency: "usd",
    interval: "month",
    stripePriceId: "",
    features: [
      "50 messages / month",
      "Hermes 4 + Hermes Agent (basic)",
      "5 projects / month",
      "Memory up to 50 facts",
      "1 Telegram connector",
    ],
    limits: { messagesPerMonth: 50, projectsPerMonth: 5, hermesAgentNative: false, teamSeats: 1 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 2000, // $20
    currency: "usd",
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_PRO || "",
    features: [
      "Unlimited messages",
      "Hermes Agent native (40+ tools)",
      "All models — Hermes, Claude, GPT, Gemini, and more",
      "Unlimited projects + public preview",
      "Unlimited memory",
      "Priority queue",
    ],
    limits: { messagesPerMonth: -1, projectsPerMonth: -1, hermesAgentNative: true, teamSeats: 1 },
  },
  team: {
    id: "team",
    name: "Team",
    priceCents: 9900, // $99
    currency: "usd",
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_TEAM || "",
    features: [
      "Everything in Pro",
      "5 seats included",
      "Shared memory + skills",
      "Admin dashboard",
      "Audit log",
      "Email + chat support",
    ],
    limits: { messagesPerMonth: -1, projectsPerMonth: -1, hermesAgentNative: true, teamSeats: 5 },
  },
};

function rowToPlan(r: DB.PlanRow): Plan {
  let features: string[] = [];
  let limits: Plan["limits"] = { messagesPerMonth: -1, projectsPerMonth: -1, hermesAgentNative: false, teamSeats: 1 };
  try { features = JSON.parse(r.features); } catch { /* keep default */ }
  try { limits = { ...limits, ...JSON.parse(r.limits) }; } catch { /* keep default */ }
  return {
    id: r.id as PlanId,
    name: r.name,
    priceCents: r.price_cents,
    currency: r.currency,
    interval: (r.interval as "month" | "year") ?? "month",
    stripePriceId: r.stripe_price_id,
    features,
    limits,
  };
}

/** Copies the defaults into the database the first time, then never again. */
export function seedPlans() {
  try {
    if (DB.countPlanRows() > 0) return;
    let sort = 0;
    for (const p of Object.values(DEFAULT_PLANS)) {
      DB.upsertPlanRow({
        id: p.id, name: p.name, price_cents: p.priceCents, currency: p.currency,
        interval: p.interval, stripe_price_id: p.stripePriceId,
        features: JSON.stringify(p.features), limits: JSON.stringify(p.limits),
        sort: sort++, enabled: 1,
      });
    }
  } catch { /* table not ready yet; seeded on the next boot */ }
}

export function listPlans(): Plan[] {
  try {
    const rows = DB.listPlanRows();
    if (rows.length) return rows.filter((r) => r.enabled).map(rowToPlan);
  } catch { /* fall through to defaults */ }
  return Object.values(DEFAULT_PLANS);
}

export function getPlan(id: string | null | undefined): Plan {
  const all = listPlans();
  const free = all.find((p) => p.id === "free") ?? DEFAULT_PLANS.free;
  if (!id) return free;
  return all.find((p) => p.id === id) ?? free;
}

// Reverse lookup: priceId -> planId
export function planFromPriceId(priceId: string): PlanId {
  for (const p of listPlans()) if (p.stripePriceId && p.stripePriceId === priceId) return p.id;
  return "free";
}

// Back-compat for call sites that still read the old constant.
export const PLANS = new Proxy({} as Record<string, Plan>, {
  get(_t, prop: string) { return listPlans().find((p) => p.id === prop); },
  ownKeys() { return listPlans().map((p) => p.id); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; },
});

// ============================================================
// CUSTOMERS
// ============================================================

export async function ensureStripeCustomer(opts: {
  userId: string;
  email: string;
  existingCustomerId: string | null;
}): Promise<string | null> {
  if (!stripe) return null;
  if (opts.existingCustomerId) {
    try {
      const c = await stripe.customers.retrieve(opts.existingCustomerId);
      if (!(c as any).deleted) return opts.existingCustomerId;
    } catch { /* fallthrough — recreate */ }
  }
  const c = await stripe.customers.create({
    email: opts.email,
    metadata: { user_id: opts.userId },
  });
  return c.id;
}

// ============================================================
// CHECKOUT
// ============================================================

export async function createCheckoutSession(opts: {
  customerId: string;
  priceId: string;
  successPath?: string;
  cancelPath?: string;
  userId: string;
}): Promise<Stripe.Checkout.Session> {
  if (!stripe) throw new Error("Stripe not configured");
  const successUrl = `${PUBLIC_BASE_URL_FN()}${opts.successPath || "/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}"}`;
  const cancelUrl = `${PUBLIC_BASE_URL_FN()}${opts.cancelPath || "/app/billing?checkout=cancel"}`;
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: opts.customerId,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: { user_id: opts.userId },
    subscription_data: { metadata: { user_id: opts.userId } },
  });
}

// ============================================================
// CUSTOMER PORTAL
// ============================================================

export async function createPortalSession(opts: { customerId: string; returnPath?: string }): Promise<Stripe.BillingPortal.Session> {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: `${PUBLIC_BASE_URL_FN()}${opts.returnPath || "/app/billing"}`,
  });
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================

export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  if (!stripe) throw new Error("Stripe not configured");
  if (!STRIPE_WEBHOOK_SECRET_FN()) throw new Error("STRIPE_WEBHOOK_SECRET missing");
  return stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET_FN());
}
