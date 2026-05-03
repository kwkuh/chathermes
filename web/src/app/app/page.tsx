"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowUp, Sparkles, Paperclip, ChevronDown, ChevronRight, Wrench, Brain, Activity, Trash2, X, Globe, FileText, GitBranch, Cloud, Newspaper, BookOpen, MessageSquare, Save, Send, Code2, AlertTriangle, Check, Copy } from "lucide-react";
import { uid } from "@/lib/api";
import { ThinkingMascot } from "@/app/_components/interactive-image";
import { MarkdownContent } from "@/app/app/_components/markdown-content";
import { WorkspaceStatusBar } from "./_components/workspace-status-bar";

type Tool = { id: string; name: string; arguments: string; output?: string };
type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; pending?: boolean; tools?: Tool[] };
type Memory = { id: string; topic: string; body: string; created_at: number };

async function* sessionChatStream(sessionId: string, content: string) {
  const r = await fetch(`/api/me/sessions/${sessionId}/chat`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok || !r.body) { yield { error: `chat ${r.status}` }; return; }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const events = buf.split("\n\n"); buf = events.pop() ?? "";
    for (const e of events) {
      const ev = /^event:\s*(.+)$/m.exec(e)?.[1];
      const data = /^data:\s*(.+)$/m.exec(e)?.[1];
      if (!ev || !data) continue;
      try {
        const j = JSON.parse(data);
        if (ev === "token") yield { token: j.t };
        else if (ev === "tool_call") yield { toolCall: j };
        else if (ev === "tool_result") yield { toolResult: j };
        else if (ev === "error") yield { error: j.error };
        else if (ev === "done") yield { done: true };
      } catch {}
    }
  }
}

export default function WorkspacePage() {
  return <Suspense fallback={<div />}><Workspace /></Suspense>;
}

