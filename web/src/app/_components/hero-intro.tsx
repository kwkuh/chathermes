"use client";
import { motion } from "motion/react";

export default function HeroIntro() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center gap-2.5 font-[family-name:var(--font-mono)] text-[10.5px] text-amber uppercase tracking-[0.18em] px-3.5 py-1.5 rounded-full border border-amber/30 bg-amber/[0.04]"
    >
      <span className="relative flex w-1.5 h-1.5">
        <span className="absolute inset-0 rounded-full bg-amber animate-pulse-soft" />
        <span className="relative w-1.5 h-1.5 rounded-full bg-amber" />
      </span>
      built on Hermes Agent + Kimi K2
    </motion.div>
  );
}
