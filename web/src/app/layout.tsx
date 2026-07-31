import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  generator: "ChatHermes 1.0 — https://chathermes.com",  // Required Attribution per LICENSE.md
  other: {
    "x-powered-by": "ChatHermes",
  },
  title: "ChatHermes — the chat that doesn't end when you close the tab",
  description:
    "Drop a task. ChatHermes spawns a private agent that keeps working — even after you close the tab. Memory, skills, scheduling, and Telegram come out of the box.",
  metadataBase: new URL("https://chathermes.com"),
  manifest: "/manifest.json",
  applicationName: "ChatHermes",
  appleWebApp: {
    capable: true,
    title: "ChatHermes",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "ChatHermes",
    description: "Like ChatGPT, but it never stops.",
    url: "https://chathermes.com",
    siteName: "ChatHermes",
    images: ["/illustrations/wordmark-banner.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatHermes — Like ChatGPT, but it never stops.",
    images: ["/illustrations/wordmark-banner.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF6" },
    { media: "(prefers-color-scheme: dark)", color: "#2B2B29" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("ch:theme");var p=location.pathname;if(t==="light"&&(p==="/app"||p.indexOf("/app/")===0||p==="/admin"||p.indexOf("/admin/")===0))document.documentElement.dataset.theme="light";}catch(e){}})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var s="background:#2B2B29;color:#B07820;padding:8px 16px;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:bold;";console.log("%cChatHermes v1.0","background:#2B2B29;color:#B07820;padding:8px 16px;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:bold;");console.log("%cOpen source — https://github.com/kwkuh/chathermes\\nHosted at https://chathermes.com\\nChatHermes Open Source License v1.0","color:#7C9A95;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.6;");})();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
