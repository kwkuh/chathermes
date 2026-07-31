"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Paperclip, Sparkles, MessageCircle, Code2 } from "lucide-react";

type Mode = "chat" | "dev";

const SUGGESTIONS: Record<Mode, { label: string; prompt: string }[]> = {
  chat: [
    { label: "Newsletter while I sleep", prompt: "Draft a newsletter on why slow AI is undervalued. My voice is terse. Send it to my Telegram by 7am." },
    { label: "PR triage every morning", prompt: "Every weekday at 8am, summarize PRs needing my review. Skip the noise. Send to Telegram." },
    { label: "Watch a price for me", prompt: "Watch Bitcoin and ping me on Telegram when it moves more than 5% in 24h." },
    { label: "Research a topic deeply", prompt: "Find the 7 most important papers on agentic LLMs published this year. Summarize each in 3 bullets." },
  ],
  dev: [
    { label: "Build a Next.js landing", prompt: "Build a landing page for an indie game called Aether. Wire it up, deploy it, send me the URL." },
    { label: "Refactor my repo", prompt: "Clone github.com/me/myrepo, find the 5 worst code smells, open a PR fixing each one." },
    { label: "Add Stripe to my app", prompt: "Add Stripe checkout to my Next.js app. One subscription tier. Test card flow before opening PR." },
    { label: "Set up CI/CD", prompt: "Set up GitHub Actions for typecheck + tests + deploy on push to main. Use my Vercel token in secrets." },
  ],
};

const PLACEHOLDERS: Record<Mode, string[]> = {
  chat: [
    "Build me a landing page for…",
    "Every Monday at 9am, summarize…",
    "Draft a newsletter on…",
    "Watch the price of… and ping me when…",
    "Research the top 5 papers on…",
  ],
  dev: [
    "Build a Next.js app that…",
    "Clone repo X and refactor…",
    "Add a Stripe subscription to…",
    "Deploy this to Vercel with…",
    "Write tests for the function…",
  ],
};

const COPY: Record<Mode, { kicker: string; subline: string; sendLabel: string; modelChip: string }> = {
  chat: {
    kicker: "ChatHermes",
    subline: "no signup until you hit send · powered by Hermes Agent",
    sendLabel: "Send",
    modelChip: "hermes-agent",
  },
  dev: {
    kicker: "ChatHermes.dev",
    subline: "vibe coding · agent reads + writes + runs code · Hermes Agent",
    sendLabel: "Build",
    modelChip: "hermes-agent · code",
  },
};

