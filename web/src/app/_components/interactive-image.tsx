"use client";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";

type CommonProps = {
  src: string;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

/** Mouse-parallax tilt — image rotates based on cursor position. Use in hero / CTA / scenes. */
export function TiltImage({ src, alt = "", width, height, className = "", priority, intensity = 7 }: CommonProps & { intensity?: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-1, 1], [intensity, -intensity]), { stiffness: 180, damping: 22 });
  const ry = useSpring(useTransform(x, [-1, 1], [-intensity, intensity]), { stiffness: 180, damping: 22 });
  const sx = useSpring(useTransform(x, [-1, 1], [-6, 6]), { stiffness: 120, damping: 20 });
  const sy = useSpring(useTransform(y, [-1, 1], [-6, 6]), { stiffness: 120, damping: 20 });

  return (
    <motion.div
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200, transformStyle: "preserve-3d" }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * 2);
        y.set(((e.clientY - r.top) / r.height - 0.5) * 2);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="will-change-transform"
    >
      <motion.div style={{ x: sx, y: sy }}>
        <Image src={src} alt={alt} width={width} height={height} priority={priority} className={className} />
      </motion.div>
    </motion.div>
  );
}

/** Hover-pop — scale & lift on hover with spring. Use in pillar cards / connectors. */
export function HoverPopImage({ src, alt = "", width, height, className = "" }: CommonProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="will-change-transform"
    >
      <Image src={src} alt={alt} width={width} height={height} className={className} />
    </motion.div>
  );
}

/** Click-shake — playful jiggle on click. Use on mascots in empty states. */
export function ShakeImage({ src, alt = "", width, height, className = "" }: CommonProps) {
  const [n, setN] = useState(0);
  return (
    <motion.button
      type="button"
      onClick={() => setN((v) => v + 1)}
      animate={n ? { rotate: [0, -8, 8, -6, 6, -3, 3, 0], y: [0, -6, 0, -3, 0] } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="cursor-pointer focus:outline-none"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
    >
      <Image src={src} alt={alt} width={width} height={height} className={className} />
    </motion.button>
  );
}

/** Thinking — mascot bobs/rotates loop. Use during streaming or loading states. */
export function ThinkingMascot({ src = "/illustrations/mascot-head.png", size = 36 }: { src?: string; size?: number }) {
  return (
    <motion.div
      animate={{
        rotate: [-3, 3, -3],
        y: [-1.5, 1.5, -1.5],
      }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
      style={{ width: size, height: size }}
    >
      <Image src={src} alt="" width={size * 2} height={size * 2} className="w-full h-full halo-amber" />
    </motion.div>
  );
}

/** Sparkle field — random twinkling dots overlaid on dark images. */
export function SparkleField({ count = 14, className = "" }: { count?: number; className?: string }) {
  const [stars, setStars] = useState<{ x: number; y: number; d: number; s: number }[]>([]);
  useEffect(() => {
    const arr = Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      d: 1.5 + Math.random() * 2.5,
      s: 0.6 + Math.random() * 1.6,
    }));
    setStars(arr);
  }, [count]);
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-amber"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s * 2, height: s.s * 2 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
          transition={{ duration: s.d, repeat: Infinity, delay: Math.random() * 3, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Scroll-trigger fade-up — wraps any child, animates in when in view. */
export function FadeUpOnView({ children, delay = 0, y = 14 }: { children: React.ReactNode; delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Magnetic — element subtly pulled toward cursor. Use on CTAs and chip buttons. */
export function MagneticHover({ children, strength = 14, className = "" }: { children: React.ReactNode; strength?: number; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  return (
    <motion.div
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * strength);
        y.set(((e.clientY - r.top) / r.height - 0.5) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
