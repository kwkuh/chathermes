"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, AlertCircle, Info, X } from "lucide-react";

export type ToastKind = "ok" | "err" | "info";
export type Toast = { id: string; kind: ToastKind; title: string; body?: string; durationMs?: number };

type Ctx = {
  push: (t: Omit<Toast, "id"> & { id?: string }) => string;
  ok: (title: string, body?: string) => string;
  err: (title: string, body?: string) => string;
  info: (title: string, body?: string) => string;
  dismiss: (id: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast must be inside <ToastProvider>");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => setToasts((s) => s.filter((t) => t.id !== id)), []);

  const push = useCallback<Ctx["push"]>((t) => {
    const id = t.id ?? crypto.randomUUID();
    const toast: Toast = { id, kind: t.kind, title: t.title, body: t.body, durationMs: t.durationMs ?? (t.kind === "err" ? 6000 : 3500) };
    setToasts((s) => [...s, toast]);
    if (toast.durationMs! > 0) setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), toast.durationMs);
    return id;
  }, []);

  const ok = useCallback((title: string, body?: string) => push({ kind: "ok", title, body }), [push]);
  const err = useCallback((title: string, body?: string) => push({ kind: "err", title, body }), [push]);
  const info = useCallback((title: string, body?: string) => push({ kind: "info", title, body }), [push]);

  return (
    <ToastCtx.Provider value={{ push, ok, err, info, dismiss }}>
      {children}
      <div className="fixed top-4 sm:top-6 right-4 sm:right-6 z-[100] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-[400px] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => <ToastView key={t.id} t={t} onDismiss={() => dismiss(t.id)} />)}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastView({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const Icon = t.kind === "ok" ? Check : t.kind === "err" ? AlertCircle : Info;
  const styles = t.kind === "ok"
    ? "bg-moss/10 border-moss/40 text-moss"
    : t.kind === "err"
    ? "bg-rust/10 border-rust/40 text-rust"
    : "bg-amber/10 border-amber/40 text-amber";
  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`pointer-events-auto rounded-xl border-2 ${styles} backdrop-blur-md bg-ink-soft/95 px-4 py-3 shadow-2xl flex items-start gap-3`}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-paper">{t.title}</div>
        {t.body && <div className="text-[12.5px] text-paper-dim mt-0.5 leading-[1.45]">{t.body}</div>}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-paper-faint hover:text-paper -mt-1">
        <X size={13} />
      </button>
    </motion.div>
  );
}

// Optional: subscribe to in-app notifications poll → fire toasts
export function NotificationToaster({ pollMs = 30_000 }: { pollMs?: number }) {
  const { info } = useToast();
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const r = await fetch("/api/me/notifications", { credentials: "include" });
        if (!r.ok) return;
        const j = await r.json();
        if (!active) return;
        for (const n of (j.notifications || [])) {
          if (n.read_at || seen.has(n.id)) continue;
          info(n.title, n.body);
          setSeen((s) => { const ns = new Set(s); ns.add(n.id); return ns; });
        }
      } catch {}
    }
    poll();
    const t = setInterval(poll, pollMs);
    return () => { active = false; clearInterval(t); };
  }, [pollMs, info, seen]);

  return null;
}