export default function ChatLauncher() {
  const [mode, setMode] = useState<Mode>("chat");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [phIndex, setPhIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS[mode].length), 3200);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => { setPhIndex(0); }, [mode]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [value]);

  function submit() {
    const v = value.trim();
    if (!v) return;
    sessionStorage.setItem("ch:first-prompt", v);
    sessionStorage.setItem("ch:mode", mode);
    // Auto-detect: if cookie present, go straight to app
    const hasSession = typeof document !== "undefined" && /ch_sid=[^;]+/.test(document.cookie);
    router.push(hasSession ? "/app" : "/auth/login?next=app");
  }
  function pick(p: string) {
    setValue(p);
    requestAnimationFrame(() => ref.current?.focus());
  }
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <motion.div
      className="w-full max-w-[840px] mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
    >
      {/* Tab switcher */}
      <div className="flex justify-center mb-5">
        <div className="relative inline-flex p-1 bg-ink-soft/80 backdrop-blur-sm border border-ink-line rounded-full">
          <motion.div
            className="absolute top-1 bottom-1 rounded-full bg-amber/15 border border-amber/30"
            initial={false}
            animate={{
              left: mode === "chat" ? "4px" : "calc(50% + 0px)",
              right: mode === "chat" ? "calc(50% + 0px)" : "4px",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          <button
            onClick={() => setMode("chat")}
            className={`relative z-10 inline-flex items-center gap-2 px-5 py-2 text-[13px] font-medium rounded-full transition-colors ${
              mode === "chat" ? "text-amber" : "text-paper-dim hover:text-paper"
            }`}
          >
            <MessageCircle size={13} strokeWidth={1.8} />
            ChatHermes
          </button>
          <button
            onClick={() => setMode("dev")}
            className={`relative z-10 inline-flex items-center gap-2 px-5 py-2 text-[13px] font-medium rounded-full transition-colors ${
              mode === "dev" ? "text-amber" : "text-paper-dim hover:text-paper"
            }`}
          >
            <Code2 size={13} strokeWidth={1.8} />
            ChatHermes<span className="text-paper-faint">.dev</span>
          </button>
        </div>
      </div>

      {/* Glow border + chat input */}
      <div className="relative group">
        {/* Animated conic gradient border */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-[2px] rounded-[26px] opacity-100 transition-opacity duration-500 chat-glow-border ${
            focused ? "chat-glow-fast" : ""
          }`}
        />
        {/* Soft amber atmosphere */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-12 rounded-full opacity-60 blur-[60px] bg-[radial-gradient(ellipse_at_center,rgba(232,165,71,0.18),transparent_70%)] -z-10"
        />

        <div
          className="relative rounded-[24px] bg-ink-soft/90 backdrop-blur-md border border-ink-line"
          onClick={() => ref.current?.focus()}
        >
          <div className="relative">
            <textarea
              ref={ref}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKey}
              rows={1}
              className="w-full bg-transparent px-8 pt-7 pb-20 text-paper text-[20px] leading-[1.5] resize-none outline-none font-[family-name:var(--font-body)] placeholder:text-transparent"
              style={{ minHeight: "150px", maxHeight: "320px" }}
              placeholder=" "
            />
            {!value && (
              <div className="absolute top-7 left-8 right-8 pointer-events-none text-paper-faint text-[20px] leading-[1.5] flex items-center gap-0.5">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`${mode}-${phIndex}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                  >
                    {PLACEHOLDERS[mode][phIndex]}
                  </motion.span>
                </AnimatePresence>
                <span className="inline-block w-[2px] h-[22px] bg-amber/80 animate-caret ml-0.5" />
              </div>
            )}
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="p-2.5 rounded-lg text-paper-dim hover:text-paper hover:bg-ink-line/40 transition-colors"
                aria-label="Attach"
              >
                <Paperclip size={17} strokeWidth={1.6} />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-md text-paper-dim text-[12.5px] font-[family-name:var(--font-mono)] hover:text-paper hover:bg-ink-line/40 cursor-default transition-colors">
                <Sparkles size={13} strokeWidth={1.8} className="text-amber" />
                <AnimatePresence mode="wait">
                  <motion.span key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {COPY[mode].modelChip}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.14em]">
                ↵ to send · ⇧↵ for new line
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                className="inline-flex items-center gap-2 pl-4 pr-3.5 py-2.5 rounded-full bg-amber text-ink hover:bg-amber-soft disabled:bg-ink-line disabled:text-paper-faint disabled:cursor-not-allowed transition-all text-[13.5px] font-medium shadow-[0_0_24px_rgba(232,165,71,0.35)] disabled:shadow-none"
                aria-label="Send"
              >
                <AnimatePresence mode="wait">
                  <motion.span key={mode} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 4 }} transition={{ duration: 0.18 }}>
                    {COPY[mode].sendLabel}
                  </motion.span>
                </AnimatePresence>
                <ArrowUp size={15} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <motion.div
        key={`sug-${mode}`}
        className="mt-6 flex flex-wrap gap-2 justify-center"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      >
        {SUGGESTIONS[mode].map((s) => (
          <motion.button
            key={s.label}
            onClick={() => pick(s.prompt)}
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
            className="px-4 py-2 rounded-full border border-ink-line text-paper-dim hover:text-paper hover:border-amber/40 hover:bg-amber/[0.04] text-[13px] transition-all"
          >
            {s.label}
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        key={`sub-${mode}`}
        className="mt-7 text-center font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.14em]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {COPY[mode].subline}
      </motion.div>
    </motion.div>
  );
}
