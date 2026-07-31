"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, MessageSquare, Brain, Plug, Code2, ArrowRight, Check, X } from "lucide-react";

const STORAGE_KEY = "ch:onboarding:v1";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to ChatHermes",
    body: "Your private autonomous agent. Drop a task, close the tab, come back to a finished thing.",
    cta: "Show me how",
  },
  {
    icon: MessageSquare,
    title: "Multi-model chat",
    body: "Pick from Hermes Agent, Hermes 4 (405B), Claude Sonnet 4.6, GPT-5, and more — at the model chip below the chat input.",
    cta: "Got it",
  },
  {
    icon: Brain,
    title: "Memory persists",
    body: "Tell your agent things about you and it remembers across sessions. View, edit, and delete them anytime in the Memory tab.",
    cta: "Got it",
  },
  {
    icon: Code2,
    title: "Vibe coding",
    body: "Try \"Build me a landing page for an indie game called Aether.\" Watch it paint live, then publish to a public URL.",
    cta: "Got it",
  },
  {
    icon: Plug,
    title: "Connect Telegram",
    body: "Optional but powerful: connect your Telegram so your agent can ping you when long jobs finish — even when you've closed the tab.",
    cta: "Done",
  },
];

export function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {}
  }, []);

  function dismiss() {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now() })); } catch {}
  }
  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else dismiss();
  }

  if (!open) return null;
  const s = STEPS[step];
  const Icon = s.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="bg-ink-soft border border-ink-line rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden"
        >
          <div className="px-6 sm:px-7 pt-6 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1 rounded-full transition-all ${i === step ? "w-6 bg-amber" : i < step ? "w-3 bg-amber/40" : "w-3 bg-ink-line"}`}></span>
              ))}
            </div>
            <button onClick={dismiss} className="text-paper-faint hover:text-paper -mt-1"><X size={14} /></button>
          </div>

          <div className="px-6 sm:px-7 py-6">
            <div className="w-12 h-12 rounded-xl bg-amber/15 border border-amber/30 flex items-center justify-center mb-4">
              <Icon size={20} className="text-amber" />
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-[26px] sm:text-[30px] leading-[1.15] tracking-[-0.02em] mb-3">{s.title}</h2>
            <p className="text-paper-dim text-[15px] leading-[1.55] max-w-[42ch]">{s.body}</p>
          </div>

          <div className="px-6 sm:px-7 py-4 border-t border-ink-line flex items-center justify-between gap-3">
            <button onClick={dismiss} className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.14em] text-paper-faint hover:text-paper">skip tour</button>
            <button onClick={next} className="px-4 py-2 rounded-md bg-amber text-ink hover:bg-amber-soft text-[14px] font-medium inline-flex items-center gap-1.5">
              {step === STEPS.length - 1 ? <><Check size={13} /> Done</> : <>{s.cta} <ArrowRight size={13} /></>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
