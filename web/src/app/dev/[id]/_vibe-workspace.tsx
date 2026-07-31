"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowUp, ExternalLink, Globe, Eye, Code2, RefreshCw, Sparkles, Check, Copy, FileCode, Download, FileText } from "lucide-react";
import { api, projectChatStream, uid } from "@/lib/api";
import { ThinkingMascot } from "@/app/_components/interactive-image";

type Project = { id: string; slug: string; title: string; html: string; published: number; mode?: string; files?: Record<string, string> | null };
type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; pending?: boolean };

function extractLatestHtml(text: string): string | null {
  // Parse closed multi-file blocks: ```<lang> file=<path>\n...\n```
  const fileRe = /```([a-z]+)\s+file=([^\s`]+)\s*\n([\s\S]*?)```/g;
  const files: Record<string, string> = {};
  let m;
  while ((m = fileRe.exec(text)) !== null) {
    files[m[2].trim()] = m[3];
  }
  // Detect open block at end (odd fence count = unclosed at end)
  const fenceCount = (text.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) {
    const openMatch = text.match(/```([a-z]+)(?:\s+file=([^\s`]+))?\s*\n([\s\S]*)$/);
    if (openMatch) {
      const path = openMatch[2] ? openMatch[2].trim() : (openMatch[1] === "html" ? "index.html" : null);
      if (path && !files[path]) files[path] = openMatch[3];
    }
  }
  // Legacy: ```html (no file=)
  if (!files["index.html"]) {
    const legacy = /```html\s*\n([\s\S]*?)```/g;
    let lastHtml: string | null = null;
    let lm;
    while ((lm = legacy.exec(text)) !== null) lastHtml = lm[1];
    if (lastHtml && lastHtml.trim().length > 50) {
      files["index.html"] = lastHtml.trim();
    } else if (fenceCount % 2 === 1) {
      const idx = text.lastIndexOf("```html");
      if (idx >= 0) {
        const after = text.slice(idx + 7).replace(/^[\s\n]+/, "");
        if (after.length > 50 && /^(<!|<html|<body|<head|<div|<main|<section)/i.test(after)) {
          files["index.html"] = after;
        }
      }
    }
  }
  if (!files["index.html"]) return null;
  // Compose: inline linked CSS/JS into index.html
  let composed = files["index.html"];
  for (const [path, content] of Object.entries(files)) {
    if (path === "index.html") continue;
    const esc = path.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
    composed = composed.replace(new RegExp(`<link[^>]+href=["\']${esc}["\'][^>]*>`, "g"), `<style>${content}</style>`);
    composed = composed.replace(new RegExp(`<script([^>]*?)src=["\']${esc}["\']([^>]*)></script>`, "g"), (_m, b, a) => `<script${b}${a}>${content}</script>`);
  }
  return composed;
}

// Inject a small error reporter into the iframe's HTML so we can collect runtime errors.
function injectErrorReporter(html: string): string {
  const script = `<script>(function(){var p=window.parent;function r(d){try{p.postMessage({__chvibe:1,...d},"*");}catch(e){}}window.addEventListener("error",function(e){r({type:"error",message:e.message,filename:e.filename,line:e.lineno,col:e.colno,stack:e.error&&e.error.stack});});window.addEventListener("unhandledrejection",function(e){r({type:"reject",message:String(e.reason&&e.reason.message||e.reason)});});var o=console.error;console.error=function(){r({type:"console",message:Array.prototype.map.call(arguments,String).join(" ")});return o.apply(console,arguments);};})();</script>`;
  if (html.includes("</head>")) return html.replace("</head>", script + "</head>");
  if (html.includes("<body")) return html.replace(/<body([^>]*)>/, "<body$1>" + script);
  return script + html;
}

export default function VibeWorkspace({ project: initialProject, initialMessages }: { project: Project; initialMessages: any[] }) {
  const [project, setProject] = useState(initialProject);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [iframeErrors, setIframeErrors] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [titleEdit, setTitleEdit] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [view, setView] = useState<"preview" | "code" | "files">("preview");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "canvas">("chat");
  const [copied, setCopied] = useState(false);
  const [bootMsg, setBootMsg] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastWriteRef = useRef<number>(0);
  const pendingHtmlRef = useRef<string>("");


  // Live canvas writer — uses contentDocument.open/write/close (NO srcDoc reload, no flicker).
  // Throttles writes to ~80ms so streaming token bursts feel buttery.
  useEffect(() => {
    pendingHtmlRef.current = injectErrorReporter(project.html);
    const now = Date.now();
    const elapsed = now - lastWriteRef.current;
    const writeNow = () => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      try {
        doc.open();
        doc.write(pendingHtmlRef.current);
        doc.close();
        lastWriteRef.current = Date.now();
      } catch {}
    };
    if (elapsed > 80) {
      writeNow();
    } else {
      const t = setTimeout(writeNow, 80 - elapsed);
      return () => clearTimeout(t);
    }
  }, [project.html]);

  useEffect(() => {
    const v = sessionStorage.getItem("ch:first-prompt");
    if (v) {
      sessionStorage.removeItem("ch:first-prompt");
      setBootMsg(v);
    }
    function onMsg(e: MessageEvent) {
      const d = e.data;
      if (!d || !d.__chvibe) return;
      const msg = `${d.type}: ${d.message}${d.filename ? ` (${d.filename}:${d.line ?? "?"})` : ""}`;
      setIframeErrors((xs) => xs.slice(-9).concat(msg));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (bootMsg) { send(bootMsg); setBootMsg(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootMsg]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [draft]);

  async function send(text?: string) {
    const v = (text ?? draft).trim();
    if (!v || streaming) return;
    setDraft("");
    setStreaming(true);
    const userMsg: Msg = { id: uid(), role: "user", content: v };
    const aiMsg: Msg = { id: uid(), role: "assistant", content: "", pending: true };
    setMessages((m) => [...m, userMsg, aiMsg]);

    let fullContent = "";
    try {
      for await (const ev of projectChatStream(project.id, v)) {
        if (ev.token) {
          fullContent += ev.token;
          setMessages((m) => m.map((x) => (x.id === aiMsg.id ? { ...x, content: x.content + ev.token } : x)));
          // live HTML extraction during streaming
          const partial = extractLatestHtml(fullContent);
          if (partial) { setProject((p) => ({ ...p, html: partial })); setIframeErrors([]); }
        } else if (ev.html) {
          setProject((p) => ({ ...p, html: ev.html! }));
          setIframeErrors([]);
        } else if ((ev as any).files) {
          setProject((p) => ({ ...p, files: (ev as any).files }));
        } else if (ev.error) {
          setMessages((m) => m.map((x) => (x.id === aiMsg.id ? { ...x, content: `⚠️ ${ev.error}`, pending: false } : x)));
        }
      }
    } finally {
      setMessages((m) => m.map((x) => (x.id === aiMsg.id ? { ...x, pending: false } : x)));
      setStreaming(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function saveTitle() {
    if (titleDraft.trim() && titleDraft !== project.title) {
      await api.projects.update(project.id, { title: titleDraft.trim() });
      setProject((p) => ({ ...p, title: titleDraft.trim() }));
    }
    setTitleEdit(false);
  }

  async function publishToggle() {
    const next = project.published ? 0 : 1;
    await api.projects.update(project.id, { published: next });
    setProject((p) => ({ ...p, published: next }));
  }

  async function copyShareUrl() {
    const url = `${window.location.origin}/p/${project.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="h-screen flex flex-col bg-ink text-paper">
      {/* Top bar */}
      <header className="h-[58px] border-b border-ink-line-soft bg-ink/85 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
        <Link href="/app/projects" className="p-2 rounded-md text-paper-dim hover:text-paper hover:bg-ink-line/40 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <Image src="/illustrations/mascot-head.png" alt="" width={28} height={28} className="w-7 h-7 halo-amber" />
        <span className="font-[family-name:var(--font-display)] text-[18px] hidden sm:inline">ChatHermes<span className="text-amber">.dev</span></span>
        <span className="text-paper-faint mx-1">·</span>
        <select
          value={project.mode || "static"}
          onChange={async (e) => {
            const mode = e.target.value;
            setProject((p) => ({ ...p, mode }));
            await api.projects.update(project.id, { mode });
          }}
          className="hidden md:inline-flex bg-ink-soft border border-ink-line rounded px-2 py-1 text-[11px] font-[family-name:var(--font-mono)] text-paper-dim hover:text-paper uppercase tracking-[0.12em] cursor-pointer"
          title="Project mode"
        >
          <option value="static">static</option>
          <option value="spa">spa</option>
          <option value="fullstack">fullstack</option>
        </select>
        {titleEdit ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setTitleDraft(project.title); setTitleEdit(false); } }}
            autoFocus
            className="bg-transparent text-paper text-[14px] outline-none border-b border-amber px-1 py-0.5 min-w-[180px]"
          />
        ) : (
          <button onClick={() => { setTitleEdit(true); setTitleDraft(project.title); }} className="text-paper text-[14px] hover:text-amber transition-colors">
            {project.title}
          </button>
        )}
        <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.14em] hidden md:inline ml-2">
          /dev/{project.slug}
        </span>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="hidden md:inline-flex p-1 bg-ink-soft border border-ink-line rounded-full">
          <button onClick={() => setView("preview")} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${view === "preview" ? "bg-amber/15 text-amber" : "text-paper-dim hover:text-paper"}`}>
            <Eye size={12} /> Preview
          </button>
          <button onClick={() => setView("files")} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${view === "files" ? "bg-amber/15 text-amber" : "text-paper-dim hover:text-paper"}`}>
            <FileCode size={12} /> Files {project.files ? <span className="text-paper-faint">{Object.keys(project.files).length}</span> : null}
          </button>
          <button onClick={() => setView("code")} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${view === "code" ? "bg-amber/15 text-amber" : "text-paper-dim hover:text-paper"}`}>
            <Code2 size={12} /> HTML
          </button>
        </div>

        {/* Publish */}
        {project.published ? (
          <>
            <button onClick={copyShareUrl} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] text-paper-dim hover:text-paper hover:bg-ink-line/40 transition-colors font-[family-name:var(--font-mono)]">
              {copied ? <Check size={12} className="text-moss" /> : <Copy size={12} />}
              {copied ? "copied" : "copy link"}
            </button>
            <a href={`/p/${project.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] text-amber hover:bg-amber/10 transition-colors">
              <ExternalLink size={12} /> Open
            </a>
            <button onClick={publishToggle} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] text-paper-dim hover:text-rust transition-colors">
              Unpublish
            </button>
          </>
        ) : (
          <button onClick={publishToggle} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-ink text-[13px] font-medium hover:bg-amber-soft transition-colors shadow-[0_0_18px_rgba(232,165,71,0.3)]">
            <Globe size={14} strokeWidth={2.2} /> Publish
          </button>
        )}
      </header>

      {/* Main split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] min-h-0">
        {/* Chat pane */}
        <aside className={`border-r border-ink-line-soft flex-col min-h-0 bg-ink/40 lg:flex ${mobileTab === "chat" ? "flex" : "hidden"} lg:flex`}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
            {messages.length === 0 ? (
              <div className="text-center py-10">
                <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-amber uppercase tracking-[0.18em] mb-3">— vibe coding</div>
                <h2 className="font-[family-name:var(--font-display)] text-[28px] leading-[1.1] tracking-[-0.02em]">
                  What do you want to <em className="text-amber">build?</em>
                </h2>
                <p className="text-paper-dim mt-3 text-[13.5px]">Describe it. The agent ships HTML to the canvas live.</p>
                <div className="mt-7 flex flex-col gap-2">
                  {["Landing page for an indie game", "Pomodoro timer with confetti", "Pricing table with three tiers", "Animated 3D card with hover"].map((s) => (
                    <button key={s} onClick={() => send(s)} className="text-left px-3.5 py-2.5 rounded-lg border border-ink-line text-paper-dim hover:text-paper hover:border-amber/40 hover:bg-amber/[0.04] text-[12.5px] transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mb-5"
                  >
                    <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] mb-1.5 flex items-center gap-2">
                      {m.role === "assistant" && m.pending ? <ThinkingMascot size={16} /> : null}
                      <span className={m.role === "user" ? "text-paper-faint" : "text-amber"}>
                        {m.role === "user" ? "you" : "hermes.dev"}
                      </span>
                    </div>
                    <div className={`text-[13px] leading-[1.6] whitespace-pre-wrap break-words ${m.role === "user" ? "text-paper" : "text-paper border-l-2 border-amber/40 pl-3"} font-[family-name:var(--font-mono)]`}>
                      {(() => {
                        const cleaned = m.content
                          .replace(/```[a-z]*[^\n]*\n[\s\S]*?```/g, "")
                          .replace(/```[a-z]*[^\n]*\n[\s\S]*$/, "")
                          .trim();
                        const fc = (m.content.match(/```/g) || []).length;
                        const inCode = fc % 2 === 1;
                        if (cleaned) return cleaned;
                        if (inCode) {
                          const closedFiles = (m.content.match(/```[a-z]+\s+file=([^\s`]+)\s*\n[\s\S]*?```/g) || []).length;
                          const openMatch = m.content.match(/```([a-z]+)(?:\s+file=([^\s`]+))?\s*\n([\s\S]*)$/);
                          const currentFile = openMatch?.[2] || (openMatch?.[1] === "html" ? "index.html" : openMatch?.[1] || "");
                          const lines = (openMatch?.[3] || "").split("\n").length;
                          return (
                            <span className="inline-flex flex-wrap items-center gap-2 text-paper-dim">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber animate-pulse-soft" />
                              <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em]">writing</span>
                              {currentFile && <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-amber">{currentFile}</span>}
                              <span className="text-paper-faint text-[11.5px]">· {lines} lines</span>
                              {closedFiles > 0 && <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.14em]">+{closedFiles} done</span>}
                            </span>
                          );
                        }
                        if (m.pending) return <span className="text-paper-faint italic">thinking…</span>;
                        return null;
                      })()}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="border-t border-ink-line-soft p-4 bg-ink/80">
            <div className={`relative rounded-2xl bg-ink-soft border transition-colors ${streaming ? "border-amber/40" : "border-ink-line focus-within:border-amber/50"}`}>
              <textarea
                ref={ref}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                disabled={streaming}
                placeholder="Describe what to build, or change…"
                className="w-full bg-transparent px-4 pt-3.5 pb-12 text-paper text-[14px] leading-[1.5] resize-none outline-none placeholder:text-paper-faint disabled:opacity-60"
                style={{ minHeight: "70px", maxHeight: "200px" }}
              />
              <div className="flex items-center justify-between px-2.5 pb-2.5 -mt-9">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-paper-dim text-[11px] font-[family-name:var(--font-mono)]">
                  <Sparkles size={11} className="text-amber" /> hermes-agent · code
                </div>
                <button onClick={() => send()} disabled={!draft.trim() || streaming} className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber text-ink hover:bg-amber-soft disabled:bg-ink-line disabled:text-paper-faint disabled:cursor-not-allowed transition-all">
                  <ArrowUp size={14} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Preview / Code pane */}
        <main className={`relative bg-paper-soft min-h-0 flex-col ${mobileTab === "canvas" ? "flex" : "hidden"} lg:flex`}>
          {iframeErrors.length > 0 && (
            <div className="absolute top-2 left-2 right-2 z-10 bg-rust/15 backdrop-blur border border-rust/40 rounded-lg px-3 py-2 flex items-start gap-2 max-h-[120px] overflow-auto">
              <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-rust uppercase tracking-[0.16em] shrink-0">{iframeErrors.length} errors</span>
              <div className="flex-1 font-[family-name:var(--font-mono)] text-[11px] text-paper truncate">{iframeErrors[iframeErrors.length - 1]}</div>
              <button onClick={() => { send(`[iframe error] ${iframeErrors.join(" | ")} — fix it`); setIframeErrors([]); }} disabled={streaming} className="shrink-0 px-2.5 py-1 rounded bg-rust text-paper text-[11px] font-medium hover:bg-rust/80 disabled:opacity-50">
                Fix with AI
              </button>
              <button onClick={() => setIframeErrors([])} className="shrink-0 p-1 text-paper-dim hover:text-paper">×</button>
            </div>
          )}
          <AnimatePresence mode="wait">
            {view === "preview" && (
              <motion.iframe
                key="preview-stable"
                ref={iframeRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                title="preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="w-full h-full border-0 bg-white"
              />
            )}
            {view === "code" && (
              <motion.pre
                key="code"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full overflow-auto bg-ink text-paper font-[family-name:var(--font-mono)] text-[12px] p-6 whitespace-pre"
              >
                {project.html}
              </motion.pre>
            )}
            {view === "files" && (
              <motion.div
                key="files"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full grid grid-cols-1 md:grid-cols-[240px_1fr] bg-ink"
              >
                <div className="border-r border-ink-line-soft overflow-y-auto">
                  <div className="px-4 py-3 border-b border-ink-line-soft flex items-center justify-between">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-paper-faint uppercase tracking-[0.16em]">Files</span>
                    <button
                      onClick={async () => {
                        const files = project.files ?? {};
                        if (Object.keys(files).length === 0) { alert("No files yet"); return; }
                        // Download as concatenated text bundle
                        const bundle = Object.entries(files).map(([p, c]) => `// ===== ${p} =====\n${c}`).join("\n\n");
                        const blob = new Blob([bundle], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `${project.slug}-bundle.txt`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="p-1.5 rounded text-paper-faint hover:text-paper hover:bg-ink-line/40"
                      title="Download bundle"
                    >
                      <Download size={13} />
                    </button>
                  </div>
                  {project.files && Object.keys(project.files).length > 0 ? (
                    <div className="py-1">
                      {Object.keys(project.files).sort().map((path) => (
                        <button
                          key={path}
                          onClick={() => setOpenFile(path)}
                          className={`w-full text-left px-4 py-1.5 flex items-center gap-2 text-[12.5px] truncate transition-colors ${openFile === path ? "bg-amber/10 text-amber" : "text-paper-dim hover:text-paper hover:bg-ink-line/30"}`}
                        >
                          <FileText size={11} className="shrink-0" />
                          {path}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-paper-faint text-[12px] text-center">No files yet. Send a prompt.</div>
                  )}
                </div>
                <div className="overflow-auto bg-ink">
                  {openFile && project.files?.[openFile] ? (
                    <pre className="p-5 font-[family-name:var(--font-mono)] text-[12px] text-paper whitespace-pre">{project.files[openFile]}</pre>
                  ) : (
                    <div className="p-8 text-center text-paper-faint text-[13px]">Pick a file to view</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {streaming && <BuildingOverlay />}
        </main>
      </div>

      {/* Mobile chat/canvas toggle */}
      <div className="lg:hidden border-t border-ink-line-soft bg-ink/85 backdrop-blur-sm flex shrink-0">
        <button
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-3 text-[12px] font-[family-name:var(--font-mono)] uppercase tracking-[0.14em] transition-colors ${
            mobileTab === "chat" ? "text-amber border-t-2 border-amber" : "text-paper-dim border-t-2 border-transparent"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setMobileTab("canvas")}
          className={`flex-1 py-3 text-[12px] font-[family-name:var(--font-mono)] uppercase tracking-[0.14em] transition-colors ${
            mobileTab === "canvas" ? "text-amber border-t-2 border-amber" : "text-paper-dim border-t-2 border-transparent"
          }`}
        >
          Canvas
        </button>
      </div>
    </div>
  );
}

function BuildingOverlay() {
  const [phase, setPhase] = useState(0);
  const phases = ["planning", "structuring", "styling", "interactivity", "polishing"];
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % phases.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="absolute inset-x-0 top-0 z-10 pointer-events-none">
      <div className="h-0.5 bg-gradient-to-r from-transparent via-amber to-transparent animate-pulse-soft" />
      <div className="flex justify-center mt-3">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-ink/85 border border-amber/30 backdrop-blur-md shadow-[0_0_20px_rgba(232,165,71,0.18)]">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-amber animate-ping opacity-50" />
            <span className="relative w-2 h-2 rounded-full bg-amber" />
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10.5px] text-amber uppercase tracking-[0.18em]">
            {phases[phase]}
          </span>
        </div>
      </div>
    </div>
  );
}
