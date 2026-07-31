"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, ArrowRight, Sparkles, Volume2, VolumeX, Maximize, X,
  MessageSquare, Brain, Globe, Code2, Bell, Cpu, Mail, Send, Crown,
  CheckCircle2, Loader2, Subtitles, MousePointer2, Plug, Shield,
  Zap, Activity, KeyRound, Plus, Search, Music,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// SCENES — full-bleed, with narration + subtitles + cursor paths
// ═══════════════════════════════════════════════════════════════════════════

type Cue = { at: number; text: string };  // at = 0..1 of scene progress

type Scene = {
  id: string;
  duration: number;
  narration: string;             // TTS spoken text
  cues: Cue[];                   // subtitle cues (overlapping segments)
};

const SCENES: Scene[] = [
  {
    id: "studio", duration: 4500,
    narration: "ChatHermes Studios presents.",
    cues: [{ at: 0.1, text: "ChatHermes Studios presents…" }],
  },
  {
    id: "promise", duration: 5500,
    narration: "A coworker. Not a chatbot.",
    cues: [
      { at: 0.15, text: "A coworker." },
      { at: 0.55, text: "Not a chatbot." },
    ],
  },
  {
    id: "landing", duration: 5500,
    narration: "Open the app. Click sign in.",
    cues: [
      { at: 0.05, text: "Open chathermes.com." },
      { at: 0.5, text: "Click 'Sign in' to begin." },
    ],
  },
  {
    id: "signin", duration: 6500,
    narration: "Drop your email. A magic link arrives.",
    cues: [
      { at: 0.05, text: "Drop your email." },
      { at: 0.45, text: "Send the magic link." },
      { at: 0.75, text: "It arrives in your inbox." },
    ],
  },
  {
    id: "dashboard", duration: 6000,
    narration: "Welcome to your private workspace.",
    cues: [
      { at: 0.05, text: "Welcome, demo@chathermes.com." },
      { at: 0.45, text: "Your private workspace — sessions, memory, tools." },
    ],
  },
  {
    id: "chat", duration: 8500,
    narration: "Drop a task. The agent reasons, plans, and uses tools.",
    cues: [
      { at: 0.05, text: '"Research multi-agent reasoning. Top 3 papers from 2025."' },
      { at: 0.4, text: "The agent picks tools — web_search, browse." },
      { at: 0.85, text: "Tools execute in parallel." },
    ],
  },
  {
    id: "toolcall", duration: 6500,
    narration: "Tools run live. You see every call and result.",
    cues: [
      { at: 0.05, text: "Tools run live — transparent." },
      { at: 0.5, text: "Every call. Every result. Visible." },
    ],
  },
  {
    id: "tools", duration: 7000,
    narration: "Fourteen tools. Real APIs. Zero mockups.",
    cues: [
      { at: 0.05, text: "Fourteen tools." },
      { at: 0.5, text: "Real APIs. Zero mockups." },
    ],
  },
  {
    id: "vibe", duration: 9000,
    narration: "Describe what to build. Watch HTML appear, live.",
    cues: [
      { at: 0.05, text: '"Build me a landing page for reg."' },
      { at: 0.4, text: "Code streams on the left." },
      { at: 0.7, text: "Preview renders on the right." },
    ],
  },
  {
    id: "memory", duration: 6000,
    narration: "It remembers your stack, your voice, your preferences.",
    cues: [
      { at: 0.05, text: "Persistent memory — survives sessions." },
      { at: 0.5, text: "Stack. Voice. Preferences. All stored." },
    ],
  },
  {
    id: "schedule", duration: 6000,
    narration: "Works while you sleep. Daily briefings, monitors, recurring research.",
    cues: [
      { at: 0.05, text: "Works while you sleep." },
      { at: 0.5, text: "Daily briefings. Monitors. Weekly digests." },
    ],
  },
  {
    id: "telegram", duration: 6000,
    narration: "Results pushed to Telegram, email, or your own webhook.",
    cues: [
      { at: 0.05, text: "Results — pushed to Telegram." },
      { at: 0.55, text: "Or email. Or your own webhook." },
    ],
  },
  {
    id: "stinger", duration: 4500,
    narration: "But sharing has limits. What if it didn't?",
    cues: [
      { at: 0.1, text: "But sharing has limits." },
      { at: 0.55, text: "What if it didn't?" },
    ],
  },
  {
    id: "private", duration: 8500,
    narration: "Pro plan auto-provisions a Hetzner server. Just yours.",
    cues: [
      { at: 0.05, text: "Pro plan unlocks your private agent." },
      { at: 0.4, text: "A dedicated Hetzner Cloud server — spinning up." },
      { at: 0.85, text: "Ninety seconds later — ready." },
    ],
  },
  {
    id: "billing", duration: 6500,
    narration: "Twenty dollars a month. Cancel anytime.",
    cues: [
      { at: 0.05, text: "Twenty dollars a month." },
      { at: 0.5, text: "Cancel anytime. PDF receipts. Stripe-secure." },
    ],
  },
  {
    id: "assemble", duration: 6000,
    narration: "Every model. Every tool. Every minute you're away.",
    cues: [
      { at: 0.15, text: "Every model." },
      { at: 0.4, text: "Every tool." },
      { at: 0.65, text: "Every minute you're away." },
    ],
  },
  {
    id: "outro", duration: 8500,
    narration: "Ready when you are. Sign up free.",
    cues: [
      { at: 0.05, text: "ChatHermes — a coworker, not a chatbot." },
      { at: 0.3, text: "Ready when you are." },
      { at: 0.7, text: "Free tier. No credit card. Sign up in thirty seconds." },
    ],
  },
];

const TOTAL_MS = SCENES.reduce((s, x) => s + x.duration, 0);
const OFFSETS = (() => {
  let acc = 0;
  return SCENES.map((s) => { const start = acc; acc += s.duration; return { start, end: acc }; });
})();

