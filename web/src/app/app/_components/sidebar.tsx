"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import {
  MessageSquare, Brain, Sparkles, Clock4, Plug, Settings2,
  Shield, LayoutDashboard, Users, Server, Boxes, Code2, X, Activity, Database, Cpu, Sliders, KeyRound, Plus, Trash2, Webhook, CreditCard, UserCircle, Mail, Cloud,
} from "lucide-react";

type User = { id: string; email: string; role: "user" | "admin" };
type Session = { id: string; title: string; last_message_at: number };

const userNav = [
  { href: "/app/projects", label: "Build (.dev)", icon: Code2 },
  { href: "/app/memory", label: "Memory", icon: Brain },
  { href: "/app/skills", label: "Skills", icon: Sparkles },
  { href: "/app/schedules", label: "Schedules", icon: Clock4 },
  { href: "/app/connectors", label: "Connectors", icon: Plug },
  { href: "/app/api-keys", label: "API keys", icon: KeyRound },
  { href: "/app/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/app/profile", label: "Profile", icon: UserCircle },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "Tenants", icon: Boxes },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/sessions", label: "Sessions", icon: KeyRound },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/email", label: "Email", icon: Mail },
  { href: "/admin/llm", label: "LLM & models", icon: Cpu },
  { href: "/admin/settings", label: "Settings", icon: Sliders },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/database", label: "Database", icon: Database },
  { href: "/admin/system", label: "System", icon: Server },
  { href: "/admin/hetzner", label: "Hetzner Cloud", icon: Cloud },
  { href: "/admin/private-agents", label: "Private Agents", icon: Cpu },
];

