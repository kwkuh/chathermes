"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Terminal, Server, Cloud, Copy, Check, RefreshCw, ArrowUpRight,
  CircleAlert, Package, BookOpen, Container,
} from "lucide-react";

type HermesLatest = {
  version: string | null;
  tag: string | null;
  published_at: string | null;
  url: string;
  source: "github" | "pypi" | "unavailable";
  checked_at: string;
};
type HermesResp = { latest: HermesLatest; stale: boolean; docs: string; repo: string };

const REPO = "https://github.com/kwkuh/chathermes";

function ago(iso: string | null) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default function InstallPage() {
  const [hermes, setHermes] = useState<HermesResp | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (force = false) => {
    setChecking(true);
    try {
      const r = await fetch(`/api/system/hermes-version${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      setHermes(await r.json());
      setFailed(false);
    } catch { setFailed(true); }
    setChecking(false);
  }, []);

  // Re-check on mount and whenever the tab regains focus, so a page left open
  // does not keep showing a version that has since been superseded.
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const v = hermes?.latest;

  return (
    <div className="min-h-screen bg-ink text-paper antialiased">
      <nav className="px-6 sm:px-10 py-5 flex items-center gap-6 border-b border-ink-line/40">
        <Link href="/" className="font-[family-name:var(--font-display)] text-[20px] tracking-tight">ChatHermes</Link>
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-amber border-l border-ink-line/60 pl-3 hidden sm:inline">Install</span>
        <div className="ml-auto flex items-center gap-5">
          <Link href="/docs" className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] text-paper-dim hover:text-amber transition">docs</Link>
          <Link href="/opensource" className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] text-paper-dim hover:text-amber transition">open source</Link>
          <a href={REPO} target="_blank" rel="noopener" className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper transition">github</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="px-6 sm:px-10 pt-16 sm:pt-20 pb-10 max-w-[900px] mx-auto">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-4">— self-host</div>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,84px)] leading-[0.98] tracking-[-0.03em] mb-6">
          Run your own<br /><em className="text-amber italic">agent platform.</em>
        </h1>
        <p className="text-paper-dim text-[17px] sm:text-[19px] leading-[1.55] max-w-[62ch]">
          Two commands and you have the whole thing: multi-tenant auth, billing, 14 tools,
          memory, vibe coding, and a dedicated agent per paying user. One SQLite file,
          three Bun processes, no external services required to boot.
        </p>
      </section>

      {/* RUNTIME VERSION — live */}
      <section className="px-6 sm:px-10 pb-12 max-w-[900px] mx-auto">
        <div className="rounded-lg border border-ink-line bg-ink-soft/30 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.22em] text-paper-faint mb-2">
                Hermes Agent runtime
              </div>
              {failed ? (
                <div className="flex items-center gap-2 text-rust text-[15px]">
                  <CircleAlert size={15} /> Could not reach the release feed.
                </div>
              ) : !hermes ? (
                <div className="h-[34px] w-[180px] rounded bg-ink-line/50 animate-pulse" />
              ) : v?.version || v?.tag ? (
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-[family-name:var(--font-display)] text-[30px] sm:text-[34px] leading-none text-amber">
                    {v.version ? `v${v.version}` : v.tag}
                  </span>
                  {v.version && v.tag && (
                    <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper-faint">{v.tag}</span>
                  )}
                  {v.published_at && (
                    <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper-faint">
                      released {ago(v.published_at)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-paper-dim text-[15px]">Version unavailable right now.</div>
              )}
            </div>

            <button
              onClick={() => load(true)}
              disabled={checking}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-dim text-[13px] transition disabled:opacity-50 font-[family-name:var(--font-mono)]"
            >
              <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
              {checking ? "checking…" : "check now"}
            </button>
          </div>

          <p className="text-paper-dim text-[14px] leading-[1.6] mt-4">
            Read live from the upstream release feed every time this page is opened, so it
            never drifts out of date. ChatHermes talks to Hermes Agent over an
            OpenAI-compatible endpoint, so a runtime upgrade does not require a ChatHermes
            upgrade.
          </p>

          <div className="flex items-center gap-4 mt-4 flex-wrap font-[family-name:var(--font-mono)] text-[12px]">
            {v && (
              <a href={v.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-amber hover:text-amber-soft transition">
                <Package size={12} /> release notes <ArrowUpRight size={11} />
              </a>
            )}
            <a href={hermes?.docs ?? "https://hermes-agent.nousresearch.com/"} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-paper-dim hover:text-amber transition">
              <BookOpen size={12} /> hermes-agent.nousresearch.com <ArrowUpRight size={11} />
            </a>
            {v?.source && v.source !== "unavailable" && (
              <span className="text-paper-faint">source: {v.source}</span>
            )}
          </div>
        </div>
      </section>

      {/* PREREQS */}
      <section className="px-6 sm:px-10 pb-10 max-w-[900px] mx-auto">
        <h2 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[30px] tracking-[-0.02em] mb-4">Before you start</h2>
        <ul className="space-y-2.5 text-paper-dim text-[15.5px] leading-[1.6]">
          <li>— <strong className="text-paper">Bun 1.3+</strong> on Linux or macOS. Nothing else is required to boot.</li>
          <li>— <strong className="text-paper">An LLM API key</strong> from any one provider. The installer asks for it and writes the env file for you.</li>
          <li>— <strong className="text-paper">Optional:</strong> Resend for email, Stripe for billing, a Hetzner token for per-user agent servers. Skipping these leaves the features dormant, not broken — magic links print to the orchestrator log.</li>
        </ul>
      </section>

      {/* PATHS */}
      <section className="px-6 sm:px-10 pb-16 max-w-[900px] mx-auto space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[30px] tracking-[-0.02em] mb-1">Pick a path</h2>

        <Path
          icon={Terminal}
          title="Your machine"
          time="~3 min"
          desc="The fastest way to see it running. Interactive setup wizard, dependency install, build, and a smoke test — then all three services."
          code={`git clone ${REPO}.git
cd chathermes
./bin/install.sh     # wizard + deps + build + smoke test
./bin/start.sh       # boots orchestrator, web, and the shared agent proxy`}
          after="Open http://localhost:7000 and sign in with any email."
        />

        <Path
          icon={Server}
          title="A VPS you own"
          time="~10 min"
          desc="Same install, then systemd units so it survives reboots. Put nginx and Certbot in front for HTTPS. A $5 box is enough to start."
          code={`git clone ${REPO}.git /opt/chathermes
cd /opt/chathermes && ./bin/install.sh
cp deploy/systemd/*.service /etc/systemd/system/
systemctl enable --now chathermes-orch chathermes-web chathermes-hermes-proxy`}
          after="Full production notes — HTTPS, Stripe webhooks, verified email domain — are in INSTALL.md."
          link={{ href: `${REPO}/blob/main/INSTALL.md`, label: "INSTALL.md" }}
        />

        <Path
          icon={Container}
          title="Docker"
          time="~2 min"
          desc="One image runs all three processes and keeps every byte of state in one volume. This is the path that works on any platform that can run a container."
          code={`git clone ${REPO}.git && cd chathermes
cp orchestrator/.env.example .env    # set SESSION_SECRET + one LLM key
docker compose up -d`}
          after="On macOS, port 7000 is taken by AirPlay Receiver — run WEB_PORT=7600 docker compose up -d, or turn AirPlay off in System Settings."
        />

        <Path
          icon={Cloud}
          title="One-click to Hetzner"
          time="~2 min"
          desc="Provision a server from inside the admin panel with your own Hetzner token. Cloud-init installs and boots everything. This is also what provisions a dedicated agent per Pro user."
          code={`# from a running instance:
#   Admin → Hetzner → pick server type + region → Deploy`}
          after="Needs HETZNER_API_TOKEN in the orchestrator env. Gated by default: an admin approves every spawn."
        />
      </section>

      {/* ANY CLOUD */}
      <section className="px-6 sm:px-10 pb-16 max-w-[900px] mx-auto">
        <h2 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[30px] tracking-[-0.02em] mb-3">Any other cloud</h2>
        <p className="text-paper-dim text-[15.5px] leading-[1.6] mb-6 max-w-[68ch]">
          Hetzner is wired into the admin panel because that is what the hosted product
          uses. Nothing about ChatHermes is tied to it. Paste the block below as
          <span className="text-paper"> user data</span> when you create a server and it
          installs itself on first boot — same script the one-click deploy runs.
        </p>

        <CodeBlock code={`#cloud-config
package_update: true
packages: [docker.io, docker-compose-plugin, git]
write_files:
  - path: /opt/chathermes/.env
    permissions: '0600'
    content: |
      SESSION_SECRET=REPLACE_WITH_openssl_rand_hex_32
      PUBLIC_BASE_URL=https://your-domain.com
      NOUS_API_KEY=REPLACE_OR_USE_ANOTHER_PROVIDER
      DATA_ROOT=/data
runcmd:
  - systemctl enable --now docker
  - git clone ${REPO}.git /opt/chathermes/repo
  - cp -r /opt/chathermes/repo/. /opt/chathermes/
  - cd /opt/chathermes && docker compose up -d --build`} />

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-7">
          <ProviderNote name="DigitalOcean" note="Droplet → Advanced → Add Initialization scripts (user data). Or: doctl compute droplet create --user-data-file cloud-init.yml" />
          <ProviderNote name="Vultr" note="Deploy → Advanced → Cloud-Init User-Data. Or: vultr-cli instance create --userdata" />
          <ProviderNote name="Linode / Akamai" note="Create Linode → Advanced → Metadata → User Data (needs a metadata-enabled region)" />
          <ProviderNote name="AWS EC2 / Lightsail" note="Launch instance → Advanced details → User data. Ubuntu images ship with cloud-init" />
          <ProviderNote name="Google Cloud" note="Create VM → Advanced → Automation → Startup script (paste the runcmd lines as a shell script)" />
          <ProviderNote name="Azure" note="VM → Advanced → Custom data and cloud init" />
          <ProviderNote name="Scaleway" note="Instance → Advanced settings → cloud-init" />
          <ProviderNote name="OVHcloud" note="Public Cloud instance → Post-installation script" />
          <ProviderNote name="Oracle Cloud" note="Instance → Advanced options → Cloud-init script. The Always Free ARM tier fits this comfortably" />
          <ProviderNote name="Contabo / Netcup" note="Any Ubuntu image: SSH in and run the runcmd lines by hand" />
        </div>

        <p className="text-paper-faint text-[13.5px] leading-[1.6] mt-6">
          Anything that boots Ubuntu with cloud-init works. If your provider has no user-data
          field, SSH in and run the four <code className="text-paper-dim">runcmd</code> lines.
        </p>
      </section>

      {/* PAAS */}
      <section className="px-6 sm:px-10 pb-16 max-w-[900px] mx-auto">
        <h2 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[30px] tracking-[-0.02em] mb-3">Platforms and panels</h2>
        <p className="text-paper-dim text-[15.5px] leading-[1.6] mb-6 max-w-[68ch]">
          Point any of these at the repo. They read the Dockerfile, build it, and run it.
          Two things to set everywhere: <code className="text-paper">SESSION_SECRET</code>,
          and a persistent volume on <code className="text-paper">/data</code> — without the
          volume your database disappears on the next deploy.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          <ProviderNote name="Coolify" note="New Resource → Docker Compose → point at the repo. Self-hosted PaaS on your own box" />
          <ProviderNote name="Dokploy" note="Create Application → Docker → repo URL. Add a volume mount for /data" />
          <ProviderNote name="Railway" note="Deploy from GitHub repo. Attach a volume at /data, set the port to 7000" />
          <ProviderNote name="Render" note="New Web Service → Docker. Add a persistent disk mounted at /data" />
          <ProviderNote name="Fly.io" note="fly launch reads the Dockerfile. Create a volume and mount it at /data" />
          <ProviderNote name="CapRover" note="One-click app from Dockerfile, with a persistent directory on /data" />
          <ProviderNote name="Portainer" note="Stacks → paste docker-compose.yml from the repo" />
          <ProviderNote name="Any Kubernetes" note="One image, one PVC on /data, one service on port 7000" />
        </div>
      </section>

      {/* AFTER */}
      <section className="px-6 sm:px-10 pb-20 max-w-[900px] mx-auto">
        <h2 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[30px] tracking-[-0.02em] mb-4">Once it is up</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Cmd label="Check every service" code="./bin/health.sh" />
          <Cmd label="Stop everything" code="./bin/stop.sh" />
          <Cmd label="Re-run the env wizard" code="./bin/setup.sh" />
          <Cmd label="Verify a release bundle" code="./bin/verify-bundle.sh" />
        </div>
        <p className="text-paper-dim text-[15px] leading-[1.6] mt-6">
          The first account you create becomes the admin. Add your model providers under
          Admin → LLM, then set one as default — that is what new users get before they
          pick anything.
        </p>
      </section>

      <footer className="px-6 sm:px-10 py-10 border-t border-ink-line/40 max-w-[900px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em]">
          <Link href="/docs" className="text-paper-dim hover:text-amber transition">read the docs</Link>
          <a href={REPO} target="_blank" rel="noopener" className="text-paper-dim hover:text-amber transition">
            github.com/kwkuh/chathermes <ArrowUpRight size={11} className="inline" />
          </a>
        </div>
      </footer>
    </div>
  );
}

function Path({ icon: Icon, title, time, desc, code, after, link }: {
  icon: any; title: string; time: string; desc: string; code: string; after: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-ink-line bg-ink-soft/20 p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-2.5">
        <Icon size={16} className="text-amber shrink-0" />
        <h3 className="font-[family-name:var(--font-display)] text-[21px] tracking-[-0.01em]">{title}</h3>
        <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint border border-ink-line rounded px-2 py-0.5">{time}</span>
      </div>
      <p className="text-paper-dim text-[15px] leading-[1.6] mb-4">{desc}</p>
      <CodeBlock code={code} />
      <p className="text-paper-faint text-[13.5px] leading-[1.6] mt-3">
        {after}{" "}
        {link && (
          <a href={link.href} target="_blank" rel="noopener" className="text-amber hover:text-amber-soft underline decoration-amber/40 underline-offset-[3px] transition">
            {link.label}
          </a>
        )}
      </p>
    </div>
  );
}

function ProviderNote({ name, note }: { name: string; note: string }) {
  return (
    <div className="border-t border-ink-line/50 pt-2.5">
      <div className="text-paper text-[14.5px] mb-0.5">{name}</div>
      <div className="text-paper-faint text-[13px] leading-[1.5]">{note}</div>
    </div>
  );
}

function Cmd({ label, code }: { label: string; code: string }) {
  return (
    <div className="rounded-md border border-ink-line bg-ink-soft/20 p-3.5">
      <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-2">{label}</div>
      <CodeBlock code={code} compact />
    </div>
  );
}

function CodeBlock({ code, compact }: { code: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the text is selectable anyway */ }
  }
  return (
    <div className="relative group">
      <pre className={`overflow-x-auto rounded-md bg-ink border border-ink-line/60 ${compact ? "p-2.5 text-[12.5px]" : "p-3.5 text-[13px]"} font-[family-name:var(--font-mono)] text-paper-dim leading-[1.7]`}>
        {code}
      </pre>
      <button
        onClick={copy}
        aria-label="Copy to clipboard"
        className="absolute top-2 right-2 p-1.5 rounded border border-ink-line bg-ink text-paper-faint hover:text-paper transition opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? <Check size={12} className="text-moss" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
