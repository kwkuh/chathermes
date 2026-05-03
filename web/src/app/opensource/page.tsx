import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, ArrowUpRight, Check, X, Copy, GitBranch, Terminal,
  Shield, Cpu, Code2, Sparkles, Lock, Crown, Zap, Server,
  FileCode, Package, BookOpen, Heart,
} from "lucide-react";

export const metadata = {
  title: "Open Source · ChatHermes",
  description: "We built ChatHermes in the open. Every line. Here's how to self-host it, what's in the box, and what the license requires.",
};

export default function OpenSourcePage() {
  return (
    <div className="min-h-screen bg-ink text-paper antialiased">
      {/* TOP NAV */}
      <nav className="px-6 sm:px-10 py-5 flex items-center gap-6 border-b border-ink-line/40">
        <Link href="/" className="font-[family-name:var(--font-display)] text-[20px] tracking-tight">ChatHermes</Link>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/introducing" className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] text-paper-dim hover:text-amber transition">demo</Link>
          <Link href="/docs" className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] text-paper-dim hover:text-amber transition">docs</Link>
          <Link href="/opensource" className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] text-amber">open source</Link>
          <Link href="/auth/login" className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper transition">sign in</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="px-6 sm:px-10 pt-16 sm:pt-24 pb-16 max-w-[1100px] mx-auto">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-6">— ChatHermes × Kimi K2 · Open Source v1.0.0</div>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(48px,8vw,108px)] leading-[0.95] tracking-[-0.03em] mb-8">
          We built it<br /><em className="text-amber italic">in the open.</em>
        </h1>
        <p className="text-paper-dim text-[18px] sm:text-[22px] leading-[1.5] max-w-[720px] mb-10">
          Every line of the code that runs <span className="text-paper">chathermes.com</span> is in a public repository.
          <span className="text-paper"> 6,683 lines of TypeScript. 17 narration MP3s. 14 real tools. One SQLite file.</span> No black box.
          Bring your own keys, your own server, your own brand.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/chathermes/chathermes"
            target="_blank" rel="noopener"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-md bg-paper text-ink text-[15px] font-medium hover:bg-paper/90 transition shadow-[0_0_40px_rgba(251,250,246,0.2)]"
          >
            <GitBranch size={16} /> View on GitHub <ArrowUpRight size={14} />
          </a>
          <a
            href="#install"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[14.5px] transition"
          >
            <Terminal size={14} /> Install in 5 minutes
          </a>
        </div>
      </section>

      {/* WHY */}
      <section className="px-6 sm:px-10 py-16 sm:py-20 max-w-[860px] mx-auto border-t border-ink-line/40">
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-amber mb-6">— founder mode</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,4.5vw,56px)] leading-[1.05] tracking-[-0.025em] mb-8">
          Why give it away.
        </h2>
        <div className="space-y-5 text-paper-dim text-[16.5px] sm:text-[18px] leading-[1.65]">
          <p>
            We're a small team in Jakarta. We compete with companies that have <strong className="text-paper">100x more engineers</strong> than us.
            The only way we win is if you can read the code.
          </p>
          <p>
            Closed source costs us trust we can't afford. Open source costs us nothing — the moat isn't the code,
            it's the operational cost of running it well at scale: <strong className="text-paper">pre-pooled LLM keys, verified email domain, Hetzner pool, monitoring, backups</strong>.
            That's what running it well costs to operate.
          </p>
          <p>
            If you'd rather run it yourself: clone the repo, point it at your own keys, ship. We genuinely want you to.
            And if you build something cool with it, we'll link to you.
          </p>
          <p>
            The license has teeth — see <Link href="#license" className="text-amber hover:underline">below</Link> — because we want adoption AND sustainability.
            <span className="text-paper"> The same playbook as Plausible, Discourse, Mautic.</span> It works.
          </p>
        </div>
      </section>

      {/* WHAT'S IN THE BOX */}
      <section className="px-6 sm:px-10 py-16 sm:py-20 max-w-[1100px] mx-auto border-t border-ink-line/40">
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-amber mb-4">— inside the repo</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,4.5vw,56px)] leading-[1.05] tracking-[-0.025em] mb-3">
          156 files. <em className="text-amber italic">Zero leaks.</em>
        </h2>
        <p className="text-paper-dim text-[15.5px] sm:text-[17px] leading-[1.55] mb-12 max-w-[640px]">
          Every feature on chathermes.com works under self-host. The only thing different is whose keys, whose servers, whose backups.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
          <FeatureBox
            icon={Cpu}
            title="14 chat-time tools"
            desc="Real APIs, no mockups. web_search (5-tier fallback), browse, github_repo, weather, news_search, wikipedia, save/recall_memory, telegram_send, run_js, fetch_url, generate_image (Replicate Flux), analyze_image (Gemini/GPT-4o), dispatch_subagent."
            file="orchestrator/src/tools.ts · 414 lines"
          />
          <FeatureBox
            icon={Server}
            title="Private Agent infrastructure"
            desc="Free users share a Bun OpenAI-compatible proxy on :19002. Paid users auto-provision dedicated Hetzner CPX11 servers via cloud-init. Gated by default — admin clicks Provision per upgrade."
            file="orchestrator/src/private_agent.ts · 380 lines"
          />
          <FeatureBox
            icon={Code2}
            title="Vibe coding workspace"
            desc='Type "build me a landing page for X". Code streams left, preview renders right. Multi-file fullstack. Publish to /p/<slug>. Per-plan project quotas.'
            file="web/src/app/dev/[id]/_vibe-workspace.tsx · 518 lines"
          />
          <FeatureBox
            icon={Sparkles}
            title="Cinematic /introducing demo"
            desc="17-chapter video-style walkthrough. edge-tts narration MP3s (en-GB-RyanNeural, free). Procedural Web Audio backsound (Cm7 pad + 75 BPM sub-pulse + FM bell pings). Self-record to WebM."
            file="web/src/app/introducing/page.tsx · 1,200+ lines"
          />
          <FeatureBox
            icon={Crown}
            title="Conversion-focused billing"
            desc={`Hero ("You're sharing. Your agent shouldn't be."), 3-card pricing with Pro emphasized, comparison table, FAQ, trust bar, invoice PDF download, Stripe Checkout + Customer Portal.`}
            file="web/src/app/app/billing/page.tsx · 561 lines"
          />
          <FeatureBox
            icon={Zap}
            title="Mobile super-app interface"
            desc="Bottom tab bar (Chat / Build / Memory / Plan / More) + bottom-sheet drawer for secondary nav. Thumb-zone composer. Safe-area inset support."
            file="web/src/app/app/_components/mobile-tab-bar.tsx · 280 lines"
          />
          <FeatureBox
            icon={Shield}
            title="Required Attribution"
            desc="Runtime guard refuses to start the orchestrator if _attribution.ts is tampered. X-Powered-By header on every response. Floating badge on /p/<slug> public previews."
            file="orchestrator/src/_attribution.ts · 75 lines"
          />
          <FeatureBox
            icon={Package}
            title="Built-in PWA + status page + Cmd+K"
            desc="Installable mobile-first web app. Public /status page with real-time service health. Global search across messages, memory, projects."
            file="web/src/app/_components/* · varies"
          />
        </div>
      </section>

      {/* INSTALL */}
      <section id="install" className="px-6 sm:px-10 py-16 sm:py-20 max-w-[1100px] mx-auto border-t border-ink-line/40">
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-amber mb-4">— ship it yourself</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,4.5vw,56px)] leading-[1.05] tracking-[-0.025em] mb-12">
          Three install paths.
        </h2>

        <div className="space-y-8">
          <InstallPath
            label="01"
            title="Docker Compose"
            time="~5 min"
            recommended
            desc="The path we recommend. One command, works on macOS / Linux / Windows / WSL. Single SQLite file persists in ./data/."
            code={`git clone https://github.com/chathermes/chathermes.git
cd chathermes
./bin/setup.sh           # interactive .env wizard (60s)
docker compose up -d
# → open http://localhost:7000`}
          />

          <InstallPath
            label="02"
            title="Hetzner one-click"
            time="~90 sec"
            desc="If you already have a Hetzner Cloud token. Cloud-init bootstraps Bun + Docker + clones repo + writes .env + runs docker compose up. Server size and region are your choice."
            code={`curl -X POST https://your-self-host.com/api/deploy/hetzner \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "hcloud_...",
    "server_type": "cx22",
    "location": "nbg1",
    "llm_keys": { "nous": "..." }
  }'

# Returns: { ok: true, ip, url, ssh_command }
# Total: ~90 seconds to a fresh Hetzner Cloud server with HTTPS.`}
          />

          <InstallPath
            label="03"
            title="Bun runtime"
            time="~10 min"
            desc="No Docker. Requires Bun ≥ 1.3 + Node ≥ 22 (for Next.js). Use this for fastest iteration in development."
            code={`# Orchestrator
cd orchestrator
bun install
bun run src/index.ts &

# Web (in another terminal)
cd web
bun install
bun run build
PORT=7000 ORCH_URL=http://127.0.0.1:7010 bun run start`}
          />
        </div>

        <div className="mt-10 px-5 sm:px-7 py-5 rounded-2xl bg-amber/[0.04] border border-amber/20">
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="text-amber mt-0.5 shrink-0" />
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-amber mb-2">— minimum viable .env</div>
              <pre className="font-[family-name:var(--font-mono)] text-[12.5px] sm:text-[13px] text-paper leading-[1.7] whitespace-pre-wrap">{`PUBLIC_BASE_URL=http://localhost:7000
SESSION_SECRET=$(openssl rand -hex 32)
NOUS_API_KEY=hf_...     # OR KIMI_API_KEY, OR ANTHROPIC_API_KEY, etc. Pick one.`}</pre>
              <div className="text-paper-dim text-[13.5px] mt-3 leading-[1.55]">
                Everything else is optional. Resend, Stripe, Hetzner, Replicate, Tavily, Brave —
                features degrade gracefully if absent. See full <code className="text-[12px] text-amber bg-ink-soft px-1.5 py-0.5 rounded">orchestrator/.env.example</code> for all 30+ vars documented.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OSS VS CLOUD */}
      <section className="px-6 sm:px-10 py-16 sm:py-20 max-w-[1100px] mx-auto border-t border-ink-line/40">
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-amber mb-4">— honest split</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,4.5vw,56px)] leading-[1.05] tracking-[-0.025em] mb-3">
          Self-host vs <em className="text-amber italic">cloud.</em>
        </h2>
        <p className="text-paper-dim text-[15.5px] sm:text-[17px] leading-[1.55] mb-10 max-w-[640px]">
          The code is identical. What changes is the operations.
        </p>

        <div className="rounded-2xl bg-ink-soft border border-ink-line overflow-hidden">
          <div className="grid grid-cols-3 border-b border-ink-line bg-ink/40">
            <div className="px-4 sm:px-6 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-paper-faint">Capability</div>
            <div className="px-4 sm:px-6 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-paper-dim">Self-host</div>
            <div className="px-4 sm:px-6 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-amber">chathermes.com</div>
          </div>
          {[
            ["LLM API keys", "bring your own", "pre-pooled"],
            ["Hermes Agent native (:19002)", "pip install nous-hermes-agent", "pre-installed"],
            ["Email", "BYO Resend + DNS", "verified domain"],
            ["Stripe", "BYO account + price IDs", "live + monitored"],
            ["Hetzner private agents", "your token, your project", "our managed pool"],
            ["Auto-provision on upgrade", "gated (admin clicks)", "automatic"],
            ["Backups", "DIY (cron + rsync)", "included, off-site"],
            ["Updates", "git pull", "automatic"],
            ["Status page / SLA", "build it yourself", "99.9% target"],
            ["You operate", "your infra, your keys, your boundary", "we operate it for you"],
          ].map(([cap, self, cloud], i) => (
            <div key={i} className="grid grid-cols-3 border-b border-ink-line/40 last:border-b-0 hover:bg-ink/20 transition">
              <div className="px-4 sm:px-6 py-3 text-paper text-[14px] sm:text-[15px]">{cap}</div>
              <div className="px-4 sm:px-6 py-3 text-paper-dim text-[13.5px] sm:text-[14.5px]">{self}</div>
              <div className="px-4 sm:px-6 py-3 text-paper text-[13.5px] sm:text-[14.5px]">{cloud}</div>
            </div>
          ))}
        </div>
      </section>

      {/* LICENSE */}
      <section id="license" className="px-6 sm:px-10 py-16 sm:py-20 max-w-[1100px] mx-auto border-t border-ink-line/40">
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-amber mb-4">— license terms</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,4.5vw,56px)] leading-[1.05] tracking-[-0.025em] mb-10">
          AGPL-3.0 + <em className="text-amber italic">Required Attribution.</em>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
          <div className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/30 px-5 sm:px-7 py-6">
            <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-emerald-400 mb-4">— you can</div>
            <ul className="space-y-2.5 text-paper text-[14.5px] sm:text-[15px]">
              {[
                "Use commercially",
                "Modify and redistribute",
                "Sell hosting (with your own brand if re-branded)",
                "Charge for support, customizations, deployments",
                "Run on your own infrastructure forever",
                "Audit every line of source",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check size={13} className="text-emerald-400 mt-1 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-rust/[0.06] border border-rust/30 px-5 sm:px-7 py-6">
            <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-rust mb-4">— you cannot</div>
            <ul className="space-y-2.5 text-paper text-[14.5px] sm:text-[15px]">
              {[
                "Strip the visible \"Powered by ChatHermes\" link",
                "Remove the X-Powered-By: ChatHermes HTTP header",
                "Use the name \"ChatHermes\" or our mascot for your fork",
                "Modify _attribution.ts identifying constants",
                "Bypass the runtime guard",
                "Pretend to be us",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <X size={13} className="text-rust mt-1 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl bg-ink-soft border border-ink-line px-5 sm:px-7 py-6">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-amber mt-0.5 shrink-0" />
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-amber mb-2">— enforcement</div>
              <p className="text-paper text-[14.5px] sm:text-[15px] leading-[1.6] mb-3">
                The runtime guard in <code className="text-[12.5px] text-amber bg-ink px-1.5 py-0.5 rounded">orchestrator/src/_attribution.ts</code> checks that all required attribution constants are present at startup. <strong>If tampered, the orchestrator refuses to start.</strong>
              </p>
              <p className="text-paper-dim text-[13.5px] sm:text-[14px] leading-[1.6]">
                The X-Powered-By header is set in middleware on <em>every</em> HTTP response.
                The /p/&lt;slug&gt; public preview includes a floating "Made with ChatHermes" badge that's compiled into the served HTML.
                These aren't suggestions. They're the license.
              </p>
              <Link
                href="https://github.com/chathermes/chathermes/blob/master/LICENSE.md"
                target="_blank"
                className="inline-flex items-center gap-1.5 mt-4 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.16em] text-amber hover:text-amber-soft"
              >
                Read full LICENSE.md <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* VERIFY */}
      <section className="px-6 sm:px-10 py-16 sm:py-20 max-w-[1100px] mx-auto border-t border-ink-line/40">
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-amber mb-4">— trust through verification</div>
        <h2 className="font-[family-name:var(--font-display)] text-[clamp(32px,4.5vw,56px)] leading-[1.05] tracking-[-0.025em] mb-3">
          Audit it yourself.
        </h2>
        <p className="text-paper-dim text-[15.5px] sm:text-[17px] leading-[1.55] mb-8 max-w-[640px]">
          We ship a verify script. Run it after cloning to confirm the bundle is clean: zero credentials, zero PII, attribution intact.
        </p>

        <div className="rounded-2xl bg-ink-soft border border-ink-line overflow-hidden">
          <div className="px-5 py-2.5 border-b border-ink-line/60 flex items-center gap-2 bg-ink/40">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            <span className="ml-2 font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint">bash bin/verify-bundle.sh</span>
          </div>
          <pre className="px-5 py-5 font-[family-name:var(--font-mono)] text-[12.5px] sm:text-[13.5px] text-paper-dim leading-[1.7] overflow-x-auto whitespace-pre">{`== verify-bundle ==
-- attribution layer --
  + _attribution.ts present
  + runtime guard present
-- credential scan (strict, real-key shape) --
  + zero real credentials matched
-- email/PII scan --
  + no team emails leaked
-- IP scan --
  + no production IPs leaked
-- env hygiene --
  + no real .env shipped
  + .env.example present
  + no production database shipped

  ALL CHECKS PASSED`}</pre>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-10 py-20 sm:py-28 max-w-[1100px] mx-auto border-t border-ink-line/40">
        <div className="text-center">
          <Image src="/illustrations/mascot-head.png" alt="" width={84} height={84} className="mx-auto mb-6" style={{ filter: "drop-shadow(0 0 50px rgba(232,165,71,0.5))" }} />
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,6vw,88px)] tracking-[-0.025em] leading-[1.0] mb-6">
            Clone it.<br /><em className="text-amber italic">Ship it.</em>
          </h2>
          <p className="text-paper-dim text-[16px] sm:text-[18px] leading-[1.55] max-w-[520px] mx-auto mb-10">
            6,683 lines of TypeScript waiting for you on GitHub. v1.0.0 tagged. Verify-bundle passes. Nothing held back.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://github.com/chathermes/chathermes"
              target="_blank" rel="noopener"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-md bg-paper text-ink text-[15.5px] font-medium hover:bg-paper/90 transition shadow-[0_0_60px_rgba(251,250,246,0.25)]"
            >
              <GitBranch size={16} /> github.com/chathermes/chathermes <ArrowUpRight size={14} />
            </a>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[14.5px] transition"
            >
              <Crown size={14} /> Or use the hosted version
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 sm:px-10 py-12 border-t border-ink-line/40 max-w-[1100px] mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="font-[family-name:var(--font-display)] text-[16px]">ChatHermes</div>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint">v1.0.0 · AGPL + Required Attribution</span>
          </div>
          <div className="flex items-center gap-1.5 text-paper-faint text-[12.5px]">
            <Heart size={11} className="text-amber" />
            <span>Made in Jakarta. Built on <a href="https://github.com/NousResearch/hermes-agent" target="_blank" rel="noopener" className="text-paper-dim hover:text-amber">Hermes Agent</a> by Nous Research × <a href="https://moonshot.ai" target="_blank" rel="noopener" className="text-paper-dim hover:text-amber">Kimi K2</a> by Moonshot AI.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureBox({ icon: Icon, title, desc, file }: any) {
  return (
    <div className="rounded-2xl bg-ink-soft border border-ink-line px-5 sm:px-6 py-5 hover:border-amber/30 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-amber/15 border border-amber/30 flex items-center justify-center text-amber shrink-0">
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-[family-name:var(--font-display)] text-[18px] sm:text-[20px] tracking-[-0.01em] text-paper">{title}</div>
        </div>
      </div>
      <p className="text-paper-dim text-[13.5px] sm:text-[14px] leading-[1.55] mb-3">{desc}</p>
      <div className="flex items-center gap-1.5 text-amber/80 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] pt-3 border-t border-ink-line/60">
        <FileCode size={10} />
        <span className="truncate">{file}</span>
      </div>
    </div>
  );
}

function InstallPath({ label, title, time, desc, code, recommended }: any) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${recommended ? "bg-amber/[0.03] border-amber/30" : "bg-ink-soft border-ink-line"}`}>
      <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.22em] text-amber">{label}</div>
          {recommended && (
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 rounded bg-amber/15 border border-amber/40 text-amber">recommended</span>
          )}
          <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint ml-auto">{time}</span>
        </div>
        <div className="font-[family-name:var(--font-display)] text-[24px] sm:text-[30px] tracking-[-0.015em] mb-2">{title}</div>
        <p className="text-paper-dim text-[14px] sm:text-[15px] leading-[1.55]">{desc}</p>
      </div>
      <pre className="bg-black/40 border-t border-ink-line/60 px-5 sm:px-7 py-5 font-[family-name:var(--font-mono)] text-[12px] sm:text-[13px] text-paper leading-[1.7] overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}