function Workspace() {
  const sp = useSearchParams();
  const router = useRouter();
  const sessionFromUrl = sp.get("s");

  const [activeId, setActiveId] = useState<string | null>(sessionFromUrl);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [rightTab, setRightTab] = useState<"memory" | "tools" | "activity">("memory");
  const [bootMsg, setBootMsg] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [activeModel, setActiveModel] = useState<string>("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // First-time setup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me/sessions", { credentials: "include" });
        const d = await r.json();
        if (cancelled) return;
        const list = d.sessions ?? [];
        if (!sessionFromUrl && list.length > 0) {
          router.replace(`/app?s=${list[0].id}`);
          setActiveId(list[0].id);
        }
      } catch {}
      try {
        const [memR, meR, modR] = await Promise.all([
          fetch("/api/me/memory", { credentials: "include" }).then((r) => r.json()),
          fetch("/api/me", { credentials: "include" }).then((r) => r.json()),
          fetch("/api/me/models", { credentials: "include" }).then((r) => r.json()),
        ]);
        if (!cancelled) {
          setMemories(memR.memories ?? []);
          setAvailableModels(modR.models ?? []);
          const userModel = meR?.settings?.model;
          const def = (modR.models ?? []).find((m: any) => m.default) ?? (modR.models ?? [])[0];
          setActiveModel(userModel || def?.model_id || "");
        }
      } catch {}
      const v = sessionStorage.getItem("ch:first-prompt");
      if (v && !cancelled) {
        sessionStorage.removeItem("ch:first-prompt");
        setBootMsg(v);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync URL → activeId
  useEffect(() => { setActiveId(sessionFromUrl); }, [sessionFromUrl]);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/me/sessions/${activeId}/messages`, { credentials: "include" });
        const d = await r.json();
        if (!cancelled) setMessages(d.messages ?? []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  useEffect(() => {
    if (bootMsg && activeId) { send(bootMsg); setBootMsg(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootMsg, activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [draft]);

  async function refreshMemories() {
    try {
      const r = await fetch("/api/me/memory", { credentials: "include" });
      const d = await r.json();
      setMemories(d.memories ?? []);
    } catch {}
  }
  // memory auto-sync — pick up changes from /app/memory in another tab
  useEffect(() => {
    const t = setInterval(() => { refreshMemories().catch(() => {}); }, 30_000);
    const onFocus = () => refreshMemories().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);

  async function ensureSessionThenSend(text: string) {
    if (activeId) return send(text);
    // Create session inline
    const r = await fetch("/api/me/sessions", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json();
    router.replace(`/app?s=${d.session.id}`);
    setActiveId(d.session.id);
    // wait next tick then send
    setTimeout(() => send(text), 50);
  }

  async function send(text?: string) {
    const v = (text ?? draft).trim();
    if (!v || streaming) return;
    if (!activeId) { ensureSessionThenSend(v); setDraft(""); return; }
    setDraft("");
    setStreaming(true);
    const aiId = uid();
    let savedMemoryThisTurn = false;
    try {
      const userMsg: Msg = { id: uid(), role: "user", content: v };
      const aiMsg: Msg = { id: aiId, role: "assistant", content: "", pending: true };
      setMessages((m) => [...m, userMsg, aiMsg]);

      for await (const ev of sessionChatStream(activeId, v)) {
        if (ev.token) {
          setMessages((m) => m.map((x) => x.id === aiId ? { ...x, content: x.content + ev.token } : x));
        } else if (ev.toolCall) {
          setMessages((m) => m.map((x) => x.id === aiId ? { ...x, tools: [...(x.tools ?? []), { id: ev.toolCall.id, name: ev.toolCall.name, arguments: ev.toolCall.arguments }] } : x));
        } else if (ev.toolResult) {
          setMessages((m) => m.map((x) => x.id === aiId ? { ...x, tools: (x.tools ?? []).map((t: any) => t.id === ev.toolResult.id ? { ...t, output: ev.toolResult.output } : t) } : x));
          if (ev.toolResult.name === "save_memory") savedMemoryThisTurn = true;
        } else if (ev.error) {
          console.error("chat error:", ev.error);
          setMessages((m) => m.map((x) => x.id === aiId ? { ...x, content: x.content + `\n\n[error] ${ev.error}`, pending: false } : x));
        }
      }
    } catch (e: any) {
      console.error(e);
      setMessages((m) => m.map((x) => x.id === aiId ? { ...x, content: x.content + `\n\n[error] ${e.message}`, pending: false } : x));
    } finally {
      setMessages((m) => m.map((x) => x.id === aiId ? { ...x, pending: false } : x));
      setStreaming(false);
      if (savedMemoryThisTurn) refreshMemories();
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const allTools = messages.flatMap((m) => m.tools ?? []);
  const activeModelLabel = availableModels.find((m) => m.model_id === activeModel)?.label || activeModel || "select model";

  return (
    <div className="h-full flex">
      {/* Center: chat */}
      <section className="flex-1 flex flex-col min-h-0 min-w-0">
        <WorkspaceStatusBar activeModel={activeModel} modelLabel={activeModelLabel} streaming={streaming} />
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full min-h-[60vh] flex flex-col items-center justify-center px-7 text-center">
              <Image src="/illustrations/mascot-full.png" alt="" width={140} height={140} className="w-[96px] h-[96px] mb-5 opacity-90" />
              <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.22em] text-amber mb-3">
                — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/[0.07] border border-emerald-500/20 mb-5">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="text-emerald-400"><path d="M8 1.5L3 4v4c0 3.5 2.4 6.7 5 7 2.6-.3 5-3.5 5-7V4L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-emerald-400">Your private workspace</span>
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-[clamp(28px,3.6vw,42px)] leading-[1.05] tracking-[-0.025em] max-w-[20ch]">
                Your workspace is <em className="text-amber italic not-italic font-normal" style={{fontFamily:'var(--font-display)',fontStyle:'italic'}}>ready</em>.
              </h1>
              <p className="text-paper-dim mt-3 text-[15.5px] max-w-[44ch]">
                Drop a task, close the tab, come back to a finished thing. 40+ tools, persistent memory, multi-model.
              </p>
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-[640px] w-full">
                {[
                  { i: "🔎", t: "Research", p: "Research the latest on multi-agent reasoning and summarize the 5 most cited papers from 2025." },
                  { i: "🛠️", t: "Build", p: "Build me a landing page for a domain registrar called \"reg\" — minimal, monospace, dark mode." },
                  { i: "📊", t: "Analyze", p: "Compute 17 * 23 + sqrt(8100) and show your reasoning. Use run_js if needed." },
                  { i: "🧠", t: "Remember", p: "Remember that I use Bun + Next.js + Tailwind v4 for all my projects." },
                ].map((c) => (
                  <button key={c.t} onClick={() => send(c.p)} className="group text-left px-3.5 py-3 rounded-xl border border-ink-line bg-ink-soft/40 hover:border-amber/40 hover:bg-amber/[0.04] transition-all">
                    <div className="text-[18px] mb-1">{c.i}</div>
                    <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint group-hover:text-amber transition">{c.t}</div>
                  </button>
                ))}
              </div>
              <p className="mt-6 font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint">
                ⌘K to search · Enter to send · Shift+Enter for newline
              </p>
            </div>
          ) : (
            <div className="max-w-[720px] mx-auto px-5 sm:px-6 py-8 pb-6">
              {messages.map((m, i) => (
                <MessageBubble key={m.id} m={m} isFirst={i === 0} />
              ))}
            </div>
          )}
        </div>

        <div className="px-3 sm:px-5 pb-3 sm:pb-5 pt-2 shrink-0 relative" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0))" }}>
          <div className="max-w-[720px] mx-auto relative">
            {showModelPicker && (
              <div className="absolute bottom-[calc(100%+8px)] left-3 w-[280px] sm:w-[320px] max-h-[400px] overflow-y-auto bg-ink-soft border border-ink-line rounded-xl shadow-2xl z-30">
                <div className="px-4 py-2.5 border-b border-ink-line font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.18em]">Pick a model</div>
                {availableModels.length === 0 ? (
                  <div className="px-4 py-6 text-center text-paper-faint text-[14px]">No models. Admin: bootstrap a provider.</div>
                ) : availableModels.map((m: any) => (
                  <button key={m.id} onClick={async () => {
                    setActiveModel(m.model_id);
                    setShowModelPicker(false);
                    await fetch("/api/me/settings", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: m.model_id }) });
                  }} className={`w-full text-left px-4 py-2.5 hover:bg-ink-line/40 transition-colors flex items-center gap-3 ${activeModel === m.model_id ? "bg-amber/10" : ""}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeModel === m.model_id ? "bg-amber" : "bg-ink-line"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-paper text-[14.5px] truncate">{m.label}</div>
                      <div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint truncate">{m.model_id}</div>
                    </div>
                    {m.default && <span className="font-[family-name:var(--font-mono)] text-[9.5px] text-amber uppercase tracking-[0.14em] shrink-0">default</span>}
                  </button>
                ))}
              </div>
            )}
            <div className={`rounded-2xl bg-ink-soft border transition-colors ${streaming ? "border-amber/30" : "border-ink-line focus-within:border-amber/40"}`}>
              <textarea
                ref={ref} rows={1} value={draft}
                onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
                disabled={streaming}
                placeholder="Send a message…"
                className="w-full bg-transparent px-5 pt-4 pb-12 text-paper text-[15px] leading-[1.5] resize-none outline-none placeholder:text-paper-faint disabled:opacity-60"
                style={{ minHeight: "82px", maxHeight: "220px" }}
              />
              <div className="flex items-center justify-between px-3 pb-3 -mt-9">
                <div className="flex items-center gap-1">
                  <button className="p-2 rounded-md text-paper-faint hover:text-paper hover:bg-ink-line/40 transition" aria-label="Attach"><Paperclip size={14} /></button>
                  <button
                    type="button"
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-paper-dim text-[13px] font-[family-name:var(--font-mono)] hover:text-paper hover:bg-ink-line/40 transition-colors"
                  >
                    <Sparkles size={11} className="text-amber" />
                    <span className="max-w-[160px] sm:max-w-[200px] truncate">{activeModelLabel}</span>
                    <ChevronDown size={10} className={`transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setRightOpen(!rightOpen)} className="lg:hidden p-2 rounded-md text-paper-faint hover:text-paper hover:bg-ink-line/40" aria-label="Workspace">
                    <Wrench size={14} />
                  </button>
                  <button
                    onClick={() => send()} disabled={!draft.trim() || streaming}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber text-ink hover:bg-amber-soft disabled:bg-ink-line disabled:text-paper-faint disabled:cursor-not-allowed transition-all"
                    aria-label="Send"
                  >
                    <ArrowUp size={14} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Right: workspace pane (desktop persistent, mobile drawer) */}
      <aside className="hidden lg:flex flex-col w-[300px] xl:w-[340px] border-l border-ink-line-soft bg-ink/30 min-h-0">
        <RightPaneInner memories={memories} allTools={allTools} streaming={streaming} model={activeModel} rightTab={rightTab} setRightTab={setRightTab} refreshMemories={refreshMemories} />
      </aside>

      {rightOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm" onClick={() => setRightOpen(false)} />
          <aside className="lg:hidden fixed top-0 right-0 bottom-0 w-[280px] bg-ink border-l border-ink-line-soft z-50 flex flex-col">
            <div className="h-[52px] px-4 flex items-center justify-between border-b border-ink-line-soft">
              <span className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.18em]">Workspace</span>
              <button onClick={() => setRightOpen(false)} className="p-1.5 rounded text-paper-dim hover:text-paper"><X size={16} /></button>
            </div>
            <RightPaneInner memories={memories} allTools={allTools} streaming={streaming} model={activeModel} rightTab={rightTab} setRightTab={setRightTab} refreshMemories={refreshMemories} />
          </aside>
        </>
      )}
    </div>
  );
}

function RightPaneInner({ memories, allTools, streaming, model, rightTab, setRightTab, refreshMemories }: any) {
  return (
    <>
      <div className="border-b border-ink-line-soft flex shrink-0">
        <TabBtn active={rightTab === "memory"} onClick={() => setRightTab("memory")} icon={Brain} count={memories.length}>Memory</TabBtn>
        <TabBtn active={rightTab === "tools"} onClick={() => setRightTab("tools")} icon={Wrench} count={allTools.length}>Tools</TabBtn>
        <TabBtn active={rightTab === "activity"} onClick={() => setRightTab("activity")} icon={Activity}>Activity</TabBtn>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {rightTab === "memory" && <MemoryList memories={memories} onChange={refreshMemories} />}
        {rightTab === "tools" && <ToolsList tools={allTools} />}
        {rightTab === "activity" && <ActivityList msgCount={0} streaming={streaming} model={model} />}
      </div>
    </>
  );
}

function TabBtn({ active, onClick, icon: Icon, count, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-3 text-[13px] font-[family-name:var(--font-mono)] uppercase tracking-[0.14em] transition-colors border-b-2 ${
        active ? "text-amber border-amber" : "text-paper-dim border-transparent hover:text-paper"
      }`}
    >
      <Icon size={11} /> {children}
      {typeof count === "number" && count > 0 && <span className="text-paper-faint normal-case tracking-normal">{count}</span>}
    </button>
  );
}

