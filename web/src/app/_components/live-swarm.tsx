"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

const CHIPS = [
  { label: "copy • drafting hero", liveAt: 0 },
  { label: "design • 3 variants", liveAt: 0.3 },
  { label: "code • Next.js scaffold", liveAt: 0.6 },
  { label: "deploy • waiting", liveAt: 1.5 },
];

export default function LiveSwarm() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 0.1) % 3), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {CHIPS.map((c, i) => {
        const live = t >= c.liveAt && t < c.liveAt + 1.0;
        return (
          <motion.span
            key={i}
            animate={live ? { borderColor: "rgb(232 165 71)", color: "rgb(232 165 71)" } : { borderColor: "rgb(37 34 28)", color: "rgba(244, 238, 223, 0.58)" }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11.5px] border"
          >
            {live && (
              <motion.span
                className="w-1 h-1 rounded-full bg-amber"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
            {c.label}
          </motion.span>
        );
      })}
    </div>
  );
}
