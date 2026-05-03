"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCheck, Inbox, AlertCircle, Mail, CreditCard, MessageSquare, Cpu, Sparkles, X } from "lucide-react";

type Notification = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  url?: string | null;
  read_at: number | null;
  created_at: number;
};

const KIND_ICON: Record<string, any> = {
  email: Mail,
  billing: CreditCard,
  message: MessageSquare,
  agent: Cpu,
  alert: AlertCircle,
  default: Sparkles,
};

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ notifications: Notification[]; unread: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const r = await fetch("/api/me/notifications", { credentials: "include" });
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/api/me/notifications/read-all", { method: "POST", credentials: "include" });
      await load();
    } finally { setBusy(false); }
  }

  async function markRead(id: string) {
    try {
      await fetch(`/api/me/notifications/${id}/read`, { method: "POST", credentials: "include" });
      await load();
    } catch {}
  }

  const unread = data?.unread || 0;
  const items = data?.notifications || [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md text-paper-dim hover:text-paper hover:bg-ink-line/40 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell size={15} strokeWidth={1.6} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber text-ink text-[10px] font-medium flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[360px] sm:w-[400px] max-h-[70vh] bg-ink-soft border border-ink-line rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-ink-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-amber" />
                <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em] text-paper-dim">Notifications</span>
                {unread > 0 && <span className="text-[11px] text-amber">· {unread} unread</span>}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={busy}
                  className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-paper-dim hover:text-amber transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <CheckCheck size={11} /> Read all
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {!data ? (
                <div className="px-5 py-8 text-center text-paper-faint text-[13px]">Loading…</div>
              ) : items.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Inbox size={28} className="text-paper-faint mx-auto mb-3 opacity-50" />
                  <div className="text-paper-dim text-[14px] mb-1">All caught up</div>
                  <div className="text-paper-faint text-[12px]">No new notifications</div>
                </div>
              ) : (
                items.map((n) => {
                  const Icon = KIND_ICON[n.kind] || KIND_ICON.default;
                  const Wrapper: any = n.url ? Link : "div";
                  const wrapperProps = n.url ? { href: n.url } : {};
                  return (
                    <Wrapper
                      key={n.id}
                      {...wrapperProps}
                      onClick={() => {
                        if (!n.read_at) markRead(n.id);
                        if (n.url) setOpen(false);
                      }}
                      className={`block px-4 py-3 border-b border-ink-line/40 last:border-0 cursor-pointer hover:bg-ink-line/20 transition-colors ${!n.read_at ? "bg-amber/[0.03]" : ""}`}
                    >
                      <div className="flex gap-3">
                        <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
                          n.kind === "alert" ? "bg-rust/15 text-rust" :
                          n.kind === "billing" ? "bg-amber/15 text-amber" :
                          n.kind === "agent" ? "bg-emerald-500/15 text-emerald-400" :
                          "bg-ink-line/40 text-paper-dim"
                        }`}>
                          <Icon size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className={`text-[13.5px] leading-[1.4] ${!n.read_at ? "text-paper font-medium" : "text-paper-dim"}`}>{n.title}</div>
                            {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-amber shrink-0 mt-1.5" />}
                          </div>
                          {n.body && <div className="text-paper-faint text-[12.5px] mt-0.5 leading-[1.45] line-clamp-2">{n.body}</div>}
                          <div className="text-paper-faint text-[11px] mt-1 font-[family-name:var(--font-mono)]">{timeAgo(n.created_at)}</div>
                        </div>
                      </div>
                    </Wrapper>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-4 py-2.5 border-t border-ink-line bg-ink/40">
                <Link
                  href="/app/profile#notifications"
                  onClick={() => setOpen(false)}
                  className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-paper-dim hover:text-amber"
                >
                  View all →
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
