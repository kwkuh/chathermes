"use client";
import { motion } from "motion/react";

/**
 * Hermes / caduceus glyph — abstract, editorial.
 * A vertical staff with paired curving snakes and stylized wings on top.
 * Drawn entirely with thin SVG lines so it scales gracefully.
 */
export default function HermesGlyph({ size = 320, className = "" }: { size?: number; className?: string }) {
  return (
    <motion.svg
      width={size}
      height={size * 1.45}
      viewBox="0 0 200 290"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <defs>
        <linearGradient id="amberFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8A547" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#E8A547" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* central staff */}
      <motion.line
        x1="100" y1="60" x2="100" y2="280"
        stroke="url(#amberFade)" strokeWidth="1.2" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, delay: 0.1, ease: "easeOut" }}
      />

      {/* serpent left — sinuous double curve */}
      <motion.path
        d="M 100 80 C 60 100, 60 130, 100 150 C 140 170, 140 200, 100 220 C 70 235, 70 255, 92 268"
        stroke="#E8A547" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, delay: 0.4, ease: "easeOut" }}
      />
      {/* serpent right — mirror */}
      <motion.path
        d="M 100 80 C 140 100, 140 130, 100 150 C 60 170, 60 200, 100 220 C 130 235, 130 255, 108 268"
        stroke="#E8A547" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, delay: 0.55, ease: "easeOut" }}
      />

      {/* serpent heads */}
      <motion.circle
        cx="92" cy="268" r="2.4" fill="#E8A547"
        initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 1.9 }}
      />
      <motion.circle
        cx="108" cy="268" r="2.4" fill="#E8A547"
        initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 2.0 }}
      />

      {/* wings — six feather strokes per side, fanning out from staff top */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = -8 - i * 9;
        const len = 50 + i * 6;
        const x2 = 100 + Math.cos((angle * Math.PI) / 180) * len * -1;
        const y2 = 60 + Math.sin((angle * Math.PI) / 180) * len * -1 - 10;
        return (
          <motion.line
            key={`wl-${i}`}
            x1="100" y1="60" x2={x2} y2={y2}
            stroke="#E8A547" strokeOpacity={0.9 - i * 0.08}
            strokeWidth="1" strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.8 + i * 0.07, ease: "easeOut" }}
          />
        );
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = -8 - i * 9;
        const len = 50 + i * 6;
        const x2 = 100 + Math.cos((angle * Math.PI) / 180) * len;
        const y2 = 60 + Math.sin((angle * Math.PI) / 180) * len * -1 - 10;
        return (
          <motion.line
            key={`wr-${i}`}
            x1="100" y1="60" x2={x2} y2={y2}
            stroke="#E8A547" strokeOpacity={0.9 - i * 0.08}
            strokeWidth="1" strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.8 + i * 0.07, ease: "easeOut" }}
          />
        );
      })}

      {/* small orb crowning the staff */}
      <motion.circle
        cx="100" cy="50" r="5"
        stroke="#E8A547" strokeWidth="1" fill="none"
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.4 }}
      />
      <motion.circle
        cx="100" cy="50" r="1.6" fill="#E8A547"
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.55 }}
      />
    </motion.svg>
  );
}