function MessageBubble({ m, isFirst }: { m: Msg; isFirst?: boolean }) {
  const cleaned = (m.content || "").replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "").trim();
  const showThinking = m.pending && !cleaned && (!m.tools || m.tools.length === 0);
  const [hover, setHover] = useState(false);

  if (m.role === "user") {
    return (
      <div className={`${isFirst ? "" : "mt-6"} flex justify-end`}>
        <div className="max-w-[85%] rounded-2xl bg-ink-soft border border-ink-line px-4 py-3 text-[15px] leading-[1.55] text-paper whitespace-pre-wrap break-words">
          {m.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFirst ? "" : "mt-6"} flex gap-3 items-start group`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="shrink-0 mt-0.5">
        {m.pending && !cleaned ? (
          <ThinkingMascot size={26} />
        ) : (
          <div className="w-6 h-6 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center shrink-0">
            <span className="text-amber text-[11.5px]">⚭</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {m.tools && m.tools.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3">
            {m.tools.map((t) => <ToolCard key={t.id} t={t} />)}
          </div>
        )}
        {showThinking ? (
          <div className="text-[15px] leading-[1.65] text-paper-faint italic">thinking…</div>
        ) : (
          <div className="text-[15px] text-paper relative">
            <MarkdownContent>{cleaned}</MarkdownContent>
            {m.pending && cleaned && <span className="inline-block w-[2px] h-[14px] bg-amber/70 align-middle ml-0.5 animate-caret -mt-3" />}
          </div>
        )}
        {!m.pending && cleaned && (
          <div className={`mt-2 flex items-center gap-2 transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}>
            <CopyButton text={cleaned} />
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }
  return (
    <button onClick={copy} className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-paper-faint hover:text-paper inline-flex items-center gap-1">
      {copied ? <><Check size={10} /> copied</> : <><Copy size={10} /> copy</>}
    </button>
  );
}

