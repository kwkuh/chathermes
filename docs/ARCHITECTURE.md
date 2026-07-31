# ChatHermes Architecture

## Tagline
> Like ChatGPT, but it never stops.

## Pillar features
1. **Zero install** — open URL, chat, done.
2. **Lifelong memory** — agent learns you across sessions.
3. **Lives everywhere** — Telegram, email, etc. (Telegram first.)
4. **Background work** — natural-language scheduling.
5. **Parallel subagents** — visible live in UI.

## Topology

    Browser
      |
      v  http://IP:7000
    [Orchestrator]  :7000  (public)
      - Landing + signup (magic link)
      - Auth (session cookie)
      - Tenant manager (spawn/stop docker containers)
      - Reverse proxy /t/<tenant>/* -> tenant engine
                      |
                      v
             [Workspace UI] :7001  (shared, multi-tenant via gateway URL injection)
                      |
                      v
              Per-tenant engine pool (127.0.0.1:7100+N)
                Tenant A  :7101    Tenant B  :7102   ...
                hermes-webui       hermes-webui
                HERMES_HOME=./data/<tenant>/.hermes

## Tenant model

Per signup: orchestrator spawns one hermes-webui container with:
- HERMES_HOME=./data/<tenant_id>/.hermes (volume mount)
- HERMES_WEBUI_STATE_DIR=./data/<tenant_id>/state
- HERMES_WEBUI_PORT=<assigned> bound to 127.0.0.1
- HERMES_WEBUI_PASSWORD=<random> (orchestrator stores in DB)
- HERMES_WEBUI_DEFAULT_MODEL=nousresearch/hermes-4-405b (or user choice)
- API keys mounted from orchestrator-managed secrets

Memory, skills, sessions all naturally isolated by HERMES_HOME per container.

## Workspace UI multi-tenancy

UI runs as ONE shared instance on :7001. Tenant scoping via:
- User session cookie identifies tenant_id
- UI fetches /api/me/gateway-config -> returns proxied URL http://orchestrator:7000/t/<tenant>/gateway
- UI's HERMES_API_URL env at runtime is overridden via the existing ~/.hermes/workspace-overrides.json mechanism (or via fork patch)

## Orchestrator responsibilities

1. **Public API:** signup, magic-link, login, gateway-config endpoint
2. **Tenant lifecycle:**
   - POST /tenants -> allocate port, create dirs, write env, docker run engine
   - POST /tenants/:id/hibernate -> docker stop (idle reaper)
   - POST /tenants/:id/wake -> docker start, wait for health
3. **Reverse proxy:** /t/:tenant_id/* -> http://127.0.0.1:<port>/* with auth injection
4. **Static:** serve landing page + workspace UI build

## Resource budget

Server: 4.5G available RAM, 4 CPU, 131G disk.
- Engine container idle: ~150 MB RAM
- Active tenants concurrent target: 8-10
- Idle reaper: hibernate after 30 min no activity

## Build history

The first release was built in a 16-day sprint: concept lock and scaffold,
orchestrator MVP (signup, spawn, proxy), UI revamp (onboarding, IA, theme),
default model plus three hero skills (research, content drafter, code assistant),
Telegram connector, showcase tenants, demo video.

## Known integration questions

1. Workspace UI talks to gateway at :8642 API contract; hermes-webui exposes at :8787 with its own API. Compat? **Action:** test single-tenant E2E day 3.
2. If APIs incompatible: either (a) run hermes-agent core directly as engine + skip webui, or (b) write thin adapter shim in orchestrator. Prefer (a) for cleanliness.
3. Per-tenant Docker overhead at scale: not solved here; deferred.

## Decisions locked
- Name: ChatHermes
- Domain: chathermes.com (soon); demo via IP+port
- Tagline: "Like ChatGPT, but it never stops"
- Hero skills: research, content drafter, code assistant
- Default model: Hermes 4 405B
- Auth: magic link
- Connector v1: Telegram only
