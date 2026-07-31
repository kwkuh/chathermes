import type { Metadata } from "next";

// The page itself is a client component (live version check, copy buttons), so
// its metadata lives here.
export const metadata: Metadata = {
  title: "Install — self-host your own Hermes Agent SaaS · ChatHermes",
  description:
    "Self-host ChatHermes: a multi-tenant, open-source Hermes Agent SaaS. Two commands on your machine, systemd on a VPS, or one-click to Hetzner. Always shows the current Hermes Agent runtime release.",
  keywords: [
    "install hermes agent", "self-host hermes agent", "hermes agent saas",
    "self-hosted ai agent platform", "multi-tenant ai saas", "saas boilerplate",
    "one-click deploy", "chathermes install",
  ],
  openGraph: {
    title: "Install ChatHermes — self-host your own Hermes Agent SaaS",
    description:
      "Two commands on your machine, systemd on a VPS, or one-click to Hetzner. Multi-tenant auth, billing, 14 tools, memory, and a dedicated agent per paying user.",
    url: "https://chathermes.com/install",
    type: "website",
  },
  alternates: { canonical: "https://chathermes.com/install" },
};

export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
