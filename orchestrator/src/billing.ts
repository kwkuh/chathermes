// ChatHermes — Stripe subscription billing
// Plans: free / pro / team — defined in PLANS below.
// All Stripe IDs (price_xxx) come from env. Webhook handler keeps DB in sync.

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:7000";

export const stripe: Stripe | null = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" as any })
  : null;

export const isStripeEnabled = () => stripe !== null;

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

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    currency: "usd",
    interval: "month",
    stripePriceId: "",
    features: [
      "50 messages / month",
      "Kimi K2 + Hermes 4 (basic)",
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
      "All models — Hermes, Kimi, Claude, GPT, Gemini",
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

export function getPlan(id: string | null | undefined): Plan {
  if (!id) return PLANS.free;
  return PLANS[id as PlanId] || PLANS.free;
}

// Reverse lookup: priceId -> planId
export function planFromPriceId(priceId: string): PlanId {
  for (const p of Object.values(PLANS)) if (p.stripePriceId && p.stripePriceId === priceId) return p.id;
  return "free";
}

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
  const successUrl = `${PUBLIC_BASE_URL}${opts.successPath || "/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}"}`;
  const cancelUrl = `${PUBLIC_BASE_URL}${opts.cancelPath || "/app/billing?checkout=cancel"}`;
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
    return_url: `${PUBLIC_BASE_URL}${opts.returnPath || "/app/billing"}`,
  });
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================

export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  if (!stripe) throw new Error("Stripe not configured");
  if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET missing");
  return stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}
