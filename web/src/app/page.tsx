import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import ChatLauncher from "./_components/chat-launcher";
import HeroIntro from "./_components/hero-intro";
import LiveSwarm from "./_components/live-swarm";
import LivePreview from "./_components/live-preview";
import HermesGlyph from "./_components/hermes-glyph";
import { TiltImage, HoverPopImage, SparkleField, FadeUpOnView } from "./_components/interactive-image";

export default async function Landing() {
  // Auto-detect if user is signed in (cookie present + non-empty)
  const c = await cookies();
  const sid = c.get("ch_sid")?.value;
  const isAuthed = !!sid;
  return (
    <>
      <nav className="absolute top-0 left-0 right-0 py-7 z-10">
        <div className="mx-auto max-w-[1240px] px-7 flex justify-between items-center">
          <Link href="/" className="font-[family-name:var(--font-display)] text-[30px] sm:text-[34px] tracking-tight leading-none flex items-center gap-3">
            <Image src="/illustrations/mascot-head.png" alt="" width={56} height={56} className="w-12 h-12 sm:w-14 sm:h-14 halo-amber" priority />
            <span>ChatHermes</span>
          </Link>
          <div className="flex items-center gap-7">
            <Link href="/introducing" className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim hover:text-amber transition-colors uppercase tracking-[0.12em]">demo</Link>
            <Link href="/docs" className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim hover:text-amber transition-colors uppercase tracking-[0.12em]">docs</Link>
            <Link href="/opensource" className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim hover:text-amber transition-colors uppercase tracking-[0.12em]">open source</Link>
            <a href="#how" className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim hover:text-paper transition-colors uppercase tracking-[0.12em]">how</a>
            <a href="#vs" className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim hover:text-paper transition-colors uppercase tracking-[0.12em]">vs chatgpt</a>
            <Link href={isAuthed ? "/app" : "/auth/login"} className="font-[family-name:var(--font-mono)] text-[12px] text-paper hover:text-amber transition-colors uppercase tracking-[0.12em]">
              {isAuthed ? "open app →" : "sign in →"}
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="min-h-[100svh] flex flex-col items-center justify-center px-7 pt-32 pb-24 relative">
          <HeroIntro />
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(48px,9vw,128px)] leading-[0.96] tracking-[-0.035em] text-center max-w-[16ch] mb-7 mt-6">
            What should your <em className="text-amber">agent</em> work on?
          </h1>
          <p className="text-paper-dim text-[17px] max-w-[54ch] text-center mb-12 leading-[1.55]">
            Drop a task. ChatHermes spawns a private agent that keeps working — even after you close the tab. Memory, skills, scheduling, and Telegram out of the box.
          </p>
          <ChatLauncher />
          <LivePreview />
        </section>

        <section id="how" className="py-24 lg:py-32 border-t border-ink-line-soft">
          <div className="mx-auto max-w-[1140px] px-7">
            <div className="max-w-[64ch] mb-20">
              <div className="font-[family-name:var(--font-mono)] text-[11px] text-amber uppercase tracking-[0.18em] mb-6">— how it works</div>
              <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,6vw,72px)] leading-[1.0] tracking-[-0.025em]">
                It works <em className="text-amber">while you&apos;re offline.</em>
              </h2>
              <p className="text-paper-dim mt-7 text-[18px] leading-[1.55] max-w-[56ch]">
                Three things that ChatGPT can&apos;t do — because it&apos;s a chat. ChatHermes is an agent.
              </p>
            </div>

            <Scene
              when="Tuesday, 10:47 PM"
              sub="before bed"
              title="You leave a half-formed idea. It comes back finished."
              lede="Drop a voice-note about a newsletter you've been meaning to write. Then go to sleep."
              illustration="/illustrations/scene-sleep.png"
              illustrationAlt="Hermes writing a newsletter at night while you sleep"
            >
              <Bubble role="you">&quot;Draft something on why slow AI is undervalued. My voice — terse. Reading list pinned.&quot;</Bubble>
              <Bubble role="agent">Got it. I&apos;ll have a draft on your Telegram by 7am.</Bubble>
              <Meta>— 8 hours later, while you slept —</Meta>
              <Swarm chips={["research • 18 sources", "draft • 740w", "fact-check", "style-pass"]} />
              <Bubble role="agent">Draft ready. Pinned 3 quotes from your reading list. Tap to edit, or reply with feedback.</Bubble>
            </Scene>

            <Scene
              when="Right now"
              sub="parallel"
              title="It spawns a swarm. You watch it work."
              lede="Big asks split into subagents that run in parallel. Each one is visible — no black box."
              illustration="/illustrations/mascot-desk.png"
              illustrationAlt="Hermes spawning many ideas in parallel"
            >
              <Bubble role="you">&quot;Build me a landing page for an indie game called Aether. Wire it up, deploy it, send me the URL.&quot;</Bubble>
              <Bubble role="agent">On it. Spawning 4 agents.</Bubble>
              <LiveSwarm />
              <Bubble role="agent">Live at aether-gXk2.chathermes.dev. Want me to hook a domain?</Bubble>
            </Scene>
          </div>
        </section>

        <section id="vs" className="py-24 lg:py-32 border-t border-ink-line-soft">
          <div className="mx-auto max-w-[1140px] px-7">
            <div className="font-[family-name:var(--font-mono)] text-[11px] text-amber uppercase tracking-[0.18em] mb-6">— vs. chatgpt</div>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,6vw,72px)] leading-[1.0] tracking-[-0.025em] max-w-[20ch]">
              A chatbot is a calculator. <em className="text-amber">ChatHermes is a coworker.</em>
            </h2>
            <div className="mt-16 grid gap-5">
              <CompareImage label="presence" src="/illustrations/compare-presence.png" alt="ChatGPT sleeping vs ChatHermes always working" />
              <CompareImage label="memory" src="/illustrations/compare-memory.png" alt="ChatGPT forgets vs ChatHermes remembers" />
              <CompareImage label="surface" src="/illustrations/compare-surface.png" alt="ChatGPT trapped in a tab vs ChatHermes everywhere" />
              <CompareImage label="parallelism" src="/illustrations/compare-parallelism.png" alt="ChatGPT one task vs ChatHermes many in parallel" />
            </div>
          </div>
        </section>

        <section className="py-24 lg:py-32 border-t border-ink-line-soft">
          <div className="mx-auto max-w-[1140px] px-7">
            <div className="font-[family-name:var(--font-mono)] text-[11px] text-amber uppercase tracking-[0.18em] mb-6">— what makes it different</div>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(40px,6vw,72px)] leading-[1.0] tracking-[-0.025em] max-w-[20ch]">
              Four things that make this <em className="text-amber">different.</em>
            </h2>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
              <PillarCard n="01" h="Zero install." img="/illustrations/pillar-install.png">Open the URL. Chat. The agent is already running on a server we operate. No Docker. No SSH. No env vars.</PillarCard>
              <PillarCard n="02" h="Lifelong memory." img="/illustrations/pillar-memory.png">Browse, edit, and curate what your agent knows about you. Memory is reviewable, never opaque.</PillarCard>
              <PillarCard n="03" h="Lives where you live." img="/illustrations/pillar-surfaces.png">One agent, every surface. Connect Telegram in one click — same memory, same skills, same voice.</PillarCard>
              <PillarCard n="04" h="Background work." img="/illustrations/pillar-background.png">&quot;Every Monday, summarize my reading list.&quot; It does. Forever. Until you change your mind.</PillarCard>
            </div>
          </div>
        </section>

        <section className="py-32 border-t border-ink-line-soft relative overflow-hidden">
          <div className="mx-auto max-w-[1240px] px-7 grid lg:grid-cols-[auto_1fr] gap-12 lg:gap-20 items-center">
            <div className="hidden lg:flex justify-center -my-10 w-[300px]">
              <TiltImage src="/illustrations/winged-helmet.png" alt="" width={320} height={260} className="w-[300px] h-auto bleed-soft halo-amber float-drift" intensity={10} />
            </div>
            <div className="text-center lg:text-left">
              <div className="font-[family-name:var(--font-mono)] text-[11px] text-amber uppercase tracking-[0.18em] mb-5">— start now</div>
              <h2 className="font-[family-name:var(--font-display)] text-[clamp(48px,8vw,108px)] leading-[0.98] tracking-[-0.03em] max-w-[16ch]">
                Stop chatting. <em className="text-amber">Start delegating.</em>
              </h2>
              <p className="text-paper-dim mt-6 text-[17px] max-w-[52ch] mx-auto lg:mx-0 leading-[1.55]">
                Sign up takes 30 seconds. Tell your agent what you want. Close the tab. Come back to results.
              </p>
              <a
                href="#top"
                className="inline-flex items-center gap-3 mt-10 px-8 py-4 rounded-full bg-amber text-ink font-medium text-[15px] hover:bg-amber-soft hover:-translate-y-px transition-all"
              >
                Try it now ↑
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Giant wordmark — startup-style brand outro */}
      <SelfHostVsCloud isAuthed={isAuthed} />

      <section className="relative pt-24 pb-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,165,71,0.08),transparent_60%)] pointer-events-none" />
        <div className="mx-auto max-w-[1480px] px-7 relative">
          <div className="flex items-end gap-4 sm:gap-8 justify-center lg:justify-start">
            <Image src="/illustrations/mascot-full.png" alt="" width={420} height={420} className="hidden md:block w-[180px] lg:w-[280px] xl:w-[340px] h-auto bleed-soft halo-amber float-drift -mb-2" />
            <h2
              aria-label="ChatHermes"
              className="font-[family-name:var(--font-display)] leading-[0.82] tracking-[-0.04em] text-paper select-none"
              style={{ fontSize: "clamp(80px, 19vw, 320px)" }}
            >
              <span className="block">Chat<em className="text-amber not-italic italic">Hermes</em></span>
            </h2>
          </div>
          <div className="mt-8 lg:mt-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 border-t border-ink-line-soft pt-6">
            <p className="font-[family-name:var(--font-display)] italic text-[clamp(20px,3vw,32px)] leading-[1.2] text-paper-dim max-w-[28ch]">
              The chat that doesn&apos;t end when you close the tab.
            </p>
            <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-paper-faint flex flex-wrap gap-x-5 gap-y-1.5">
              <span>built on Hermes Agent</span>
              <span>·</span>
              <span>Hermes Agent × Kimi K2</span>
              <span>·</span>
              <span>Nous Research × Moonshot AI</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-ink-line-soft text-paper-dim text-[13px]">
        <div className="mx-auto max-w-[1140px] px-7 flex justify-between flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2.5">
            <Image src="/illustrations/mascot-head.png" alt="" width={28} height={28} className="w-7 h-7 halo-amber" />
            <span>© 2026 ChatHermes</span>
          </div>
          <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em]">
            built on{" "}
            <a href="https://hermes-agent.nousresearch.com" className="text-amber">Hermes Agent</a>
            {" + "}
            <a href="https://moonshot.ai" className="text-amber">Kimi K2</a>
          </div>
        </div>
      </footer>
    </>
  );
}

