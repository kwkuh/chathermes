# Installing ChatHermes

Three install paths — pick one.

## Path 0 — Quickstart (one command, ~3 min)

```bash
git clone https://github.com/ai-co-id/chathermes.git
cd chathermes
./bin/install.sh         # → setup wizard + deps + build + smoke test
./bin/start.sh           # → boots all 3 services
```

Open `http://localhost:7000`. Sign in with any email — magic link prints to the orchestrator log if you skipped Resend setup.

Health check anytime:
```bash
./bin/health.sh
```

Stop:
```bash
./bin/stop.sh
```

Requires: **Bun >= 1.3** (`curl -fsSL https://bun.sh/install | bash`), **Node >= 22** (for Next.js build), **openssl**, **sqlite3** (optional, for `health.sh` DB checks).

## Path 1 — One-click deploy to Hetzner (~90 sec)

If you have a Hetzner Cloud account and an API token: open `https://your-self-host.com/deploy/hetzner` (or the hosted equivalent) and follow the wizard. The deploy logic is in `orchestrator/src/deploy.ts` — fully open source. You can call the API directly:

```bash
curl -X POST https://your-self-host.com/api/deploy/hetzner \
  -H "Content-Type: application/json" \
  -d '{
    "token":"hcloud_...",
    "server_type":"cx22",
    "location":"nbg1",
    "llm_keys":{"nous":"..."}
  }'
```

## Path 2 — Manual / step-by-step

If `./bin/install.sh` fails or you want full control:

```bash
git clone https://github.com/ai-co-id/chathermes.git
cd chathermes

# 1. Generate .env interactively (or copy + edit)
./bin/setup.sh
#   OR:
#   cp orchestrator/.env.example orchestrator/.env
#   # then set SESSION_SECRET=$(openssl rand -hex 32) etc.

# 2. Orchestrator
cd orchestrator
bun install
PORT=7010 bun run src/index.ts &

# 3. Hermes proxy (in another terminal)
cd orchestrator
HERMES_PROXY_PORT=19002 bun run src/_hermes_proxy.ts &

# 4. Web (in another terminal)
cd web
bun install
bun run build
PORT=7000 ORCH_URL=http://127.0.0.1:7010 bun run start
```

For long-running production, see `deploy/systemd/INSTALL.md`.

## Path 3 — Production behind a domain + HTTPS

Follow Path 0 or 2 first. Then:

