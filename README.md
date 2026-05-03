# ChatHermes

> The chat that doesn't end when you close the tab.

**ChatHermes** is an open-source autonomous-agent SaaS, built on top of [Nous Research's Hermes Agent](https://github.com/NousResearch/hermes-agent) and Hermes 4. Drop a task, close the tab, come back to a finished thing — research, drafts, code, monitoring — pushed to your Telegram, deployed to a public URL, persisted in memory.

This repo is the full source of [chathermes.com](https://chathermes.com). Self-host it for free under [the ChatHermes Open Source License](./LICENSE.md), or [skip the setup](https://chathermes.com) and use the managed version.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    A chatbot is a calculator. ChatHermes is a coworker.         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

[![License: ChatHermes OSL (AGPL + Attribution)](https://img.shields.io/badge/license-AGPL_3.0_+_Attribution-amber.svg)](./LICENSE.md)
[![Built on Hermes Agent](https://img.shields.io/badge/built_on-Hermes_Agent-9333ea.svg)](https://github.com/NousResearch/hermes-agent)
[![Hosted](https://img.shields.io/badge/hosted-chathermes.com-2B2B29.svg)](https://chathermes.com)

## What's new

- **14 chat-time tools** — including 3 just added: `generate_image` (Flux), `analyze_image` (Gemini/GPT-4o vision), `dispatch_subagent` (Claude/GPT-5/Kimi parallel reasoning)
- **Per-user private Hermes Agent** — paid users auto-provision a dedicated Hetzner Cloud server (CPX11, ~€4.59/mo) running their own isolated agent on `:19002`. Free users share the local proxy. Gated by default — admin clicks Provision to spawn.
- **Vibe coding with quotas** — 5 projects/month free, unlimited Pro. 6 starter templates. Live HTML render, publish to public URL.
- **Mobile super-app interface** — bottom tab bar (Chat / Build / Memory / Plan / More), full bottom-sheet drawer for secondary nav, safe-area aware
- **Auto-detect login** — visitors with a session see "Open app" instead of "Sign in" on the landing page
- **Conversion-focused billing** — hero + 3-card pricing + comparison table + FAQ + invoice PDF download
- **Workspace status bar** — auto-detects shared vs private agent, latency dot, model chip, plan badge
- **Comprehensive Hermes Agent system prompt** — mission, multi-step planning, 14-tool reference, output style
- **Auto-refresh everywhere** — activity log, sidebar sessions, memory list, notification bell — no manual refresh needed
- **Private Agent admin** — `/admin/private-agents` fleet view with auto-readiness probe, per-user provision/destroy
- **Hetzner one-click admin** — `/admin/hetzner` for managing Hetzner Cloud fleet from inside the app

## Quick start

### Option 1: Local Docker (~5 min)

```bash
git clone https://github.com/chathermes/chathermes.git
cd chathermes
./bin/setup.sh        # interactive .env config (60s)
docker compose up -d
# → open http://localhost:7000
```

### Option 2: One-click Hetzner deploy (~90 sec)

[![Deploy to Hetzner](https://img.shields.io/badge/Deploy_to-Hetzner_Cloud-d50c2d?style=for-the-badge&logo=hetzner)](https://chathermes.com/deploy/hetzner)

The deploy logic is in `orchestrator/src/deploy.ts` — full source, AGPL.

Sign in with any email. Magic link prints to orchestrator log if you skipped Resend. Done.

See [INSTALL.md](./INSTALL.md) for production setup (HTTPS, Stripe, Resend domain, Hermes Agent native).

## What's in the box

### Core
- **Streaming multi-model chat** — Hermes 4 (405B + 70B), Hermes 3, Kimi K2 / K2 Thinking, Claude Sonnet 4.6, GPT-5, Gemini 3.1 Pro, Step 3.5 Flash. Bring your own keys.
- **Hermes Agent native** integration — 40+ tools, skills, memory when you have it installed locally on `:19002`.
- **Persistent memory** users can read/edit/curate (no black box).
- **14 built-in chat-time tools** — web_search (5-tier fallback), browse, github_repo, news_search, weather, wikipedia, telegram_send, save/recall_memory, run_js, fetch_url, **generate_image** (Replicate Flux), **analyze_image** (Gemini/GPT-4o vision), **dispatch_subagent** (Claude/GPT-5/Kimi).

### Vibe coding
- *"Build me a landing page for X"* → multi-file fullstack project → live partial-HTML render → publish to public URL at `/p/<slug>`.
- 6 starter templates: landing page, dashboard, SaaS pricing, portfolio, booking app, e-commerce.
- Per-plan project quota (5/month free, unlimited Pro/Team) with adaptive UI (green/amber/rust progress bar).

### Private Agent infrastructure (Pro feature)
- Free users share `127.0.0.1:19002` (a Bun OpenAI-compat proxy that forwards to Nous API with hermes-4-405b).
- Paid users: auto-provision a dedicated Hetzner CPX11 with cloud-init that installs Bun + isolated agent proxy + per-user auth token.
- Stripe webhook integration: subscription.created → mark `pending` → admin clicks Provision (or full auto with `AUTO_PROVISION_PRIVATE_AGENT=true`).
- Auto-readiness probe + auto-fallback to shared if private endpoint not yet ready.
- `/admin/private-agents` fleet view with auto-refresh polling.

### Billing & monetization
- **Full Stripe integration** — Checkout, Customer Portal, webhook signature verification, subscription sync, **invoice PDF download** + Stripe-hosted view.
- **Token-aware credits** — per-model rates configured via `CHATHERMES_MODEL_RATES` env var. Per-user balance, monthly grant, one-time top-up packs.
- **Conversion-focused billing page** — hero ("You're sharing. Your agent shouldn't be."), side-by-side shared vs private visual, 3-card pricing with Pro emphasized, feature comparison table, 6-question FAQ, trust bar.

### Power features
- **18 transactional email templates** via Resend (magic-link, welcome, project-published, subscription-updated, invoice-paid/failed, usage-warning, weekly-digest) with delivery/open/click tracking via Resend webhooks.
- **Public REST API** — Bearer-token authenticated, OpenAPI 3.0.3 spec at `/api/openapi.json`.
- **Outbound webhooks** — HMAC-signed event delivery with 3-attempt exponential backoff.
- **Magic-link auth** — no passwords, no SSO setup. Brute-force throttled, new-device alerts.
- **3-panel workspace** — sessions / chat / memory+tools+activity (with live polling).
- **Admin dashboard** — users, tenants, LLM provider config, email log, billing overview, real-time activity, audit trail, Hetzner Cloud fleet, Private Agent fleet.
- **CLI** — `chathermes` command with 13 admin operations (status, user, apikey, webhook, cron, backup, notify, email-test, stats).

### UI / UX
- **Mobile super-app interface** — bottom tab bar (5 tabs), bottom sheet for secondary nav, thumb-zone composer, safe-area inset support.
- **Auto-detect login** on landing page — server-side cookie check, no flash.
- **Workspace status bar** — health dot, latency, model, agent backend, plan, upgrade CTA.
- **Notification dropdown** with kind icons + auto-poll + mark read.
- **Built-in PWA** — installable, theme-aware.
- **Status page** — public real-time at `/status`.
- **Search** — Cmd+K global across messages, memory, projects.

See [docs/CLOUD_FEATURES.md](./docs/CLOUD_FEATURES.md) for the full split between this repo and chathermes.com.

## Stack

```
┌─ Web (Next.js 16, Turbopack, Tailwind 4, Motion, react-markdown)
│   └─ port 7000
├─ Orchestrator (Hono on Bun, SQLite via bun:sqlite)
│   └─ port 7010
└─ Hermes proxy (Bun, OpenAI-compat) — shared free-tier endpoint
    └─ port 19002
       ↓ forwards to upstream
       https://inference-api.nousresearch.com (Hermes-4-405B)
```

No PostgreSQL, no Redis, no Kafka. **Single SQLite file** for everything.

## Configuration

ChatHermes reads everything from environment variables — see [`orchestrator/.env.example`](./orchestrator/.env.example). Run `./bin/setup.sh` for an interactive walkthrough.

Minimum required:
- `PUBLIC_BASE_URL` — your install's public URL
- `SESSION_SECRET` — auto-generated by `setup.sh`
- One of: `NOUS_API_KEY`, `KIMI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.

Optional but recommended:
- `RESEND_API_KEY` + verified domain for email delivery
- `STRIPE_*` keys for billing (free Stripe account works)
- `CHATHERMES_MODEL_RATES` JSON for per-model credit pricing
- `HETZNER_API_TOKEN` for one-click + private agent deploys
- `REPLICATE_API_TOKEN` for image generation tool
- `GEMINI_API_KEY` for vision analysis tool

**No credentials are bundled with this repo. You configure your own.**

## Self-host vs Cloud

The code is the same. What's different is the *infrastructure*:

| | This repo (self-host) | [chathermes.com](https://chathermes.com) |
|---|---|---|
| Setup time | 5 min with Docker | 30 sec (sign in) |
| LLM API keys | bring your own | pre-pooled |
| Hermes Agent native | install yourself (5 GB) | pre-installed |
| Email | BYO Resend + DNS | verified domain |
| Public preview | `your-domain.com/p/<slug>` | `chathermes.com/p/<slug>` |
| Backups | DIY (cron) | included |
| Updates | `git pull` | automatic |
| Hetzner deploys | works with **your** token | works with our pool |
| **License** | [ChatHermes OSL](./LICENSE.md) — AGPL + Required Attribution | hosted service |
| Cost | Your infra | from $20/mo |

We genuinely want you to self-host. The hosted version pays our team to operate the cloud-only features ([see CLOUD_FEATURES.md](./docs/CLOUD_FEATURES.md)).

## License

[ChatHermes Open Source License v1.0](./LICENSE.md) — based on AGPL-3.0 with a Required Attribution Addendum. In short:

- ✅ Use, modify, redistribute. Sell hosting if you want.
- ✅ Run it commercially.
- ❌ Strip the visible "Powered by ChatHermes" link from the UI.
- ❌ Remove the `X-Powered-By: ChatHermes` HTTP header.
- ❌ Use the name "ChatHermes" or our mascot for your fork.

These restrictions exist because we want adoption AND sustainability. They are exactly what [Plausible](https://plausible.io), [Discourse](https://discourse.org), and [Mautic](https://mautic.org) do.

If you tamper with the attribution module, the runtime guard refuses to start the orchestrator. That's a feature, not a bug.

## Contributing

PRs welcome. By contributing you agree your work is licensed under the [ChatHermes Open Source License](./LICENSE.md). See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Built on

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research — the autonomous-agent runtime that makes ChatHermes possible
- [Hermes 4](https://huggingface.co/NousResearch) — Llama-based open-weights model family
- [Kimi K2](https://moonshot.ai) — Moonshot AI's reasoning model
- [Hono](https://hono.dev), [Bun](https://bun.sh), [Next.js](https://nextjs.org)
- [Resend](https://resend.com), [Stripe](https://stripe.com), [Tailwind CSS](https://tailwindcss.com)

---

Made with care by a small team in Jakarta. Thanks to Nous Research for shipping Hermes Agent in the open.
