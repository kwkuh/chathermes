# Cloud-only differences

This document is the authoritative split between the **OSS repo** (this) and the **managed service** at [chathermes.com](https://chathermes.com). The code in this repo is what powers chathermes.com — what differs is the *operations*, not the *features*.

---

## What's identical (you get this when you self-host)

Every feature works under self-host:

- All 14 chat-time tools (web_search, browse, github_repo, news_search, weather, wikipedia, save_memory, recall_memory, telegram_send, run_js, fetch_url, generate_image, analyze_image, dispatch_subagent)
- Hermes Agent shared proxy (`orchestrator/src/_hermes_proxy.ts`)
- Private-agent provisioning module (`orchestrator/src/private_agent.ts`) — including cloud-init template that spawns isolated Hetzner servers per paid user
- One-click Hetzner deploy logic (`orchestrator/src/deploy.ts`)
- Vibe-coding workspace (`web/src/app/dev/[id]/`) with project quota enforcement and 6 starter templates
- Conversion-focused billing page with Stripe Checkout + Customer Portal + invoice PDF download
- Mobile super-app interface (bottom tab bar + More sheet + safe-area)
- Cinematic /introducing demo with narration MP3s + procedural backsound
- Admin dashboard (`/admin/private-agents`, `/admin/hetzner`, `/admin/llm`, `/admin/billing`, `/admin/tenants`, `/admin/users`, `/admin/email`)
- Public REST API (`/api/v1/*` Bearer-authenticated, OpenAPI 3.0.3 spec)
- Outbound webhooks with HMAC signing + 3-attempt exponential backoff
- 18 transactional email templates via Resend
- Required Attribution: runtime guard + visible badge + X-Powered-By header

---

## What's operationally different (we run it; you'd run it yourself)

These aren't code differences — they're things we operate on chathermes.com that you'd configure / operate yourself when self-hosting:

| Capability | Self-host (this repo) | chathermes.com |
|---|---|---|
| **LLM API keys** | bring your own (Nous, Kimi, Anthropic, OpenAI, Gemini, etc.) | pre-pooled across users |
| **Hermes Agent native** (`:19002`) | install via `pip install nous-hermes-agent` | pre-installed on production |
| **Email delivery** | configure Resend yourself + verify domain DNS | verified `hello@chathermes.com` |
| **Stripe billing** | bring your own Stripe account + price IDs | live + monitored |
| **Hetzner Cloud deploys** | works with **your** Hetzner token | works with chathermes.com Hetzner pool |
| **Private Hermes Agents** | provisioned to **your** Hetzner project | provisioned to chathermes.com pool |
| **Auto-provisioning on upgrade** | gated by default (`AUTO_PROVISION_PRIVATE_AGENT=false`) | enabled (paid plans auto-spawn) |
| **Backups** | DIY (cron + rsync) | included, off-site |
| **Updates** | `git pull && bun install && bun run build` | automatic |
| **Status page / SLA** | none unless you build it | https://chathermes.com/status, 99.9% target |
| **Public preview hosting** | `your-domain.com/p/<slug>` | `chathermes.com/p/<slug>` |
| **Default admin email** | none (configure `ADMIN_EMAILS` env var) | locked to founding team |
| **Per-model credit rates** | empty default — admin configures via `CHATHERMES_MODEL_RATES` JSON | tuned for our cost basis |

---

## What's restricted by license

Per [LICENSE.md](../LICENSE.md), the OSS distribution adds these requirements on top of AGPL-3.0:

### You CAN
- Use commercially
- Modify and redistribute
- Sell hosting (with your own brand if you re-brand fully)
- Charge for support, customizations, deployments

### You CANNOT
- Strip the visible "Powered by ChatHermes" link from the UI
- Remove the `X-Powered-By: ChatHermes` HTTP header
- Use the name "ChatHermes" or our mascot for your fork (you must re-brand if you redistribute under a different name)

### Enforcement
- The runtime guard in `orchestrator/src/_attribution.ts` refuses to start the orchestrator if the attribution module is missing or visibly tampered with
- The X-Powered-By header is set in middleware on every response
- The /p/<slug> public preview includes a floating "Made with ChatHermes" badge

These restrictions exist because we want adoption AND sustainability. They're exactly what [Plausible](https://plausible.io), [Discourse](https://discourse.org), and [Mautic](https://mautic.org) do.

---

## Want the hosted version?

[chathermes.com](https://chathermes.com) — same code, hosted by us, with all the cloud-only operations included. From $20/mo with a free tier (50 messages/month, 5 vibe-coding projects).

Self-hosting is genuinely free under the license terms. Pick whichever works for you.
