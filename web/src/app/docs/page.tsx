"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Book, Rocket, Settings2, Wrench, Sparkles, Code2, Webhook, Brain,
  Cpu, Server, Shield, Menu, X, ChevronRight, Copy, Check, ArrowUpRight,
  GitBranch, Terminal, Zap, KeyRound, Bell, Plug, Mail,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// SECTIONS — single source of truth (drives sidebar + scroll-spy)
// ──────────────────────────────────────────────────────────────────
const SECTIONS = [
  { group: "Getting started", items: [
    { id: "introduction", title: "Introduction", icon: Book },
    { id: "quickstart",   title: "Quickstart",   icon: Rocket },
    { id: "configuration",title: "Configuration",icon: Settings2 },
  ]},
  { group: "Core",          items: [
    { id: "tools",        title: "Tools",        icon: Wrench },
    { id: "skills",       title: "Skills",       icon: Sparkles },
    { id: "memory",       title: "Memory",       icon: Brain },
    { id: "vibe",         title: "Vibe coding",  icon: Code2 },
  ]},
  { group: "Integrations",  items: [
    { id: "api",          title: "REST API",     icon: Terminal },
    { id: "webhooks",     title: "Webhooks",     icon: Webhook },
    { id: "connectors",   title: "Connectors",   icon: Plug },
    { id: "schedules",    title: "Schedules",    icon: Bell },
  ]},
  { group: "Operations",    items: [
    { id: "private-agents",title: "Private Agents", icon: Cpu },
    { id: "hetzner-deploy", title: "Hetzner deploy", icon: Server },
    { id: "self-hosting",   title: "Self-hosting",   icon: Shield },
  ]},
  { group: "Reference",     items: [
    { id: "env-vars",     title: "Env vars",     icon: KeyRound },
    { id: "license",      title: "License",      icon: Shield },
  ]},
];

const FLAT = SECTIONS.flatMap((g) => g.items);

