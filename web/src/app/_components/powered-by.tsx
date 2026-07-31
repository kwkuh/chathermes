// ChatHermes — Required Attribution component
// REQUIRED: this badge satisfies section 2.1 of the ChatHermes Open Source License.
// You may restyle it to match your design, but you MAY NOT remove or hide it.
// See LICENSE.md for the full requirement.

export function PoweredByChatHermes({
  variant = "footer",
  className = "",
}: {
  variant?: "footer" | "badge" | "auth";
  className?: string;
}) {
  if (variant === "badge") {
    return (
      <a
        href="https://chathermes.com"
        target="_blank"
        rel="noopener"
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-ink-line/40 border border-ink-line text-paper-faint hover:text-paper hover:border-amber/40 transition-colors text-[10.5px] font-[family-name:var(--font-mono)] uppercase tracking-[0.16em] ${className}`}
        title="Powered by ChatHermes (open source)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber" />
        Powered by ChatHermes
      </a>
    );
  }

  if (variant === "auth") {
    // For login / signup pages — slightly bigger, more prominent
    return (
      <div className={`flex items-center justify-center pt-6 ${className}`}>
        <a
          href="https://chathermes.com"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 text-paper-faint hover:text-paper text-[12px] font-[family-name:var(--font-mono)] uppercase tracking-[0.18em] transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber" />
          Powered by ChatHermes
          <span className="text-paper-faint/60">— open source</span>
        </a>
      </div>
    );
  }

  // Default: footer variant
  return (
    <div className={`flex items-center justify-center gap-1.5 py-3 text-[11.5px] font-[family-name:var(--font-mono)] text-paper-faint ${className}`}>
      <span>Powered by</span>
      <a
        href="https://chathermes.com"
        target="_blank"
        rel="noopener"
        className="text-paper-dim hover:text-amber transition-colors uppercase tracking-[0.14em]"
      >
        ChatHermes
      </a>
      <span className="text-paper-faint/60">·</span>
      <a
        href="https://github.com/kwkuh/chathermes"
        target="_blank"
        rel="noopener"
        className="text-paper-faint hover:text-paper transition-colors"
      >
        open source
      </a>
    </div>
  );
}