// Per-tool icon + label + summary formatter. Maps known tools to nice presentations.
const TOOL_META: Record<string, { icon: any; color: string; label: string; summarize?: (args: any, output?: string) => string }> = {
  web_search: {
    icon: Globe, color: "text-sage", label: "Web search",
    summarize: (a) => a?.query ? `"${a.query}"` : "",
  },
  fetch_url: {
    icon: FileText, color: "text-sage", label: "Fetch URL",
    summarize: (a) => a?.url || "",
  },
  browse: {
    icon: Globe, color: "text-sage", label: "Browse",
    summarize: (a) => a?.url || "",
  },
  github_repo: {
    icon: GitBranch, color: "text-paper", label: "GitHub repo",
    summarize: (a) => a?.repo || a?.name || "",
  },
  news_search: {
    icon: Newspaper, color: "text-amber", label: "News",
    summarize: (a) => a?.query ? `"${a.query}"` : "",
  },
  weather: {
    icon: Cloud, color: "text-sage", label: "Weather",
    summarize: (a) => a?.location || "",
  },
  wikipedia: {
    icon: BookOpen, color: "text-paper", label: "Wikipedia",
    summarize: (a) => a?.topic || a?.query || "",
  },
  save_memory: {
    icon: Save, color: "text-moss", label: "Save memory",
    summarize: (a) => a?.topic ? `[${a.topic}] ${a?.body?.slice(0, 60) ?? ""}` : "",
  },
  recall_memory: {
    icon: Brain, color: "text-moss", label: "Recall memory",
    summarize: (a) => a?.query || "",
  },
  telegram_send: {
    icon: Send, color: "text-amber", label: "Telegram",
    summarize: (a) => a?.message?.slice(0, 80) ?? "",
  },
  run_js: {
    icon: Code2, color: "text-amber", label: "Run JS",
    summarize: (a) => (a?.code || a?.expression || "").split("\n")[0]?.slice(0, 80) ?? "",
  },
};

