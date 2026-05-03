# Installing ChatHermes

Three install paths — pick one.

## Path 0 — One-click deploy to Hetzner (recommended, ~90 sec)

If you have a Hetzner Cloud account and an API token: open `https://your-self-host.com/deploy/hetzner` (or the equivalent on the managed version) and follow the wizard. The deploy logic is in `orchestrator/src/deploy.ts` — fully open source. You can call the API directly:

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

## Path 1 — Docker Compose (recommended for self-host, ~5 min)

```bash
git clone https://github.com/chathermes/chathermes.git
cd chathermes
./bin/setup.sh           # interactive .env wizard
docker compose up -d
docker compose logs -f
```

Open http://localhost:7000. Sign in with any email — magic link prints to the orchestrator log if you skipped Resend setup.

To stop: `docker compose down`. Data persists in `./data/`.

## Path 2 — Bun runtime (no Docker, ~10 min)

Requires: Bun >= 1.3, Node >= 22 (for Next.js).

```bash
git clone https://github.com/chathermes/chathermes.git
cd chathermes

./bin/setup.sh           # interactive .env wizard

# Orchestrator
cd orchestrator
bun install
bun run src/index.ts &

# Web (in another terminal)
cd web
bun install
bun run build
PORT=7000 ORCH_URL=http://127.0.0.1:7010 bun run start
```

For systemd, see `deploy/systemd/`.

## Path 3 — Production behind a domain + HTTPS

Follow Path 1 or 2 to get the app running on `:7000`. Then:

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

5. Restart.

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
   - "Pro" — recurring monthly, $20 — copy `price_xxx`
   - "Team" — recurring monthly, $99 — copy `price_xxx`
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

```bash
pip install nous-hermes-agent
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

Single SQLite file at `${DATA_ROOT}/orchestrator.db`. Migrations applied automatically on startup.

Backup:
```bash
sqlite3 ./data/orchestrator.db ".backup ./data/backup-$(date +%F).db"
```

## Update

```bash
git pull
docker compose pull && docker compose up -d   # if using docker
# or
bun install && bun run build                  # if running directly
```

## Don't want to operate this?

Use [chathermes.com](https://chathermes.com) — same code, hosted by us, with all the cloud-only operations included.
