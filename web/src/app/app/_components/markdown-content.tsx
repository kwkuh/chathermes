"use client";
import { useState, memo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, ExternalLink } from "lucide-react";

import "highlight.js/styles/atom-one-dark.css";

// Display markdown content with full GFM support, syntax highlighting, copy buttons.
// Streaming-safe: handles partial code fences gracefully.
function MarkdownContentInner({ children, compact = false }: { children: string; compact?: boolean }) {
  // Tolerate unfinished code blocks during streaming
  const safe = ensureFences(children || "");

  return (
    <div className={`md-content ${compact ? "md-compact" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          h1: ({ children }) => <h1 className="font-[family-name:var(--font-display)] text-[26px] leading-[1.2] tracking-[-0.02em] mt-5 mb-3 text-paper">{children}</h1>,
          h2: ({ children }) => <h2 className="font-[family-name:var(--font-display)] text-[22px] leading-[1.2] tracking-[-0.02em] mt-5 mb-2.5 text-paper">{children}</h2>,
          h3: ({ children }) => <h3 className="font-medium text-[17px] leading-[1.3] mt-4 mb-2 text-paper">{children}</h3>,
          h4: ({ children }) => <h4 className="font-medium text-[15.5px] leading-[1.3] mt-3 mb-1.5 text-paper">{children}</h4>,
          p: ({ children }) => <p className="my-2.5 leading-[1.65] text-paper">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-paper">{children}</strong>,
          em: ({ children }) => <em className="italic text-paper">{children}</em>,
          del: ({ children }) => <del className="line-through text-paper-dim">{children}</del>,
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-amber hover:text-amber-soft underline underline-offset-2 decoration-amber/40 hover:decoration-amber inline-flex items-center gap-0.5"
            >
              {children}
              {href?.startsWith("http") && <ExternalLink size={11} className="opacity-70 inline-block" />}
            </a>
          ),
          ul: ({ children }) => <ul className="my-2.5 ml-1 space-y-1.5 list-none">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 ml-1 space-y-1.5 list-decimal list-inside marker:text-paper-faint marker:font-[family-name:var(--font-mono)] marker:text-[12.5px]">{children}</ol>,
          li: ({ children, ...props }) => {
            // Task list items
            const checked = (props as any).checked;
            if (typeof checked === "boolean") {
              return (
                <li className="flex items-start gap-2 leading-[1.6]">
                  <span className={`mt-[5px] inline-flex w-3.5 h-3.5 rounded-sm shrink-0 items-center justify-center ${checked ? "bg-moss border-moss" : "border border-paper-faint/40"}`}>
                    {checked ? <Check size={9} className="text-ink" strokeWidth={3.5} /> : null}
                  </span>
                  <span className={checked ? "text-paper-dim line-through" : "text-paper"}>{children}</span>
                </li>
              );
            }
            return (
              <li className="leading-[1.6] text-paper relative pl-4 before:content-['—'] before:absolute before:left-0 before:text-paper-faint before:top-[0.05em]">
                {children}
              </li>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3.5 border-l-2 border-amber/40 text-paper-dim italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-0 border-t border-ink-line" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-ink-line bg-ink-soft/40">
              <table className="w-full text-[13.5px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-ink-line/40">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-paper-faint border-b border-ink-line">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-ink-line/60 last:border-b-0 text-paper">{children}</td>,
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="font-[family-name:var(--font-mono)] text-[0.9em] px-[0.35em] py-[0.1em] rounded-[4px] bg-ink-line/60 text-amber border border-ink-line/40">
                  {children}
                </code>
              );
            }
            const lang = (className || "").replace("language-", "") || "text";
            return <CodeBlock lang={lang} className={className} {...props}>{String(children).replace(/\n$/, "")}</CodeBlock>;
          },
          pre: ({ children }) => <>{children}</>, // CodeBlock owns the wrapper
          img: ({ src, alt }) => (
            <img src={src as string} alt={alt as string} className="my-3 rounded-md max-w-full h-auto border border-ink-line" />
          ),
        }}
      >
        {safe}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownContent = memo(MarkdownContentInner);

// ----------------------------------------------------------------
// Code block with copy button + language label
// ----------------------------------------------------------------
function CodeBlock({ lang, className, children }: { lang: string; className?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-ink-line bg-[#0d1117] group">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-line/30 border-b border-ink-line">
        <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint">
          {lang === "text" ? "code" : lang}
        </span>
        <button
          onClick={copy}
          className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-paper-faint hover:text-paper inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? <><Check size={10} /> copied</> : <><Copy size={10} /> copy</>}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-[12.5px] leading-[1.55] font-[family-name:var(--font-mono)]">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

// ----------------------------------------------------------------
// Streaming helper: close any open code fence so partial markdown
// doesn't render as broken HTML mid-stream.
// ----------------------------------------------------------------
function ensureFences(s: string): string {
  const fenceCount = (s.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) return s + "\n```";
  return s;
}