function parseArgs(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}

function ToolCard({ t }: { t: Tool }) {
  const [open, setOpen] = useState(false);
  const args = parseArgs(t.arguments);
  const meta = TOOL_META[t.name] ?? { icon: Wrench, color: "text-paper-faint", label: t.name };
  const Icon = meta.icon;
  const summary = meta.summarize ? meta.summarize(args, t.output) : "";
  const isError = !!t.output && /^error:|^err:|<error>/i.test(t.output);

  let argsPretty = t.arguments;
  try { argsPretty = JSON.stringify(args, null, 2); } catch {}

  return (
    <div className={`rounded-lg border overflow-hidden transition-colors ${isError ? "border-rust/30 bg-rust/5" : "border-ink-line bg-ink-soft/50"}`}>
      <button onClick={() => setOpen(!open)} className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-ink-line/30 transition-colors">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isError ? "bg-rust" : t.output ? "bg-moss" : "bg-amber animate-pulse-soft"}`}></span>
        <Icon size={12} className={`shrink-0 ${isError ? "text-rust" : meta.color}`} />
        <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-paper shrink-0">{meta.label}</span>
        {summary && <span className="text-[12.5px] text-paper-dim truncate min-w-0 flex-1">{summary}</span>}
        {!t.output && <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint shrink-0">running…</span>}
        {isError && <AlertTriangle size={11} className="text-rust shrink-0" />}
        <span className="text-paper-faint shrink-0">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
      </button>
      {open && (
        <div className="border-t border-ink-line px-3 py-2.5 bg-ink/40 space-y-2.5">
          <div>
            <div className="font-[family-name:var(--font-mono)] text-[9.5px] text-paper-faint uppercase tracking-[0.18em] mb-1">arguments</div>
            <pre className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim whitespace-pre-wrap break-all bg-ink/40 rounded px-2 py-1.5 border border-ink-line/60">{argsPretty}</pre>
          </div>
          {t.output && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="font-[family-name:var(--font-mono)] text-[9.5px] text-paper-faint uppercase tracking-[0.18em]">output</div>
                <CopyButton text={t.output} />
              </div>
              <ToolOutput name={t.name} output={t.output} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Smart per-tool output renderer. Falls back to monospace block.
function ToolOutput({ name, output }: { name: string; output: string }) {
  // Try parse as JSON for structured tools
  let parsed: any = null;
  try { parsed = JSON.parse(output); } catch {}

  // web_search / news_search / github_repo can return JSON arrays or objects we can pretty-render
  if (parsed && Array.isArray(parsed) && parsed.length && (parsed[0]?.title || parsed[0]?.url)) {
    return (
      <div className="space-y-1.5">
        {parsed.slice(0, 8).map((r: any, i: number) => (
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block px-2.5 py-1.5 rounded bg-ink/50 border border-ink-line/60 hover:border-amber/30 transition-colors">
            <div className="text-[13px] text-paper truncate">{r.title}</div>
            {r.url && <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-sage truncate">{r.url}</div>}
            {r.snippet && <div className="text-[12px] text-paper-dim mt-0.5 line-clamp-2">{r.snippet}</div>}
          </a>
        ))}
        {parsed.length > 8 && <div className="text-[11.5px] text-paper-faint italic">+ {parsed.length - 8} more results</div>}
      </div>
    );
  }

  if (parsed && typeof parsed === "object") {
    return (
      <pre className="font-[family-name:var(--font-mono)] text-[12px] text-paper whitespace-pre-wrap max-h-[320px] overflow-auto bg-ink/40 rounded px-2 py-1.5 border border-ink-line/60">{JSON.stringify(parsed, null, 2)}</pre>
    );
  }

  // run_js: render as code-styled block
  if (name === "run_js") {
    return (
      <pre className="font-[family-name:var(--font-mono)] text-[12px] text-paper whitespace-pre-wrap max-h-[320px] overflow-auto bg-[#0d1117] rounded px-3 py-2 border border-ink-line">{output}</pre>
    );
  }

  // Default: plain text in subtle block
  return (
    <pre className="font-[family-name:var(--font-mono)] text-[12px] text-paper whitespace-pre-wrap max-h-[320px] overflow-auto bg-ink/40 rounded px-2 py-1.5 border border-ink-line/60">{output}</pre>
  );
}

function MemoryList({ memories, onChange }: { memories: Memory[]; onChange: () => void }) {
  async function remove(id: string) {
    await fetch(`/api/me/memory/${id}`, { method: "DELETE", credentials: "include" });
    onChange();
  }
  if (memories.length === 0) return <div className="text-center py-10 text-paper-faint text-[14px]">Agent learns as you talk.</div>;
  return (
    <div className="space-y-2">
      {memories.map((m) => (
        <div key={m.id} className="group bg-ink-soft border border-ink-line rounded-md px-3 py-2.5 hover:border-paper-faint/50 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="font-[family-name:var(--font-mono)] text-[9.5px] text-amber uppercase tracking-[0.16em]">{m.topic}</span>
            <button onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 p-1 text-paper-faint hover:text-rust transition-all">
              <Trash2 size={10} />
            </button>
          </div>
          <p className="text-[14px] text-paper leading-[1.5]">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

function ToolsList({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return <div className="text-center py-10 text-paper-faint text-[14px]">Tool calls show here.</div>;
  return (
    <div className="space-y-2">
      {tools.map((t) => (
        <div key={t.id} className="bg-ink-soft border border-ink-line rounded-md px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${t.output ? "bg-moss" : "bg-amber animate-pulse-soft"}`}></span>
            <span className="font-[family-name:var(--font-mono)] text-[12px] text-paper">{t.name}</span>
          </div>
          {t.output ? <pre className="font-[family-name:var(--font-mono)] text-[12px] text-paper-dim whitespace-pre-wrap line-clamp-3">{t.output}</pre> : <span className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint">running…</span>}
        </div>
      ))}
    </div>
  );
}

function ActivityList({ msgCount, streaming, model }: { msgCount: number; streaming: boolean; model: string }) {
  const [acts, setActs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    try {
      const r = await fetch("/api/me/activity?limit=20", { credentials: "include" });
      if (r.ok) {
        const j = await r.json();
        setActs(j.activities || []);
      }
    } catch {}
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // poll every 10s — feels live
    return () => clearInterval(t);
  }, [streaming]); // also reload right after streaming ends

  function timeAgo(ms: number) {
    const d = Date.now() - ms;
    if (d < 60000) return `${Math.floor(d/1000)}s`;
    if (d < 3_600_000) return `${Math.floor(d/60000)}m`;
    if (d < 86_400_000) return `${Math.floor(d/3_600_000)}h`;
    return `${Math.floor(d/86_400_000)}d`;
  }
  function kindLabel(k: string) {
    return k.replace(/\./g, " · ").replace(/_/g, " ");
  }

  return (
    <div className="space-y-1.5 text-[14px]">
      <div className="pb-2 border-b border-ink-line-soft mb-2">
        <Row k="Status" v={streaming ? "streaming" : "idle"} accent={streaming ? "amber" : undefined} />
        <Row k="Model" v={model || "—"} mono />
      </div>
      <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-paper-faint mb-2 flex items-center justify-between">
        <span>— recent activity</span>
        <span className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>live</span>
        </span>
      </div>
      {loading ? (
        <div className="text-paper-faint text-[12.5px]">Loading…</div>
      ) : acts.length === 0 ? (
        <div className="text-paper-faint text-[12.5px] italic">No activity yet — your actions will appear here.</div>
      ) : (
        <div className="space-y-1">
          {acts.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-2 py-1 text-[12.5px]">
              <span className="text-paper truncate">{kindLabel(a.kind)}</span>
              <span className="text-paper-faint font-[family-name:var(--font-mono)] text-[11px] shrink-0">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono, accent }: { k: string; v: string; mono?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-ink-line-soft last:border-b-0">
      <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.14em]">{k}</span>
      <span className={`${mono ? "font-[family-name:var(--font-mono)] text-[12px]" : "text-[13.5px]"} ${accent === "amber" ? "text-amber" : "text-paper"} truncate ml-2 text-right`}>{v}</span>
    </div>
  );
}