export default function DocsPage() {
  const [active, setActive] = useState(FLAT[0].id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Scroll-spy: highlight sidebar item based on which section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.intersectionRatio > b.intersectionRatio ? -1 : 1))[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    FLAT.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Close mobile nav on item click
  function jumpTo(id: string) {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-ink text-paper antialiased">
      {/* TOP NAV */}
      <nav className="sticky top-0 z-30 bg-ink/90 backdrop-blur border-b border-ink-line/40 px-4 sm:px-7 py-3.5 flex items-center gap-4">
        <button onClick={() => setMobileNavOpen((v) => !v)} className="lg:hidden p-1.5 -ml-1 text-paper-dim hover:text-paper" aria-label="Toggle nav">
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <Link href="/" className="font-[family-name:var(--font-display)] text-[18px] tracking-tight">ChatHermes</Link>
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-amber border-l border-ink-line/60 pl-3 hidden sm:inline">Docs</span>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/introducing" className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-paper-dim hover:text-amber hidden sm:inline">demo</Link>
          <Link href="/opensource" className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-paper-dim hover:text-amber hidden sm:inline">open source</Link>
          <Link href="/auth/login" className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper">sign in</Link>
        </div>
      </nav>

      <div className="flex">
        {/* SIDEBAR */}
        <aside className={`fixed lg:sticky top-[57px] left-0 z-20 w-[260px] h-[calc(100vh-57px)] overflow-y-auto bg-ink border-r border-ink-line/40 transition-transform lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <nav className="px-4 py-6 space-y-6">
            {SECTIONS.map((g) => (
              <div key={g.group}>
                <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-paper-faint mb-2 px-3">— {g.group}</div>
                <ul className="space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    const isActive = active === it.id;
                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => jumpTo(it.id)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13.5px] text-left transition ${
                            isActive
                              ? "bg-amber/10 text-amber border-l-2 border-amber -ml-[2px]"
                              : "text-paper-dim hover:text-paper hover:bg-ink-line/40 border-l-2 border-transparent -ml-[2px]"
                          }`}
                        >
                          <Icon size={12} className="shrink-0" />
                          <span className="truncate">{it.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="pt-4 border-t border-ink-line/40">
              <a href="https://github.com/chathermes/chathermes" target="_blank" rel="noopener" className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-paper-dim hover:text-amber transition">
                <GitBranch size={12} />
                <span>GitHub</span>
                <ArrowUpRight size={11} className="ml-auto" />
              </a>
              <Link href="/opensource" className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-paper-dim hover:text-amber transition">
                <Shield size={12} />
                <span>Open source page</span>
              </Link>
            </div>
          </nav>
        </aside>

        {/* Backdrop for mobile nav */}
        {mobileNavOpen && (
          <div onClick={() => setMobileNavOpen(false)} className="lg:hidden fixed inset-0 z-10 bg-ink/70 backdrop-blur-sm top-[57px]" />
        )}

        {/* CONTENT */}
        <main className="flex-1 min-w-0 px-5 sm:px-10 lg:px-14 py-10 lg:py-14 max-w-[860px] mx-auto">
          <Section id="introduction" title="Introduction" kicker="— what is chathermes">
            <p className="lede">ChatHermes is an autonomous-agent SaaS built on <strong className="text-paper">Nous Research's Hermes 4</strong> and <strong className="text-paper">Moonshot AI's Kimi K2 Thinking</strong> — the official sponsors of the Hermes Agent Creative Hackathon. It pairs streaming multi-model chat with persistent memory, real tools, and agent infrastructure that lets a paid user spin up their own dedicated server. The same code that runs <a href="https://chathermes.com" className="link">chathermes.com</a> is in this repo.</p>
            <p>This documentation covers everything you need to: install ChatHermes, configure it, use the public REST API, build skills, integrate Telegram, deploy a private agent, and self-host the whole thing.</p>
            <Callout kind="amber" icon={Sparkles}>
              <strong>New here?</strong> Watch the <Link href="/introducing" className="link">cinematic /introducing demo</Link> first — 17 chapters, ~2 minutes. It shows the entire workflow before you write any code.
            </Callout>
          </Section>

          <Section id="quickstart" title="Quickstart" kicker="— install in 5 minutes">
            <p>Three install paths. Pick one.</p>
            <H3>Option 1 — Docker Compose</H3>
            <p>The recommended path. One command, works on macOS, Linux, Windows / WSL.</p>
            <Code>{`git clone https://github.com/chathermes/chathermes.git
cd chathermes
./bin/setup.sh           # interactive .env wizard (60s)
docker compose up -d
# → open http://localhost:7000`}</Code>

            <H3>Option 2 — Hetzner one-click</H3>
            <p>If you already have a Hetzner Cloud token. Cloud-init bootstraps Bun + Docker + clones repo + writes <code>.env</code> + runs <code>docker compose up</code>.</p>
            <Code>{`curl -X POST https://your-self-host.com/api/deploy/hetzner \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "hcloud_...",
    "server_type": "cx22",
    "location": "nbg1",
    "llm_keys": { "nous": "..." }
  }'

# Returns: { ok: true, ip, url, ssh_command }`}</Code>

            <H3>Option 3 — Bun runtime</H3>
            <p>No Docker. Requires Bun ≥ 1.3 and Node ≥ 22.</p>
            <Code>{`# Orchestrator
cd orchestrator
bun install
bun run src/index.ts &

# Web (in another terminal)
cd web
bun install
bun run build
PORT=7000 ORCH_URL=http://127.0.0.1:7010 bun run start`}</Code>
          </Section>

          <Section id="configuration" title="Configuration" kicker="— environment variables">
            <p>ChatHermes reads everything from environment variables. The minimum viable <code>.env</code>:</p>
            <Code>{`PUBLIC_BASE_URL=http://localhost:7000
SESSION_SECRET=$(openssl rand -hex 32)
NOUS_API_KEY=hf_...     # OR another LLM provider key — pick one`}</Code>
            <p>Everything else degrades gracefully. See the <a href="#env-vars" onClick={(e) => { e.preventDefault(); jumpTo("env-vars"); }} className="link">full env var reference</a> below.</p>
            <H3>Provider keys</H3>
            <p>You need at least one LLM provider configured. ChatHermes supports:</p>
            <Table head={["Provider", "Env var", "What you get"]} rows={[
              ["Moonshot AI ★", <code key="1">KIMI_API_KEY</code>, "Kimi K2, K2 Thinking — strong reasoning, hackathon co-sponsor"],
              ["Nous Research ★", <code key="2">NOUS_API_KEY</code>, "Hermes 4 (405B + 70B), Hermes 3 — open weights, hackathon host"],
              ["Anthropic", <code key="3">ANTHROPIC_API_KEY</code>, "Claude Sonnet 4.6 — best for code"],
              ["OpenAI", <code key="4">OPENAI_API_KEY</code>, "GPT-5 — best general"],
              ["Google", <code key="5">GEMINI_API_KEY</code>, "Gemini 3.1 Pro — best vision"],
              ["StepFun", <code key="6">STEPFUN_API_KEY</code>, "Step 3.5 Flash — fast/cheap"],
            ]} />
          </Section>

          <Section id="tools" title="Tools" kicker="— 14 chat-time tools">
            <p>The agent has 14 tools available during chat. All are real APIs — no mockups. Tools are called via <code>{"<tool_call>"}</code> XML blocks in the assistant response and parsed by the orchestrator.</p>
            <Table head={["Name", "What it does", "Backend"]} rows={[
              ["web_search(query)", "5-tier web search fallback", "Tavily → Brave → DuckDuckGo HTML → Wikipedia → DDG instant"],
              ["browse(url)", "Visit URL + extract main content", "fetch + article/main extraction"],
              ["fetch_url(url)", "Raw HTTP fetch", "lower-level than browse()"],
              ["github_repo(\"owner/name\")", "Repo metadata", "GitHub REST API"],
              ["news_search(query)", "Recent news headlines", "Google News RSS"],
              ["weather(location)", "Live weather + forecast", "open-meteo + geocoding"],
              ["wikipedia(topic)", "Encyclopedia summary", "Wikipedia REST API"],
              ["save_memory(topic, body)", "Persist a fact across sessions", "SQLite, per-user"],
              ["recall_memory(query)", "Search saved memories", "SQLite full-text"],
              ["telegram_send(message)", "Push to user's Telegram bot", "via /app/connectors token"],
              ["run_js(code)", "Execute JavaScript expression", "in-process VM"],
              ["generate_image(prompt)", "Create image from text", "Replicate Flux Schnell"],
              ["analyze_image(url, question)", "Vision analysis", "Gemini 2.0 Flash → GPT-4o fallback"],
              ["dispatch_subagent(task, model)", "Delegate to a different model", "Claude / GPT-5 / Kimi via providers DB"],
            ]} />
            <Callout kind="amber" icon={Sparkles}>
              <strong>Adding a new tool</strong> means: 1) add to <code>TOOLS</code> array in <code>orchestrator/src/tools.ts</code>, 2) add a <code>case</code> in <code>executeTool()</code> for the dispatch logic, 3) update the system prompt in <code>orchestrator/src/index.ts</code> with the rule for when to call it. PRs welcome.
            </Callout>
          </Section>

          <Section id="skills" title="Skills" kicker="— /app/skills">
            <p>Skills are user-toggleable capabilities listed at <code>/app/skills</code>. The system prompt mentions which are active for the user; the agent uses that context to decide when to invoke tools.</p>
            <p>Twelve skills ship enabled by default:</p>
            <ul>
              <li><strong>Research</strong> — web_search + browse + cite</li>
              <li><strong>Code &amp; Build</strong> — vibe coding at <code>/app/projects</code>, publish to <code>/p/&lt;slug&gt;</code></li>
              <li><strong>Persistent memory</strong> — save_memory / recall_memory</li>
              <li><strong>Scheduler</strong> — natural-language cron at <code>/app/schedules</code></li>
              <li><strong>Telegram push</strong> — telegram_send via connector</li>
              <li><strong>Subagent dispatch</strong> — Claude / GPT-5 / Kimi parallel reasoning</li>
              <li><strong>Image generation</strong> — Flux via Replicate</li>
              <li><strong>Vision analysis</strong> — Gemini 2.0 Flash + GPT-4o fallback</li>
              <li><strong>Browser</strong> — browse() + fetch_url()</li>
              <li><strong>GitHub recon</strong> — github_repo()</li>
              <li><strong>Weather + News</strong> — open-meteo + Google News RSS</li>
              <li><strong>Run JS</strong> — calculations, regex, JSON parsing</li>
            </ul>
          </Section>

          <Section id="memory" title="Memory" kicker="— persistent context">
            <p>Memory is per-user, scoped via <code>WHERE user_id = ?</code> on every query. The schema:</p>
            <Code>{`CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_memories_user ON memories(user_id, created_at DESC);`}</Code>
            <p>Memories are surfaced to the agent two ways:</p>
            <ol>
              <li><strong>System prompt context</strong> — the latest 20 memories are injected into every chat turn's system message.</li>
              <li><strong>recall_memory tool</strong> — the agent calls this explicitly when it needs to look something up before answering personal questions.</li>
            </ol>
            <p>Users can read, edit, and delete memories at <code>/app/memory</code>. No black box.</p>
          </Section>

          <Section id="vibe" title="Vibe coding" kicker="— /app/projects, /dev/[id]">
            <p>"Build me a landing page for X" → agent generates HTML/CSS/JS that renders live in a sandboxed iframe. Three modes:</p>
            <Table head={["Mode", "What it generates", "When to use"]} rows={[
              ["static", "single index.html (Tailwind CDN allowed)", "marketing pages, simple UIs"],
              ["spa", "React via esm.sh CDN, single component tree", "interactive prototypes"],
              ["fullstack", "frontend + mock API backend in iframe", "demo apps with state"],
            ]} />
            <p>Per-plan project quotas enforce free-tier limits. <code>POST /api/me/projects</code> returns <code>402</code> if the user is over their monthly cap. <code>GET /api/me/projects/quota</code> returns:</p>
            <Code>{`{
  "plan": "free",
  "used_this_month": 3,
  "limit_per_month": 5,
  "is_unlimited": false,
  "remaining": 2,
  "pct": 60,
  "lifetime_total": 12,
  "lifetime_published": 4
}`}</Code>
            <p>Projects can be published at <code>/p/&lt;slug&gt;</code> for public preview. The orchestrator injects a "Made with ChatHermes" floating badge into published HTML (this is required by the license).</p>
          </Section>

          <Section id="api" title="REST API" kicker="— /api/v1/*">
            <p>The public REST API is Bearer-authenticated with API keys created at <code>/app/api-keys</code>. OpenAPI 3.0.3 spec available at <Link href="/api/openapi.json" className="link">/api/openapi.json</Link>.</p>
            <H3>Authentication</H3>
            <Code>{`curl https://your-self-host.com/api/v1/me \\
  -H "Authorization: Bearer ck_..."`}</Code>
            <H3>Core endpoints</H3>
            <Table head={["Method", "Path", "What it does"]} rows={[
              ["GET",  "/api/v1/me",                "User profile + plan"],
              ["GET",  "/api/v1/sessions",          "List chat sessions"],
              ["POST", "/api/v1/sessions",          "Create a new chat session"],
              ["POST", "/api/v1/sessions/:id/chat","Stream a chat completion (SSE)"],
              ["GET",  "/api/v1/memories",         "List your memories"],
              ["POST", "/api/v1/memories",         "Save a memory"],
              ["GET",  "/api/v1/projects",         "List your vibe-coding projects"],
              ["GET",  "/api/v1/projects/:id",     "Project detail + history"],
              ["GET",  "/api/v1/usage",            "Current period usage stats"],
            ]} />
          </Section>

          <Section id="webhooks" title="Webhooks" kicker="— event delivery">
            <p>ChatHermes can POST to your endpoints when events fire. Configured at <code>/app/webhooks</code>. Each delivery is HMAC-signed using your webhook secret.</p>
            <H3>Verifying signatures</H3>
            <Code>{`import crypto from "node:crypto";

const sig = req.headers["x-chathermes-signature"];
const body = await readRawBody(req);
const expected = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(body)
  .digest("hex");

if (sig !== expected) {
  res.status(401).send("invalid signature");
}`}</Code>
            <H3>Events</H3>
            <Table head={["Event", "Fires when"]} rows={[
              ["session.message.created", "User or assistant adds a message"],
              ["project.published",       "Vibe-coding project goes live"],
              ["memory.created",          "save_memory tool runs"],
              ["subscription.changed",    "Stripe subscription state changes"],
              ["agent.ready",             "Private Hermes Agent provisioning succeeds"],
            ]} />
            <p>Failed deliveries retry with exponential backoff (3 attempts: ~1s, ~5s, ~30s). After that, the delivery is logged at <code>/admin/email</code> for manual replay.</p>
          </Section>

          <Section id="connectors" title="Connectors" kicker="— Telegram + more">
            <p>Connectors at <code>/app/connectors</code> let users wire ChatHermes into external services. Currently shipping: Telegram.</p>
            <H3>Telegram</H3>
            <ol>
              <li>Talk to <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="link">@BotFather</a> on Telegram → <code>/newbot</code> → save the token.</li>
              <li>Open ChatHermes → Connectors → Telegram → paste token → Save.</li>
              <li>In Telegram, find your new bot → <code>/start</code> — this binds your Telegram user to your ChatHermes account.</li>
              <li>The agent can now call <code>telegram_send(message)</code> tool to push you messages.</li>
            </ol>
          </Section>

          <Section id="schedules" title="Schedules" kicker="— recurring tasks">
            <p>Natural-language cron at <code>/app/schedules</code>. Examples:</p>
            <ul>
              <li>"Daily briefing at 9am — top 5 stories from Hacker News"</li>
              <li>"Every 6 hours — check competitor.com/pricing, notify if changed"</li>
              <li>"Sundays at 8am — summarize what I worked on this week, email it"</li>
            </ul>
            <p>The orchestrator parses the natural-language schedule into a cron expression and a target tool chain. When it fires, the agent runs as if the schedule's prompt were sent in a fresh chat.</p>
          </Section>

          <Section id="private-agents" title="Private Agents" kicker="— per-user dedicated infrastructure">
            <p>Free-tier users share a single Hermes Agent proxy on the orchestrator's <code>:19002</code>. Paid-tier users can have a dedicated Hetzner server provisioned for them — fully isolated CPU, fully isolated rate limits, fully isolated tool tokens.</p>
            <H3>Architecture</H3>
            <Code>{`// resolveHermesEndpoint() in private_agent.ts
// Free user → shared :19002 (this server)
// Paid user + status=ready → user's dedicated server
// Paid user + status=pending/provisioning → falls back to shared`}</Code>
            <H3>Provisioning flow</H3>
            <ol>
              <li>Stripe webhook fires <code>customer.subscription.created</code> with active paid status.</li>
              <li>Orchestrator marks the user as <code>private_agent_status = pending</code>.</li>
              <li><strong>Gated mode (default)</strong>: an admin opens <code>/admin/private-agents</code>, clicks <em>Provision</em> per user.</li>
              <li><strong>Auto mode</strong>: set <code>AUTO_PROVISION_PRIVATE_AGENT=true</code> in <code>.env</code>; webhook spawns immediately.</li>
              <li>Hetzner Cloud API spawns a fresh server with cloud-init that installs Bun + a per-user proxy + auth token.</li>
              <li>Orchestrator polls readiness; when <code>:19002</code> answers, status flips to <code>ready</code>.</li>
              <li>Future <code>hermes-agent</code> requests for that user route to their endpoint.</li>
            </ol>
          </Section>

          <Section id="hetzner-deploy" title="Hetzner deploy" kicker="— one-click + admin fleet">
            <p>The deploy logic lives in <code>orchestrator/src/deploy.ts</code>. Two surfaces:</p>
            <H3>Public one-click — /deploy/hetzner</H3>
            <p>Anyone with a Hetzner token can paste it, pick a server type and region, paste at least one LLM API key, and click <em>Deploy ChatHermes</em>. Cloud-init bootstraps the new server in around 90 seconds.</p>
            <H3>Admin fleet management — /admin/hetzner</H3>
            <p>Admins set the Hetzner token once via the UI (stored in <code>system_settings</code>), then manage all servers in their account: list, status, power on/off/reboot, delete. Servers labeled <code>app=chathermes</code> are highlighted as managed.</p>
          </Section>

          <Section id="self-hosting" title="Self-hosting" kicker="— production checklist">
            <p>Before going live with self-hosted ChatHermes:</p>
            <ul>
              <li><strong>HTTPS</strong> — set up nginx + Certbot. See <a href="https://github.com/chathermes/chathermes/blob/master/INSTALL.md" target="_blank" rel="noopener" className="link">INSTALL.md Path 3</a>.</li>
              <li><strong>SESSION_SECRET</strong> — generate with <code>openssl rand -hex 32</code>. Don't reuse the example value.</li>
              <li><strong>ADMIN_EMAILS</strong> — set in <code>.env</code> to grant your email admin role on first signup.</li>
              <li><strong>Backups</strong> — set up cron to <code>sqlite3 .backup</code> the SQLite file daily, and rsync off-server.</li>
              <li><strong>Resend</strong> — verify your domain at <a href="https://resend.com/domains" target="_blank" rel="noopener" className="link">resend.com/domains</a> for magic links.</li>
              <li><strong>Stripe</strong> — set up products + webhook endpoint. See <a href="https://github.com/chathermes/chathermes/blob/master/INSTALL.md" target="_blank" rel="noopener" className="link">INSTALL.md "Optional integrations"</a>.</li>
              <li><strong>Hermes Agent native</strong> — for the <code>hermes-agent</code> model option, install <code>nous-hermes-agent</code> separately. The orchestrator's shared proxy works without it (proxies to Nous API directly).</li>
              <li><strong>Required Attribution</strong> — don't strip <code>_attribution.ts</code>. The runtime guard refuses to start without it. This is the license.</li>
            </ul>
          </Section>

          <Section id="env-vars" title="Env vars" kicker="— full reference">
            <p>Every environment variable. Copy <code>orchestrator/.env.example</code> to <code>orchestrator/.env</code> and fill what you need.</p>
            <Table head={["Variable", "Required?", "Purpose"]} rows={[
              ["PUBLIC_BASE_URL",          "yes",       "Your install's public URL (used in magic links, OG, webhooks)"],
              ["SESSION_SECRET",           "yes",       "Cookie signing key — openssl rand -hex 32"],
              ["NODE_ENV",                 "no",        "production | development"],
              ["ADMIN_EMAILS",             "no",        "Comma-separated emails granted admin on signup"],
              ["DATA_ROOT",                "no",        "Where SQLite + tenant volumes live (default ./data)"],
              ["NOUS_API_KEY",             "1+ needed", "Hermes 4, Hermes 3, Kimi K2 (Nous proxies multiple)"],
              ["KIMI_API_KEY",             "1+ needed", "Direct Moonshot Kimi"],
              ["ANTHROPIC_API_KEY",        "1+ needed", "Claude Sonnet 4.6"],
              ["OPENAI_API_KEY",           "1+ needed", "GPT-5"],
              ["GEMINI_API_KEY",           "1+ needed", "Gemini 3.1 Pro"],
              ["STEPFUN_API_KEY",          "1+ needed", "Step 3.5 Flash"],
              ["DEFAULT_MODEL",            "no",        "Default model_id when user has no preference"],
              ["CHATHERMES_MODEL_RATES",   "no",        "JSON: {model_id: credits_per_1k_tokens}. Default empty."],
              ["CHATHERMES_DEFAULT_RATE",  "no",        "Fallback rate for models not in the rates JSON"],
              ["RESEND_API_KEY",           "no",        "If absent, magic links print to log instead of email"],
              ["RESEND_FROM",              "no",        "From address — must be verified in Resend"],
              ["RESEND_REPLY_TO",          "no",        "Reply-to address"],
              ["RESEND_WEBHOOK_SECRET",    "no",        "For verifying inbound delivery events"],
              ["STRIPE_SECRET_KEY",        "no",        "If absent, billing UI shows demo banner"],
              ["STRIPE_PUBLISHABLE_KEY",   "no",        "Frontend Stripe.js"],
              ["STRIPE_WEBHOOK_SECRET",    "no",        "For verifying inbound subscription events"],
              ["STRIPE_PRICE_PRO",         "no",        "Stripe price_xxx for Pro plan"],
              ["STRIPE_PRICE_TEAM",        "no",        "Stripe price_xxx for Team plan"],
              ["AUTO_PROVISION_PRIVATE_AGENT", "no",    "false (default — admin gates) | true (full auto)"],
              ["HETZNER_API_TOKEN",        "no",        "Alternative to setting in /admin/hetzner UI"],
              ["HERMES_PROXY_PORT",        "no",        "Default 19002"],
              ["HERMES_UPSTREAM_MODEL",    "no",        "What the shared proxy forwards to (default Hermes-4-405B)"],
              ["HERMES_RATE_LIMIT",        "no",        "Requests/min per IP on the shared proxy (default 60)"],
              ["REPLICATE_API_TOKEN",      "no",        "Image generation tool"],
              ["TAVILY_API_KEY",           "no",        "Web search tier 1 (best quality)"],
              ["BRAVE_API_KEY",            "no",        "Web search tier 2"],
            ]} />
          </Section>

          <Section id="license" title="License" kicker="— AGPL-3.0 + Required Attribution">
            <p>ChatHermes is licensed under the <Link href="/opensource" className="link">ChatHermes Open Source License v1.0</Link> — AGPL-3.0 with a Required Attribution Addendum and Trademark Reservation.</p>
            <Callout kind="emerald" icon={Check}>
              <strong>You can:</strong> use commercially, modify, redistribute, sell hosting (with your own brand), audit every line.
            </Callout>
            <Callout kind="rust" icon={X}>
              <strong>You cannot:</strong> strip the visible "Powered by ChatHermes" link, remove the X-Powered-By header, use the name "ChatHermes" or our mascot for your fork, modify <code>_attribution.ts</code> identifying constants.
            </Callout>
            <p>The runtime guard in <code>orchestrator/src/_attribution.ts</code> refuses to start the orchestrator if the attribution module is tampered. See <Link href="/opensource#license" className="link">/opensource</Link> for full terms.</p>
          </Section>

          <div className="mt-16 pt-8 border-t border-ink-line/40 flex items-center justify-between text-paper-faint text-[12.5px] font-[family-name:var(--font-mono)]">
            <span>ChatHermes Docs · v1.0 · by <a href="https://x.com/kwkuh" target="_blank" rel="noopener" className="text-amber hover:text-amber-soft underline decoration-amber/50 underline-offset-[3px] decoration-[1px] hover:decoration-amber transition">@kwkuh</a> & <a href="https://x.com/supercryptolord" target="_blank" rel="noopener" className="text-amber hover:text-amber-soft underline decoration-amber/50 underline-offset-[3px] decoration-[1px] hover:decoration-amber transition">@supercryptolord</a></span>
            <a href="https://github.com/chathermes/chathermes" target="_blank" rel="noopener" className="hover:text-amber inline-flex items-center gap-1">
              Edit on GitHub <ArrowUpRight size={11} />
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// COMPONENTS
// ──────────────────────────────────────────────────────────────────