function fmtTime(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(t / 60);
  const ss = t % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKSOUND: procedural Web Audio (tech/founder YC vibe)
// Cm7 pad + 55Hz sub-pulse + bell pings + slow filter LFO
// Fully generative — no MP3 asset, no licensing, sounds like a keynote opener.
// ═══════════════════════════════════════════════════════════════════════════

function useBacksound(enabled: boolean, ducking: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<{ stop: () => void }[]>([]);
  const pulseTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (typeof window === "undefined" || startedRef.current) return;
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;  // start silent, ramp in
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // ── Reverb-ish via convolver with synthetic IR ──
    const convolver = ctx.createConvolver();
    const irLen = ctx.sampleRate * 2;
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3) * 0.5;
      }
    }
    convolver.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    convolver.connect(wet).connect(master);

    // ── Layer 1: Cm7 pad (C, Eb, G, Bb in low octave) ──
    // Cinematic minor-7 = pensive-yet-hopeful (founder vibe)
    const root = 65.41; // C2
    const ratios = [1, 1.2, 1.5, 1.78, 2, 2.4]; // C, Eb, G, Bb, C(oct), Eb(oct)
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 800;
    padFilter.Q.value = 1.2;
    padFilter.connect(master);
    padFilter.connect(convolver);

    // Slow LFO that opens/closes the filter (movement)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;  // very slow (~14s cycle)
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 600;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();
    nodesRef.current.push({ stop: () => { try { lfo.stop(); } catch {} } });

    for (const r of ratios) {
      // Two detuned sawtooth oscillators per note (fat pad)
      for (const detune of [-7, +7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = root * r;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.018;
        // Slow amplitude wobble
        const ampLFO = ctx.createOscillator();
        ampLFO.frequency.value = 0.11 + Math.random() * 0.08;
        const ampLFOGain = ctx.createGain();
        ampLFOGain.gain.value = 0.008;
        ampLFO.connect(ampLFOGain).connect(g.gain);
        ampLFO.start();
        o.connect(g).connect(padFilter);
        o.start();
        nodesRef.current.push({
          stop: () => { try { o.stop(); ampLFO.stop(); } catch {} }
        });
      }
    }

    // ── Layer 2: filtered noise wash (texture) ──
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf; noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 2400;
    noiseFilter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.025;
    // Slow amp LFO on noise
    const noiseLFO = ctx.createOscillator();
    noiseLFO.frequency.value = 0.06;
    const noiseLFOGain = ctx.createGain();
    noiseLFOGain.gain.value = 0.015;
    noiseLFO.connect(noiseLFOGain).connect(noiseGain.gain);
    noiseLFO.start();
    noise.connect(noiseFilter).connect(noiseGain).connect(convolver);
    noise.start();
    nodesRef.current.push({ stop: () => { try { noise.stop(); noiseLFO.stop(); } catch {} } });

    // ── Layer 3: sub-bass pulse at ~75 BPM (heartbeat) ──
    function pulse() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 55;  // sub
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.13, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(env).connect(master);
      o.start(t); o.stop(t + 0.5);
    }
    pulseTimerRef.current = window.setInterval(pulse, 800);  // 75 BPM

    // ── Ramp master gain in over 3 seconds ──
    master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 3.0);

    startedRef.current = true;
  }, []);

  const stop = useCallback(() => {
    if (!startedRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx || !masterGainRef.current) return;
    masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    setTimeout(() => {
      if (pulseTimerRef.current) { window.clearInterval(pulseTimerRef.current); pulseTimerRef.current = null; }
      nodesRef.current.forEach((n) => n.stop());
      nodesRef.current = [];
      try { ctx.close(); } catch {}
      ctxRef.current = null;
      masterGainRef.current = null;
      startedRef.current = false;
    }, 600);
  }, []);

  // Bell ping on scene change (called externally)
  const ping = useCallback(() => {
    const ctx = ctxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    // FM bell: carrier 880Hz, mod 1320Hz (3:2 ratio)
    const carrier = ctx.createOscillator();
    carrier.frequency.value = 880;
    const mod = ctx.createOscillator();
    mod.frequency.value = 1320;
    const modGain = ctx.createGain();
    modGain.gain.value = 280;
    mod.connect(modGain).connect(carrier.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.06, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    carrier.connect(env).connect(master);
    mod.start(t); carrier.start(t);
    mod.stop(t + 1.8); carrier.stop(t + 1.8);
  }, []);

  // Toggle on/off based on enabled
  useEffect(() => {
    if (enabled) start();
    else stop();
    return () => stop();
  }, [enabled, start, stop]);

  // Duck volume during narration
  useEffect(() => {
    const ctx = ctxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master || !enabled) return;
    const target = ducking ? 0.22 : 0.55;
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.6);
  }, [ducking, enabled]);

  return { ping };
}

// ═══════════════════════════════════════════════════════════════════════════
// VOICE: HTML5 <audio> element with pre-generated MP3 narration
// (en-GB-RyanNeural via edge-tts — free Microsoft Neural TTS, cinematic British male)
// ═══════════════════════════════════════════════════════════════════════════

function useNarration(enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazy-init audio element on client
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio();
    a.preload = "auto";
    a.volume = 0.85;
    audioRef.current = a;
    return () => { a.pause(); a.src = ""; audioRef.current = null; };
  }, []);

  const play = useCallback((sceneId: string) => {
    const a = audioRef.current;
    if (!a || !enabled) return;
    a.pause();
    a.currentTime = 0;
    a.src = `/audio/intro/${sceneId}.mp3`;
    // play() returns a promise — swallow autoplay-policy errors
    a.play().catch(() => {});
  }, [enabled]);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
  }, []);

  return { play, stop };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PLAYER
// ═══════════════════════════════════════════════════════════════════════════

