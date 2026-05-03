# Cloud-only features (chathermes.com)

This file describes what's **identical** between this OSS repo and the
hosted version at https://chathermes.com — versus what's **operationally
different**. The code is the same. The infrastructure isn't.

## Same code (this repo)

Everything you see here is what powers chathermes.com — and is licensed
under the [ChatHermes Open Source License](../LICENSE.md) (AGPL-3.0 +
Required Attribution Addendum).

That includes:

- All 14 chat-time tools (web_search, browse, github_repo, news_search,
  weather, wikipedia, save_memory, recall_memory, telegram_send, run_js,
  fetch_url, generate_image, analyze_image, dispatch_subagent)
- Hermes Agent shared proxy (orchestrator/src/_hermes_proxy.ts)
- Private-agent provisioning module (orchestrator/src/private_agent.ts)
  — including the cloud-init template that spawns isolated per-user
  Hetzner servers
- One-click Hetzner deploy logic (orchestrator/src/deploy.ts)
- Vibe-coding workspace (web/src/app/dev/[id]/) with project quota
  enforcement and 6 starter templates
- Conversion-focused billing page with Stripe Checkout + Customer Portal
  + invoice PDF download
- Mobile super-app interface (bottom tab bar + More sheet + safe-area)
- Admin dashboard (`/admin/private-agents`, `/admin/hetzner`,
  `/admin/llm`, `/admin/billing`, `/admin/tenants`, `/admin/users`)
- Public REST API (`/api/v1/*` Bearer-authenticated, OpenAPI 3.0.3 spec)
- Outbound webhooks with HMAC signing + 3-attempt exponential backoff
- 18 transactional email templates via Resend
- Required Attribution: runtime guard + visible badge + X-Powered-By

## Operationally different (chathermes.com only)

These aren't code differences — they're things we *operate* on the hosted
version that you'd configure yourself when self-hosting:

| Capability | Self-host | chathermes.com |
|---|---|---|
| LLM API keys | bring your own (Nous, Kimi, Anthropic, OpenAI, Gemini) | pre-pooled |
| Hermes Agent native (:19002) | install via `pip install nous-hermes-agent` | pre-installed |
| Email delivery | configure Resend yourself + verify domain DNS | verified `hello@chathermes.com` |
| Stripe billing | bring your own Stripe account + price IDs | live + monitored |
| Hetzner one-click deploy | works with **your** Hetzner token | works with chathermes.com Hetzner pool |
| Backups | DIY (cron + rsync) | included, off-site |
| Updates | `git pull && bun install && bun run build` | automatic |
| Status page / SLA | none | https://chathermes.com/status, 99.9% target |
| Per-user private Hermes Agents | provisioned to **your** Hetzner project | provisioned to chathermes.com pool |
| Public preview hosting | `your-domain.com/p/<slug>` | `chathermes.com/p/<slug>` |

## Restrictions on this repo (per License)

The OSS license is AGPL-3.0 with a Required Attribution Addendum. In
short:

✅ **You can:**
- Use commercially
- Modify and redistribute
- Sell hosting

❌ **You cannot:**
- Strip the visible "Powered by ChatHermes" link from the UI
- Remove the `X-Powered-By: ChatHermes` HTTP header
- Use the name "ChatHermes" or our mascot for your fork
  (it must be re-branded if you redistribute)

These restrictions exist because we want adoption AND sustainability.
They're exactly what [Plausible](https://plausible.io),
[Discourse](https://discourse.org), and
[Mautic](https://mautic.org) do.

If you violate the attribution clause, the runtime guard will refuse to
start the orchestrator. That's a feature, not a bug.

## Want the hosted version?

[chathermes.com](https://chathermes.com) — same code, hosted by us, with
all the cloud-only operations included. From $20/mo with a free tier.

Self-hosting is genuinely free under the license terms. Pick whichever
works for you.
