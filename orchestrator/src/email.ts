// ChatHermes — transactional + lifecycle email via Resend
// Templates: magic_link, welcome, email_verification, sign_in_alert,
//   project_published, project_unpublished, long_job_done,
//   subscription_updated, subscription_canceled, renewal_reminder,
//   invoice_paid, invoice_failed, trial_ending,
//   usage_warning, usage_limit_reached,
//   weekly_digest, account_disabled, account_reactivated
// Plus: audiences sync, domain setup helper, batch send, scheduled send.

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "ChatHermes <onboarding@resend.dev>";
const REPLY_TO = process.env.RESEND_REPLY_TO || "hello@chathermes.com";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:7000";
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || ""; // optional: contact list

const resend: Resend | null = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
export const isEmailEnabled = () => resend !== null;
export const getResend = () => resend;

// ============================================================
// CORE SEND HELPERS
// ============================================================

type Tag = { name: string; value: string };

type SendInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  tags?: Tag[];                 // for analytics in Resend dashboard
  idempotency_key?: string;     // dedupe (e.g. "welcome:user_id")
  scheduled_at?: string;        // ISO 8601 — schedule future delivery
  reply_to?: string;
  from?: string;
};

export async function send(input: SendInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!resend) {
    const tos = Array.isArray(input.to) ? input.to.join(",") : input.to;
    console.log(`[email:dev] to=${tos} subject=${input.subject}`);
    return { ok: true, id: "dev_" + Date.now() };
  }
  try {
    const payload: any = {
      from: input.from || RESEND_FROM,
      to: Array.isArray(input.to) ? input.to : [input.to],
      reply_to: input.reply_to || REPLY_TO,
      subject: input.subject,
      html: input.html,
      text: input.text || stripHtml(input.html),
    };
    if (input.tags) payload.tags = input.tags;
    if (input.idempotency_key) payload.idempotency_key = input.idempotency_key;
    if (input.scheduled_at) payload.scheduled_at = input.scheduled_at;

    const res = await resend.emails.send(payload);
    const err = (res as any).error;
    if (err) {
      console.error("[email:resend:error]", err);
      return { ok: false, error: String(err.message || err) };
    }
    return { ok: true, id: (res as any).data?.id };
  } catch (e: any) {
    console.error("[email:resend:throw]", e);
    return { ok: false, error: String(e?.message || e) };
  }
}

// Batch — up to 100 emails in one API call (use for digests)
export async function sendBatch(emails: SendInput[]): Promise<{ ok: boolean; ids?: string[]; error?: string }> {
  if (!resend) {
    console.log(`[email:dev] batch size=${emails.length}`);
    return { ok: true, ids: emails.map((_, i) => "dev_batch_" + i) };
  }
  try {
    const items = emails.map((e) => ({
      from: e.from || RESEND_FROM,
      to: Array.isArray(e.to) ? e.to : [e.to],
      reply_to: e.reply_to || REPLY_TO,
      subject: e.subject,
      html: e.html,
      text: e.text || stripHtml(e.html),
      tags: e.tags,
    }));
    // Resend SDK v6: batch sending — try `emails.batch.send`, fall back to per-email
    const r: any = (resend.emails as any).batch?.send
      ? await (resend.emails as any).batch.send(items)
      : await Promise.all(items.map((it) => resend.emails.send(it as any)));
    const ids = Array.isArray(r) ? r.map((x: any) => x?.data?.id).filter(Boolean) : ((r as any)?.data?.data || []).map((x: any) => x?.id);
    return { ok: true, ids };
  } catch (e: any) {
    console.error("[email:resend:batch:throw]", e);
    return { ok: false, error: String(e?.message || e) };
  }
}

