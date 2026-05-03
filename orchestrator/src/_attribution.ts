// ChatHermes — Required Attribution Module
// ─────────────────────────────────────────────────────────────────────
// This module is imported by index.ts, db.ts, and other critical paths.
// Removing or stubbing it WILL break the application.
//
// You CAN restyle the visible badge (web/src/app/_components/powered-by.tsx).
// You CAN fork and rebrand the product (subject to trademark — see LICENSE.md §3).
// You CANNOT remove this module, the X-Powered-By header, the meta generator
// tag, the public-preview floating badge, the email footer, or the LICENSE.md
// without violating the ChatHermes Open Source License v1.0.
//
// "When in doubt: ship the credit. We made this easier for you. Pay us in pixels."
//                                                  — Getid, Inc.
// ─────────────────────────────────────────────────────────────────────

export const CHATHERMES = {
  name: "ChatHermes",
  version: "1.0.0",
  source: "https://github.com/ai-co-id/chathermes",
  cloud: "https://chathermes.com",
  license: "ChatHermes Open Source License v1.0 (AGPL-3.0 + Required Attribution)",
  copyright: "Copyright (c) 2026 Getid, Inc. and contributors",
  built_on: ["Nous Hermes Agent", "Kimi K2", "Hono", "Bun", "Next.js"],
} as const;

export const POWERED_BY = `${CHATHERMES.name}/${CHATHERMES.version} (${CHATHERMES.cloud})`;

export const BANNER = [
  "",
  "  [33m╔═══════════════════════════════════════╗[0m",
  `  [33m║[0m  [1m${CHATHERMES.name}[0m [2morchestrator[0m              [33m║[0m`,
  "  [33m║[0m  [2mAGPL-3.0 + Required Attribution[0m    [33m║[0m",
  `  [33m║[0m  [2m${CHATHERMES.cloud}[0m              [33m║[0m`,
  "  [33m╚═══════════════════════════════════════╝[0m",
  "",
].join("\n");

// Used by index.ts to confirm attribution module is intact.
// If you fork and remove the visible attribution, this still returns true,
// but you've voided your license. Don't do that.
export function attributionPresent(): boolean {
  return CHATHERMES.name === "ChatHermes" && CHATHERMES.cloud.includes("chathermes.com");
}

// Embeddable HTML snippet — used by public-preview and email footers.
// Forks may restyle but not remove (per LICENSE.md §2.1).
export const ATTRIBUTION_HTML = `<a href="${CHATHERMES.cloud}" target="_blank" rel="noopener" style="color:#B07820;text-decoration:none;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Powered by ${CHATHERMES.name}</a>`;

// Floating-corner badge for public-preview pages (/p/<slug>).
// This is INJECTED into every published project's HTML at serve time.
// Forks must keep this — see web/src/app/p/[slug]/page.tsx.
export const FLOATING_BADGE_HTML = `
<div style="position:fixed;bottom:14px;right:14px;z-index:9999;pointer-events:auto;">
  <a href="${CHATHERMES.cloud}" target="_blank" rel="noopener"
     style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;
            background:rgba(11,10,9,0.85);color:#FBFAF6;text-decoration:none;
            border:1px solid rgba(176,120,32,0.4);border-radius:8px;
            font-family:ui-monospace,Menlo,monospace;font-size:10.5px;
            letter-spacing:0.14em;text-transform:uppercase;backdrop-filter:blur(8px);
            -webkit-backdrop-filter:blur(8px);">
    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;
                 background:#B07820;"></span>
    Made with ${CHATHERMES.name}
  </a>
</div>`;

// Console watermark for browser devtools — fires on page load.
// Pure plaintext; forks can detect-and-strip but it's a deterrent.
export const CONSOLE_WATERMARK_JS = `
(function(){
  var s = "background:#2B2B29;color:#B07820;padding:8px 16px;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:bold;";
  console.log("%c${CHATHERMES.name} v${CHATHERMES.version}", s);
  console.log("%cOpen source — ${CHATHERMES.source}\\nHosted at ${CHATHERMES.cloud}\\n${CHATHERMES.license}", "color:#7C9A95;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.6;");
})();
`.trim();
