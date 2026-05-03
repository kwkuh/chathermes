"use client";
import { useEffect, useState } from "react";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import { ToastProvider, NotificationToaster } from "@/app/_components/toast";
import { SearchModal, useSearchHotkey } from "./search-modal";
import { OnboardingWizard } from "./onboarding";
import { MobileTabBar } from "./mobile-tab-bar";
import { PoweredByChatHermes } from "@/app/_components/powered-by";

type Props = { user: any; tenant: any; children: React.ReactNode };

export default function AppShell({ user, tenant, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useSearchHotkey(setSearchOpen);

  useEffect(() => {
    try { setDesktopCollapsed(localStorage.getItem("ch:sidebar") === "collapsed"); } catch {}
    // ch:theme-applied — ensure theme attribute is set on mount, removed on unmount
    try {
      const t = localStorage.getItem("ch:theme");
      if (t === "light") document.documentElement.dataset.theme = "light";
    } catch {}
    return () => {
      // Strip theme so non-dashboard routes (landing, auth/login, /dev) stay dark
      delete document.documentElement.dataset.theme;
    };
  }, []);

  function toggleSidebar() {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileOpen((v) => !v);
    } else {
      setDesktopCollapsed((v) => {
        const next = !v;
        try { localStorage.setItem("ch:sidebar", next ? "collapsed" : "expanded"); } catch {}
        return next;
      });
    }
  }

  return (
    <ToastProvider>
      <div className="h-screen flex">
        <Sidebar user={user} open={mobileOpen} onClose={() => setMobileOpen(false)} desktopCollapsed={desktopCollapsed} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar user={user} tenant={tenant} onMenu={toggleSidebar} onSearch={() => setSearchOpen(true)} />
          <main className="flex-1 overflow-auto"><div className="lg:pb-0" style={{ paddingBottom: "calc(78px + env(safe-area-inset-bottom, 0))" }}>
          {children}
          <PoweredByChatHermes variant="footer" className="border-t border-ink-line-soft mt-8" />
        </div></main>
        </div>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <OnboardingWizard />
      <NotificationToaster />
      <MobileTabBar user={user} />
    </ToastProvider>
  );
}
