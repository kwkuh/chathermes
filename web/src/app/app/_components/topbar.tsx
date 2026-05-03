"use client";
import { Search, Bell, Menu, LogOut } from "lucide-react";
import { UpgradeCTA, UpgradeCTAMobile } from "./upgrade-cta";
import { CreditMini } from "./credit-pill";
import { NotificationBell } from "./notifications-dropdown";
import ThemeToggle from "@/app/_components/theme-toggle";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThinkingMascot } from "@/app/_components/interactive-image";

type User = { email: string };
type Tenant = { id: string; status: string; port: number } | null;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  running: { label: "agent online", color: "bg-moss" },
  hibernated: { label: "agent sleeping", color: "bg-paper-dim" },
  error: { label: "agent error", color: "bg-rust" },
  created: { label: "agent provisioning", color: "bg-amber" },
};

export default function Topbar({ user, tenant, onMenu, onSearch }: { user: User; tenant: Tenant; onMenu: () => void; onSearch?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = tenant
    ? STATUS_LABEL[tenant.status] ?? { label: tenant.status, color: "bg-paper-dim" }
    : { label: "no agent yet", color: "bg-paper-faint" };

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    window.location.href = "/";
  }

  return (
    <div className="h-[56px] sm:h-[60px] border-b border-ink-line-soft bg-ink/80 backdrop-blur-sm flex items-center px-3 sm:px-7 gap-2 sm:gap-5 shrink-0">
      <button
        onClick={onMenu}
        className="p-2 rounded-md text-paper-dim hover:text-paper hover:bg-ink-line/40 transition-colors"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-2.5 min-w-0">
        {tenant?.status === "running" ? (
          <ThinkingMascot size={20} />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${status.color}`} />
        )}
        <span className="font-[family-name:var(--font-mono)] text-[12.5px] sm:text-[13px] text-paper-dim uppercase tracking-[0.12em] truncate">
          {status.label}
        </span>
      </div>

      <button
        onClick={onSearch}
        className="flex-1 max-w-[420px] mx-auto relative hidden sm:flex items-center gap-2.5 pl-3 pr-2 py-2 bg-ink-soft border border-ink-line rounded-md text-paper-faint hover:border-amber/40 hover:text-paper-dim transition-colors text-[14.5px]"
        aria-label="Search (⌘K)"
      >
        <Search size={14} strokeWidth={1.7} />
        <span className="flex-1 text-left">Search messages, memory, projects…</span>
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] border border-ink-line rounded px-1.5 py-0.5">⌘K</span>
      </button>

      {/* Mobile: just an icon button */}
      <button onClick={onSearch} className="sm:hidden p-2 rounded-md text-paper-dim hover:text-paper hover:bg-ink-line/40" aria-label="Search">
        <Search size={16} />
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <UpgradeCTA />
        <UpgradeCTAMobile />
        <ThemeToggle />
        <NotificationBell />
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-1.5 rounded-md text-paper-dim hover:text-paper hover:bg-ink-line/40 transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-amber/15 border border-amber/40 flex items-center justify-center text-amber text-[12.5px] font-medium uppercase">
              {(user.email?.[0] ?? "?")}
            </span>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-[240px] bg-ink-soft border border-ink-line rounded-xl shadow-2xl z-20 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-ink-line">
                    <div className="text-paper text-[14.5px] truncate">{user.email}</div>
                    <CreditMini />
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[14.5px] text-paper-dim hover:text-rust hover:bg-rust/5 transition-colors"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
