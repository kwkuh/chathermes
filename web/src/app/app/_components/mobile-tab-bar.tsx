"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare, Code2, Brain, Activity, MoreHorizontal,
  Sparkles, Clock4, Plug, KeyRound, Webhook, UserCircle,
  CreditCard, Settings2, LogOut, Cloud, Cpu, Shield,
  LayoutDashboard, Users, Server, Boxes, Database, Mail, X
} from "lucide-react";

type User = { email: string; role?: "user" | "admin" };

interface Props {
  user: User;
  onSearch?: () => void;
}

// 4 primary tabs + More — thumb-zone optimized
const TABS = [
  { href: "/app", label: "Chat", icon: MessageSquare, exact: true },
  { href: "/app/projects", label: "Build", icon: Code2 },
  { href: "/app/memory", label: "Memory", icon: Brain },
  { href: "/app/billing", label: "Plan", icon: CreditCard },
];

const MORE_USER = [
  { href: "/app/skills", label: "Skills", icon: Sparkles },
  { href: "/app/schedules", label: "Schedules", icon: Clock4 },
  { href: "/app/connectors", label: "Connectors", icon: Plug },
  { href: "/app/api-keys", label: "API keys", icon: KeyRound },
  { href: "/app/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/app/profile", label: "Profile", icon: UserCircle },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];

const MORE_ADMIN = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/private-agents", label: "Private Agents", icon: Cpu },
  { href: "/admin/hetzner", label: "Hetzner Cloud", icon: Cloud },
  { href: "/admin/llm", label: "LLM Providers", icon: Sparkles },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/email", label: "Email", icon: Mail },
  { href: "/admin/database", label: "Database", icon: Database },
  { href: "/admin/system", label: "System", icon: Server },
  { href: "/admin/tenants", label: "Tenants", icon: Boxes },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/sessions", label: "Sessions", icon: Shield },
];

export function MobileTabBar({ user }: Props) {
  const pathname = usePathname() || "/app";
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch {}
    window.location.href = "/";
  }

  return (
    <>
      {/* Bottom tab bar — fixed, only visible on mobile/tablet (< lg) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-ink/95 backdrop-blur-md border-t border-ink-line"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="grid grid-cols-5 px-1 pt-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors ${
                  active ? "text-amber" : "text-paper-faint"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
                <span className={`text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em] ${active ? "font-medium" : ""}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md transition-colors ${
              moreOpen || pathname.startsWith("/admin") || ["/app/skills","/app/schedules","/app/connectors","/app/api-keys","/app/webhooks","/app/profile","/app/settings"].some(p => pathname.startsWith(p))
                ? "text-amber" : "text-paper-faint"
            }`}
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-[0.06em]">More</span>
          </button>
        </div>
      </nav>

      {/* Bottom sheet — More options */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMoreOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-ink-soft border-t border-ink-line rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
            >
              {/* Grab handle */}
              <div className="pt-2.5 pb-1 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-ink-line" />
              </div>

              {/* Header */}
              <div className="px-5 pt-2 pb-4 border-b border-ink-line flex items-center justify-between">
                <div>
                  <div className="font-[family-name:var(--font-display)] text-[20px] tracking-[-0.01em]">More</div>
                  <div className="text-paper-faint text-[12.5px] truncate max-w-[60vw]">{user.email}</div>
                </div>
                <button onClick={() => setMoreOpen(false)} className="p-2 -mr-2 rounded-md text-paper-dim hover:text-paper">
                  <X size={18} />
                </button>
              </div>

              {/* User features grid */}
              <div className="overflow-y-auto flex-1 pb-4">
                <div className="px-5 pt-4 pb-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-paper-faint">
                  — workspace
                </div>
                <div className="px-3 grid grid-cols-3 gap-2">
                  {MORE_USER.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all ${
                          active
                            ? "bg-amber/10 border-amber/40 text-amber"
                            : "bg-ink/40 border-ink-line text-paper-dim hover:text-paper hover:border-ink-line"
                        }`}
                      >
                        <Icon size={22} strokeWidth={1.6} />
                        <span className="text-[11.5px] text-center leading-tight">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {user.role === "admin" && (
                  <>
                    <div className="px-5 pt-6 pb-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-amber">
                      — admin
                    </div>
                    <div className="px-3 grid grid-cols-3 gap-2">
                      {MORE_ADMIN.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMoreOpen(false)}
                            className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border transition-all ${
                              active
                                ? "bg-amber/10 border-amber/40 text-amber"
                                : "bg-ink/40 border-ink-line text-paper-dim hover:text-paper"
                            }`}
                          >
                            <Icon size={20} strokeWidth={1.6} />
                            <span className="text-[11px] text-center leading-tight">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Sign out */}
                <div className="mt-6 px-3">
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rust/10 border border-rust/30 text-rust hover:bg-rust/20 transition-colors text-[14px] font-medium"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