export default function IntroducingPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [muted, setMuted] = useState(true);  // voice off by default — auto-play with sound is blocked
  const [musicOn, setMusicOn] = useState(false);  // backsound off by default
  const [ccOn, setCcOn] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { play: playNarration, stop: stopNarration } = useNarration(!muted);
  const { ping: musicPing } = useBacksound(musicOn && hasStarted && playing, !muted /* duck while narration on */);

  // ── Animation loop
  useEffect(() => {
    if (!playing) return;
    startRef.current = Date.now();
    function tick() {
      const dur = SCENES[activeIdx].duration;
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / dur);
      setProgress(p);
      if (p >= 1) {
        if (activeIdx < SCENES.length - 1) {
          setTransitioning(true);
          setTimeout(() => {
            setActiveIdx((i) => i + 1);
            setProgress(0);
            startRef.current = Date.now();
            setTimeout(() => setTransitioning(false), 60);
          }, 240);
        } else { setPlaying(false); }
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, activeIdx]);

  // ── Play scene narration MP3 on scene change (when playing + voice on)
  useEffect(() => {
    if (!playing || muted) { stopNarration(); return; }
    playNarration(SCENES[activeIdx].id);
  }, [activeIdx, playing, muted, playNarration, stopNarration]);

  // ── Bell ping on scene transition (when music on)
  useEffect(() => { if (musicOn && hasStarted) musicPing(); }, [activeIdx, musicOn, hasStarted, musicPing]);

  useEffect(() => { if (muted) stopNarration(); }, [muted, stopNarration]);

  // ── Auto-hide controls
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playing && hasStarted) setControlsVisible(false);
    }, 2800);
  }, [playing, hasStarted]);

  useEffect(() => {
    function onMove() { showControls(); }
    function onLeave() { if (playing) setControlsVisible(false); }
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mousemove", onMove);
    el.addEventListener("touchstart", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("touchstart", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [showControls, playing]);

  // ── Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      if (e.key === "ArrowRight") jumpRel(5000);
      if (e.key === "ArrowLeft") jumpRel(-5000);
      if (e.key === "Escape") setPlaying(false);
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "m" || e.key === "M") setMuted((v) => !v);
      if (e.key === "c" || e.key === "C") setCcOn((v) => !v);
      if (e.key === "b" || e.key === "B") setMusicOn((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, progress]);

  function togglePlay() {
    if (!hasStarted) setHasStarted(true);
    setPlaying((v) => {
      const next = !v;
      if (!next) stopNarration();
      else if (!muted) playNarration(SCENES[activeIdx].id);
      return next;
    });
    startRef.current = Date.now() - progress * SCENES[activeIdx].duration;
    showControls();
  }

  function getCurrentTime() { return OFFSETS[activeIdx].start + progress * SCENES[activeIdx].duration; }

  function seekTo(targetMs: number) {
    const clamp = Math.max(0, Math.min(TOTAL_MS - 1, targetMs));
    const idx = OFFSETS.findIndex((o) => clamp >= o.start && clamp < o.end);
    const sceneIdx = idx === -1 ? SCENES.length - 1 : idx;
    const dur = SCENES[sceneIdx].duration;
    const p = (clamp - OFFSETS[sceneIdx].start) / dur;
    setActiveIdx(sceneIdx);
    setProgress(p);
    startRef.current = Date.now() - p * dur;
    stopNarration();
  }
  function jumpRel(deltaMs: number) { seekTo(getCurrentTime() + deltaMs); showControls(); }
  function toggleFullscreen() {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }
  function onSurfaceClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-control]")) return;
    togglePlay();
  }

  const scene = SCENES[activeIdx];
  const currentMs = getCurrentTime();
  const overallPct = (currentMs / TOTAL_MS) * 100;
  const ended = !playing && hasStarted && activeIdx === SCENES.length - 1 && progress >= 1;
  const activeCue = ccOn ? scene.cues.slice().reverse().find((c) => progress >= c.at) : null;

  return (
    <div
      ref={containerRef}
      onClick={onSurfaceClick}
      className="fixed inset-0 bg-black overflow-hidden select-none"
      style={{
        cursor: playing && !controlsVisible && hasStarted ? "none" : "auto",
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      <ParticleField />

      {/* Cinematic letterbox */}
      <motion.div animate={{ opacity: !controlsVisible && playing ? 1 : 0 }} transition={{ duration: 0.4 }} className="absolute top-0 inset-x-0 h-[5vh] bg-black z-40 pointer-events-none" />
      <motion.div animate={{ opacity: !controlsVisible && playing ? 1 : 0 }} transition={{ duration: 0.4 }} className="absolute bottom-0 inset-x-0 h-[5vh] bg-black z-40 pointer-events-none" />

      {/* Scene viewport */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: transitioning ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="absolute inset-0 z-20"
        >
          <SceneRender id={scene.id} progress={progress} />
        </motion.div>
      </AnimatePresence>

      {/* SUBTITLES — Netflix-style, just above bottom controls */}
      <AnimatePresence>
        {ccOn && activeCue && hasStarted && (
          <motion.div
            key={`${scene.id}-${activeCue.at}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="absolute left-0 right-0 z-40 pointer-events-none flex justify-center px-6"
            style={{ bottom: controlsVisible ? "100px" : "12vh" }}
          >
            <div className="px-4 py-2 rounded-md bg-black/85 backdrop-blur text-white text-[15px] sm:text-[18px] font-medium leading-[1.4] text-center max-w-[90%] sm:max-w-[640px]" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
              {activeCue.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INITIAL play overlay */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <button data-control onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="group flex flex-col items-center gap-4 cursor-pointer">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/95 hover:bg-white text-black flex items-center justify-center transition-all shadow-[0_0_60px_rgba(255,255,255,0.4)] group-hover:scale-105">
                <Play size={36} fill="currentColor" className="ml-1" strokeWidth={0} />
              </div>
              <div className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.4em] text-white/90">ChatHermes — A Film</div>
              <div className="font-[family-name:var(--font-mono)] text-[10.5px] text-white/40">{fmtTime(TOTAL_MS)} · {SCENES.length} chapters · click to play</div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] text-white/30 mt-2">CC on · M for voice · B for backsound</div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAUSE overlay */}
      <AnimatePresence>
        {hasStarted && !playing && !ended && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-md">
              <Pause size={28} className="text-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* END overlay */}
      <AnimatePresence>
        {ended && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center px-6">
              <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.4em] text-amber mb-4">⊹ end of film ⊹</div>
              <div className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,64px)] tracking-[-0.025em] mb-6 text-white">Ready when <em className="text-amber italic">you are.</em></div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/auth/login" data-control onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-amber text-black text-[15px] font-medium hover:bg-amber-soft transition shadow-[0_0_60px_rgba(232,165,71,0.5)]">
                  <Sparkles size={15} /> Get started — free <ArrowRight size={14} />
                </Link>
                <button data-control onClick={(e) => { e.stopPropagation(); seekTo(0); setPlaying(true); }} className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-[14px]">Replay</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTROLS bar */}
      <AnimatePresence>
        {controlsVisible && hasStarted && !ended && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.25 }} className="absolute bottom-0 inset-x-0 z-40 pointer-events-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
            <div className="relative px-4 sm:px-6 pt-8 pb-1.5">
              <div data-control onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * TOTAL_MS); }} className="h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-1.5 transition-all relative group">
                <div className="h-full bg-amber transition-[width] duration-75 ease-linear" style={{ width: `${overallPct}%`, boxShadow: "0 0 12px rgba(232,165,71,0.6)" }} />
                {/* Chapter markers */}
                {OFFSETS.slice(0, -1).map((o, i) => (
                  <div key={i} className="absolute top-0 bottom-0 w-px bg-black/40" style={{ left: `${(o.end / TOTAL_MS) * 100}%` }} />
                ))}
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_rgba(232,165,71,0.6)]" style={{ left: `${overallPct}%` }} />
              </div>
            </div>
            <div className="relative px-4 sm:px-6 pb-3 sm:pb-4 flex items-center gap-2 sm:gap-3">
              <button data-control onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-2 text-white/80 hover:text-white transition">
                {playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
              </button>
              <button data-control onClick={(e) => { e.stopPropagation(); setMuted((v) => !v); }} className="p-2 text-white/60 hover:text-white transition" title="Voice (M)">
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button data-control onClick={(e) => { e.stopPropagation(); setCcOn((v) => !v); }} className={`p-2 transition ${ccOn ? "text-amber" : "text-white/40 hover:text-white"}`} title="Subtitles (C)">
                <Subtitles size={18} />
              </button>
              <button data-control onClick={(e) => { e.stopPropagation(); setMusicOn((v) => !v); }} className={`p-2 transition ${musicOn ? "text-amber" : "text-white/40 hover:text-white"}`} title="Backsound (B)">
                <Music size={18} />
              </button>
              <div className="font-[family-name:var(--font-mono)] text-[11px] sm:text-[12px] text-white/80 tabular-nums">{fmtTime(currentMs)}<span className="text-white/40"> / {fmtTime(TOTAL_MS)}</span></div>
              <div className="hidden sm:block font-[family-name:var(--font-mono)] text-[10px] text-amber/70 uppercase tracking-[0.18em] ml-2">{String(activeIdx + 1).padStart(2, "0")} · {scene.id}</div>
              <div className="flex-1" />
              <Link href="/auth/login" data-control onClick={(e) => e.stopPropagation()} className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-amber text-black text-[12.5px] font-medium hover:bg-amber-soft transition">Sign up free <ArrowRight size={12} /></Link>
              <button data-control onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="p-2 text-white/60 hover:text-white transition" title="Fullscreen (F)"><Maximize size={16} /></button>
              <Link href="/" data-control onClick={(e) => e.stopPropagation()} className="p-2 text-white/60 hover:text-white transition" title="Close"><X size={16} /></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint shown briefly */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 1.5, duration: 0.4 }} className="absolute top-6 right-6 z-30 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-white/40">
            space · ← → · f · m · c · b · esc
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FAKE CURSOR — for "screen recording" feel on select scenes
// ═══════════════════════════════════════════════════════════════════════════

function FakeCursor({ x, y, clicking }: { x: string; y: string; clicking?: boolean }) {
  return (
    <motion.div
      animate={{ left: x, top: y, scale: clicking ? 0.85 : 1 }}
      transition={{ type: "spring", damping: 22, stiffness: 200 }}
      className="absolute z-30 pointer-events-none"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="black" strokeWidth="1">
        <path d="M5 3 L19 12 L13 13 L11 19 Z" />
      </svg>
      {clicking && (
        <motion.div initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 2.5, opacity: 0 }} transition={{ duration: 0.5 }} className="absolute top-[8px] left-[8px] w-3 h-3 rounded-full border border-amber" />
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════════════════════════════

function ParticleField() {
  const [particles] = useState(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 2 + 1, duration: 8 + Math.random() * 12, delay: Math.random() * 8,
      opacity: 0.1 + Math.random() * 0.3,
    }))
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <motion.div
          key={p.id} className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: "rgb(232,165,71)", opacity: p.opacity, boxShadow: `0 0 ${p.size * 4}px rgba(232,165,71,${p.opacity})` }}
          animate={{ y: [-20, 20, -20], x: [-15, 15, -15], opacity: [p.opacity * 0.4, p.opacity, p.opacity * 0.4] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════

function SceneRender({ id, progress }: { id: string; progress: number }) {
  switch (id) {
    case "studio":    return <SceneStudio progress={progress} />;
    case "promise":   return <ScenePromise progress={progress} />;
    case "landing":   return <SceneLanding progress={progress} />;
    case "signin":    return <SceneSignin progress={progress} />;
    case "dashboard": return <SceneDashboard progress={progress} />;
    case "chat":      return <SceneChat progress={progress} />;
    case "toolcall":  return <SceneToolCall progress={progress} />;
    case "tools":     return <SceneTools progress={progress} />;
    case "vibe":      return <SceneVibe progress={progress} />;
    case "memory":    return <SceneMemory progress={progress} />;
    case "schedule":  return <SceneSchedule progress={progress} />;
    case "telegram":  return <SceneTelegram progress={progress} />;
    case "stinger":   return <SceneStinger progress={progress} />;
    case "private":   return <ScenePrivate progress={progress} />;
    case "billing":   return <SceneBilling progress={progress} />;
    case "assemble":  return <SceneAssemble progress={progress} />;
    case "outro":     return <SceneOutro progress={progress} />;
  }
  return null;
}

function Vignette() { return <div className="absolute inset-0 pointer-events-none z-30" style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)" }} />; }

function TypeOut({ text, speed = 30, trigger }: { text: string; speed?: number; trigger?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown(""); let i = 0;
    const t = setInterval(() => { i++; setShown(text.slice(0, i)); if (i >= text.length) clearInterval(t); }, speed);
    return () => clearInterval(t);
  }, [text, speed, trigger]);
  return <span>{shown}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENES
// ═══════════════════════════════════════════════════════════════════════════

function SceneStudio({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
      <motion.div initial={{ x: "-100%" }} animate={{ x: progress > 0.2 && progress < 0.6 ? "100%" : "-100%" }} transition={{ duration: 1.5, ease: "easeOut" }} className="absolute top-0 left-0 w-[30%] h-full bg-gradient-to-r from-transparent via-amber/30 to-transparent blur-2xl" />
      <div className="text-center relative z-20">
        <motion.div initial={{ scale: 0.5, opacity: 0, filter: "blur(20px)" }} animate={{ scale: 1, opacity: progress > 0.1 ? 1 : 0, filter: "blur(0px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="mb-6">
          <Image src="/illustrations/mascot-head.png" alt="" width={140} height={140} className="mx-auto" style={{ filter: "drop-shadow(0 0 80px rgba(232,165,71,0.6))" }} priority />
        </motion.div>
        <motion.div initial={{ letterSpacing: "0.3em", opacity: 0 }} animate={{ letterSpacing: progress > 0.4 ? "0.05em" : "0.3em", opacity: progress > 0.3 ? 1 : 0 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(56px,9vw,120px)] tracking-tight text-white" style={{ textShadow: "0 0 40px rgba(232,165,71,0.4), 0 0 100px rgba(232,165,71,0.25)" }}>
          ChatHermes
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: progress > 0.6 ? 1 : 0, y: progress > 0.6 ? 0 : 10 }} transition={{ duration: 0.8 }} className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.4em] text-amber mt-4">Studios</motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: progress > 0.75 ? 1 : 0 }} transition={{ duration: 0.6 }} className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-white/40 mt-3">Built on Hermes 4</motion.div>
      </div>
      <Vignette />
    </div>
  );
}

function ScenePromise({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
      <motion.div initial={{ scale: 1.2 }} animate={{ scale: 1 + progress * 0.15 }} transition={{ duration: 5, ease: "linear" }} className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(232,165,71,0.12) 0%, transparent 70%)" }} />
      <div className="text-center relative z-20 px-8 max-w-[90%]">
        <div className="space-y-2 sm:space-y-4">
          <motion.div initial={{ opacity: 0, y: 30, filter: "blur(15px)" }} animate={{ opacity: progress > 0.15 ? 1 : 0, y: progress > 0.15 ? 0 : 30, filter: progress > 0.15 ? "blur(0px)" : "blur(15px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(48px,9vw,140px)] tracking-[-0.03em] leading-[0.95] text-white">A coworker.</motion.div>
          <motion.div initial={{ opacity: 0, y: 30, filter: "blur(15px)" }} animate={{ opacity: progress > 0.5 ? 1 : 0, y: progress > 0.5 ? 0 : 30, filter: progress > 0.5 ? "blur(0px)" : "blur(15px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(48px,9vw,140px)] tracking-[-0.03em] leading-[0.95] text-amber italic" style={{ textShadow: "0 0 80px rgba(232,165,71,0.5)" }}>Not a chatbot.</motion.div>
        </div>
      </div>
      <Vignette />
    </div>
  );
}

// NEW — Landing page replica with cursor moving to "Sign in"
function SceneLanding({ progress }: { progress: number }) {
  // Cursor trajectory: enters from bottom-right, moves to "Sign in" button at top-right, clicks
  const cx = progress < 0.4 ? "60%" : progress < 0.7 ? "85%" : "85%";
  const cy = progress < 0.4 ? "60%" : progress < 0.7 ? "8%" : "8%";
  const clicking = progress > 0.65 && progress < 0.78;
  return (
    <div className="absolute inset-0 bg-stone-950 overflow-hidden">
      {/* Browser-ish chrome */}
      <div className="h-8 bg-stone-900 border-b border-stone-800 flex items-center px-4 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        <div className="ml-3 px-3 py-0.5 bg-stone-800 rounded text-stone-400 text-[10px] font-[family-name:var(--font-mono)]">chathermes.com</div>
      </div>
      {/* Top nav */}
      <div className="px-6 py-4 flex items-center gap-6 border-b border-stone-800/60">
        <div className="font-[family-name:var(--font-display)] text-[18px] text-white">ChatHermes</div>
        <div className="flex-1" />
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-stone-500 hidden sm:block">demo</div>
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-stone-500 hidden sm:block">how</div>
        <div className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-stone-500 hidden sm:block">vs chatgpt</div>
        <motion.div animate={{ scale: clicking ? 0.96 : 1, boxShadow: clicking ? "0 0 30px rgba(232,165,71,0.6)" : "0 0 0 rgba(0,0,0,0)" }} className="px-4 py-1.5 rounded-md bg-amber text-stone-950 text-[12.5px] font-medium">Sign in</motion.div>
      </div>
      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center max-w-[800px]">
          <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-4">— autonomous · persistent · multi-platform</div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(36px,5.5vw,72px)] tracking-[-0.025em] leading-[1.05] text-white mb-4">A coworker, not a chatbot.</div>
          <div className="text-stone-400 text-[15px] sm:text-[16px] leading-[1.55]">Drop a task. Close the tab. Come back to a finished thing.</div>
        </div>
      </div>
      <FakeCursor x={cx} y={cy} clicking={clicking} />
    </div>
  );
}

// Sign-in flow with cursor, typing, clicking
function SceneSignin({ progress }: { progress: number }) {
  const showInput = progress > 0.05;
  const showTyping = progress > 0.15;
  const showSent = progress > 0.55;
  const showLink = progress > 0.78;
  const cx = progress < 0.45 ? "50%" : progress < 0.6 ? "50%" : "50%";
  const cy = progress < 0.45 ? "55%" : "70%";
  const clicking = progress > 0.45 && progress < 0.55;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-stone-950 overflow-hidden">
      <motion.div initial={{ scale: 1.05 }} animate={{ scale: 1 + progress * 0.05 }} transition={{ duration: 5, ease: "linear" }} className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, rgba(232,165,71,0.08), transparent 60%)" }} />
      <div className="relative z-20 max-w-[420px] w-full px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-8">
          <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-3">— sign in</div>
          <div className="font-[family-name:var(--font-display)] text-[40px] sm:text-[56px] tracking-[-0.025em] text-white">One link.<br />No password.</div>
        </motion.div>
        {showInput && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-3">
            <div className="px-5 py-4 rounded-lg border border-stone-700 bg-stone-900/80 backdrop-blur shadow-2xl">
              <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-stone-500 mb-1.5">email</div>
              <div className="text-white text-[16px] h-[22px]">{showTyping && <TypeOut text="demo@chathermes.com" speed={50} trigger={progress > 0.15 ? 1 : 0} />}</div>
            </div>
            <button className={`w-full py-3.5 rounded-lg font-medium text-[14.5px] transition-all shadow-2xl ${showSent ? "bg-emerald-500 text-stone-950" : "bg-amber text-stone-950"}`} style={{ boxShadow: showSent ? "0 0 40px rgba(16,185,129,0.4)" : "0 0 40px rgba(232,165,71,0.4)" }}>
              {showSent ? "✓ Magic link sent" : "Send magic link"}
            </button>
            {showLink && (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mt-6 px-4 py-3 rounded-lg border border-amber/40 bg-amber/[0.04]">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={11} className="text-amber" />
                  <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-amber">inbox · just now</span>
                </div>
                <div className="text-white text-[13px] mb-0.5">ChatHermes &lt;hello@chathermes.com&gt;</div>
                <div className="text-stone-400 text-[12px]">→ Click to sign in</div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
      {progress > 0.05 && progress < 0.78 && <FakeCursor x={cx} y={cy} clicking={clicking} />}
      <Vignette />
    </div>
  );
}

// NEW — Dashboard first-look (with sidebar, topbar, workspace)
function SceneDashboard({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 bg-stone-950 flex overflow-hidden">
      {/* Sidebar */}
      <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="w-[180px] border-r border-stone-800 px-3 py-4 hidden md:block">
        <div className="flex items-center gap-2 px-2 mb-5">
          <div className="w-6 h-6 rounded bg-amber/20 border border-amber/40 flex items-center justify-center text-amber text-[10px] font-bold">CH</div>
          <span className="font-[family-name:var(--font-display)] text-[14px] text-white">ChatHermes</span>
        </div>
        {[
          { i: MessageSquare, n: "Chat", active: true },
          { i: Code2, n: "Build" },
          { i: Brain, n: "Memory" },
          { i: Bell, n: "Schedules" },
          { i: Plug, n: "Connectors" },
          { i: KeyRound, n: "API keys" },
        ].map((it) => {
          const Icon = it.i;
          return (
            <div key={it.n} className={`px-2 py-1.5 mb-0.5 rounded-md flex items-center gap-2 text-[12.5px] ${it.active ? "bg-amber/10 text-amber" : "text-stone-400"}`}>
              <Icon size={12} /> {it.n}
            </div>
          );
        })}
      </motion.div>
      {/* Main */}
      <div className="flex-1 flex flex-col">
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="h-12 border-b border-stone-800 flex items-center px-5 gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
          <span className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-stone-400">240ms · hermes-4-405b · shared agent · free</span>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber/15 border border-amber/40 text-amber">
            <Cpu size={11} />
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em]">Get private agent</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-amber/20 border border-amber/40 flex items-center justify-center text-amber text-[11px] font-medium">D</div>
        </motion.div>
        <div className="flex-1 flex items-center justify-center px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: progress > 0.2 ? 1 : 0, y: progress > 0.2 ? 0 : 20 }} transition={{ duration: 0.6, delay: 0.3 }} className="text-center">
            <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-amber mb-3">— SATURDAY, MAY 3</div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: progress > 0.35 ? 1 : 0 }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/25 mb-5">
              <Shield size={9} className="text-emerald-400" />
              <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-emerald-400">Your private workspace</span>
            </motion.div>
            <div className="font-[family-name:var(--font-display)] text-[clamp(28px,4.5vw,52px)] tracking-[-0.025em] text-white leading-[1.05]">Your workspace is <em className="text-amber italic">ready.</em></div>
            <div className="text-stone-400 text-[14.5px] mt-3">Drop a task. Close the tab. Come back to a finished thing.</div>
            {progress > 0.55 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-[600px]">
                {[
                  { i: "🔎", t: "Research" }, { i: "🛠️", t: "Build" },
                  { i: "📊", t: "Analyze" }, { i: "🧠", t: "Remember" },
                ].map((c) => (
                  <div key={c.t} className="px-3 py-3 rounded-xl border border-stone-800 bg-stone-900/50">
                    <div className="text-[18px] mb-1">{c.i}</div>
                    <div className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-stone-500">{c.t}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} className="px-5 sm:px-8 pb-5">
          <div className="rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3 max-w-[700px] mx-auto">
            <div className="text-stone-500 text-[13px]">Send a message…</div>
          </div>
        </motion.div>
      </div>
      <Vignette />
    </div>
  );
}

function SceneChat({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 bg-stone-950 flex flex-col">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 sm:px-10 py-3 border-b border-stone-800/50 flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-stone-400">240ms · hermes-4-405b · shared agent · free</span>
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-amber">— chathermes</span>
      </motion.div>
      <div className="flex-1 max-w-[760px] mx-auto w-full px-6 py-8 sm:py-12 space-y-4 overflow-hidden">
        {progress > 0.05 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="ml-auto max-w-[80%] px-4 py-3 rounded-2xl text-[15px] sm:text-[16px] leading-[1.55] bg-amber/15 border border-amber/30 text-white shadow-lg">
            Research recent multi-agent reasoning. Top 3 papers from 2025.
          </motion.div>
        )}
        {progress > 0.35 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-[85%] px-4 py-3 rounded-2xl text-[15px] sm:text-[16px] leading-[1.55] bg-stone-900 border border-stone-800 text-white shadow-lg">
            <TypeOut text="On it. Calling web_search → browsing top 3 → synthesizing with citations." speed={20} trigger={progress > 0.35 ? 1 : 0} />
          </motion.div>
        )}
        {progress > 0.85 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-stone-400 text-[12.5px] font-[family-name:var(--font-mono)]">
            <Loader2 size={13} className="animate-spin text-amber" />
            <span>tools running · web_search → browse → summarize</span>
          </motion.div>
        )}
      </div>
      <Vignette />
    </div>
  );
}

// NEW — Tool call visible with arguments + result panel
function SceneToolCall({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 bg-stone-950 px-6 sm:px-10 py-8 flex flex-col overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-4">— tool execution · live</motion.div>
      <div className="space-y-3 max-w-[820px] mx-auto w-full">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: progress > 0.05 ? 1 : 0, x: progress > 0.05 ? 0 : -20 }} className="rounded-xl bg-stone-900/80 border border-amber/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 rounded bg-amber/15 border border-amber/30 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-amber">tool_call</div>
            <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-white">web_search</span>
          </div>
          <pre className="font-[family-name:var(--font-mono)] text-[11.5px] text-stone-300 bg-black/40 rounded-md px-3 py-2 leading-[1.5]">{"{\n  \"query\": \"multi-agent reasoning papers 2025\"\n}"}</pre>
        </motion.div>
        {progress > 0.4 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="rounded-xl bg-stone-900/80 border border-emerald-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-emerald-300">tool_result</div>
              <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-white">via tavily</span>
              <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] text-stone-500">340ms</span>
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[11px] text-stone-300 leading-[1.6] space-y-1.5">
              <div>- <strong className="text-white">Self-Refining Agents at Scale</strong> — arxiv.org/2509.0123</div>
              <div>- <strong className="text-white">Multi-Agent Coordination via Hermes 4</strong> — nous.ai/multi-agent</div>
              <div>- <strong className="text-white">Tool-Use Benchmarks 2025</strong> — papers.io/2510</div>
            </div>
          </motion.div>
        )}
        {progress > 0.75 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-stone-900/80 border border-stone-800 p-4">
            <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-stone-500 mb-2">— assistant · summarizing</div>
            <div className="text-white text-[13.5px] leading-[1.55]">
              <TypeOut text="Found 3 strong papers. Self-Refining covers iterative reasoning, Hermes 4 paper benchmarks coord at scale, and Tool-Use 2025 includes Hermes Agent…" speed={15} trigger={progress > 0.75 ? 1 : 0} />
            </div>
          </motion.div>
        )}
      </div>
      <Vignette />
    </div>
  );
}

function SceneTools({ progress }: { progress: number }) {
  const tools = ["web_search","browse","github_repo","weather","wikipedia","news_search","save_memory","recall_memory","telegram_send","run_js","fetch_url","generate_image","analyze_image","dispatch_subagent"];
  return (
    <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-8 sm:mb-12 px-6">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-3">— the arsenal</div>
        <div className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,72px)] tracking-[-0.025em] text-white leading-[1.05]">14 tools.<br /><em className="text-amber italic">Real APIs. Zero mockups.</em></div>
      </motion.div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3 max-w-[1100px] w-full px-6">
        {tools.map((t, i) => {
          const show = progress > i / tools.length * 0.85;
          return (
            <motion.div key={t} initial={{ opacity: 0, scale: 0.7, y: 20 }} animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.7, y: show ? 0 : 20 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="px-3 py-3 rounded-xl border border-amber/30 bg-stone-900/80 backdrop-blur" style={{ boxShadow: show ? "0 0 20px rgba(232,165,71,0.15)" : "none" }}>
              <div className="font-[family-name:var(--font-mono)] text-[10.5px] sm:text-[11px] text-amber/90 truncate text-center">{t}</div>
            </motion.div>
          );
        })}
      </div>
      <Vignette />
    </div>
  );
}

function SceneVibe({ progress }: { progress: number }) {
  const code = `<!doctype html>
<html><head>
  <title>reg — domains</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-stone-950 text-white min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-7xl font-serif italic">reg</h1>
    <p class="text-stone-400 mt-3">The simplest way to register domains.</p>
    <button class="mt-6 px-6 py-2.5 rounded bg-amber-500 text-stone-950 font-medium">
      Search →
    </button>
  </div>
</body></html>`;
  const visible = Math.floor(progress * code.length * 1.3);
  return (
    <div className="absolute inset-0 bg-stone-950 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
      <div className="border-b md:border-b-0 md:border-r border-stone-800 px-6 sm:px-8 py-6 sm:py-10 overflow-hidden flex flex-col">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-4 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-amber animate-pulse" />— code · streaming
        </div>
        <pre className="font-[family-name:var(--font-mono)] text-[11.5px] sm:text-[13px] text-amber/90 leading-[1.55] whitespace-pre-wrap flex-1 overflow-hidden">{code.slice(0, visible)}<span className="bg-amber/40 inline-block w-[6px] h-[12px] animate-pulse">&nbsp;</span></pre>
      </div>
      <div className="px-6 sm:px-8 py-6 sm:py-10 flex flex-col">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-emerald-400 mb-4 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />— preview · live
        </div>
        {progress > 0.35 && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="rounded-lg bg-black border border-stone-800 flex-1 flex items-center justify-center text-center px-6 shadow-2xl">
            <div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white text-[64px] sm:text-[88px] font-[family-name:var(--font-display)] italic leading-none">reg</motion.div>
              {progress > 0.6 && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-stone-400 text-[14px] mt-3">The simplest way to register domains.</motion.div>}
              {progress > 0.85 && <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 px-6 py-2.5 rounded bg-amber text-stone-950 text-[13px] font-medium">Search →</motion.button>}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SceneMemory({ progress }: { progress: number }) {
  const memories = [
    { topic: "stack", body: "Bun + Next.js 16 + Tailwind v4" },
    { topic: "voice", body: "Concise. Mono labels. Amber accent." },
    { topic: "deploy", body: "Hetzner Cloud, Hillsboro OR" },
    { topic: "favorite", body: "Italic serif headlines." },
  ];
  return (
    <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-8 sm:mb-10 px-6">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-3">— the mind</div>
        <div className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,68px)] tracking-[-0.025em] text-white leading-[1.05]">It <em className="text-amber italic">remembers.</em></div>
      </motion.div>
      <div className="space-y-2 sm:space-y-3 max-w-[640px] w-full px-6">
        {memories.map((m, i) => {
          const show = progress > i / memories.length * 0.8;
          return (
            <motion.div key={m.topic} initial={{ opacity: 0, x: -30 }} animate={{ opacity: show ? 1 : 0, x: show ? 0 : -30 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="px-4 sm:px-5 py-3 sm:py-4 rounded-xl bg-stone-900/80 backdrop-blur border border-stone-800 hover:border-amber/30 transition">
              <div className="flex items-center gap-2 mb-1">
                <Brain size={11} className="text-amber" />
                <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-amber">{m.topic}</span>
              </div>
              <div className="text-white text-[14px] sm:text-[15.5px] ml-5">{m.body}</div>
            </motion.div>
          );
        })}
      </div>
      <Vignette />
    </div>
  );
}

function SceneSchedule({ progress }: { progress: number }) {
  const items = [
    { p: 0.05, name: "Daily briefing", time: "09:00", live: true, desc: "Top 5 stories from your watchlist, summarized." },
    { p: 0.35, name: "Watch competitor pricing", time: "every 6h", live: false, desc: "Browse → diff vs last check → notify if changed." },
    { p: 0.65, name: "Weekly digest", time: "Sun 08:00", live: false, desc: "What the agent did this week → your inbox." },
  ];
  return (
    <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-8 sm:mb-10 px-6">
        <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-3">— the schedule</div>
        <div className="font-[family-name:var(--font-display)] text-[clamp(36px,5vw,68px)] tracking-[-0.025em] text-white leading-[1.05]">Works while <em className="text-amber italic">you sleep.</em></div>
      </motion.div>
      <div className="space-y-2 sm:space-y-3 max-w-[640px] w-full px-6">
        {items.map((s) => (
          <motion.div key={s.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: progress > s.p ? 1 : 0, y: progress > s.p ? 0 : 20 }} transition={{ duration: 0.5 }} className={`px-4 sm:px-5 py-3 sm:py-4 rounded-xl border transition ${s.live ? "bg-amber/[0.05] border-amber/30" : "bg-stone-900/80 border-stone-800"}`}>
            <div className="flex items-center gap-2.5 mb-1">
              <Bell size={11} className={s.live ? "text-amber" : "text-stone-500"} />
              <span className="text-white text-[14px] sm:text-[15px] font-medium flex-1">{s.name}</span>
              <span className={`font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] ${s.live ? "text-amber" : "text-stone-500"}`}>{s.time}</span>
            </div>
            <div className="text-stone-400 text-[12.5px] ml-5">{s.desc}</div>
          </motion.div>
        ))}
      </div>
      <Vignette />
    </div>
  );
}

function SceneTelegram({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-stone-950 to-stone-950 flex items-center justify-center overflow-hidden">
      <div className="relative z-20 max-w-[400px] w-full px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-6">
          <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-2">— the reach</div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(28px,4vw,44px)] tracking-[-0.025em] text-white leading-[1.05]">Wherever <em className="text-amber italic">you are.</em></div>
        </motion.div>
        <motion.div initial={{ y: 30, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: progress > 0.2 ? 1 : 0, scale: progress > 0.2 ? 1 : 0.95 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-blue-500/15 border-b border-blue-500/30 px-4 py-2 flex items-center gap-2">
            <Send size={11} className="text-blue-300" />
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-blue-300">Telegram</span>
          </div>
          <div className="p-4">
            {progress > 0.35 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-amber/10 border border-amber/30 rounded-lg px-3 py-2.5">
                <div className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.16em] text-amber mb-1">— @ChatHermes</div>
                <div className="text-white text-[13px] leading-[1.55]">
                  <strong>Daily briefing</strong>
                  {progress > 0.55 && <><br />Top stories: Hermes 4 405B benchmarks, GPT-5 release confirmed, Anthropic Claude update shipping next week.</>}
                </div>
                {progress > 0.85 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-stone-500 text-[10px] mt-2">just now ✓✓</motion.div>}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
      <Vignette />
    </div>
  );
}

function SceneStinger({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
      <motion.div animate={{ opacity: [0.05, 0.25, 0.08, 0.2, 0.05] }} transition={{ duration: 4, repeat: Infinity }} className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(232,165,71,0.4) 0%, transparent 60%)" }} />
      <motion.div animate={{ x: progress > 0.5 ? [0, -3, 3, -1, 0] : 0 }} transition={{ duration: 0.4, repeat: progress > 0.5 ? 4 : 0 }} className="text-center relative z-20 px-8">
        <motion.div initial={{ opacity: 0, scale: 1.5 }} animate={{ opacity: progress > 0.1 ? 1 : 0, scale: progress > 0.1 ? 1 : 1.5 }} transition={{ duration: 0.7, ease: "easeOut" }} className="font-[family-name:var(--font-display)] text-[clamp(40px,7vw,90px)] tracking-[-0.025em] leading-[1.05] text-white/80 italic mb-6">But sharing has limits.</motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.5, filter: "blur(20px)" }} animate={{ opacity: progress > 0.55 ? 1 : 0, scale: progress > 0.55 ? 1 : 0.5, filter: progress > 0.55 ? "blur(0px)" : "blur(20px)" }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(56px,10vw,140px)] tracking-[-0.03em] leading-[0.95] text-amber" style={{ textShadow: "0 0 60px rgba(232,165,71,0.7), 0 0 140px rgba(232,165,71,0.4)" }}>What if it didn't?</motion.div>
      </motion.div>
      <Vignette />
    </div>
  );
}

function ScenePrivate({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-amber/[0.06] via-stone-950 to-stone-950 flex items-center justify-center overflow-hidden">
      <div className="relative z-20 max-w-[580px] w-full px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-8">
          <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-3">— the private agent</div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,60px)] tracking-[-0.025em] text-white leading-[1.05]">A server. <em className="text-amber italic">Just yours.</em></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: progress > 0.05 ? 1 : 0, scale: progress > 0.05 ? 1 : 0.92 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="rounded-2xl bg-stone-900 border-2 border-amber/40 px-5 sm:px-7 py-5 sm:py-7 shadow-2xl" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(232,165,71,0.15)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber/15 border border-amber/40 flex items-center justify-center text-amber"><Crown size={20} /></div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-amber">— pro plan active</div>
              <div className="text-white text-[16px] font-medium">Welcome to the inside</div>
            </div>
          </div>
          {progress > 0.25 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.5 }} className="rounded-lg bg-blue-500/10 border border-blue-500/30 px-4 py-3 flex items-center gap-3">
              <Loader2 size={16} className={progress < 0.85 ? "text-blue-300 animate-spin" : "text-emerald-400"} />
              <div className="flex-1 min-w-0">
                <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-blue-200">{progress < 0.85 ? "Spinning up your private agent" : "Private agent · ready"}</div>
                <div className="text-stone-400 text-[10.5px] font-[family-name:var(--font-mono)] mt-0.5 truncate">{progress < 0.85 ? "Hetzner Cloud · Hillsboro OR · ~90s" : "5.78.x.x:19002 — your server"}</div>
              </div>
              {progress > 0.85 && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
            </motion.div>
          )}
          {progress > 0.65 && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-stone-400 text-[13px] leading-[1.6]">Dedicated CPU. Your tokens. Your boundary. No queue, no shared rate limit.</motion.p>}
        </motion.div>
      </div>
      <Vignette />
    </div>
  );
}

// NEW — Stripe-style billing checkout
function SceneBilling({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 bg-stone-950 grid grid-cols-1 md:grid-cols-[55%_45%] overflow-hidden">
      <div className="px-6 sm:px-10 py-8 sm:py-12 flex flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.3em] text-amber mb-3">— pro plan</div>
          <div className="font-[family-name:var(--font-display)] text-[clamp(40px,5.5vw,72px)] tracking-[-0.025em] text-white leading-[1.0] mb-2">$20<span className="text-stone-500 text-[20px] sm:text-[28px]">/mo</span></div>
          <div className="text-stone-400 text-[14.5px] mb-6">Cancel anytime. Stripe-secure. PDF receipts.</div>
          <div className="space-y-2 max-w-[400px]">
            {[
              "Unlimited messages, all 14 tools",
              "Your own private Hermes Agent on Hetzner Cloud",
              "Unlimited vibe-coding projects",
              "Priority queue + 30-day refund",
            ].map((f, i) => {
              const show = progress > 0.1 + i * 0.1;
              return (
                <motion.div key={f} initial={{ opacity: 0, x: -10 }} animate={{ opacity: show ? 1 : 0, x: show ? 0 : -10 }} transition={{ duration: 0.4 }} className="flex items-start gap-2 text-stone-300 text-[13.5px]">
                  <CheckCircle2 size={13} className="text-amber mt-0.5 shrink-0" />
                  <span>{f}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
      <div className="border-t md:border-t-0 md:border-l border-stone-800 px-6 sm:px-8 py-8 sm:py-12 flex flex-col justify-center bg-stone-900/40">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: progress > 0.3 ? 1 : 0, scale: progress > 0.3 ? 1 : 0.95 }} transition={{ duration: 0.5 }} className="max-w-[340px] w-full mx-auto">
          <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-stone-500 mb-3">— payment · stripe</div>
          <div className="space-y-2.5">
            <div className="px-3 py-2.5 rounded-md border border-stone-700 bg-stone-900">
              <div className="font-[family-name:var(--font-mono)] text-[9.5px] uppercase tracking-[0.14em] text-stone-500 mb-0.5">card</div>
              <div className="text-white text-[13px] font-[family-name:var(--font-mono)]">{progress > 0.4 ? "•••• •••• •••• 4242" : ""}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-md border border-stone-700 bg-stone-900">
                <div className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-stone-500">exp</div>
                <div className="text-white text-[12px] font-[family-name:var(--font-mono)]">{progress > 0.55 ? "12/29" : ""}</div>
              </div>
              <div className="px-3 py-2 rounded-md border border-stone-700 bg-stone-900">
                <div className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.14em] text-stone-500">cvc</div>
                <div className="text-white text-[12px] font-[family-name:var(--font-mono)]">{progress > 0.7 ? "•••" : ""}</div>
              </div>
            </div>
            <motion.button animate={{ boxShadow: progress > 0.85 ? "0 0 30px rgba(232,165,71,0.6)" : "0 0 0 rgba(0,0,0,0)" }} className="w-full py-3 rounded-md bg-amber text-stone-950 font-medium text-[13.5px]">
              {progress > 0.85 ? "✓ Subscribed · welcome" : "Pay $20.00"}
            </motion.button>
            <div className="font-[family-name:var(--font-mono)] text-[9.5px] text-stone-500 text-center mt-1">Powered by Stripe</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SceneAssemble({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
      <motion.div initial={{ scale: 1.1 }} animate={{ scale: 1 + progress * 0.1 }} transition={{ duration: 5, ease: "linear" }} className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(232,165,71,0.18) 0%, transparent 60%)" }} />
      <div className="text-center relative z-20 px-8 max-w-[90%]">
        <div className="space-y-2 sm:space-y-4">
          <motion.div initial={{ opacity: 0, y: 30, filter: "blur(15px)" }} animate={{ opacity: progress > 0.15 ? 1 : 0, y: progress > 0.15 ? 0 : 30, filter: progress > 0.15 ? "blur(0px)" : "blur(15px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(36px,7vw,100px)] tracking-[-0.03em] leading-[0.95] text-white">Every model.</motion.div>
          <motion.div initial={{ opacity: 0, y: 30, filter: "blur(15px)" }} animate={{ opacity: progress > 0.4 ? 1 : 0, y: progress > 0.4 ? 0 : 30, filter: progress > 0.4 ? "blur(0px)" : "blur(15px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(36px,7vw,100px)] tracking-[-0.03em] leading-[0.95] text-white">Every tool.</motion.div>
          <motion.div initial={{ opacity: 0, y: 30, filter: "blur(15px)" }} animate={{ opacity: progress > 0.65 ? 1 : 0, y: progress > 0.65 ? 0 : 30, filter: progress > 0.65 ? "blur(0px)" : "blur(15px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(36px,7vw,100px)] tracking-[-0.03em] leading-[0.95] text-amber italic" style={{ textShadow: "0 0 80px rgba(232,165,71,0.5)" }}>Every minute you're away.</motion.div>
        </div>
      </div>
      <Vignette />
    </div>
  );
}

function SceneOutro({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(232,165,71,0.15) 0%, transparent 60%)" }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: progress > 0.05 ? 1 : 0, scale: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="text-center relative z-20 px-6 max-w-[800px]">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="inline-block mb-6">
          <Image src="/illustrations/mascot-head.png" alt="" width={88} height={88} className="mx-auto" style={{ filter: "drop-shadow(0 0 50px rgba(232,165,71,0.7))" }} />
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: progress > 0.15 ? 1 : 0 }} transition={{ duration: 0.8 }} className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.4em] text-amber mb-4">Hermes Agent — A Coworker</motion.div>
        <motion.h1 initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: progress > 0.25 ? 1 : 0, scale: progress > 0.25 ? 1 : 0.96 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="font-[family-name:var(--font-display)] text-[clamp(44px,8vw,110px)] leading-[0.95] tracking-[-0.03em] text-white" style={{ textShadow: "0 0 50px rgba(232,165,71,0.3)" }}>Ready when <em className="text-amber italic">you are.</em></motion.h1>
        {progress > 0.85 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.4em] text-white/30 mt-12">⊹ a chathermes studios production ⊹</motion.div>}
        {progress > 0.92 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="font-[family-name:var(--font-mono)] text-[9.5px] tracking-[0.18em] text-white/40 mt-3">written, designed, and shipped by <a href="https://x.com/kwkuh" target="_blank" rel="noopener" className="text-amber hover:text-amber-soft underline decoration-amber/50 underline-offset-[3px] decoration-[1px] hover:decoration-amber" onClick={(e) => e.stopPropagation()}>@kwkuh</a> & <a href="https://x.com/supercryptolord" target="_blank" rel="noopener" className="text-amber hover:text-amber-soft underline decoration-amber/50 underline-offset-[3px] decoration-[1px] hover:decoration-amber" onClick={(e) => e.stopPropagation()}>@supercryptolord</a></motion.div>}
      </motion.div>
      <Vignette />
    </div>
  );
}