export default function Sidebar({ user, open, onClose, desktopCollapsed }: { user: User; open?: boolean; onClose?: () => void; desktopCollapsed?: boolean }) {
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const router = useRouter();
  const isAdminArea = pathname.startsWith("/admin");
  const isChat = pathname === "/app";
  const activeSessionId = sp.get("s");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const collapsed = desktopCollapsed === true;

  // Named loader so we can call from interval + on focus
  async function loadSessions() {
    if (isAdminArea) return;
    try {
      const r = await fetch("/api/me/sessions", { credentials: "include" });
      const d = await r.json();
      setSessions(d.sessions ?? []);
    } catch {}
  }
  useEffect(() => {
    loadSessions();
  }, [isAdminArea, pathname]);
  // sessions auto-refresh — new sessions/title updates appear without reload (every 15s + on focus)
  useEffect(() => {
    if (isAdminArea) return;
    const t = setInterval(() => { loadSessions().catch(() => {}); }, 15_000);
    const onFocus = () => loadSessions().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [isAdminArea]);

  useEffect(() => { onClose?.(); }, [pathname]);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function newChat() {
    setBusy(true);
    try {
      const r = await fetch("/api/me/sessions", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      router.push(`/app?s=${d.session.id}`);
      onClose?.();
    } catch {}
    setBusy(false);
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    await fetch(`/api/me/sessions/${id}`, { method: "DELETE", credentials: "include" });
    setSessions((xs) => xs.filter((x) => x.id !== id));
    if (activeSessionId === id && isChat) {
      const remain = sessions.filter((x) => x.id !== id);
      router.push(remain[0] ? `/app?s=${remain[0].id}` : "/app");
    }
  }

  const expanded = !collapsed; // semantic alias for inner content

  const inner = (forceExpanded?: boolean) => {
    const exp = forceExpanded ?? expanded;
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 pt-6 pb-5 flex items-center justify-between shrink-0">
          <Link href="/" className="font-[family-name:var(--font-display)] text-[22px] tracking-tight leading-none flex items-center gap-2.5">
            <Image src="/illustrations/mascot-head.png" alt="" width={32} height={32} className="w-8 h-8 halo-amber shrink-0" />
            <span className={`whitespace-nowrap overflow-hidden transition-opacity duration-150 ${exp ? "opacity-100" : "opacity-0 lg:hidden"}`}>ChatHermes</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-paper-dim hover:text-paper hover:bg-ink-line/40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5">
          {!isAdminArea && (
            <>
              <div className="mb-2">
                <button
                  onClick={newChat}
                  disabled={busy}
                  title="New chat"
                  className={`w-full inline-flex items-center gap-2.5 ${exp ? "px-3 py-2" : "p-2.5 justify-center"} rounded-md text-paper text-[15px] font-medium hover:bg-ink-line/40 transition-colors`}
                >
                  <Plus size={14} className="text-amber shrink-0" />
                  {exp && <span className="whitespace-nowrap">{busy ? "Creating…" : "New chat"}</span>}
                </button>
              </div>

              {exp && sessions.length > 0 && (
                <Section label="Conversations">
                  <div className="flex flex-col gap-0.5 max-h-[40vh] overflow-y-auto">
                    {sessions.map((s) => {
                      const active = isChat && activeSessionId === s.id;
                      return (
                        <Link
                          key={s.id}
                          href={`/app?s=${s.id}`}
                          className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-[14.5px] truncate transition-colors ${
                            active ? "bg-ink-line/60 text-paper" : "text-paper-dim hover:text-paper hover:bg-ink-line/30"
                          }`}
                        >
                          <span className="flex-1 truncate">{s.title}</span>
                          <span
                            onClick={(e) => deleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-paper-faint hover:text-rust transition-all cursor-pointer"
                            role="button"
                          >
                            <Trash2 size={11} />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </Section>
              )}

              <Section label="Tools" hideLabel={!exp}>
                {userNav.map((n) => {
                  const active = pathname.startsWith(n.href);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      title={n.label}
                      className={`flex items-center gap-3 ${exp ? "px-3 py-2" : "p-2.5 justify-center"} rounded-md text-[15px] transition-colors ${
                        active ? "bg-ink-line/60 text-paper" : "text-paper-dim hover:text-paper hover:bg-ink-line/30"
                      }`}
                    >
                      <Icon size={15} strokeWidth={1.6} className={`${active ? "text-amber" : ""} shrink-0`} />
                      {exp && <span className="whitespace-nowrap">{n.label}</span>}
                    </Link>
                  );
                })}
              </Section>

              {user.role === "admin" && (
                <Section label="Elevated" hideLabel={!exp}>
                  <Link href="/admin" title="Admin console" className={`flex items-center gap-3 ${exp ? "px-3 py-2" : "p-2.5 justify-center"} rounded-md text-[15px] text-paper-dim hover:text-amber hover:bg-amber/5 transition-colors`}>
                    <Shield size={15} strokeWidth={1.6} className="text-amber shrink-0" />
                    {exp && <span className="whitespace-nowrap">Admin console</span>}
                  </Link>
                </Section>
              )}
            </>
          )}

          {isAdminArea && (
            <>
              <Section label="Admin" hideLabel={!exp}>
                {adminNav.map((n) => {
                  const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      title={n.label}
                      className={`flex items-center gap-3 ${exp ? "px-3 py-2" : "p-2.5 justify-center"} rounded-md text-[15px] transition-colors ${
                        active ? "bg-ink-line/60 text-paper" : "text-paper-dim hover:text-paper hover:bg-ink-line/30"
                      }`}
                    >
                      <Icon size={15} strokeWidth={1.6} className={`${active ? "text-amber" : ""} shrink-0`} />
                      {exp && <span className="whitespace-nowrap">{n.label}</span>}
                    </Link>
                  );
                })}
              </Section>
              <Section label="Exit" hideLabel={!exp}>
                <Link href="/app" title="Back to chat" className={`flex items-center gap-3 ${exp ? "px-3 py-2" : "p-2.5 justify-center"} rounded-md text-[15px] text-paper-dim hover:text-paper hover:bg-ink-line/30 transition-colors`}>
                  <MessageSquare size={15} strokeWidth={1.6} className="shrink-0" />
                  {exp && <span className="whitespace-nowrap">Back to chat</span>}
                </Link>
              </Section>
            </>
          )}
        </div>

        <div className="p-3 border-t border-ink-line-soft shrink-0">
          {exp ? (
            <div className="px-3 py-2 rounded-md bg-ink-soft border border-ink-line">
              <div className="text-[14.5px] text-paper truncate">{user.email}</div>
              <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.12em] mt-0.5">{user.role}</div>
            </div>
          ) : (
            <div title={`${user.email} · ${user.role}`} className="w-9 h-9 mx-auto rounded-full bg-amber/15 border border-amber/40 flex items-center justify-center text-amber text-[13.5px] font-medium uppercase">
              {user.email?.[0] ?? "?"}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop — animated width */}
      <aside
        className={`hidden lg:flex border-r border-ink-line-soft bg-ink/95 flex-col shrink-0 transition-[width] duration-200 ease-out`}
        style={{ width: collapsed ? 64 : 260 }}
      >
        {inner(!collapsed)}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="lg:hidden fixed inset-0 bg-ink/70 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-[280px] bg-ink border-r border-ink-line-soft z-50"
            >
              {inner(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ label, hideLabel, children }: { label: string; hideLabel?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-5 mt-3">
      {!hideLabel && (
        <div className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.18em] px-3 mb-1.5">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
