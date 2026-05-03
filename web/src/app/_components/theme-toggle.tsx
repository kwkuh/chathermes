"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("ch:theme")) as Theme | null;
    const initial: Theme = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ch:theme", next);
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-md text-paper-dim hover:text-paper hover:bg-ink-line/40 transition-colors"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <Moon size={15} strokeWidth={1.7} /> : <Sun size={15} strokeWidth={1.7} />}
    </button>
  );
}