function Section({ id, title, kicker, children }: any) {
  return (
    <section id={id} className="docs-section scroll-mt-[80px]">
      <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-3">{kicker}</div>
      <h2 className="font-[family-name:var(--font-display)] text-[clamp(28px,4vw,42px)] tracking-[-0.025em] leading-[1.1] mb-6">{title}</h2>
      <div className="docs-prose space-y-4 text-paper-dim text-[15.5px] leading-[1.7]">{children}</div>
      <hr className="my-12 sm:my-14 border-ink-line/40" />
    </section>
  );
}

function H3({ children }: any) {
  return <h3 className="font-[family-name:var(--font-display)] text-[20px] sm:text-[22px] tracking-[-0.015em] text-paper mt-7 mb-3">{children}</h3>;
}

function Code({ children }: any) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === "string" ? children : "";
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="my-5 rounded-xl bg-ink-soft border border-ink-line overflow-hidden group relative">
      <div className="px-4 py-2 border-b border-ink-line/60 flex items-center gap-2 bg-ink/40">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] text-paper-faint hover:text-amber transition opacity-0 group-hover:opacity-100"
        >
          {copied ? <><Check size={11} className="text-emerald-400" /> copied</> : <><Copy size={10} /> copy</>}
        </button>
      </div>
      <pre className="px-5 py-4 font-[family-name:var(--font-mono)] text-[12.5px] sm:text-[13px] text-paper leading-[1.7] overflow-x-auto">{children}</pre>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: any[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-ink-line">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="bg-ink-soft/60 border-b border-ink-line">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-amber">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink-line/40 last:border-0 hover:bg-ink-soft/40 transition">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-3 text-paper align-top">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ kind, icon: Icon, children }: any) {
  const colorMap: Record<string, string> = {
    amber: "bg-amber/[0.05] border-amber/30 text-amber",
    emerald: "bg-emerald-500/[0.05] border-emerald-500/30 text-emerald-300",
    rust: "bg-rust/[0.06] border-rust/30 text-rust",
  };
  return (
    <div className={`my-5 rounded-xl border px-4 sm:px-5 py-3.5 ${colorMap[kind] || colorMap.amber}`}>
      <div className="flex items-start gap-3">
        <Icon size={14} className="mt-1 shrink-0" />
        <div className="text-paper text-[14px] leading-[1.6]">{children}</div>
      </div>
    </div>
  );
}