function stripHtml(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escape(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ============================================================
// SHELL — branded HTML wrapper used by all templates
// ============================================================

const SHELL = (inner: string, opts?: { preheader?: string }) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${opts?.preheader ? `<style>.preheader{display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#FBFAF6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;}</style>` : ""}
</head>
<body style="margin:0;background:#FBFAF6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2B2B29;">
${opts?.preheader ? `<div class="preheader">${escape(opts.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBFAF6;padding:48px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#FFFDF7;border:1px solid rgba(124,154,149,0.20);border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 40px 16px 40px;">
<div style="font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#2B2B29;">ChatHermes</div>
<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#5F7E79;margin-top:4px;">the chat that doesn't end</div>
</td></tr>
<tr><td style="padding:8px 40px 32px 40px;color:#2B2B29;font-size:15px;line-height:1.6;">${inner}</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid rgba(124,154,149,0.15);background:#F4EEDF;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:rgba(43,43,41,0.5);">
Powered by <a href="https://chathermes.com" style="color:#B07820;text-decoration:none;">ChatHermes</a> · the chat that doesn't end · <a href="${PUBLIC_BASE_URL}" style="color:#5F7E79;text-decoration:none;">${PUBLIC_BASE_URL.replace(/^https?:\/\//, "")}</a>
<br><span style="font-size:9px;letter-spacing:0.1em;text-transform:none;color:rgba(43,43,41,0.35);">If you'd rather not get these, <a href="${PUBLIC_BASE_URL}/app/settings" style="color:rgba(43,43,41,0.5);">manage notification preferences</a>.</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

const BTN = (href: string, label: string, color: "ink" | "amber" = "ink") => {
  const bg = color === "ink" ? "#2B2B29" : "#B07820";
  return `<a href="${href}" style="display:inline-block;background:${bg};color:#FBFAF6;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:15px;">${label}</a>`;
};

const CODE = (s: string) => `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#5F7E79;background:#F4EEDF;padding:12px;border-radius:8px;word-break:break-all;">${escape(s)}</div>`;

// ============================================================
// TEMPLATES — AUTH
// ============================================================

export async function sendMagicLink(opts: { to: string; verifyUrl: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Your sign-in link</p>
<p style="margin:0 0 24px 0;color:rgba(43,43,41,0.7);">Click to sign in to ChatHermes. The link expires in 30 minutes and can only be used once.</p>
<div style="margin:0 0 24px 0;">${BTN(opts.verifyUrl, "Sign in to ChatHermes →")}</div>
<p style="margin:0 0 8px 0;font-size:12px;color:rgba(43,43,41,0.5);">Or copy this URL into your browser:</p>
${CODE(opts.verifyUrl)}
<p style="margin:32px 0 0 0;font-size:12px;color:rgba(43,43,41,0.5);">If you didn't request this, you can safely ignore this email.</p>`;
  return send({
    to: opts.to,
    subject: "Sign in to ChatHermes",
    html: SHELL(inner, { preheader: "Click to sign in. Expires in 30 minutes." }),
    text: `Sign in to ChatHermes\n\n${opts.verifyUrl}\n\nExpires in 30 minutes.`,
    tags: [{ name: "category", value: "auth" }, { name: "template", value: "magic_link" }],
  });
}

export async function sendEmailVerification(opts: { to: string; verifyUrl: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Confirm your email address</p>
<p style="margin:0 0 24px 0;color:rgba(43,43,41,0.7);">Click below to confirm <b>${escape(opts.to)}</b> as your ChatHermes email.</p>
<div style="margin:0 0 24px 0;">${BTN(opts.verifyUrl, "Confirm email →")}</div>`;
  return send({
    to: opts.to,
    subject: "Confirm your email — ChatHermes",
    html: SHELL(inner),
    tags: [{ name: "category", value: "auth" }, { name: "template", value: "email_verification" }],
  });
}

export async function sendSignInAlert(opts: { to: string; ip: string; userAgent: string; when: string; revokeUrl: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">New sign-in to your account</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">We noticed a sign-in to your ChatHermes account from a new device.</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;background:#F4EEDF;border-radius:8px;">
<tr><td style="padding:12px;color:rgba(43,43,41,0.55);font-size:13px;">When</td><td style="padding:12px;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:13px;">${escape(opts.when)}</td></tr>
<tr><td style="padding:12px;color:rgba(43,43,41,0.55);font-size:13px;border-top:1px solid rgba(124,154,149,0.2);">IP</td><td style="padding:12px;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:13px;border-top:1px solid rgba(124,154,149,0.2);">${escape(opts.ip)}</td></tr>
<tr><td style="padding:12px;color:rgba(43,43,41,0.55);font-size:13px;border-top:1px solid rgba(124,154,149,0.2);">Device</td><td style="padding:12px;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:13px;border-top:1px solid rgba(124,154,149,0.2);max-width:300px;">${escape(opts.userAgent.slice(0, 80))}</td></tr>
</table>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);"><b>Was this you?</b> No action needed.</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);"><b>Wasn't you?</b> Revoke all active sessions immediately:</p>
<div style="margin:0 0 24px 0;">${BTN(opts.revokeUrl, "Revoke all sessions", "amber")}</div>`;
  return send({
    to: opts.to,
    subject: "New sign-in to ChatHermes",
    html: SHELL(inner),
    tags: [{ name: "category", value: "security" }, { name: "template", value: "sign_in_alert" }],
  });
}

// ============================================================
// TEMPLATES — ONBOARDING
// ============================================================

export async function sendWelcome(opts: { to: string; name?: string }) {
  const greeting = opts.name ? `Welcome, ${escape(opts.name)} 👋` : "Welcome to ChatHermes 👋";
  const inner = `
<p style="margin:0 0 16px 0;font-size:20px;font-weight:600;">${greeting}</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">Your private agent is now spun up and ready. Drop a task, close the tab, come back to a finished thing.</p>
<p style="margin:0 0 12px 0;color:rgba(43,43,41,0.75);">Three things to try first:</p>
<ul style="margin:0 0 24px 0;padding-left:20px;color:rgba(43,43,41,0.75);">
<li style="margin-bottom:10px;"><b>Ask anything.</b> Hermes Agent + Kimi K2 + Hermes 4 are wired up. Pick a model from the chip below the chat input.</li>
<li style="margin-bottom:10px;"><b>Vibe-code a project.</b> Try: <i>"Build me a landing page for an indie game called Aether."</i> Watch it paint live, publish to a public URL.</li>
<li style="margin-bottom:0;"><b>Connect Telegram.</b> Settings → Connectors. The agent pings you when long jobs finish.</li>
</ul>
<div style="margin:0 0 24px 0;">${BTN(`${PUBLIC_BASE_URL}/app`, "Open ChatHermes →")}</div>
<p style="margin:32px 0 0 0;font-size:12px;color:rgba(43,43,41,0.5);">Reply to this email — it goes straight to a human.</p>`;
  return send({
    to: opts.to,
    subject: "Welcome to ChatHermes",
    html: SHELL(inner, { preheader: "Your private agent is ready. Three things to try first." }),
    tags: [{ name: "category", value: "onboarding" }, { name: "template", value: "welcome" }],
    idempotency_key: `welcome:${opts.to}`,
  });
}

export async function sendOnboardingDay3(opts: { to: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:20px;font-weight:600;">Three days in. Let's level up.</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">By now you've probably tried a few prompts. Here are three things most users miss:</p>
<ul style="margin:0 0 24px 0;padding-left:20px;color:rgba(43,43,41,0.75);">
<li style="margin-bottom:10px;"><b>Memory.</b> Right panel → Memory. Tell your agent your preferences. It'll remember across sessions.</li>
<li style="margin-bottom:10px;"><b>Skills.</b> Settings → Skills. Toggle on agent capabilities like research, drafting, code review.</li>
<li style="margin-bottom:0;"><b>Hermes Agent native.</b> Pick "Hermes Agent" from the model chip — it's the full Nous Hermes Agent with 40+ tools.</li>
</ul>
<div style="margin:0 0 24px 0;">${BTN(`${PUBLIC_BASE_URL}/app`, "Continue →")}</div>`;
  return send({
    to: opts.to,
    subject: "ChatHermes — three things you might've missed",
    html: SHELL(inner),
    tags: [{ name: "category", value: "onboarding" }, { name: "template", value: "day_3" }],
    idempotency_key: `onboard_day3:${opts.to}`,
  });
}

// ============================================================
// TEMPLATES — PROJECTS
// ============================================================

export async function sendProjectPublished(opts: { to: string; projectTitle: string; publicUrl: string; projectId: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Your project is live 🚀</p>
<p style="margin:0 0 24px 0;color:rgba(43,43,41,0.75);"><b>${escape(opts.projectTitle)}</b> just went public. Anyone with the link can view it.</p>
<div style="margin:0 0 16px 0;">${BTN(opts.publicUrl, "Open it →")}</div>
${CODE(opts.publicUrl)}
<p style="margin:24px 0 0 0;font-size:12px;color:rgba(43,43,41,0.5);">To unpublish: <a href="${PUBLIC_BASE_URL}/dev/${opts.projectId}" style="color:#5F7E79;">go to your project</a> and toggle off "Public".</p>`;
  return send({
    to: opts.to,
    subject: `${opts.projectTitle} is live`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "project" }, { name: "template", value: "published" }],
  });
}

export async function sendProjectUnpublished(opts: { to: string; projectTitle: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Project unpublished</p>
<p style="margin:0 0 24px 0;color:rgba(43,43,41,0.75);"><b>${escape(opts.projectTitle)}</b> is no longer publicly accessible.</p>`;
  return send({
    to: opts.to,
    subject: `${opts.projectTitle} — unpublished`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "project" }, { name: "template", value: "unpublished" }],
  });
}

// ============================================================
// TEMPLATES — AGENT JOBS
// ============================================================

export async function sendJobDone(opts: { to: string; jobTitle: string; summary: string; openUrl: string; durationSec?: number }) {
  const dur = opts.durationSec ? ` · ${formatDuration(opts.durationSec)}` : "";
  const inner = `
<p style="margin:0 0 8px 0;font-size:18px;font-weight:600;">Your agent finished ✓${dur}</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);"><b>${escape(opts.jobTitle)}</b></p>
<div style="margin:0 0 24px 0;background:#F4EEDF;padding:16px;border-radius:8px;color:rgba(43,43,41,0.85);font-size:14px;line-height:1.55;">${escape(opts.summary).slice(0, 800)}${opts.summary.length > 800 ? "…" : ""}</div>
<div style="margin:0 0 24px 0;">${BTN(opts.openUrl, "Read full result →")}</div>`;
  return send({
    to: opts.to,
    subject: `Done: ${opts.jobTitle}`,
    html: SHELL(inner, { preheader: opts.summary.slice(0, 100) }),
    tags: [{ name: "category", value: "agent" }, { name: "template", value: "job_done" }],
  });
}

export async function sendOvernightDigest(opts: { to: string; jobs: Array<{ title: string; summary: string; openUrl?: string }> }) {
  const list = opts.jobs.map((j, i) => `
<div style="margin:0 0 16px 0;padding:12px;background:#F4EEDF;border-radius:8px;">
<div style="font-weight:600;font-size:14.5px;margin-bottom:4px;">${i + 1}. ${escape(j.title)}</div>
<div style="color:rgba(43,43,41,0.65);font-size:13.5px;line-height:1.5;">${escape(j.summary).slice(0, 200)}</div>
${j.openUrl ? `<div style="margin-top:8px;"><a href="${j.openUrl}" style="color:#5F7E79;font-size:12.5px;">Open →</a></div>` : ""}
</div>`).join("");
  const inner = `
<p style="margin:0 0 8px 0;font-size:20px;font-weight:600;">While you slept 🌙</p>
<p style="margin:0 0 24px 0;color:rgba(43,43,41,0.75);">Your agent ran <b>${opts.jobs.length}</b> ${opts.jobs.length === 1 ? "job" : "jobs"} overnight.</p>
${list}
<div style="margin:24px 0 0 0;">${BTN(`${PUBLIC_BASE_URL}/app`, "Open ChatHermes →")}</div>`;
  return send({
    to: opts.to,
    subject: `${opts.jobs.length} overnight ${opts.jobs.length === 1 ? "job" : "jobs"} — ChatHermes`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "agent" }, { name: "template", value: "overnight_digest" }],
  });
}

// ============================================================
// TEMPLATES — BILLING
// ============================================================

export async function sendOrderConfirmation(opts: { to: string; orderName: string; amountCents: number; currency: string; receiptUrl?: string }) {
  const amount = (opts.amountCents / 100).toFixed(2);
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Order confirmed</p>
<p style="margin:0 0 8px 0;color:rgba(43,43,41,0.75);">${escape(opts.orderName)}</p>
<div style="font-family:Georgia,serif;font-size:36px;font-weight:600;letter-spacing:-0.02em;margin:8px 0 24px 0;">${opts.currency.toUpperCase()} ${amount}</div>
${opts.receiptUrl ? `<div style="margin:0 0 24px 0;">${BTN(opts.receiptUrl, "View receipt →")}</div>` : ""}
<p style="margin:24px 0 0 0;font-size:12px;color:rgba(43,43,41,0.5);">A copy of this receipt is in your <a href="${PUBLIC_BASE_URL}/app/billing" style="color:#5F7E79;">billing history</a>.</p>`;
  return send({
    to: opts.to,
    subject: `Order confirmed — ${opts.currency.toUpperCase()} ${amount}`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "billing" }, { name: "template", value: "order" }],
  });
}

export async function sendSubscriptionUpdated(opts: { to: string; plan: string; status: string; portalUrl?: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Your ChatHermes plan changed</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;">
<tr><td style="padding:8px 0;color:rgba(43,43,41,0.55);font-size:13px;">Plan</td><td style="padding:8px 0;text-align:right;font-weight:600;text-transform:capitalize;">${escape(opts.plan)}</td></tr>
<tr><td style="padding:8px 0;border-top:1px solid rgba(124,154,149,0.15);color:rgba(43,43,41,0.55);font-size:13px;">Status</td><td style="padding:8px 0;border-top:1px solid rgba(124,154,149,0.15);text-align:right;font-weight:600;text-transform:capitalize;">${escape(opts.status)}</td></tr>
</table>
${opts.portalUrl ? `<div style="margin:0 0 24px 0;">${BTN(opts.portalUrl, "Manage billing →")}</div>` : `<div style="margin:0 0 24px 0;">${BTN(`${PUBLIC_BASE_URL}/app/billing`, "Manage billing →")}</div>`}`;
  return send({
    to: opts.to,
    subject: `ChatHermes — ${opts.plan} (${opts.status})`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "billing" }, { name: "template", value: "subscription_updated" }, { name: "plan", value: opts.plan }],
  });
}

export async function sendSubscriptionCanceled(opts: { to: string; plan: string; activeUntil: string; resumeUrl: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Subscription canceled</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">Your <b>${escape(opts.plan)}</b> subscription is canceled. You'll keep access until <b>${escape(opts.activeUntil)}</b>, then drop to Free.</p>
<p style="margin:0 0 24px 0;color:rgba(43,43,41,0.75);">Changed your mind?</p>
<div style="margin:0 0 24px 0;">${BTN(opts.resumeUrl, "Resume subscription", "amber")}</div>`;
  return send({
    to: opts.to,
    subject: "Your ChatHermes subscription is canceled",
    html: SHELL(inner),
    tags: [{ name: "category", value: "billing" }, { name: "template", value: "subscription_canceled" }],
  });
}

export async function sendRenewalReminder(opts: { to: string; plan: string; renewsOn: string; amountCents: number; currency: string; portalUrl: string }) {
  const amount = (opts.amountCents / 100).toFixed(2);
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Your subscription renews in 3 days</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">On <b>${escape(opts.renewsOn)}</b>, your card will be charged <b>${opts.currency.toUpperCase()} ${amount}</b> for the <b>${escape(opts.plan)}</b> plan.</p>
<div style="margin:0 0 24px 0;">${BTN(opts.portalUrl, "Manage billing →")}</div>
<p style="margin:24px 0 0 0;font-size:12px;color:rgba(43,43,41,0.5);">Want to cancel before the renewal? Open the portal above and click "Cancel".</p>`;
  return send({
    to: opts.to,
    subject: `Renewing in 3 days — ${opts.currency.toUpperCase()} ${amount}`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "billing" }, { name: "template", value: "renewal_reminder" }],
  });
}

export async function sendInvoicePaid(opts: { to: string; amountCents: number; currency: string; invoiceUrl?: string; description?: string }) {
  const amount = (opts.amountCents / 100).toFixed(2);
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Payment received ✓</p>
<p style="margin:0 0 8px 0;color:rgba(43,43,41,0.75);">${escape(opts.description || "ChatHermes subscription")}</p>
<div style="font-family:Georgia,serif;font-size:36px;font-weight:600;letter-spacing:-0.02em;margin:8px 0 24px 0;">${opts.currency.toUpperCase()} ${amount}</div>
${opts.invoiceUrl ? `<div style="margin:0 0 24px 0;">${BTN(opts.invoiceUrl, "Download invoice →")}</div>` : ""}
<p style="margin:24px 0 0 0;font-size:12px;color:rgba(43,43,41,0.5);">Thanks for supporting independent AI from Indonesia.</p>`;
  return send({
    to: opts.to,
    subject: `Receipt — ${opts.currency.toUpperCase()} ${amount}`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "billing" }, { name: "template", value: "invoice_paid" }],
  });
}

export async function sendInvoiceFailed(opts: { to: string; amountCents: number; currency: string; portalUrl: string; reason?: string }) {
  const amount = (opts.amountCents / 100).toFixed(2);
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#C25434;">Payment failed</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">We couldn't charge your card for <b>${opts.currency.toUpperCase()} ${amount}</b>.${opts.reason ? ` Reason: <i>${escape(opts.reason)}</i>` : ""}</p>
<p style="margin:0 0 24px 0;color:rgba(43,43,41,0.75);">Please update your payment method to keep your subscription active. Your account will downgrade to Free if not resolved within 7 days.</p>
<div style="margin:0 0 24px 0;">${BTN(opts.portalUrl, "Update payment method", "amber")}</div>`;
  return send({
    to: opts.to,
    subject: `Action needed — payment failed`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "billing" }, { name: "template", value: "invoice_failed" }],
  });
}

export async function sendTrialEnding(opts: { to: string; trialEndsOn: string; upgradeUrl: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Your trial ends ${escape(opts.trialEndsOn)}</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">Upgrade to keep unlimited messages, Hermes Agent native, and all models.</p>
<div style="margin:0 0 24px 0;">${BTN(opts.upgradeUrl, "Upgrade to Pro →", "amber")}</div>`;
  return send({
    to: opts.to,
    subject: `Trial ending ${opts.trialEndsOn}`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "billing" }, { name: "template", value: "trial_ending" }],
  });
}

