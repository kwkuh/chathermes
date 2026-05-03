"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PoweredByChatHermes } from "@/app/_components/powered-by";

function LoginInner() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const sp = useSearchParams();
  const hasPrompt = typeof window !== "undefined" && sessionStorage.getItem("ch:first-prompt");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? "request failed");
      if (j.dev_link) setDevLink(j.dev_link);
      setState("sent");
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="py-7">
        <div className="mx-auto max-w-[1080px] px-7 flex justify-between items-center">
          <Link href="/" className="font-[family-name:var(--font-fraunces)] font-semibold text-[22px] tracking-tight">
            <span className="text-amber mr-1.5">⚭</span>ChatHermes
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center">
        <div className="mx-auto max-w-[480px] px-7 w-full">
          {hasPrompt && (
            <div className="mb-6 p-4 bg-ink-soft border border-ink-line rounded-md">
              <div className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-amber uppercase tracking-wider mb-1.5">your task is queued</div>
              <p className="text-paper-dim text-[13.5px]">We&apos;ll hand it to your agent the moment you sign in.</p>
            </div>
          )}

          <h1 className="font-[family-name:var(--font-fraunces)] font-medium text-[clamp(32px,5vw,46px)] leading-[1.05] tracking-[-0.02em]">
            <em className="not-italic italic text-amber">{hasPrompt ? "Almost there." : "Sign in."}</em>
          </h1>
          <p className="text-paper-dim mt-4 text-[16px]">
            Drop your email. We send a magic link. No password to forget.
          </p>

          {state !== "sent" ? (
            <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
              <input
                type="email" required autoFocus
                placeholder="you@somewhere.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-ink-soft border border-ink-line rounded-md text-paper placeholder:text-paper-dim focus:outline-none focus:border-amber transition-colors"
              />
              <button
                type="submit" disabled={state === "sending"}
                className="px-5 py-3.5 rounded-md bg-amber text-ink font-medium text-[15px] hover:bg-amber-soft transition-colors disabled:opacity-50"
              >
                {state === "sending" ? "Sending..." : "Send magic link →"}
              </button>
              {state === "error" && (
                <div className="text-rust text-[13px] font-[family-name:var(--font-jetbrains-mono)]">{err}</div>
              )}
            </form>
          ) : (
            <div className="mt-8 p-5 bg-ink-soft border border-ink-line rounded-md">
              <div className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-amber uppercase tracking-wider mb-2">link sent</div>
              <p className="text-paper text-[15px]">Check <span className="text-amber">{email}</span> for a sign-in link.</p>
              {devLink && (
                <div className="mt-4 pt-4 border-t border-ink-line">
                  <div className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-paper-dim uppercase tracking-wider mb-1.5">dev mode — click directly:</div>
                  <a href={devLink} className="text-amber text-[13px] underline font-[family-name:var(--font-jetbrains-mono)] break-all">{devLink}</a>
                </div>
              )}
            </div>
          )}

          <p className="mt-10 text-paper-dim text-[13px] font-[family-name:var(--font-jetbrains-mono)]">
            <Link href="/" className="hover:text-paper transition-colors">← back home</Link>
          </p>
        </div>
      </div>
    <PoweredByChatHermes variant="auth" />
      </main>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div />}>
      <LoginInner />
    </Suspense>
  );
}
