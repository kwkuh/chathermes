"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

type Step =
  | { kind: "user"; text: string }
  | { kind: "agent"; text: string }
  | { kind: "swarm"; chips: string[] }
  | { kind: "meta"; text: string };

const SCENARIOS: { label: string; steps: Step[] }[] = [
  {
    label: "Newsletter while you sleep",
    steps: [
      { kind: "user", text: "Draft tomorrow's newsletter on slow AI. Terse voice. Telegram by 7am." },
      { kind: "agent", text: "Got it. Drafting overnight." },
      { kind: "meta", text: "8 hours later, while you slept" },
      { kind: "swarm", chips: ["research • 18 sources", "draft • 740w", "fact-check", "style-pass"] },
      { kind: "agent", text: "Draft ready. Pinned 3 quotes from your reading list." },
    ],
  },
  {
    label: "Build & ship a landing page",
    steps: [
      { kind: "user", text: "Build a landing for Aether (indie game). Deploy and send the URL." },
      { kind: "agent", text: "On it. Spawning 4 agents." },
      { kind: "swarm", chips: ["copy", "design • 3 variants", "code • Next.js", "deploy"] },
      { kind: "agent", text: "Live at aether-gXk2.chathermes.dev." },
    ],
  },
  {
    label: "Watch a price for me",
    steps: [
      { kind: "user", text: "Watch BTC. Ping me on Telegram if it moves more than 5% in 24h." },
      { kind: "agent", text: "Set. I'll check every 15 min, forever." },
      { kind: "meta", text: "next morning" },
      { kind: "agent", text: "BTC is up 6.2% since yesterday. Sent you the chart on Telegram." },
    ],
  },
];

const TYPE_SPEED = 14; // ms/char
const STEP_PAUSE = 360;
const SCENARIO_PAUSE = 1800;

export default function LivePreview() {
  const [si, setSi] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState<Step[]>([]);

  useEffect(() => {
    const scenario = SCENARIOS[si];
    const step = scenario.steps[stepIdx];
    if (!step) return;

    if (step.kind === "swarm" || step.kind === "meta") {
      const t = setTimeout(() => {
        setDone((d) => [...d, step]);
        setStepIdx((i) => i + 1);
      }, 600);
      return () => clearTimeout(t);
    }

    // typing
    if (typed.length < step.text.length) {
      const t = setTimeout(() => setTyped((v) => step.text.slice(0, v.length + 1)), TYPE_SPEED);
      return () => clearTimeout(t);
    }

    // step finished
    const t = setTimeout(() => {
      setDone((d) => [...d, step]);
      setTyped("");
      if (stepIdx + 1 >= scenario.steps.length) {
        // next scenario after pause
        setTimeout(() => {
          setSi((x) => (x + 1) % SCENARIOS.length);
          setStepIdx(0);
          setDone([]);
        }, SCENARIO_PAUSE);
      } else {
        setStepIdx((i) => i + 1);
      }
    }, STEP_PAUSE);
    return () => clearTimeout(t);
  }, [si, stepIdx, typed]);

  const scenario = SCENARIOS[si];
  const current = scenario.steps[stepIdx];
  const isTyping = current && (current.kind === "user" || current.kind === "agent");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[760px] mx-auto mt-16"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.18em] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse-soft" />
          live preview
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={si}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint uppercase tracking-[0.14em]"
          >
            scenario {si + 1}/{SCENARIOS.length} · <span className="text-paper-dim">{scenario.label}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="rounded-[18px] bg-ink-soft/70 backdrop-blur-sm border border-ink-line shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-line flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rust/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-moss/60" />
          <span className="ml-3 font-[family-name:var(--font-mono)] text-[10.5px] text-paper-faint">chathermes.com / your agent</span>
        </div>
        <div className="px-6 py-5 min-h-[280px] max-h-[420px] overflow-hidden font-[family-name:var(--font-mono)] text-[13px] leading-[1.7] space-y-3">
          {done.map((s, i) => <Bubble key={`d-${si}-${i}`} step={s} />)}
          {isTyping && (
            <Bubble step={{ ...current, text: typed } as Step} typing />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Bubble({ step, typing }: { step: Step; typing?: boolean }) {
  if (step.kind === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-paper">
        <span className="text-paper-faint mr-3 text-[10px] uppercase tracking-[0.18em]">you</span>
        {step.text}
        {typing && <span className="inline-block w-[2px] h-[14px] bg-paper align-middle animate-caret ml-0.5" />}
      </motion.div>
    );
  }
  if (step.kind === "agent") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-paper border-l-2 border-amber py-1 pl-4">
        <span className="text-amber mr-3 text-[10px] uppercase tracking-[0.18em]">hermes</span>
        {step.text}
        {typing && <span className="inline-block w-[2px] h-[14px] bg-amber align-middle animate-caret ml-0.5" />}
      </motion.div>
    );
  }
  if (step.kind === "meta") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-paper-faint text-[11.5px] italic pl-4">
        — {step.text} —
      </motion.div>
    );
  }
  // swarm
  return (
    <motion.div
      initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
      className="flex flex-wrap gap-2 pl-4"
    >
      {step.chips.map((c, i) => (
        <motion.span
          key={i}
          variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border border-amber/40 text-amber"
        >
          <motion.span
            className="w-1 h-1 rounded-full bg-amber"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
          {c}
        </motion.span>
      ))}
    </motion.div>
  );
}