// ============================================================
// TEMPLATES — USAGE / LIMITS
// ============================================================

export async function sendUsageWarning(opts: { to: string; pct: number; used: number; limit: number; metric: string; upgradeUrl: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">You've used ${opts.pct}% of your ${escape(opts.metric)} this month</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;">
<tr><td style="padding:12px;background:#F4EEDF;border-radius:8px;">
<div style="height:8px;background:rgba(43,43,41,0.08);border-radius:4px;overflow:hidden;margin-bottom:8px;">
<div style="height:8px;width:${Math.min(100, opts.pct)}%;background:${opts.pct >= 90 ? "#C25434" : "#B07820"};border-radius:4px;"></div>
</div>
<div style="font-family:ui-monospace,Menlo,monospace;font-size:13px;color:rgba(43,43,41,0.7);">${opts.used.toLocaleString()} / ${opts.limit.toLocaleString()}</div>
</td></tr>
</table>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">Want to keep going without limits? Pro gives you unlimited ${escape(opts.metric)}.</p>
<div style="margin:0 0 24px 0;">${BTN(opts.upgradeUrl, "Upgrade to Pro →", "amber")}</div>`;
  return send({
    to: opts.to,
    subject: `${opts.pct}% of monthly ${opts.metric} used`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "usage" }, { name: "template", value: "usage_warning" }],
    idempotency_key: `usage_warn:${opts.to}:${new Date().toISOString().slice(0, 7)}:${opts.pct}`,
  });
}

export async function sendUsageLimitReached(opts: { to: string; metric: string; upgradeUrl: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#C25434;">You've hit this month's ${escape(opts.metric)} limit</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">Your agent is paused for ${escape(opts.metric)} until next month — or upgrade to remove the limit immediately.</p>
<div style="margin:0 0 24px 0;">${BTN(opts.upgradeUrl, "Upgrade to Pro →", "amber")}</div>`;
  return send({
    to: opts.to,
    subject: `Limit reached — ${opts.metric}`,
    html: SHELL(inner),
    tags: [{ name: "category", value: "usage" }, { name: "template", value: "usage_limit" }],
  });
}

// ============================================================
// TEMPLATES — ACCOUNT
// ============================================================

export async function sendAccountDisabled(opts: { to: string; reason?: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#C25434;">Your account has been disabled</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">An administrator has disabled access to your ChatHermes account.${opts.reason ? ` Reason: <i>${escape(opts.reason)}</i>` : ""}</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">If you believe this is a mistake, reply to this email and we'll look into it.</p>`;
  return send({
    to: opts.to,
    subject: "Your ChatHermes account is disabled",
    html: SHELL(inner),
    tags: [{ name: "category", value: "account" }, { name: "template", value: "disabled" }],
  });
}

export async function sendAccountReactivated(opts: { to: string }) {
  const inner = `
<p style="margin:0 0 16px 0;font-size:18px;font-weight:600;">Welcome back ✓</p>
<p style="margin:0 0 16px 0;color:rgba(43,43,41,0.75);">Your ChatHermes account has been reactivated. You can sign in again now.</p>
<div style="margin:0 0 24px 0;">${BTN(`${PUBLIC_BASE_URL}/auth/login`, "Sign in →")}</div>`;
  return send({
    to: opts.to,
    subject: "Your ChatHermes account is back",
    html: SHELL(inner),
    tags: [{ name: "category", value: "account" }, { name: "template", value: "reactivated" }],
  });
}

// ============================================================
// TEMPLATES — ENGAGEMENT
// ============================================================

export async function sendWeeklyDigest(opts: { to: string; messages: number; projects: number; toolCalls: number; topProjects?: Array<{ title: string; url: string }> }) {
  const top = (opts.topProjects || []).slice(0, 3).map((p) => `<li style="margin-bottom:6px;"><a href="${p.url}" style="color:#5F7E79;">${escape(p.title)}</a></li>`).join("");
  const inner = `
<p style="margin:0 0 16px 0;font-size:20px;font-weight:600;">Your week with ChatHermes</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;">
<tr>
<td style="text-align:center;padding:16px 8px;background:#F4EEDF;border-radius:8px 0 0 8px;border-right:1px solid rgba(124,154,149,0.2);">
<div style="font-family:Georgia,serif;font-size:32px;font-weight:600;">${opts.messages.toLocaleString()}</div>
<div style="font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:rgba(43,43,41,0.55);text-transform:uppercase;letter-spacing:0.16em;">messages</div>
</td>
<td style="text-align:center;padding:16px 8px;background:#F4EEDF;border-right:1px solid rgba(124,154,149,0.2);">
<div style="font-family:Georgia,serif;font-size:32px;font-weight:600;">${opts.projects.toLocaleString()}</div>
<div style="font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:rgba(43,43,41,0.55);text-transform:uppercase;letter-spacing:0.16em;">projects</div>
</td>
<td style="text-align:center;padding:16px 8px;background:#F4EEDF;border-radius:0 8px 8px 0;">
<div style="font-family:Georgia,serif;font-size:32px;font-weight:600;">${opts.toolCalls.toLocaleString()}</div>
<div style="font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:rgba(43,43,41,0.55);text-transform:uppercase;letter-spacing:0.16em;">tool calls</div>
</td>
</tr>
</table>
${top ? `<p style="margin:0 0 8px 0;color:rgba(43,43,41,0.55);font-size:13px;">Top projects this week:</p><ul style="margin:0 0 24px 0;padding-left:20px;">${top}</ul>` : ""}
<div style="margin:0 0 24px 0;">${BTN(`${PUBLIC_BASE_URL}/app`, "Open ChatHermes →")}</div>`;
  return send({
    to: opts.to,
    subject: "Your week with ChatHermes",
    html: SHELL(inner),
    tags: [{ name: "category", value: "engagement" }, { name: "template", value: "weekly_digest" }],
    idempotency_key: `digest:${opts.to}:${weekStamp()}`,
  });
}

// ============================================================
// AUDIENCES — auto-sync user list to Resend for marketing broadcasts
// ============================================================

export async function addToAudience(email: string, opts?: { firstName?: string; lastName?: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!resend || !RESEND_AUDIENCE_ID) return { ok: false, error: "audience not configured" };
  try {
    const r: any = await resend.contacts.create({
      audienceId: RESEND_AUDIENCE_ID,
      email,
      firstName: opts?.firstName,
      lastName: opts?.lastName,
      unsubscribed: false,
    } as any);
    if (r?.error) return { ok: false, error: String(r.error?.message || r.error) };
    return { ok: true, id: r?.data?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function removeFromAudience(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!resend || !RESEND_AUDIENCE_ID) return { ok: false, error: "audience not configured" };
  try {
    await resend.contacts.remove({ audienceId: RESEND_AUDIENCE_ID, email } as any);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ============================================================
// DOMAIN — programmatic setup helpers
// ============================================================

export async function setupDomain(name: string): Promise<{ ok: boolean; id?: string; records?: any[]; error?: string }> {
  if (!resend) return { ok: false, error: "resend not configured" };
  try {
    const r: any = await resend.domains.create({ name } as any);
    if (r?.error) return { ok: false, error: String(r.error?.message || r.error) };
    return { ok: true, id: r?.data?.id, records: r?.data?.records };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function listDomains(): Promise<{ ok: boolean; domains?: any[]; error?: string }> {
  if (!resend) return { ok: false, error: "resend not configured" };
  try {
    const r: any = await resend.domains.list();
    return { ok: true, domains: (r?.data?.data ?? r?.data ?? []) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function verifyDomain(id: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  if (!resend) return { ok: false, error: "resend not configured" };
  try {
    const r: any = await resend.domains.verify(id);
    if (r?.error) return { ok: false, error: String(r.error?.message || r.error) };
    return { ok: true, status: r?.data?.status };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

function weekStamp(): string {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}W${week}`;
}