function Scene({ when, sub, title, lede, illustration, illustrationAlt, children }: { when: string; sub: string; title: string; lede: string; illustration?: string; illustrationAlt?: string; children: React.ReactNode }) {
  return (
    <div className="mt-24 grid md:grid-cols-[180px_1fr] gap-5 md:gap-14 items-start">
      <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-dim pt-1.5 uppercase tracking-[0.1em]">
        <span className="text-amber block mb-2">{when}</span>
        {sub}
      </div>
      <div>
        {illustration && (
          <div className="mb-8 -ml-4 sm:ml-0 max-w-[460px]">
            <TiltImage src={illustration} alt={illustrationAlt ?? ""} width={520} height={520} className="w-full h-auto bleed-soft halo-warm float-slow" intensity={5} />
          </div>
        )}
        <h3 className="font-[family-name:var(--font-display)] text-[clamp(26px,3vw,36px)] leading-[1.1] tracking-[-0.02em] max-w-[28ch]">{title}</h3>
        <p className="text-paper-dim mt-3 text-[16px] leading-[1.55] max-w-[56ch]">{lede}</p>
        <div className="mt-7 bg-ink-soft/60 backdrop-blur-sm border border-ink-line rounded-[14px] px-7 py-6 font-[family-name:var(--font-mono)] text-[13px] leading-[1.7] space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, children }: { role: "you" | "agent"; children: React.ReactNode }) {
  if (role === "you") {
    return (
      <div className="text-paper">
        <span className="text-paper-faint mr-3 text-[10.5px] uppercase tracking-[0.16em]">you</span>
        {children}
      </div>
    );
  }
  return (
    <div className="text-paper border-l-2 border-amber py-1 pl-4">
      <span className="text-amber mr-3 text-[10.5px] uppercase tracking-[0.16em]">hermes</span>
      {children}
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="text-paper-faint text-[12px] mt-4 italic">{children}</div>;
}

function Swarm({ chips }: { chips: string[] }) {
  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {chips.map((c, i) => (
        <span key={i} className="px-3 py-1 rounded-md text-[11.5px] border border-ink-line text-paper-dim">{c}</span>
      ))}
    </div>
  );
}

function CompareImage({ label, src, alt }: { label: string; src: string; alt: string }) {
  return (
    <FadeUpOnView>
      <div className="group relative py-4">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-amber uppercase tracking-[0.2em] mb-4 ml-1">— {label}</div>
        <div className="relative">
          <TiltImage src={src} alt={alt} width={1200} height={600} className="w-full h-auto bleed-soft halo-warm" intensity={4} />
          <SparkleField count={18} />
        </div>
      </div>
    </FadeUpOnView>
  );
}

function SelfHostVsCloud({ isAuthed }: { isAuthed: boolean }) {
  const rows: Array<{ label: string; oss: string | React.ReactNode; cloud: string | React.ReactNode; cloudGood?: boolean }> = [
    { label: "Setup time",                oss: "30–60 min",                       cloud: "30 sec",                          cloudGood: true },
    { label: "Source code",               oss: "all of it (AGPL-3.0)",            cloud: "same code, hosted",               cloudGood: false },
    { label: "LLM API keys",              oss: "bring your own",                  cloud: "pre-pooled, included",            cloudGood: true },
    { label: "Hermes Agent native",       oss: "install yourself (5 GB)",         cloud: "pre-installed, ready",            cloudGood: true },
    { label: "Telegram bot",              oss: "BYO BotFather token",             cloud: "shared @ChatHermesBot",           cloudGood: true },
    { label: "Email delivery",            oss: "BYO Resend + DNS verify",         cloud: "verified domain, included",       cloudGood: true },
    { label: "Public preview URL",        oss: "your-domain.com/p/<slug>",        cloud: "chathermes.com/p/<slug>",         cloudGood: false },
    { label: "Backups",                   oss: "DIY (cron + S3)",                 cloud: "automatic + point-in-time",       cloudGood: true },
    { label: "Updates",                   oss: "git pull + restart",              cloud: "automatic",                       cloudGood: true },
    { label: "What you bring",            oss: "your servers, keys, time",        cloud: "your email + a credit card",      cloudGood: true },
    { label: "Privacy",                   oss: "your server, your data",          cloud: "encrypted at rest, SOC2-track",   cloudGood: false },
  ];

  return (
    <section className="relative py-24 overflow-hidden border-t border-ink-line-soft">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,154,149,0.06),transparent_60%)] pointer-events-none" />
      <div className="mx-auto max-w-[1140px] px-5 sm:px-7 relative">
        <FadeUpOnView>
          <div className="text-center mb-12">
            <div className="font-[family-name:var(--font-mono)] text-[10.5px] sm:text-[11.5px] text-amber uppercase tracking-[0.22em] mb-3">— open source</div>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(34px,5vw,56px)] leading-[1.05] tracking-[-0.025em]">
              Self-host it for free.<br />
              <em className="not-italic italic text-amber">Or skip the setup.</em>
            </h2>
            <p className="text-paper-dim mt-5 text-[15px] sm:text-[17px] max-w-[58ch] mx-auto leading-[1.55]">
              ChatHermes is fully open source under AGPL-3.0. The code that powers chathermes.com is the same code you can clone, fork, and run yourself.
            </p>
          </div>
        </FadeUpOnView>

        {/* Comparison table */}
        <FadeUpOnView>
          <div className="bg-ink-soft/50 backdrop-blur-sm border border-ink-line rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr] sm:grid-cols-[140px_1fr_1fr] divide-x divide-ink-line">
              <div className="p-3 sm:p-5 border-b border-ink-line">
                <div className="font-[family-name:var(--font-mono)] text-[9.5px] sm:text-[10.5px] uppercase tracking-[0.18em] text-paper-faint">—</div>
              </div>
              <div className="p-3 sm:p-5 border-b border-ink-line">
                <div className="font-[family-name:var(--font-mono)] text-[10px] sm:text-[10.5px] uppercase tracking-[0.18em] text-paper-faint mb-1">Self-host</div>
                <div className="font-[family-name:var(--font-display)] text-[18px] sm:text-[22px] tracking-[-0.015em]">Open source</div>
                <div className="text-paper-dim text-[12px] sm:text-[13px] mt-0.5 hidden sm:block">free, forever</div>
              </div>
              <div className="p-3 sm:p-5 border-b border-ink-line bg-amber/[0.04]">
                <div className="font-[family-name:var(--font-mono)] text-[10px] sm:text-[10.5px] uppercase tracking-[0.18em] text-amber mb-1">Hosted</div>
                <div className="font-[family-name:var(--font-display)] text-[18px] sm:text-[22px] tracking-[-0.015em]">chathermes.com</div>
                <div className="text-paper-dim text-[12px] sm:text-[13px] mt-0.5 hidden sm:block">from $20 / mo</div>
              </div>
            </div>

            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr] sm:grid-cols-[140px_1fr_1fr] divide-x divide-ink-line border-b border-ink-line last:border-b-0">
                <div className="p-3 sm:p-4 font-[family-name:var(--font-mono)] text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.14em] text-paper-faint flex items-center">
                  {r.label}
                </div>
                <div className="p-3 sm:p-4 text-[12.5px] sm:text-[14px] text-paper-dim leading-[1.45]">{r.oss}</div>
                <div className={`p-3 sm:p-4 text-[12.5px] sm:text-[14px] leading-[1.45] ${r.cloudGood ? "text-paper" : "text-paper-dim"} bg-amber/[0.02]`}>{r.cloud}</div>
              </div>
            ))}
          </div>
        </FadeUpOnView>

        {/* Dual CTA */}
        <FadeUpOnView>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
            <a href="https://github.com/chathermes/chathermes" target="_blank" rel="noopener noreferrer" className="group rounded-2xl bg-ink-soft border border-ink-line hover:border-amber/40 transition-colors px-6 py-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-paper/[0.05] border border-ink-line flex items-center justify-center shrink-0 mt-1 group-hover:bg-paper/[0.08] transition-colors">
                <span className="font-[family-name:var(--font-mono)] text-[18px]">{`{}`}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-paper-faint mb-1">— get the code</div>
                <div className="font-[family-name:var(--font-display)] text-[22px] leading-[1.15] tracking-[-0.015em] text-paper">github.com/chathermes</div>
                <div className="text-paper-dim text-[14px] mt-1.5 leading-[1.5]">
                  Clone, run <code className="font-[family-name:var(--font-mono)] text-[12.5px] px-1 py-0.5 bg-ink-line/60 rounded text-amber">docker compose up</code>, you're done. AGPL-3.0.
                </div>
              </div>
              <span className="text-paper-faint group-hover:text-amber transition-colors text-[18px] mt-1">→</span>
            </a>

            <a href={isAuthed ? "/app" : "/auth/login"} className="group rounded-2xl bg-amber/10 border border-amber/30 hover:border-amber/60 transition-colors px-6 py-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber/15 border border-amber/30 flex items-center justify-center shrink-0 mt-1">
                <span className="text-amber text-[16px]">{isAuthed ? "→" : "⚭"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-amber mb-1">— {isAuthed ? "welcome back" : "skip the setup"}</div>
                <div className="font-[family-name:var(--font-display)] text-[22px] leading-[1.15] tracking-[-0.015em] text-paper">{isAuthed ? "Continue to your workspace" : "Try chathermes.com"}</div>
                <div className="text-paper-dim text-[14px] mt-1.5 leading-[1.5]">
                  {isAuthed ? "You\'re already signed in. Pick up where you left off — sessions, memory, and skills are all loaded." : "Magic-link sign-in. No credit card. Free tier with 50 messages / month."}
                </div>
              </div>
              <span className="text-amber group-hover:translate-x-0.5 transition-transform text-[18px] mt-1">→</span>
            </a>
          </div>
        </FadeUpOnView>

        <FadeUpOnView>
          <p className="text-center text-paper-faint text-[12.5px] sm:text-[13px] mt-8 max-w-[58ch] mx-auto leading-[1.55]">
            The hosted version pays for the LLM tokens, the Hermes Agent runtime, the verified email domain, and the public preview surface — so you don't have to.
          </p>
        </FadeUpOnView>
      </div>
    </section>
  );
}

function PillarCard({ n, h, img, children }: { n: string; h: string; img: string; children: React.ReactNode }) {
  return (
    <FadeUpOnView>
      <div className="group bg-ink-soft border border-ink-line rounded-2xl overflow-hidden hover:border-amber/40 transition-colors h-full">
        <div className="relative aspect-[4/3] overflow-hidden bg-paper-soft">
          <Image src={img} alt="" width={800} height={600} className="w-full h-full object-cover transition-transform duration-[1500ms] ease-out group-hover:scale-[1.08] float-drift" />
          <div className="pointer-events-none absolute inset-0 vignette-dark rounded-none" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(11,10,9,0.35)_100%)]" />
        </div>
        <div className="px-6 py-5 border-t border-ink-line">
          <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-amber uppercase tracking-[0.2em] mb-2">{n}</div>
          <h4 className="font-[family-name:var(--font-display)] text-[24px] leading-[1.2] tracking-[-0.015em]">{h}</h4>
          <p className="text-paper-dim text-[14.5px] mt-2 leading-[1.55]">{children}</p>
        </div>
      </div>
    </FadeUpOnView>
  );
}