1. Point DNS A record: `your-domain.com` -> your server IP.
2. nginx reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:7000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host $host;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    location ~ ^/api/(stripe|resend)/webhook$ {
        proxy_pass http://127.0.0.1:7000;
        proxy_request_buffering off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

3. HTTPS via Certbot:
```bash
sudo certbot --nginx -d your-domain.com
```

4. Update `orchestrator/.env`:
```
PUBLIC_BASE_URL=https://your-domain.com
NODE_ENV=production
```

5. Restart: `./bin/stop.sh && ./bin/start.sh` (or `sudo systemctl restart chathermes.target` if using systemd).

---

## Optional integrations

### Email — Resend

1. Sign up at https://resend.com (free tier: 3,000 emails/mo).
2. Verify your domain at https://resend.com/domains.
3. Add to `orchestrator/.env`:
```
RESEND_API_KEY=re_xxx
RESEND_FROM=ChatHermes <hello@your-domain.com>
RESEND_REPLY_TO=hello@your-domain.com
```

### Billing — Stripe

1. https://dashboard.stripe.com/products — create products:
   - "Pro" plan — set whatever monthly price you want — copy `price_xxx`
   - "Team" plan — set whatever monthly price you want — copy `price_xxx`
2. https://dashboard.stripe.com/webhooks — add endpoint:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
3. Add to `orchestrator/.env`:
```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
```

### Per-model credit pricing

```
CHATHERMES_MODEL_RATES={"moonshotai/kimi-k2-thinking":1,"openai/gpt-5":6}
CHATHERMES_DEFAULT_RATE=1
```

### Hermes Agent native (40+ tools)

ChatHermes ships a built-in proxy on `:19002` that talks to whichever Hermes Agent runtime is running locally. To swap the proxy for the real Nous Research runtime:

```bash
# Install Nous Research's Hermes Agent runtime per upstream docs:
# https://hermes-agent.nousresearch.com/
hermes auth login
hermes gateway run         # exposes :19002
```

Once `:19002` is up, ChatHermes auto-detects it.

### Private Hermes Agent provisioning

By default, gated mode (admin clicks "Provision" per upgrade in `/admin/private-agents`). To enable full automation on Stripe webhook:

```
AUTO_PROVISION_PRIVATE_AGENT=true
HETZNER_API_TOKEN=hcloud_...
```

### Image generation tool

```
REPLICATE_API_TOKEN=r8_...
```

### Vision analysis tool

```
GEMINI_API_KEY=AIza...
# or
OPENAI_API_KEY=sk-...
```

### Web search (better than DDG fallback)

```
TAVILY_API_KEY=tvly-...
# or
BRAVE_API_KEY=BSA...
```

---

## Database

Single SQLite file at `${DATA_ROOT}/orchestrator.db`. Migrations + table bootstrap applied automatically on startup. The orchestrator auto-creates the data directory if missing.

Backup:
```bash
sqlite3 orchestrator/data/orchestrator.db ".backup ./backup-$(date +%F).db"
```

## Update

```bash
git pull
./bin/stop.sh
./bin/install.sh         # re-runs verify + reinstalls if package.json changed
./bin/start.sh
```

If you hit weirdness after an update, force a clean rebuild:
```bash
rm -rf web/.next orchestrator/node_modules web/node_modules
./bin/install.sh
```

---

## Troubleshooting

These are the actual errors we hit during fresh-install testing — you may hit them too.

### `error: cannot find table cron_jobs` on startup

**Cause:** orchestrator was cloned from an older commit before the table-bootstrap fix. The orchestrator references 9 tables that older schemas didn't create (`cron_jobs`, `notifications`, `outbound_webhooks`, `outbound_webhook_log`, `email_log`, `credit_balances`, `credit_transactions`, `login_attempts`, `rate_limit_buckets`).

**Fix:** pull latest. The current `main` branch creates these tables defensively at startup.

```bash
git pull
./bin/stop.sh && ./bin/install.sh && ./bin/start.sh
```

### `EACCES: permission denied, mkdir './data'`

**Cause:** orchestrator is running under a user that can't write to its working directory.

**Fix:** either run as a user that can write, or set `DATA_ROOT` in `orchestrator/.env` to a writable path:
```
DATA_ROOT=/var/lib/chathermes
```
Then `mkdir -p /var/lib/chathermes && chown -R $(whoami) /var/lib/chathermes`.

### `Error: listen EADDRINUSE :::7000`

**Cause:** another process owns the port.

**Fix:**
```bash
./bin/stop.sh                          # kill our own services
lsof -iTCP:7000 -sTCP:LISTEN          # find the squatter
# OR pick different ports:
PORT=8000 ORCH_PORT=8010 HERMES_PROXY_PORT=19102 ./bin/start.sh
```

### Magic link never arrives

**Cause:** Resend not configured, or `PUBLIC_BASE_URL` mismatches the URL the browser actually visits.

**Fix:**
- For dev: don't bother with Resend. Tail `orchestrator` log — magic links print to stdout when `RESEND_API_KEY` is empty.
- For prod: set `RESEND_API_KEY` + `RESEND_FROM`, and make sure `PUBLIC_BASE_URL=https://your-domain.com` matches what the browser sees.

### `bun: command not found`

```bash
curl -fsSL https://bun.sh/install | bash
exec $SHELL                           # reload PATH
bun --version                         # should print 1.3+
```

### Next.js build fails with `Module not found: 'lucide-react/.../Cloud'`

**Cause:** lucide-react minor version mismatch. Some icon names changed historically.

**Fix:** `cd web && rm -rf node_modules .next && bun install && bun run build`. If still failing, file an issue with the exact icon name from the error.

### `web/.next/cache: EACCES: permission denied`

**Cause:** the `chathermes` system user can't write to `.next/cache`. Common after running `bun run build` as root then switching to chathermes user.

**Fix:**
```bash
sudo chown -R chathermes:chathermes /opt/chathermes/web/.next
```

### Stale chat / sidebar shows wrong session count after creating new conversations

**Cause:** browser cached a `/api/me/activity` response.

**Fix:** hard-refresh (Cmd+Shift+R / Ctrl+Shift+R). The activity endpoint sends `Cache-Control: no-store` but a CDN in front (Cloudflare etc.) may override.

### `./bin/health.sh` shows `web :7000 NOT listening` but I just ran start

**Cause:** Next.js production server takes 5-10 seconds to bind on first boot.

**Fix:** wait 10 seconds, run health.sh again. If still down, check `.logs/web.log`.

### Cron jobs in DB show `last_status = 'error'`

**Cause:** a previous version had a bug where the cron loop crashed if the query failed, leaving stale state. Current version wraps each query in try/catch so individual failures don't kill the loop.

**Fix:** pull latest (this is fixed in `main`). To clear stale errors:
```sql
sqlite3 orchestrator/data/orchestrator.db "UPDATE cron_jobs SET last_status='ok', last_error=NULL"
```

### Hermes proxy on :19002 returns garbage / agent feels "dumb"

**Cause:** the proxy was stripping system messages from the orchestrator's careful tool-aware prompt.

**Fix:** pull latest. Current proxy passes through caller system messages and only injects a fallback when none is provided.

### Want a fully clean reset

```bash
./bin/stop.sh
rm -rf orchestrator/data orchestrator/node_modules
rm -rf web/node_modules web/.next
rm -f orchestrator/.env
./bin/install.sh
./bin/start.sh
```

---

## Don't want to operate this?

Use [chathermes.com](https://chathermes.com) — same code, hosted by us, with all the cloud-only operations included.
