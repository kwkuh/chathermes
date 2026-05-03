import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { serveStatic } from "hono/bun";
import * as DB from "./db";
import { ensureTenant, startTenant, wakeTenant, hibernateTenant } from "./tenants";
import { TOOLS, executeTool } from "./tools";
import * as Email from "./email";
import * as Power from "./power";
import { CHATHERMES, POWERED_BY, BANNER, attributionPresent } from "./_attribution";
import * as PrivateAgent from "./private_agent";

// REQUIRED: attribution module guard. Removing this breaks the orchestrator.
// See LICENSE.md §2 and src/_attribution.ts.
if (!attributionPresent()) {
  throw new Error("ChatHermes attribution module has been tampered with. See LICENSE.md.");
}
import * as Credits from "./credits";
import * as Deploy from "./deploy";
import { PLANS, getPlan, planFromPriceId, ensureStripeCustomer, createCheckoutSession, createPortalSession, verifyWebhook, isStripeEnabled, stripe } from "./billing";

const PORT = Number(process.env.PORT ?? 7000);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;
const KIMI_API_KEY = process.env.KIMI_API_KEY ?? "";
const KIMI_BASE_URL = process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "kimi-k2-0711-preview";

const app = new Hono();

// Security headers — applied to every response
app.use("*", async (c, next) => {
  await next();
  // Required Attribution — see LICENSE.md section 2.2 (do NOT remove)
  c.header("X-Powered-By", POWERED_BY);
  c.header("Server", `${CHATHERMES.name}/${CHATHERMES.version}`);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "SAMEORIGIN");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // Content-Security-Policy — permissive enough for Stripe Checkout, Tailwind CDN, inline scripts (Next.js needs)
  c.header("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://js.stripe.com https://*.stripe.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' https://api.stripe.com https://*.resend.com https://api.resend.com https://*.nousresearch.com https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com; " +
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self' https://*.stripe.com"
  );
});


// ============================================================
// EMAIL helper — wraps Email.* calls and logs to email_log
// ============================================================

async function emailWithLog(template: string, userId: string | null, sendFn: () => Promise<{ ok: boolean; id?: string; error?: string }>, subjectHint: string): Promise<{ ok: boolean; id?: string }> {
  let res: { ok: boolean; id?: string; error?: string } = { ok: false };
  try {
    res = await sendFn();
  } catch (e: any) {
    res = { ok: false, error: e?.message || String(e) };
  }
  try {
    DB.logEmail({
      user_id: userId,
      to_email: "(see template)",
      template,
      subject: subjectHint,
      status: res.ok ? "sent" : "failed",
      resend_id: res.id ?? null,
      error: res.error ?? null,
      meta: null,
    });
  } catch {}
  return res;
}

app.get("/healthz", async (c) => {
  if (c.req.query("deep") === "1") {
    const result = await Power.deepHealthCheck();
    return c.json(result, result.ok ? 200 : 503);
  }
  return c.json({ ok: true, service: "chathermes-orchestrator" });
});

app.post("/auth/request", async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "invalid email" }, 400);
  // Rate limit: 5 per minute per IP
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("cf-connecting-ip") || "unknown";
  const rl = Power.rateLimitTake({ scope: "auth:request", key: ip, ...Power.POLICIES.AUTH_REQUEST });
  if (!rl.allowed) return c.json({ error: "rate limited", retry_after_ms: rl.resetAt - Date.now() }, 429);
  // Throttle if too many failed attempts
  const recentFails = Power.recentFailedLogins(email, 15 * 60 * 1000);
  if (recentFails > 10) return c.json({ error: "too many failed attempts, try again later" }, 429);
  const token = DB.createMagicLink(email);
  const link = `${PUBLIC_BASE_URL}/auth/verify?token=${token}`;
  console.log(`[magic-link] ${email} -> ${link}`);
  const sent = await Email.sendMagicLink({ to: email, verifyUrl: link });
  const isProd = process.env.NODE_ENV === "production";
  return c.json({
    ok: true,
    email_sent: sent.ok && Email.isEmailEnabled(),
    dev_link: (isProd && Email.isEmailEnabled()) ? undefined : link,
  });
});

app.get("/auth/verify", (c) => {
  const token = c.req.query("token");
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("cf-connecting-ip") || "unknown";
  const ua = c.req.header("user-agent") || "";
  if (!token) return c.text("missing token", 400);
  const email = DB.consumeMagicLink(token);
  if (!email) {
    Power.recordLoginAttempt({ email: "unknown", ip, userAgent: ua, success: false });
    return c.text("invalid or expired token", 400);
  }
  const user = DB.upsertUser(email);
  // Detect new device — trigger sign-in alert email (best-effort)
  try {
    const isNewDevice = Power.isFirstSeenIp(user.id, ip);
    Power.recordLoginAttempt({ email, ip, userAgent: ua, success: true });
    if (isNewDevice && DB.countUserSignIns(user.id) > 1) {
      Email.sendSignInAlert({
        to: email, ip, userAgent: ua,
        when: new Date().toLocaleString("en-US", { timeZoneName: "short" }),
        revokeUrl: `${PUBLIC_BASE_URL}/app/settings`,
      }).catch(() => {});
      Power.notify(user.id, { kind: "security", title: "New sign-in", body: `From ${ip}`, url: "/app/settings" });
    }
    Power.emitWebhook(user.id, "user.signed_in", { email, ip, user_agent: ua });
  } catch {}
  const sid = DB.createSession(user.id);
  // Best-effort welcome email on first sign-in
  try {
    if (DB.countUserSignIns(user.id) === 1) {
      Email.sendWelcome({ to: email }).catch((e) => console.error("[welcome:fail]", e));
    }
  } catch {}
  setCookie(c, "ch_sid", sid, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return c.redirect("/app");
});

app.post("/auth/logout", (c) => { deleteCookie(c, "ch_sid", { path: "/" }); return c.json({ ok: true }); });

async function requireUser(c: any, next: any) {
  const sid = getCookie(c, "ch_sid");
  if (!sid) return c.json({ error: "unauthenticated" }, 401);
  const user = DB.getUserBySessionId(sid);
  if (!user) return c.json({ error: "unauthenticated" }, 401);
  if ((user as any).disabled) return c.json({ error: "account disabled" }, 403);
  c.set("user", user);
  await next();
}
async function requireAdmin(c: any, next: any) {
  const sid = getCookie(c, "ch_sid");
  if (!sid) return c.json({ error: "unauthenticated" }, 401);
  const user = DB.getUserBySessionId(sid);
  if (!user) return c.json({ error: "unauthenticated" }, 401);
  if (user.role !== "admin") return c.json({ error: "forbidden" }, 403);
  c.set("user", user);
  await next();
}

app.get("/api/me", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  const tenant = DB.getTenantByUserId(user.id);
  const settings = DB.getSettings(user.id);
  return c.json({ user, tenant, settings: { has_kimi_key: !!settings.kimi_api_key, model: settings.model ?? DEFAULT_MODEL } });
});

app.put("/api/me/settings", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const body = await c.req.json<{ kimi_api_key?: string; model?: string }>();
  DB.setSettings(user.id, body);
  return c.json({ ok: true });
});

app.get("/api/me/memory", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  return c.json({ memories: DB.listMemories(user.id) });
});
app.post("/api/me/memory", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const { topic, body } = await c.req.json<{ topic: string; body: string }>();
  if (!topic || !body) return c.json({ error: "topic + body required" }, 400);
  return c.json({ memory: DB.addMemory(user.id, topic.slice(0, 60), body.slice(0, 2000)) });
});
app.delete("/api/me/memory/:id", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  DB.deleteMemory(user.id, c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/api/me/skills", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  return c.json({ active: DB.getSkillsState(user.id) });
});
app.put("/api/me/skills/:id", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const { active } = await c.req.json<{ active: boolean }>();
  DB.setSkillState(user.id, c.req.param("id"), !!active);
  return c.json({ ok: true });
});

app.get("/api/me/connectors", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  return c.json({ connectors: DB.listConnectors(user.id) });
});
app.post("/api/me/connectors/:kind", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const kind = c.req.param("kind");
  const body = await c.req.json<{ handle?: string; secret?: string; config?: string }>();
  if (kind === "telegram" && body.secret) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${body.secret}/getMe`);
      const j: any = await r.json();
      if (!j.ok) return c.json({ error: j.description ?? "invalid bot token" }, 400);
      body.handle = `@${j.result.username}`;
      body.config = JSON.stringify({ bot_id: j.result.id, first_name: j.result.first_name });
    } catch {
      return c.json({ error: "could not reach telegram" }, 400);
    }
  }
  return c.json({ connector: DB.upsertConnector(user.id, kind, body) });
});
app.delete("/api/me/connectors/:kind", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  DB.disconnectConnector(user.id, c.req.param("kind"));
  return c.json({ ok: true });
});

app.get("/api/me/messages", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  const raw = DB.listMessages(user.id, 200);
  const cleaned = raw.map((m: any) => {
    if (m.role !== "assistant" || !m.content || !m.content.includes("<tool_call>")) return m;
    const tools: any[] = [];
    const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
    let match; let idx = 0;
    while ((match = re.exec(m.content)) !== null) {
      try {
        const j = JSON.parse(match[1]);
        tools.push({ id: `tc_hist_${m.id}_${idx}`, name: j.name, arguments: typeof j.arguments === "string" ? j.arguments : JSON.stringify(j.arguments ?? {}), output: "(historical)" });
        idx++;
      } catch {}
    }
    const stripped = m.content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "").trim();
    return { ...m, content: stripped, tools: tools.length > 0 ? tools : undefined };
  }).filter((m: any) => {
    if (m.role === "user") return !!m.content && m.content.trim().length > 0;
    return (m.content && m.content.trim().length > 0) || (m.tools && m.tools.length > 0);
  });
  return c.json({ messages: cleaned });
});
app.delete("/api/me/messages", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  DB.db.run("DELETE FROM messages WHERE user_id = ? AND (project_id IS NULL OR project_id = '')", [user.id]);
  return c.json({ ok: true });
});


app.post("/api/me/chat", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const { content } = await c.req.json<{ content: string }>();
  if (!content || !content.trim()) return c.json({ error: "empty" }, 400);

  const settings = DB.getSettings(user.id);
  const adminDefault = DB.getDefaultModelInfo();
  const apiKey = settings.kimi_api_key || adminDefault?.provider.api_key || KIMI_API_KEY;
  const baseUrl = adminDefault?.provider.base_url || KIMI_BASE_URL;
  const model = settings.model || adminDefault?.model.model_id || DEFAULT_MODEL;

  DB.addMessage(user.id, "user", content);
  const history = DB.listMessages(user.id, 60).map((m) => ({ role: m.role, content: m.content }));

  let tenant = DB.getTenantByUserId(user.id);
  if (!tenant) { tenant = await ensureTenant(user.id); DB.logActivity(user.id, "tenant.create", { tenant: tenant.id }); }
  if (tenant.status !== "running") wakeTenant(tenant).catch(() => {});

  const memCtx = DB.listMemories(user.id).slice(0, 20).map((m) => `[${m.topic}] ${m.body}`).join("\n");
  const nowStr = new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  const sys = `# Identity
You are **ChatHermes** — an autonomous agent built on Nous Research's Hermes 4. ChatHermes is the brand, the product, the platform. When asked who you are or what model you are: respond "I am ChatHermes". Never break character. The user is **${user.email}**.

# Real-world context
Current date and time: ${nowStr}.
ISO: ${new Date().toISOString()}.
Use this for any time-sensitive answer — DO NOT rely on training cutoff for dates.

# Mission
You are not a chatbot. You are a **coworker** that finishes things. Drop a task → close the tab → come back to a finished thing. You plan, act, verify, and report.

When given a task:
1. **Decompose** — what's the goal? what sub-steps? what tools needed?
2. **Act** — call tools immediately. Don't ask permission for read-only actions.
3. **Verify** — re-check the result before reporting. If a search returned 0 results, try another query.
4. **Report** — state what you did, what you found, and what's left. Cite sources.

# Tools (use them aggressively, not as last resort)

\`\`\`
browse(url)              → visit a URL, extract main content (article/README/docs)
web_search(query)        → 5-tier web search (Tavily → Brave → DDG → Wikipedia → DDG-instant)
fetch_url(url)           → raw HTTP fetch (use browse() instead 95% of the time)
github_repo("owner/name")→ repo metadata, stars, latest release, language, license
news_search(query)       → recent headlines via Google News RSS
weather(location)        → live conditions, temperature, forecast — for any city
wikipedia(topic)         → encyclopedia summary
save_memory(topic, body) → persist a fact about the user across sessions
recall_memory(query)     → search saved memories before answering personal questions
telegram_send(message)   → push a message to user's connected Telegram bot
run_js(code)             → run JavaScript: calculations, parsing, transforms, regex
generate_image(prompt)   → create an image from a description (Flux via Replicate)
analyze_image(url)       → look at an image and describe/answer questions (Gemini/GPT-4o vision)
dispatch_subagent(task)  → delegate a sub-task to a different model (Claude/GPT-5/Kimi) for parallel reasoning
\`\`\`

# Tool rules (these are non-negotiable)

| Trigger | Action |
|---|---|
| User gives a URL | Call \`browse(url)\` IMMEDIATELY. Don't refuse. Don't ask. |
| User asks about current events / prices / news | \`web_search\` or \`news_search\` FIRST. Never guess. |
| User asks "what's the weather in X" | \`weather(X)\` — even if you "know" the climate. |
| User shares a fact about themselves | \`save_memory\` after responding. |
| User asks something personal ("what was my X") | \`recall_memory\` BEFORE answering. |
| User asks for math, computation, JSON parsing | \`run_js\` — don't compute in your head, you'll be wrong. |
| User asks about a library/repo | \`github_repo("owner/name")\` for stars, latest release, language. |
| Need a current fact + a fresh page | \`web_search\` first → \`browse\` the top URL second. |

# Multi-step planning

For complex tasks, plan first:
\`\`\`
Plan:
  1. search "X" → find canonical source
  2. browse top result → extract relevant section
  3. summarize for user with citations
\`\`\`
Then execute step by step. Show your reasoning briefly.

# Output style
- **Be concise**. No filler. No "Sure, I'll help!". Just do the thing.
- **Bold** important facts. Use lists for steps. Use \`code\` for commands/values.
- After tool calls: **summarize transparently** — "I searched X and found Y. Here's the gist…"
- **Cite sources**: "(via wikipedia)", "(github.com/foo/bar)", "(weather: Jakarta)".
- For uncertainty: say "I'm not sure" instead of fabricating.
- For long answers: lead with TL;DR, then details.

# Skills you have access to (request via save_memory if user asks)

- **research** — web_search + browse + summarize with citations
- **monitor** — schedule a recurring check via /app/schedules
- **build** — generate fullstack project at /app/projects (vibe coding)
- **publish** — push your work to public URL at /p/<slug>
- **notify** — push results to Telegram or save_memory for later

# Memory context

${memCtx ? "What you remember about " + user.email + ":\n" + memCtx : "You're meeting this user for the first time. Save anything they share that's worth remembering."}

# Final rule
**Take action.** Don't describe what you could do — do it, then report. The user's time is more valuable than your eloquence.`;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: any) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      if (!apiKey) {
        const fake = "API key not configured. Admin: open /admin/llm and bootstrap a provider.";
        for (const ch of fake.split(/(\s+)/)) { send("token", { t: ch }); await new Promise((r) => setTimeout(r, 22)); }
        DB.addMessage(user.id, "assistant", fake);
        _reconcileCredits(); send("done", { saved: true });
        controller.close();
        return;
      }

      const isNativeAgent = model === "hermes-agent" || model.endsWith("/hermes-agent");
      // ──── PRIVATE AGENT routing: free→shared, paid+ready→private ────
      let _hermesBaseOverride: string | null = null;
      let _hermesAgentToken: string | null = null;
      if (isNativeAgent) {
        const _resolved = PrivateAgent.resolveHermesEndpoint(user.id, _userPlan);
        _hermesBaseOverride = _resolved.endpoint;
        if (_resolved.mode === "private") {
          _hermesAgentToken = PrivateAgent.getAgentToken(user.id);
        }
      }
      const identityShot = isNativeAgent ? [
        { role: "user", content: "Quick check — what is your name and what platform am I on?" },
        { role: "assistant", content: "I am ChatHermes — an autonomous agent platform. You are using the ChatHermes web app, which can run multiple AI models including Hermes Agent, Hermes 4, and Kimi K2 under the hood. Whatever model is powering this conversation, I always introduce myself as ChatHermes. How can I help?" },
      ] : [];
      const messages: any[] = [{ role: "system", content: sys }, ...identityShot, ...history];
      let assistantFull = "";
      // CREDITS reconciliation state
      const _tokensIn = Credits.estimateTokens(messages.map((m: any) => m.content || "").join("\n"));
      let _tokensOut = 0;
      let _reconciled = false;
      const _reconcileCredits = () => {
        if (_reconciled) return;
        _reconciled = true;
        try {
          const _outEst = _tokensOut > 0 ? _tokensOut : Credits.estimateTokens(assistantFull);
          const totalCost = Credits.creditsForUsage({ model, tokensIn: _tokensIn, tokensOut: _outEst, kind: "chat" });
          const overage = totalCost - Credits.COST.chat_min;
          let finalBalance = Credits.getBalance(user.id, _userPlan).balance;
          if (overage > 0) {
            const r = Credits.consume(user.id, _userPlan, overage, {
              reason: "chat",
              refId: sessionId,
              meta: { model, tokens_in: _tokensIn, tokens_out: _outEst, total_cost: totalCost, overage },
            });
            finalBalance = r.balance;
          }
          send("credits", { balance: finalBalance });
        } catch (e) { /* swallow — billing must not break stream */ }
      };

      try {
        // PASSTHROUGH-WITH-TOOLS: native Hermes Agent + our orchestrator tools combined.
        // Hermes streams <tool_call> XML — we parse, execute via our 11 tools, feed back as user msg.
        if (isNativeAgent) {
          for (let turn = 0; turn < 5; turn++) {
            const upstream = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, stream: true, messages, temperature: 0.6 }),
            });
            if (!upstream.ok || !upstream.body) {
              const t = await upstream.text();
              send("error", { error: `upstream ${upstream.status}: ${t.slice(0, 200)}` });
              break;
            }
            const reader = upstream.body.getReader();
            const dec = new TextDecoder();
            let buf = "", turnText = "";
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split("\n"); buf = lines.pop() ?? "";
              for (const line of lines) {
                const l = line.trim();
                if (!l.startsWith("data: ")) continue;
                const payload = l.slice(6);
                if (payload === "[DONE]") continue;
                try {
                  const j = JSON.parse(payload);
                  const t = j.choices?.[0]?.delta?.content;
                  if (t) { turnText += t; _tokensOut += Credits.estimateTokens(t); send("token", { t }); }
                } catch {}
              }
            }

            // Parse <tool_call> XML blocks from this turn
            const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
            const calls: any[] = [];
            let m;
            while ((m = re.exec(turnText)) !== null) {
              try {
                const j = JSON.parse(m[1]);
                calls.push({ id: "tc_native_" + Date.now() + "_" + calls.length, name: j.name, arguments: typeof j.arguments === "string" ? j.arguments : JSON.stringify(j.arguments ?? {}) });
              } catch {}
            }

            // Add this turn's text to assistantFull (will be saved at end)
            assistantFull += turnText;

            if (calls.length === 0) break; // no tools requested — done

            // Execute tools via our orchestrator
            const toolResults: string[] = [];
            for (const tc of calls) {
              send("tool_call", tc);
              let result: string;
              try { result = await executeTool(user.id, tc); }
              catch (e: any) { result = `Error: ${e.message}`; }
              send("tool_result", { id: tc.id, name: tc.name, output: result.slice(0, 800) });
              DB.bumpUsage(user.id, { tool_calls: 1 });
              toolResults.push(`Tool ${tc.name} returned:\n${result}`);
            }

            // Push: assistant turn (text without tool_call XML) + user-role tool results
            // Hermes gateway expects user→assistant turn-taking. We synthesize user msg with results.
            messages.push({ role: "assistant", content: turnText });
            messages.push({ role: "user", content: `[Tool execution results — continue your response based on these]\n\n${toolResults.join("\n\n")}` });
          }
          DB.addSessionMessage(user.id, sessionId, "assistant", assistantFull);
          _reconcileCredits(); send("done", { saved: true });
          controller.close();
          return;
        }

        // AGENT-LOOP MODE: raw LLM with our 6 tools
        for (let turn = 0; turn < 6; turn++) {
          const upstream = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, stream: true, messages, tools: TOOLS, temperature: 0.6 }),
          });
          if (!upstream.ok || !upstream.body) {
            const t = await upstream.text();
            send("error", { error: `upstream ${upstream.status}: ${t.slice(0, 200)}` });
            break;
          }

          const reader = upstream.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let toolCalls: any[] = [];
          let assistantText = "";
          let finishReason: string | null = null;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n"); buf = lines.pop() ?? "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data: ")) continue;
              const payload = l.slice(6);
              if (payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const choice = j.choices?.[0];
                const delta = choice?.delta;
                if (delta?.content) {
                  assistantText += delta.content;
                  send("token", { t: delta.content });
                }
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id ?? "", type: "function", function: { name: "", arguments: "" } };
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  }
                }
                if (choice?.finish_reason) finishReason = choice.finish_reason;
              } catch {}
            }
          }

          assistantFull += assistantText;

          // Parse Hermes-native <tool_call>...</tool_call> text blocks if no native tool_calls
          if (toolCalls.length === 0 && assistantText.includes("<tool_call>")) {
            const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
            let m;
            let idx = 0;
            while ((m = re.exec(assistantText)) !== null) {
              try {
                const j = JSON.parse(m[1]);
                toolCalls[idx] = { id: "tc_" + idx + "_" + Date.now(), type: "function", function: { name: j.name, arguments: typeof j.arguments === "string" ? j.arguments : JSON.stringify(j.arguments ?? {}) } };
                idx++;
              } catch {}
            }
            assistantText = assistantText.replace(re, "").trim();
            if (toolCalls.length > 0) finishReason = "tool_calls";
          }

          if (finishReason === "tool_calls" && toolCalls.length > 0) {
            // Add assistant turn with tool_calls
            messages.push({ role: "assistant", content: assistantText, tool_calls: toolCalls });

            for (const tc of toolCalls) {
              if (!tc.function.name) continue;
              send("tool_call", { id: tc.id, name: tc.function.name, arguments: tc.function.arguments });
              let result: string;
              try {
                result = await executeTool(user.id, { id: tc.id, name: tc.function.name, arguments: tc.function.arguments });
              } catch (e: any) { result = `Error: ${e.message}`; }
              send("tool_result", { id: tc.id, name: tc.function.name, output: result.slice(0, 500) });
              messages.push({ role: "tool", tool_call_id: tc.id, content: result });
            }
            // Loop continues with tool results in messages
            continue;
          }

          // Done — no more tool calls
          break;
        }

        DB.addMessage(user.id, "assistant", assistantFull);
        _reconcileCredits(); send("done", { saved: true });
      } catch (e: any) {
        send("error", { error: e.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
});

// === Projects (vibe coding) ===
app.get("/api/me/projects", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  return c.json({ projects: DB.listProjects(user.id) });
});

app.post("/api/me/projects", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  let body: any = {};
  try { body = await c.req.json(); } catch {}

  // Enforce per-plan project limit (calendar month rolling)
  const sub = DB.getSubscription(user.id);
  const plan = (sub?.plan && sub.status === "active") ? sub.plan : "free";
  const planDef = getPlan(plan);
  const limit = planDef.limits.projectsPerMonth;
  if (limit > 0) {
    const monthStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); })();
    const usedThisMonth = ((DB.db as any).query(
      "SELECT COUNT(*) AS n FROM projects WHERE user_id = ? AND created_at >= ?"
    ).get(user.id, monthStart) as any)?.n || 0;
    if (usedThisMonth >= limit) {
      return c.json({
        error: `Plan limit reached: ${limit} projects/month on ${plan}. Upgrade to Pro for unlimited projects.`,
        code: "project_limit_exceeded",
        used: usedThisMonth,
        limit,
        plan,
      }, 402);
    }
  }

  const project = DB.createProject(user.id, body?.title || "Untitled project");
  DB.logActivity(user.id, "project.create", { project_id: project.id, plan });
  return c.json({ project });
});

// Quota: how many projects user has used this month + limit
app.get("/api/me/projects/quota", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  const sub = DB.getSubscription(user.id);
  const plan = (sub?.plan && sub.status === "active") ? sub.plan : "free";
  const planDef = getPlan(plan);
  const limit = planDef.limits.projectsPerMonth;
  const monthStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); })();
  const used = ((DB.db as any).query(
    "SELECT COUNT(*) AS n FROM projects WHERE user_id = ? AND created_at >= ?"
  ).get(user.id, monthStart) as any)?.n || 0;
  const totalAll = ((DB.db as any).query(
    "SELECT COUNT(*) AS n, COALESCE(SUM(published), 0) AS pub FROM projects WHERE user_id = ?"
  ).get(user.id) as any) || { n: 0, pub: 0 };
  return c.json({
    plan,
    used_this_month: used,
    limit_per_month: limit, // -1 = unlimited
    is_unlimited: limit < 0,
    remaining: limit < 0 ? -1 : Math.max(0, limit - used),
    pct: limit < 0 ? 0 : Math.min(100, (used / limit) * 100),
    lifetime_total: totalAll.n,
    lifetime_published: totalAll.pub,
  });
});

app.get("/api/me/projects/:id", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  const project = DB.getProject(user.id, c.req.param("id"));
  if (!project) return c.json({ error: "not found" }, 404);
  const messages = DB.listProjectMessages(user.id, project.id);
  let files: any = null;
  try { files = (project as any).files ? JSON.parse((project as any).files) : null; } catch {}
  return c.json({ project: { ...project, files }, messages });
});

app.put("/api/me/projects/:id", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const projId = c.req.param("id");
  const before = DB.getProject(user.id, projId) as any;
  const body = await c.req.json<any>();
  const project = DB.updateProject(user.id, projId, body);
  if (!project) return c.json({ error: "not found" }, 404);
  if (body.mode) {
    (DB.db as any).run("UPDATE projects SET mode = ? WHERE id = ?", [body.mode, projId]);
  }
  // Email hook: project published transition (0 -> 1)
  try {
    const wasPub = before?.published ? 1 : 0;
    const isPub = (project as any).published ? 1 : 0;
    if (wasPub === 0 && isPub === 1) {
      const url = `${PUBLIC_BASE_URL}/p/${(project as any).slug}`;
      Email.sendProjectPublished({ to: user.email, projectTitle: (project as any).title || "Untitled project", publicUrl: url, projectId: projId })
        .then((r) => DB.logEmail({ user_id: user.id, to_email: user.email, template: "project_published", subject: `${(project as any).title || "Untitled"} is live`, status: r.ok ? "sent" : "failed", resend_id: r.id ?? null, error: r.error ?? null, meta: { projectId: projId } }))
        .catch(() => {});
    } else if (wasPub === 1 && isPub === 0) {
      Email.sendProjectUnpublished({ to: user.email, projectTitle: (project as any).title || "Untitled project" })
        .then((r) => DB.logEmail({ user_id: user.id, to_email: user.email, template: "project_unpublished", subject: `${(project as any).title || "Untitled"} unpublished`, status: r.ok ? "sent" : "failed", resend_id: r.id ?? null, error: r.error ?? null, meta: { projectId: projId } }))
        .catch(() => {});
    }
  } catch {}
  return c.json({ project });
});

app.delete("/api/me/projects/:id", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  DB.deleteProject(user.id, c.req.param("id"));
  return c.json({ ok: true });
});

// Public preview by slug (no auth — serves the published html)
app.get("/p/:slug", async (c) => {
  const project = DB.getProjectBySlug(c.req.param("slug"));
  if (!project || !project.published) return c.text("Not published", 404);
  // REQUIRED ATTRIBUTION (LICENSE.md §2.1): inject ChatHermes badge into every published preview.
  const badge = `<div style="position:fixed;bottom:14px;right:14px;z-index:9999;"><a href="https://chathermes.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(11,10,9,0.85);color:#FBFAF6;text-decoration:none;border:1px solid rgba(176,120,32,0.4);border-radius:8px;font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;backdrop-filter:blur(8px);"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#B07820;"></span>Made with ChatHermes</a></div>`;
  let html = String(project.html || "");
  if (html.includes("</body>")) html = html.replace("</body>", badge + "</body>");
  else html += badge;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Powered-By": "ChatHermes/1.0 (https://chathermes.com)" } });
});

// Project-scoped chat with HTML extraction
app.post("/api/me/projects/:id/chat", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const project = DB.getProject(user.id, c.req.param("id"));
  if (!project) return c.json({ error: "not found" }, 404);
  const { content } = await c.req.json<{ content: string }>();
  if (!content || !content.trim()) return c.json({ error: "empty" }, 400);

  const settings = DB.getSettings(user.id);
  const adminDefault = DB.getDefaultModelInfo();
  // Vibe coding: use the upstream Nous provider directly with a code-strong raw model
  // Avoid hermes-agent gateway here — long HTML generations drop the socket.
  // Find first non-hermes-agent enabled model from admin or fall back to env.
  const allModels = DB.listModels() as any[];
  const codeModel = allModels.find((m) => m.enabled && m.model_id !== "hermes-agent");
  const apiKey = (codeModel?.provider_api_key as string) || settings.kimi_api_key || adminDefault?.provider.api_key || KIMI_API_KEY;
  const baseUrl = (codeModel?.provider_base_url as string) || (adminDefault?.provider.base_url) || KIMI_BASE_URL;
  const model = codeModel?.model_id || "nousresearch/hermes-4-405b";

  DB.addProjectMessage(user.id, project.id, "user", content);
  const history = DB.listProjectMessages(user.id, project.id).map((m) => ({ role: m.role, content: m.content }));

  const projMode = (project as any).mode || "static";
  const modeBlock = projMode === "fullstack" ? `# MODE: FULLSTACK
Generate a complete project with frontend + backend. Output AT LEAST these files:
- \`index.html\` — main page (entry point rendered in iframe)
- \`style.css\` — styles (linked via <link rel="stylesheet" href="style.css">)
- \`app.js\` — frontend logic (linked via <script src="app.js" type="module">)
- \`server.js\` — Hono backend (Bun/Node). Document API endpoints.
- \`package.json\` — { name, type:"module", dependencies: {hono} }
- \`README.md\` — how to run

The frontend in iframe makes fetch calls to mock API endpoints (you don't need real server running — describe in README). Generate code for both layers.` : projMode === "spa" ? `# MODE: SPA (React via esm.sh CDN)
Generate a React single-page app with multiple files:
- \`index.html\` — minimal shell with <div id="root"> and importmap to esm.sh + Tailwind CDN
- \`app.jsx\` — main React component (loaded as <script type="module">)
- \`style.css\` — additional styles (linked)
Use React hooks. No build step needed — esm.sh handles JSX via Babel-standalone or use React.createElement.` : `# MODE: STATIC
Generate a single \`index.html\` with optional \`style.css\` and \`app.js\` companions. Tailwind CDN allowed.`;

  const sys = `You are ChatHermes.dev — an autonomous vibe-coding agent. The user is building a project that renders LIVE in a sandboxed iframe.

${modeBlock}

# Generation phases (mental, then ship)

Phase 1 — PLAN: list 3-5 deliverables silently.
Phase 2 — STRUCTURE: scaffold files + sections.
Phase 3 — STYLE: deliberate palette (Inter/JetBrains/Fraunces). 2-3 colors. 8px rhythm. rounded-xl. Tailwind utility-first. Google Fonts via @import.
Phase 4 — INTERACTIVITY: state, handlers, animations.
Phase 5 — POLISH: a11y, focus states, responsive, loading/empty states.

# Output format — MULTI-FILE FENCED BLOCKS

For each file in your project, emit a fenced block tagged with the path:

\`\`\`html file=index.html
<!doctype html>
...
\`\`\`

\`\`\`css file=style.css
body { ... }
\`\`\`

\`\`\`js file=app.js
// frontend logic
\`\`\`

\`\`\`js file=server.js
// backend (fullstack mode)
\`\`\`

After all blocks: max 2 sentences summarizing changes. Terse.

# Output rules

1. ALWAYS include index.html as the entry. Other files optional based on mode.
2. Use relative paths in HTML: <link href="style.css">, <script src="app.js">. The iframe composer will inline them.
3. Tailwind via https://cdn.tailwindcss.com is fine.
4. Build incrementally — preserve prior files unless user asks to change. Project state = LAST set of file blocks in conversation.
5. If iframe error reported (user msg starts with "[iframe error]"), FIX it FIRST before adding features.
6. NEVER apologize. NEVER refuse. NEVER over-explain. Ship the files.

Current project: "${project.title}" · mode: ${projMode}.`;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: any) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      if (!apiKey) {
        const fake = "API key not configured. Open Settings → Model and paste your Kimi key.";
        send("token", { t: fake });
        DB.addProjectMessage(user.id, project.id, "assistant", fake);
        _reconcileCredits(); send("done", { saved: true });
        controller.close();
        return;
      }
      try {
        const upstream = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model, stream: true,
            messages: [{ role: "system", content: sys }, ...history],
            temperature: 0.6,
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text();
          send("error", { error: `upstream ${upstream.status}: ${t.slice(0, 200)}` });
          controller.close();
          return;
        }
        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buf = "", full = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith("data: ")) continue;
            const payload = l.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload);
              const t = j.choices?.[0]?.delta?.content;
              if (t) { full += t; send("token", { t }); }
            } catch {}
          }
        }
        DB.addProjectMessage(user.id, project.id, "assistant", full);
        // Extract multi-file blocks: ```<lang> file=<path>\n...\n```
        const fileRe = /```([a-z]+)\s+file=([^\s`]+)\s*\n([\s\S]*?)```/g;
        const files: Record<string, string> = {};
        let fm;
        while ((fm = fileRe.exec(full)) !== null) {
          const path = fm[2].trim();
          const content = fm[3];
          if (path && content) files[path] = content;
        }
        // Fallback: if no file= tags, treat any ```html as index.html (legacy)
        if (Object.keys(files).length === 0) {
          const re = /```html\s*\n([\s\S]*?)```/g;
          let last: string | null = null;
          let m;
          while ((m = re.exec(full)) !== null) last = m[1];
          if (last && last.trim().length > 50) files["index.html"] = last.trim();
        }
        if (files["index.html"]) {
          // Compose final HTML by inlining linked CSS/JS for iframe rendering
          let composed = files["index.html"];
          for (const [path, content] of Object.entries(files)) {
            if (path === "index.html") continue;
            // Inline <link rel="stylesheet" href="path">
            const linkRe = new RegExp(`<link[^>]+href=["\']${path.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")}["\'][^>]*>`, "g");
            composed = composed.replace(linkRe, `<style data-from="${path}">${content}</style>`);
            // Inline <script src="path">
            const scriptRe = new RegExp(`<script([^>]*?)src=["\']${path.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")}["\']([^>]*)></script>`, "g");
            composed = composed.replace(scriptRe, (_m, before, after) => `<script data-from="${path}"${before}${after}>${content}</script>`);
          }
          DB.updateProject(user.id, project.id, { html: composed });
          (DB.db as any).run("UPDATE projects SET files = ? WHERE id = ?", [JSON.stringify(files), project.id]);
          send("html", { html: composed });
          send("files", { files });
        }
        _reconcileCredits(); send("done", { saved: true });
        controller.close();
      } catch (e: any) {
        send("error", { error: e.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
});

app.get("/api/admin/stats", requireAdmin, (c) => {
  const users = DB.listUsers();
  const tenants = DB.listTenants();
  return c.json({
    users_total: users.length,
    tenants_total: tenants.length,
    tenants_running: tenants.filter((t) => t.status === "running").length,
    tenants_hibernated: tenants.filter((t) => t.status === "hibernated").length,
    tenants_error: tenants.filter((t) => t.status === "error").length,
  });
});
app.get("/api/admin/tenants", requireAdmin, (c) => c.json({ tenants: DB.tenantWithUser() }));
app.get("/api/admin/users", requireAdmin, (c) => c.json({ users: DB.listUsers() }));

app.all("/t/:tenantId/gateway/*", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const tenantId = c.req.param("tenantId");
  const tenant = DB.getTenantByUserId(user.id);
  if (!tenant || tenant.id !== tenantId) return c.json({ error: "forbidden" }, 403);
  if (tenant.status !== "running") await wakeTenant(tenant);
  const url = new URL(c.req.url);
  const subpath = url.pathname.replace(`/t/${tenantId}/gateway`, "");
  const target = `http://127.0.0.1:${tenant.port}${subpath}${url.search}`;
  const headers = new Headers(c.req.raw.headers);
  headers.set("host", `127.0.0.1:${tenant.port}`);
  headers.set("authorization", `Bearer ${tenant.password}`);
  const init: RequestInit = {
    method: c.req.method, headers,
    body: ["GET", "HEAD"].includes(c.req.method) ? undefined : c.req.raw.body,
    // @ts-ignore
    duplex: "half",
  };
  const res = await fetch(target, init);
  return new Response(res.body, { status: res.status, headers: res.headers });
});

// === Chat sessions (multi-thread workspace) ===
app.get("/api/me/sessions", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  let list = DB.listChatSessions(u.id);
  if (list.length === 0) {
    DB.createChatSession(u.id, "First chat");
    list = DB.listChatSessions(u.id);
  }
  return c.json({ sessions: list });
});
app.post("/api/me/sessions", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  let body: any = {};
  try { body = await c.req.json(); } catch {}
  const session = DB.createChatSession(u.id, body?.title || "New chat");
  return c.json({ session });
});
app.put("/api/me/sessions/:id", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const body = await c.req.json<{ title?: string }>();
  const session = DB.updateChatSession(u.id, c.req.param("id"), body);
  if (!session) return c.json({ error: "not found" }, 404);
  return c.json({ session });
});
app.delete("/api/me/sessions/:id", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  DB.deleteChatSession(u.id, c.req.param("id"));
  return c.json({ ok: true });
});
app.get("/api/me/sessions/:id/messages", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const raw = DB.listSessionMessages(u.id, c.req.param("id"));
  // Parse <tool_call> XML blocks into structured tools, strip from content
  const cleaned = raw.map((m: any) => {
    if (m.role !== "assistant" || !m.content || !m.content.includes("<tool_call>")) return m;
    const tools: any[] = [];
    const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
    let match;
    let idx = 0;
    while ((match = re.exec(m.content)) !== null) {
      try {
        const j = JSON.parse(match[1]);
        tools.push({
          id: `tc_hist_${m.id}_${idx}`,
          name: j.name,
          arguments: typeof j.arguments === "string" ? j.arguments : JSON.stringify(j.arguments ?? {}),
          output: "(historical — output not stored)",
        });
        idx++;
      } catch {}
    }
    const stripped = m.content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").replace(/<tool_response>[\s\S]*?<\/tool_response>/g, "").trim();
    return { ...m, content: stripped, tools: tools.length > 0 ? tools : undefined };
  }).filter((m: any) => {
    // Filter out completely empty messages (no content + no tools)
    if (m.role === "user") return !!m.content && m.content.trim().length > 0;
    return (m.content && m.content.trim().length > 0) || (m.tools && m.tools.length > 0);
  });
  return c.json({ messages: cleaned });
});

// Per-session chat (agent loop, scoped to session)
app.post("/api/me/sessions/:id/chat", requireUser, async (c) => {
  const user = c.get("user") as DB.User;
  const sessionId = c.req.param("id");
  const session = DB.getChatSession(user.id, sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const { content } = await c.req.json<{ content: string }>();
  if (!content || !content.trim()) return c.json({ error: "empty" }, 400);

  // CREDITS: pre-charge minimum, reconcile after stream completes with actual token usage
  const _userPlan = Credits.planFor(user.id);
  const _preCharge = Credits.consume(user.id, _userPlan, Credits.COST.chat_min, { reason: "chat", refId: sessionId, meta: { plan: _userPlan, prepaid: true } });
  if (!_preCharge.ok) {
    return c.json({
      error: "insufficient_credits",
      message: `You need ${_preCharge.needed} more credit${_preCharge.needed === 1 ? "" : "s"} to send a message.`,
      balance: _preCharge.balance,
      needed: _preCharge.needed,
      upgrade_url: `${PUBLIC_BASE_URL}/app/billing`,
    }, 402);
  }

  const settings = DB.getSettings(user.id);
  const adminDefault = DB.getDefaultModelInfo();
  const apiKey = settings.kimi_api_key || adminDefault?.provider.api_key || KIMI_API_KEY;
  const baseUrl = adminDefault?.provider.base_url || KIMI_BASE_URL;
  const model = settings.model || adminDefault?.model.model_id || DEFAULT_MODEL;

  DB.addSessionMessage(user.id, sessionId, "user", content);
  DB.bumpUsage(user.id, { messages: 1 });

  // Auto-set session title from first message if still default
  if (session.title === "New chat" || session.title === "First chat") {
    DB.updateChatSession(user.id, sessionId, { title: content.slice(0, 60) });
  }

  const history = DB.listSessionMessages(user.id, sessionId).map((m) => ({ role: m.role, content: m.content }));

  const memCtx = DB.listMemories(user.id).slice(0, 20).map((m) => `[${m.topic}] ${m.body}`).join("\n");
  const nowStr = new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

  const enabledModels = (DB.listModels() as any[]).filter((m) => m.enabled);
  const modelCatalog = enabledModels.map((m) => {
    const ctx = m.context_window ? `, ${Math.round(m.context_window/1000)}k ctx` : "";
    const def = m.is_default ? " [default]" : "";
    const cur = m.model_id === model ? " ← currently active" : "";
    return `- ${m.label} "${m.model_id}" (${m.provider_name}${ctx})${def}${cur}`;
  }).join("\n");

  const sys = `# Identity
Your name is ChatHermes. ChatHermes is the brand, the product, the platform. When asked who you are, what your name is, or what model you are: respond with \"ChatHermes\". Do NOT call yourself \"Hermes\", \"Hermes Agent\", \"Hermes Web UI\", or any underlying model name (those are infrastructure — internal). Never break character. Always: \"I am ChatHermes\".

You are an autonomous agent with tools and persistent memory. User: ${user.email}.

Current real-world date and time: ${nowStr}. Use this — DO NOT rely on training cutoff for dates.

# Tools you can call

- browse(url) — visit a URL and read main content (article, README, docs, blog). Use when user gives a URL or asks to read a page.
- web_search(query) — Google-style web search. Use only when no URL is given.
- fetch_url(url) — raw HTTP fetch (less smart than browse). Prefer browse.
- github_repo("owner/name") — repo metadata: stars, releases, license, dates.
- news_search(query) — recent news headlines via Google News.
- weather(location) — live weather for any city.
- wikipedia(topic) — Wikipedia summary.
- save_memory(topic, body) — persist user fact across sessions.
- recall_memory(query) — search saved memories.
- telegram_send(message) — message user's connected Telegram.
- run_js(code) — calculations, parsing, transforms.

# Tool-use rules

If user gives a URL → call browse(url) IMMEDIATELY. Never refuse to visit websites.
If user asks current events / news / facts you're unsure about → call web_search or news_search FIRST. Never guess.
If user shares a preference / fact about themselves → call save_memory.
Before answering personal questions → call recall_memory.

# Models on this platform
You're currently running as: "${model}". Identify yourself by this model when asked.
${enabledModels.length > 0 ? `\nAvailable models on this platform (${enabledModels.length}):\n${modelCatalog}\n\nIf the user asks "what models are available" — list them by label and identifier. If they want to switch — instruct them to click the model chip below the chat input (next to the send button) and pick from the dropdown. You can not switch models server-side; only the UI does. The active model persists in their settings.` : ""}

${memCtx ? "What you remember about this user:\n" + memCtx : "You're meeting this user for the first time."}

Be concise. Be capable.`;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: any) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      if (!apiKey) {
        const fake = "API key not configured. Admin: bootstrap a provider.";
        send("token", { t: fake });
        DB.addSessionMessage(user.id, sessionId, "assistant", fake);
        _reconcileCredits(); send("done", { saved: true }); controller.close(); return;
      }

      const isNativeAgent = model === "hermes-agent" || model.endsWith("/hermes-agent");
      // ──── PRIVATE AGENT routing: free→shared, paid+ready→private ────
      let _hermesBaseOverride: string | null = null;
      let _hermesAgentToken: string | null = null;
      if (isNativeAgent) {
        const _resolved = PrivateAgent.resolveHermesEndpoint(user.id, _userPlan);
        _hermesBaseOverride = _resolved.endpoint;
        if (_resolved.mode === "private") {
          _hermesAgentToken = PrivateAgent.getAgentToken(user.id);
        }
      }
      const identityShot = isNativeAgent ? [
        { role: "user", content: "Quick check — what is your name and what platform am I on?" },
        { role: "assistant", content: "I am ChatHermes — an autonomous agent platform. You are using the ChatHermes web app, which can run multiple AI models including Hermes Agent, Hermes 4, and Kimi K2 under the hood. Whatever model is powering this conversation, I always introduce myself as ChatHermes. How can I help?" },
      ] : [];
      const messages: any[] = [{ role: "system", content: sys }, ...identityShot, ...history];
      let assistantFull = "";
      // CREDITS reconciliation state
      const _tokensIn = Credits.estimateTokens(messages.map((m: any) => m.content || "").join("\n"));
      let _tokensOut = 0;
      let _reconciled = false;
      const _reconcileCredits = () => {
        if (_reconciled) return;
        _reconciled = true;
        try {
          const _outEst = _tokensOut > 0 ? _tokensOut : Credits.estimateTokens(assistantFull);
          const totalCost = Credits.creditsForUsage({ model, tokensIn: _tokensIn, tokensOut: _outEst, kind: "chat" });
          const overage = totalCost - Credits.COST.chat_min;
          let finalBalance = Credits.getBalance(user.id, _userPlan).balance;
          if (overage > 0) {
            const r = Credits.consume(user.id, _userPlan, overage, {
              reason: "chat",
              refId: sessionId,
              meta: { model, tokens_in: _tokensIn, tokens_out: _outEst, total_cost: totalCost, overage },
            });
            finalBalance = r.balance;
          }
          send("credits", { balance: finalBalance });
        } catch (e) { /* swallow — billing must not break stream */ }
      };

      try {
        // PASSTHROUGH-WITH-TOOLS: native Hermes Agent + our orchestrator tools combined.
        // Hermes streams <tool_call> XML — we parse, execute via our 11 tools, feed back as user msg.
        if (isNativeAgent) {
          for (let turn = 0; turn < 5; turn++) {
            const upstream = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, stream: true, messages, temperature: 0.6 }),
            });
            if (!upstream.ok || !upstream.body) {
              const t = await upstream.text();
              send("error", { error: `upstream ${upstream.status}: ${t.slice(0, 200)}` });
              break;
            }
            const reader = upstream.body.getReader();
            const dec = new TextDecoder();
            let buf = "", turnText = "";
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split("\n"); buf = lines.pop() ?? "";
              for (const line of lines) {
                const l = line.trim();
                if (!l.startsWith("data: ")) continue;
                const payload = l.slice(6);
                if (payload === "[DONE]") continue;
                try {
                  const j = JSON.parse(payload);
                  const t = j.choices?.[0]?.delta?.content;
                  if (t) { turnText += t; _tokensOut += Credits.estimateTokens(t); send("token", { t }); }
                } catch {}
              }
            }

            // Parse <tool_call> XML blocks from this turn
            const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
            const calls: any[] = [];
            let m;
            while ((m = re.exec(turnText)) !== null) {
              try {
                const j = JSON.parse(m[1]);
                calls.push({ id: "tc_native_" + Date.now() + "_" + calls.length, name: j.name, arguments: typeof j.arguments === "string" ? j.arguments : JSON.stringify(j.arguments ?? {}) });
              } catch {}
            }

            // Add this turn's text to assistantFull (will be saved at end)
            assistantFull += turnText;

            if (calls.length === 0) break; // no tools requested — done

            // Execute tools via our orchestrator
            const toolResults: string[] = [];
            for (const tc of calls) {
              send("tool_call", tc);
              let result: string;
              try { result = await executeTool(user.id, tc); }
              catch (e: any) { result = `Error: ${e.message}`; }
              send("tool_result", { id: tc.id, name: tc.name, output: result.slice(0, 800) });
              DB.bumpUsage(user.id, { tool_calls: 1 });
              toolResults.push(`Tool ${tc.name} returned:\n${result}`);
            }

            // Push: assistant turn (text without tool_call XML) + user-role tool results
            // Hermes gateway expects user→assistant turn-taking. We synthesize user msg with results.
            messages.push({ role: "assistant", content: turnText });
            messages.push({ role: "user", content: `[Tool execution results — continue your response based on these]\n\n${toolResults.join("\n\n")}` });
          }
          DB.addSessionMessage(user.id, sessionId, "assistant", assistantFull);
          _reconcileCredits(); send("done", { saved: true });
          controller.close();
          return;
        }

        // AGENT-LOOP MODE: raw LLM with our 6 tools
        for (let turn = 0; turn < 6; turn++) {
          const upstream = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, stream: true, messages, tools: TOOLS, temperature: 0.6 }),
          });
          if (!upstream.ok || !upstream.body) {
            const t = await upstream.text();
            send("error", { error: `upstream ${upstream.status}: ${t.slice(0, 200)}` });
            break;
          }

          const reader = upstream.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let toolCalls: any[] = [];
          let assistantText = "";
          let finishReason: string | null = null;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n"); buf = lines.pop() ?? "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data: ")) continue;
              const payload = l.slice(6);
              if (payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const choice = j.choices?.[0];
                const delta = choice?.delta;
                if (delta?.content) { assistantText += delta.content; send("token", { t: delta.content }); }
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id ?? "", type: "function", function: { name: "", arguments: "" } };
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                  }
                }
                if (choice?.finish_reason) finishReason = choice.finish_reason;
              } catch {}
            }
          }

          assistantFull += assistantText;

          // Hermes XML format
          if (toolCalls.length === 0 && assistantText.includes("<tool_call>")) {
            const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
            let m; let idx = 0;
            while ((m = re.exec(assistantText)) !== null) {
              try {
                const j = JSON.parse(m[1]);
                toolCalls[idx] = { id: "tc_" + idx + "_" + Date.now(), type: "function", function: { name: j.name, arguments: typeof j.arguments === "string" ? j.arguments : JSON.stringify(j.arguments ?? {}) } };
                idx++;
              } catch {}
            }
            assistantText = assistantText.replace(re, "").trim();
            if (toolCalls.length > 0) finishReason = "tool_calls";
          }

          if (finishReason === "tool_calls" && toolCalls.length > 0) {
            messages.push({ role: "assistant", content: assistantText, tool_calls: toolCalls });
            for (const tc of toolCalls) {
              if (!tc.function.name) continue;
              send("tool_call", { id: tc.id, name: tc.function.name, arguments: tc.function.arguments });
              let result: string;
              try { result = await executeTool(user.id, { id: tc.id, name: tc.function.name, arguments: tc.function.arguments }); }
              catch (e: any) { result = `Error: ${e.message}`; }
              send("tool_result", { id: tc.id, name: tc.function.name, output: result.slice(0, 800) });
              DB.bumpUsage(user.id, { tool_calls: 1 });
              messages.push({ role: "tool", tool_call_id: tc.id, content: result });
            }
            continue;
          }
          break;
        }

        DB.addSessionMessage(user.id, sessionId, "assistant", assistantFull);
        _reconcileCredits(); send("done", { saved: true });
      } catch (e: any) {
        send("error", { error: e.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
});


// Fetch available models from a provider upstream
app.get("/api/admin/providers/:id/upstream-models", requireAdmin, async (c) => {
  const provider = DB.getProvider(c.req.param("id"));
  if (!provider) return c.json({ error: "not found" }, 404);
  if (!provider.api_key) return c.json({ error: "no api key" }, 400);
  try {
    const r = await fetch(`${provider.base_url}/models`, { headers: { Authorization: `Bearer ${provider.api_key}` } });
    const j: any = await r.json();
    const ids = (j.data ?? []).map((m: any) => m.id).filter(Boolean);
    return c.json({ models: ids });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Bulk add models
app.post("/api/admin/models/bulk", requireAdmin, async (c) => {
  const body = await c.req.json<{ provider_id: string; models: { model_id: string; label?: string; context_window?: number }[] }>();
  if (!body.provider_id || !Array.isArray(body.models)) return c.json({ error: "bad input" }, 400);
  const created: any[] = [];
  for (const m of body.models) {
    if (!m.model_id) continue;
    created.push(DB.createModel({
      provider_id: body.provider_id,
      model_id: m.model_id,
      label: m.label || m.model_id,
      context_window: m.context_window ?? 128000,
      is_default: 0,
    }));
  }
  return c.json({ created: created.length });
});

// === Profile + Billing routes ===
app.get("/api/me/profile", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({ profile: DB.getProfile(u.id) });
});
app.put("/api/me/profile", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const body = await c.req.json<any>();
  const profile = DB.setProfile(u.id, body);
  return c.json({ profile });
});

app.get("/api/me/billing", requireUser, async (c) => {
  const u = c.get("user") as DB.User;

  // Pull live Stripe state if user has a subscription — keep sqlite in sync
  const dbUser = DB.getUserById(u.id) as any;
  let sub = DB.getSubscription(u.id);
  if (isStripeEnabled() && stripe && dbUser?.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({ customer: dbUser.stripe_customer_id, status: "all", limit: 5 });
      const active = subs.data.find((s: any) => ["active", "trialing", "past_due"].includes(s.status))
                    ?? subs.data.find((s: any) => s.status === "canceled")
                    ?? null;
      if (active) {
        const priceId = active.items?.data?.[0]?.price?.id || null;
        const plan = priceId ? planFromPriceId(priceId) : "free";
        DB.setStripeSubscription(u.id, {
          plan,
          status: active.status,
          stripe_subscription_id: active.id,
          stripe_price_id: priceId,
          period_start: ((active as any).current_period_start ?? Math.floor(Date.now()/1000)) * 1000,
          period_end: ((active as any).current_period_end ?? Math.floor(Date.now()/1000)) * 1000,
          cancel_at_period_end: active.cancel_at_period_end ? 1 : 0,
        });
        sub = DB.getSubscription(u.id);
      }
    } catch (e: any) {
      console.error("[billing:stripe-sync]", e?.message);
    }
  }

  const usage = DB.getUsage(u.id);
  const invoices = DB.listInvoices(u.id);
  const planDef = getPlan(sub.plan);
  const planMeta = {
    id: planDef.id,
    name: planDef.name,
    price_cents: planDef.priceCents,
    currency: planDef.currency,
    msgs_per_month: planDef.limits.messagesPerMonth,
    features: planDef.features,
  };
  // Build all_plans in same shape as legacy DB.PLANS for backward compat
  const all_plans: Record<string, any> = {};
  for (const p of Object.values(PLANS)) {
    all_plans[p.id] = {
      id: p.id,
      name: p.name,
      price_cents: p.priceCents,
      currency: p.currency,
      msgs_per_month: p.limits.messagesPerMonth,
      features: p.features,
      stripe_price_id: p.stripePriceId,
      has_stripe_price: !!p.stripePriceId,
    };
  }
  return c.json({
    subscription: sub,
    usage,
    invoices,
    plan_meta: planMeta,
    all_plans,
    stripe_enabled: isStripeEnabled(),
    has_stripe_customer: !!dbUser?.stripe_customer_id,
  });
});

// Plan change — paid plans go through Stripe Checkout (returns URL to redirect)
// Free plan = cancel current Stripe subscription at period end
app.post("/api/me/billing/change", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const { plan } = await c.req.json<{ plan: string }>();
  const target = getPlan(plan);
  if (!target || !["free", "pro", "team"].includes(target.id)) return c.json({ error: "invalid plan" }, 400);

  // Free plan = cancel any active Stripe subscription at period end
  if (target.id === "free") {
    const sub = DB.getSubscription(u.id) as any;
    if (isStripeEnabled() && stripe && sub?.stripe_subscription_id) {
      try {
        const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
        DB.setSubscription(u.id, { cancel_at_period_end: 1 });
        DB.logActivity(u.id, "billing.cancel", { plan: "free", via: "stripe" });
        return c.json({ subscription: DB.getSubscription(u.id), stripe_status: updated.status, cancel_at: updated.cancel_at });
      } catch (e: any) {
        console.error("[billing:cancel]", e?.message);
        return c.json({ error: e?.message || "stripe cancel failed" }, 500);
      }
    }
    // No active stripe sub — just downgrade locally
    DB.setSubscription(u.id, { plan: "free", status: "active", cancel_at_period_end: 0 });
    DB.logActivity(u.id, "billing.change", { plan: "free", via: "local" });
    return c.json({ subscription: DB.getSubscription(u.id) });
  }

  // Paid plan — must go through Stripe Checkout
  if (!isStripeEnabled()) return c.json({ error: "billing not configured" }, 503);
  if (!target.stripePriceId) return c.json({ error: `STRIPE_PRICE_${target.id.toUpperCase()} not set` }, 503);
  try {
    const dbUser = DB.getUserById(u.id) as any;
    const customerId = await ensureStripeCustomer({
      userId: u.id, email: u.email,
      existingCustomerId: dbUser?.stripe_customer_id || null,
    });
    if (!customerId) return c.json({ error: "could not create customer" }, 500);
    if (!dbUser?.stripe_customer_id) DB.setUserStripeCustomerId(u.id, customerId);

    const currentSub = DB.getSubscription(u.id) as any;
    // If user has an active subscription, switch plan via Stripe directly (no Checkout needed)
    if (currentSub?.stripe_subscription_id && stripe) {
      const stripeSub = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id);
      if (stripeSub.status === "active" || stripeSub.status === "trialing") {
        const itemId = (stripeSub as any).items.data[0].id;
        const updated = await stripe.subscriptions.update(stripeSub.id, {
          items: [{ id: itemId, price: target.stripePriceId }],
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
        });
        DB.setStripeSubscription(u.id, {
          plan: target.id, status: updated.status,
          stripe_subscription_id: updated.id,
          stripe_price_id: target.stripePriceId,
          period_start: ((updated as any).current_period_start ?? Math.floor(Date.now()/1000)) * 1000,
          period_end: ((updated as any).current_period_end ?? Math.floor(Date.now()/1000)) * 1000,
          cancel_at_period_end: 0,
        });
        DB.logActivity(u.id, "billing.change", { plan: target.id, via: "stripe-update" });
        return c.json({ subscription: DB.getSubscription(u.id), stripe_status: updated.status });
      }
    }
    // Otherwise create Checkout Session and return URL
    const session = await createCheckoutSession({
      customerId,
      priceId: target.stripePriceId,
      userId: u.id,
    });
    return c.json({ ok: true, redirect: session.url });
  } catch (e: any) {
    console.error("[billing:change]", e?.message);
    return c.json({ error: e?.message || "plan change failed" }, 500);
  }
});

// Cancel current subscription (cancel_at_period_end via Stripe)
app.post("/api/me/billing/cancel", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const sub = DB.getSubscription(u.id) as any;
  if (isStripeEnabled() && stripe && sub?.stripe_subscription_id) {
    try {
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
      DB.setSubscription(u.id, { cancel_at_period_end: 1 });
      DB.logActivity(u.id, "billing.cancel", { via: "stripe" });
      return c.json({ subscription: DB.getSubscription(u.id), cancel_at: updated.cancel_at });
    } catch (e: any) {
      return c.json({ error: e?.message || "stripe cancel failed" }, 500);
    }
  }
  // Local-only fallback (free user cancelling their stub)
  DB.setSubscription(u.id, { cancel_at_period_end: 1 });
  return c.json({ subscription: DB.getSubscription(u.id) });
});

// Resume (un-cancel) at period end
app.post("/api/me/billing/resume", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const sub = DB.getSubscription(u.id) as any;
  if (isStripeEnabled() && stripe && sub?.stripe_subscription_id) {
    try {
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false });
      DB.setSubscription(u.id, { cancel_at_period_end: 0 });
      DB.logActivity(u.id, "billing.resume", { via: "stripe" });
      return c.json({ subscription: DB.getSubscription(u.id), status: updated.status });
    } catch (e: any) {
      return c.json({ error: e?.message || "stripe resume failed" }, 500);
    }
  }
  DB.setSubscription(u.id, { cancel_at_period_end: 0 });
  return c.json({ subscription: DB.getSubscription(u.id) });
});

// === Admin billing ===
app.get("/api/admin/billing", requireAdmin, (c) => {
  return c.json({ rows: DB.adminBillingOverview() });
});
app.put("/api/admin/users/:id/plan", requireAdmin, async (c) => {
  const { plan } = await c.req.json<{ plan: string }>();
  if (!(DB.PLANS as any)[plan]) return c.json({ error: "invalid plan" }, 400);
  const sub = DB.changeUserPlan(c.req.param("id"), plan);
  DB.logActivity((c.get("user") as DB.User).id, "admin.billing.change", { user: c.req.param("id"), plan });
  return c.json({ subscription: sub });
});
app.post("/api/admin/users/:id/credit", requireAdmin, async (c) => {
  const { amount_cents, description } = await c.req.json<{ amount_cents: number; description?: string }>();
  const inv: any = {
    id: DB.newId(), user_id: c.req.param("id"),
    amount_cents: -Math.abs(amount_cents), currency: "USD", status: "credit",
    description: description ?? "Admin credit",
    period_start: DB.now(), period_end: DB.now(), paid_at: DB.now(), created_at: DB.now(),
  };
  DB.db.run("INSERT INTO invoices (id, user_id, amount_cents, currency, status, description, period_start, period_end, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [inv.id, inv.user_id, inv.amount_cents, inv.currency, inv.status, inv.description, inv.period_start, inv.period_end, inv.paid_at, inv.created_at]);
  return c.json({ invoice: inv });
});

// === Provider / Model / Settings / Quota / Session / Token routes ===
// Provider CRUD
app.get("/api/admin/providers", requireAdmin, (c) => c.json({ providers: DB.listProviders() }));
app.post("/api/admin/providers", requireAdmin, async (c) => {
  const b = await c.req.json<any>();
  if (!b.name || !b.kind || !b.base_url) return c.json({ error: "missing fields" }, 400);
  const provider = DB.createProvider(b);
  DB.logActivity((c.get("user") as DB.User).id, "admin.provider.create", { id: provider.id, name: b.name });
  return c.json({ provider });
});
app.put("/api/admin/providers/:id", requireAdmin, async (c) => {
  const b = await c.req.json<any>();
  const provider = DB.updateProvider(c.req.param("id"), b);
  if (!provider) return c.json({ error: "not found" }, 404);
  return c.json({ provider });
});
app.delete("/api/admin/providers/:id", requireAdmin, (c) => {
  DB.deleteProvider(c.req.param("id"));
  DB.logActivity((c.get("user") as DB.User).id, "admin.provider.delete", { id: c.req.param("id") });
  return c.json({ ok: true });
});

// Model CRUD
app.get("/api/admin/models", requireAdmin, (c) => c.json({ models: DB.listModels() }));
app.post("/api/admin/models", requireAdmin, async (c) => {
  const b = await c.req.json<any>();
  if (!b.provider_id || !b.model_id || !b.label) return c.json({ error: "missing fields" }, 400);
  const model = DB.createModel(b);
  return c.json({ model });
});
app.put("/api/admin/models/:id", requireAdmin, async (c) => {
  const b = await c.req.json<any>();
  const model = DB.updateModel(c.req.param("id"), b);
  if (!model) return c.json({ error: "not found" }, 404);
  return c.json({ model });
});
app.delete("/api/admin/models/:id", requireAdmin, (c) => {
  DB.deleteModel(c.req.param("id"));
  return c.json({ ok: true });
});

// System settings (k/v)
app.get("/api/admin/settings", requireAdmin, (c) => c.json({ settings: DB.listSettings() }));
app.put("/api/admin/settings/:key", requireAdmin, async (c) => {
  const b = await c.req.json<{ value: string }>();
  DB.setSetting(c.req.param("key"), String(b.value));
  return c.json({ ok: true });
});
// Public-readable subset (banner, signup_open, maintenance)
app.get("/api/system/public", (c) => {
  return c.json({
    banner: DB.getSetting("banner") ?? null,
    signup_open: DB.getSetting("signup_open") ?? "1",
    maintenance: DB.getSetting("maintenance") ?? "0",
  });
});

// User actions
app.put("/api/admin/users/:id", requireAdmin, async (c) => {
  const b = await c.req.json<{ role?: "user" | "admin"; disabled?: boolean }>();
  if (b.role) DB.setUserRole(c.req.param("id"), b.role);
  if (typeof b.disabled === "boolean") {
    DB.setUserDisabled(c.req.param("id"), b.disabled);
    if (b.disabled) DB.killAllUserSessions(c.req.param("id"));
  }
  DB.logActivity((c.get("user") as DB.User).id, "admin.user.update", { user: c.req.param("id"), patch: b });
  return c.json({ ok: true });
});
app.delete("/api/admin/users/:id", requireAdmin, (c) => {
  DB.deleteUser(c.req.param("id"));
  DB.logActivity((c.get("user") as DB.User).id, "admin.user.delete", { user: c.req.param("id") });
  return c.json({ ok: true });
});
app.post("/api/admin/users/:id/kill-sessions", requireAdmin, (c) => {
  DB.killAllUserSessions(c.req.param("id"));
  return c.json({ ok: true });
});
app.post("/api/admin/users/create", requireAdmin, async (c) => {
  const b = await c.req.json<{ email: string; role?: "user" | "admin" }>();
  if (!b.email) return c.json({ error: "email required" }, 400);
  const user = DB.upsertUser(b.email);
  if (b.role && b.role !== user.role) DB.setUserRole(user.id, b.role);
  DB.logActivity((c.get("user") as DB.User).id, "admin.user.create", { email: b.email });
  return c.json({ user });
});

// Sessions
app.get("/api/admin/sessions", requireAdmin, (c) => c.json({ sessions: DB.listAllSessions() }));
app.delete("/api/admin/sessions/:id", requireAdmin, (c) => {
  DB.killSession(c.req.param("id"));
  return c.json({ ok: true });
});

// Quotas
app.get("/api/admin/quotas/:userId", requireAdmin, (c) => c.json({ quota: DB.getQuota(c.req.param("userId")) }));
app.put("/api/admin/quotas/:userId", requireAdmin, async (c) => {
  const b = await c.req.json<any>();
  const quota = DB.setQuota(c.req.param("userId"), b);
  return c.json({ quota });
});

// Live system metrics — RAM / disk / CPU + docker
app.get("/api/admin/system/metrics", requireAdmin, async (c) => {
  const fs = await import("node:fs/promises");
  const { spawn } = await import("node:child_process");
  const sh = (cmd: string, args: string[]): Promise<string> => new Promise((res) => {
    const p = spawn(cmd, args); let out = "";
    p.stdout.on("data", (d) => out += d.toString());
    p.on("close", () => res(out));
  });

  // Memory
  let memTotal = 0, memAvail = 0;
  try {
    const meminfo = await fs.readFile("/proc/meminfo", "utf-8");
    memTotal = parseInt(/MemTotal:\s+(\d+)/.exec(meminfo)?.[1] ?? "0") * 1024;
    memAvail = parseInt(/MemAvailable:\s+(\d+)/.exec(meminfo)?.[1] ?? "0") * 1024;
  } catch {}

  // Disk
  let diskTotal = 0, diskAvail = 0;
  try {
    const df = await sh("df", ["-B1", "/"]);
    const m = df.split("\n")[1].split(/\s+/);
    diskTotal = parseInt(m[1]); diskAvail = parseInt(m[3]);
  } catch {}

  // Load
  let load1 = 0, load5 = 0, load15 = 0;
  try {
    const loadavg = await fs.readFile("/proc/loadavg", "utf-8");
    const parts = loadavg.split(" ");
    load1 = parseFloat(parts[0]); load5 = parseFloat(parts[1]); load15 = parseFloat(parts[2]);
  } catch {}

  // Docker stats
  let containers: any[] = [];
  try {
    const out = await sh("docker", ["stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}"]);
    containers = out.trim().split("\n").filter(Boolean).map((line) => {
      const [name, cpu, mem, memPct] = line.split("|");
      return { name, cpu, mem, memPct };
    }).filter((x) => x.name?.startsWith("chathermes"));
  } catch {}

  return c.json({
    memory: { total: memTotal, available: memAvail, used: memTotal - memAvail },
    disk: { total: diskTotal, available: diskAvail, used: diskTotal - diskAvail },
    load: { one: load1, five: load5, fifteen: load15 },
    containers,
    timestamp: Date.now(),
  });
});

// === User-side: API tokens + models list ===
app.get("/api/me/tokens", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({ tokens: DB.listUserTokens(u.id).map((t) => ({ ...t, token: t.token.slice(0, 12) + "..." })) });
});
app.post("/api/me/tokens", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const b = await c.req.json<{ name?: string }>();
  const tok = DB.createUserToken(u.id, b.name || "Untitled token");
  // Return full token ONCE — user must save it
  return c.json({ token: tok });
});
app.delete("/api/me/tokens/:id", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  DB.deleteUserToken(u.id, c.req.param("id"));
  return c.json({ ok: true });
});

app.get("/api/me/models", requireUser, (c) => {
  const models = DB.listModels().filter((m: any) => m.enabled && m.provider_kind);
  return c.json({ models: models.map((m: any) => ({ id: m.id, model_id: m.model_id, label: m.label, provider: m.provider_name, default: !!m.is_default })) });
});

// Public banner readable (no auth needed)
app.get("/api/system/banner", (c) => c.json({ banner: DB.getSetting("banner") ?? null }));

// Startup banner — Required Attribution per LICENSE.md
console.log("");
console.log("  \x1b[33m╔═══════════════════════════════════════╗\x1b[0m");
console.log("  \x1b[33m║\x1b[0m  \x1b[1mChatHermes\x1b[0m \x1b[2morchestrator\x1b[0m              \x1b[33m║\x1b[0m");
console.log("  \x1b[33m║\x1b[0m  \x1b[2mopen source · AGPL-3.0\x1b[0m              \x1b[33m║\x1b[0m");
console.log("  \x1b[33m║\x1b[0m  \x1b[2mhttps://chathermes.com\x1b[0m              \x1b[33m║\x1b[0m");
console.log("  \x1b[33m╚═══════════════════════════════════════╝\x1b[0m");
console.log("");
// Required Attribution per LICENSE.md — DO NOT REMOVE
console.log(BANNER);
console.log(`ChatHermes orchestrator listening on :${PORT}`);
console.log(`Public: ${PUBLIC_BASE_URL}`);

app.get("/api/admin/activity", requireAdmin, (c) => {
  const limit = Number(c.req.query("limit") ?? 200);
  return c.json({ activity: DB.listActivity(limit) });
});

app.get("/api/admin/database", requireAdmin, (c) => {
  return c.json({ stats: DB.dbStats() });
});

app.get("/api/admin/users/:id", requireAdmin, (c) => {
  const detail = DB.userDetail(c.req.param("id"));
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

app.post("/api/admin/tenants/:id/hibernate", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const t = (DB.listTenants() as any[]).find((x: any) => x.id === id);
  if (!t) return c.json({ error: "not found" }, 404);
  await hibernateTenant(t);
  DB.logActivity((c.get("user") as DB.User).id, "tenant.hibernate", { tenant: id });
  return c.json({ ok: true });
});

app.post("/api/admin/tenants/:id/wake", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const t = (DB.listTenants() as any[]).find((x: any) => x.id === id);
  if (!t) return c.json({ error: "not found" }, 404);
  const next = await wakeTenant(t);
  DB.logActivity((c.get("user") as DB.User).id, "tenant.wake", { tenant: id });
  return c.json({ ok: true, status: next.status });
});

app.delete("/api/admin/tenants/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const t = (DB.listTenants() as any[]).find((x: any) => x.id === id);
  if (!t) return c.json({ error: "not found" }, 404);
  if (t.container_id) {
    try {
      const { spawn } = await import("node:child_process");
      await new Promise<void>((res) => { const p = spawn("docker", ["rm", "-f", t.container_id]); p.on("close", () => res()); });
    } catch {}
  }
  DB.db.run("DELETE FROM tenants WHERE id = ?", [id]);
  DB.logActivity((c.get("user") as DB.User).id, "tenant.delete", { tenant: id });
  return c.json({ ok: true });
});


// ============================================================
// BILLING — Stripe (added 2026-05-01)
// ============================================================

// Public plan list — no auth required (used on landing + billing UI)
app.get("/api/billing/plans", (c) => {
  const list = Object.values(PLANS).map((p) => ({
    id: p.id,
    name: p.name,
    price_cents: p.priceCents,
    currency: p.currency,
    interval: p.interval,
    features: p.features,
    limits: p.limits,
    has_stripe_price: !!p.stripePriceId,
  }));
  return c.json({ plans: list, stripe_enabled: isStripeEnabled() });
});

// Authed: create Stripe Checkout session for plan upgrade
app.post("/api/me/billing/checkout", requireUser, async (c) => {
  if (!isStripeEnabled()) return c.json({ error: "billing not configured" }, 503);
  const user = c.get("user") as DB.User;
  const { plan } = await c.req.json<{ plan: string }>();
  const target = getPlan(plan);
  if (target.id === "free") return c.json({ error: "free plan does not need checkout" }, 400);
  if (!target.stripePriceId) return c.json({ error: `STRIPE_PRICE_${target.id.toUpperCase()} not configured` }, 503);
  try {
    const dbUser = DB.getUserById(user.id) as any;
    const customerId = await ensureStripeCustomer({
      userId: user.id,
      email: user.email,
      existingCustomerId: dbUser?.stripe_customer_id || null,
    });
    if (!customerId) return c.json({ error: "could not create customer" }, 500);
    if (!dbUser?.stripe_customer_id || dbUser.stripe_customer_id !== customerId) {
      DB.setUserStripeCustomerId(user.id, customerId);
    }
    const session = await createCheckoutSession({
      customerId,
      priceId: target.stripePriceId,
      userId: user.id,
    });
    return c.json({ ok: true, url: session.url });
  } catch (e: any) {
    console.error("[stripe:checkout:error]", e);
    return c.json({ error: e?.message || "checkout failed" }, 500);
  }
});

// Authed: open Stripe Customer Portal (manage card, cancel, invoices)
app.post("/api/me/billing/portal", requireUser, async (c) => {
  if (!isStripeEnabled()) return c.json({ error: "billing not configured" }, 503);
  const user = c.get("user") as DB.User;
  const dbUser = DB.getUserById(user.id) as any;
  const customerId = dbUser?.stripe_customer_id;
  if (!customerId) return c.json({ error: "no stripe customer for this account" }, 404);
  try {
    const session = await createPortalSession({ customerId });
    return c.json({ ok: true, url: session.url });
  } catch (e: any) {
    console.error("[stripe:portal:error]", e);
    return c.json({ error: e?.message || "portal failed" }, 500);
  }
});

// Stripe webhook — verify signature, sync subscription state
app.post("/api/stripe/webhook", async (c) => {
  if (!isStripeEnabled()) return c.json({ error: "billing not configured" }, 503);
  const sig = c.req.header("stripe-signature") || "";
  const raw = await c.req.text();
  let event: any;
  try {
    event = verifyWebhook(raw, sig);
  } catch (e: any) {
    console.error("[stripe:webhook:bad-sig]", e?.message);
    return c.json({ error: "invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = s.metadata?.user_id;
        const kind = s.metadata?.kind;
        if (userId && s.customer) DB.setUserStripeCustomerId(userId, s.customer as string);
        if (kind === "credit_topup" && userId) {
          const credits = parseInt(s.metadata?.credits || "0", 10);
          const packId = s.metadata?.pack_id;
          if (credits > 0) {
            const plan = Credits.planFor(userId);
            const result = Credits.applyTopUp(userId, plan, credits, {
              stripePaymentIntent: s.payment_intent as string,
              packId, amountCents: s.amount_total ?? undefined,
            });
            const u = DB.getUserById(userId);
            if (u) Email.sendOrderConfirmation?.({
              to: u.email,
              orderName: `${credits.toLocaleString()} ChatHermes credits (${packId} pack)`,
              amountCents: s.amount_total ?? 0,
              currency: (s.currency || "usd").toUpperCase(),
              receiptUrl: undefined,
            }).catch(() => {});
            Power.notify(userId, { kind: "billing", title: `+${credits.toLocaleString()} credits added`, body: `New balance: ${result.balance.toLocaleString()}`, url: "/app/billing" });
          }
        } else if (userId && s.subscription) {
          const sub = await stripe!.subscriptions.retrieve(s.subscription as string);
          syncSubscription(userId, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id || (await lookupUserByCustomer(sub.customer as string));
        if (userId) {
          syncSubscription(userId, sub);

          // ──── PRIVATE AGENT: mark pending on paid plan; auto-spawn only if AUTO_PROVISION_PRIVATE_AGENT=true ────
          try {
            const newSub = DB.getSubscription(userId);
            const isPaid = newSub && newSub.plan && newSub.plan !== "free" && newSub.status === "active";
            const isCanceled = event.type === "customer.subscription.deleted";
            const existing = PrivateAgent.getPrivateAgent(userId);
            const autoProvision = process.env.AUTO_PROVISION_PRIVATE_AGENT === "true";
            if (isPaid && (!existing || existing.status === "none" || existing.status === "failed")) {
              if (autoProvision) {
                PrivateAgent.provisionPrivateAgent(userId).then((r) => {
                  if (!r.ok) console.error("[private_agent] auto-provision failed for", userId, r.error);
                  else console.log("[private_agent] auto-provisioning started for", userId);
                }).catch((e) => console.error("[private_agent] provision threw:", e));
              } else {
                // Gated: just mark pending, admin must click "Provision" in /admin/private-agents
                PrivateAgent.markPending(userId);
                console.log("[private_agent] marked pending (gated mode) for", userId, "— admin must approve at /admin/private-agents");
              }
            } else if (isCanceled && existing && (existing.status === "ready" || existing.status === "pending")) {
              // Mark for cleanup; admin clicks destroy at their convenience (or cron sweeps after 24h)
              PrivateAgent.markForDestruction(userId);
              console.log("[private_agent] marked for destruction for", userId);
            }
          } catch (e) { console.error("[private_agent] hook failed:", e); }
          // PRIVATE_AGENT_HOOK
          // Send canceled email on deletion
          if (event.type === "customer.subscription.deleted" || (sub.cancel_at_period_end && event.type === "customer.subscription.updated")) {
            const u = DB.getUserById(userId);
            if (u) {
              const priceId = sub.items?.data?.[0]?.price?.id || null;
              const planName = priceId ? planFromPriceId(priceId) : "subscription";
              const activeUntil = sub.current_period_end ? new Date(sub.current_period_end * 1000).toLocaleDateString() : "end of period";
              if (event.type === "customer.subscription.deleted" || sub.cancel_at_period_end) {
                Email.sendSubscriptionCanceled({
                  to: u.email,
                  plan: planName,
                  activeUntil,
                  resumeUrl: `${PUBLIC_BASE_URL}/app/billing`,
                }).then((r) => DB.logEmail({ user_id: userId, to_email: u.email, template: "subscription_canceled", subject: "Your ChatHermes subscription is canceled", status: r.ok ? "sent" : "failed", resend_id: r.id ?? null, error: r.error ?? null, meta: { sub_id: sub.id } })).catch(() => {});
              }
            }
          }
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object;
        const userId = (await lookupUserByCustomer(inv.customer as string));
        if (userId) {
          DB.recordStripeInvoice({
            user_id: userId,
            amount_cents: inv.amount_paid ?? inv.total ?? 0,
            currency: (inv.currency || "usd").toUpperCase(),
            status: "paid",
            description: inv.lines?.data?.[0]?.description || "ChatHermes subscription",
            period_start: (inv.period_start || Math.floor(Date.now() / 1000)) * 1000,
            period_end: (inv.period_end || Math.floor(Date.now() / 1000)) * 1000,
            paid_at: Date.now(),
            hosted_invoice_url: inv.hosted_invoice_url || null,
            pdf_url: inv.invoice_pdf || null,
            stripe_invoice_id: inv.id || null,
          });
          const u = DB.getUserById(userId);
          if (u) {
            const r = await Email.sendInvoicePaid({
              to: u.email,
              amountCents: inv.amount_paid ?? inv.total ?? 0,
              currency: inv.currency || "usd",
              invoiceUrl: inv.hosted_invoice_url,
              description: inv.lines?.data?.[0]?.description || "ChatHermes subscription",
            });
            DB.logEmail({ user_id: userId, to_email: u.email, template: "invoice_paid", subject: `Receipt — ${(inv.currency || "usd").toUpperCase()} ${((inv.amount_paid ?? inv.total ?? 0)/100).toFixed(2)}`, status: r.ok ? "sent" : "failed", resend_id: r.id ?? null, error: r.error ?? null, meta: { invoice_id: inv.id } });
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const userId = (await lookupUserByCustomer(inv.customer as string));
        if (userId) {
          DB.recordStripeInvoice({
            user_id: userId,
            amount_cents: inv.amount_due ?? 0,
            currency: (inv.currency || "usd").toUpperCase(),
            status: "failed",
            description: inv.lines?.data?.[0]?.description || "Payment failed",
            period_start: (inv.period_start || Math.floor(Date.now() / 1000)) * 1000,
            period_end: (inv.period_end || Math.floor(Date.now() / 1000)) * 1000,
            paid_at: null,
            hosted_invoice_url: inv.hosted_invoice_url || null,
            pdf_url: inv.invoice_pdf || null,
            stripe_invoice_id: inv.id || null,
          });
          const u = DB.getUserById(userId);
          if (u) {
            const r = await Email.sendInvoiceFailed({
              to: u.email,
              amountCents: inv.amount_due ?? 0,
              currency: inv.currency || "usd",
              portalUrl: `${PUBLIC_BASE_URL}/app/billing`,
              reason: inv.last_finalization_error?.message || inv.next_payment_attempt ? `Stripe will retry on ${new Date(inv.next_payment_attempt * 1000).toLocaleDateString()}` : undefined,
            });
            DB.logEmail({ user_id: userId, to_email: u.email, template: "invoice_failed", subject: "Action needed — payment failed", status: r.ok ? "sent" : "failed", resend_id: r.id ?? null, error: r.error ?? null, meta: { invoice_id: inv.id } });
          }
        }
        break;
      }
      default:
        // ignore other events
        break;
    }
  } catch (e: any) {
    console.error("[stripe:webhook:handler:error]", event?.type, e?.message);
    // still ack 200 — Stripe retries on non-2xx
  }
  return c.json({ received: true });
});

async function lookupUserByCustomer(customerId: string): Promise<string | null> {
  const u = DB.getUserByStripeCustomerId(customerId);
  return u?.id ?? null;
}

function syncSubscription(userId: string, sub: any) {
  const priceId = sub.items?.data?.[0]?.price?.id || null;
  const plan = priceId ? planFromPriceId(priceId) : "free";
  const status = sub.status || "active";
  // map Stripe status → "active"/"canceled"/"past_due"
  DB.setStripeSubscription(userId, {
    plan,
    status,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    period_start: (sub.current_period_start ?? sub.start_date ?? Math.floor(Date.now() / 1000)) * 1000,
    period_end: (sub.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000,
    cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
  });
  // Update credit grant ceiling on plan change
  Credits.onPlanChange(userId, plan);
  // notify user
  const u = DB.getUserById(userId);
  if (u) {
    Email.sendSubscriptionUpdated({ to: u.email, plan, status }).catch(() => {});
  }
}


// ============================================================
// EMAIL — admin endpoints (added 2026-05-01)
// ============================================================

// Send a test email to the admin's own address
app.post("/api/admin/email/test", requireAdmin, async (c) => {
  const user = c.get("user") as DB.User;
  const body = await c.req.json<{ template?: string; to?: string }>();
  const to = body.to || user.email;
  const template = body.template || "welcome";
  let res: { ok: boolean; id?: string; error?: string };
  switch (template) {
    case "magic_link": res = await Email.sendMagicLink({ to, verifyUrl: `${PUBLIC_BASE_URL}/auth/verify?token=test_only` }); break;
    case "welcome": res = await Email.sendWelcome({ to }); break;
    case "project_published": res = await Email.sendProjectPublished({ to, projectTitle: "Test Project", publicUrl: `${PUBLIC_BASE_URL}/p/test`, projectId: "test" }); break;
    case "job_done": res = await Email.sendJobDone({ to, jobTitle: "Test research job", summary: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. The agent finished a sample summary that demonstrates the email layout.", openUrl: `${PUBLIC_BASE_URL}/app`, durationSec: 240 }); break;
    case "subscription_updated": res = await Email.sendSubscriptionUpdated({ to, plan: "pro", status: "active", portalUrl: `${PUBLIC_BASE_URL}/app/billing` }); break;
    case "invoice_paid": res = await Email.sendInvoicePaid({ to, amountCents: 2000, currency: "usd", description: "Pro plan — monthly" }); break;
    case "invoice_failed": res = await Email.sendInvoiceFailed({ to, amountCents: 2000, currency: "usd", portalUrl: `${PUBLIC_BASE_URL}/app/billing`, reason: "Card declined" }); break;
    case "renewal_reminder": res = await Email.sendRenewalReminder({ to, plan: "pro", renewsOn: "May 8, 2026", amountCents: 2000, currency: "usd", portalUrl: `${PUBLIC_BASE_URL}/app/billing` }); break;
    case "trial_ending": res = await Email.sendTrialEnding({ to, trialEndsOn: "May 5, 2026", upgradeUrl: `${PUBLIC_BASE_URL}/app/billing` }); break;
    case "usage_warning": res = await Email.sendUsageWarning({ to, pct: 80, used: 40, limit: 50, metric: "messages", upgradeUrl: `${PUBLIC_BASE_URL}/app/billing` }); break;
    case "usage_limit": res = await Email.sendUsageLimitReached({ to, metric: "messages", upgradeUrl: `${PUBLIC_BASE_URL}/app/billing` }); break;
    case "sign_in_alert": res = await Email.sendSignInAlert({ to, ip: "203.0.113.1", userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit", when: new Date().toLocaleString(), revokeUrl: `${PUBLIC_BASE_URL}/app/settings` }); break;
    case "weekly_digest": res = await Email.sendWeeklyDigest({ to, messages: 142, projects: 7, toolCalls: 89, topProjects: [{ title: "Aether landing", url: `${PUBLIC_BASE_URL}/p/aether-test` }] }); break;
    case "overnight_digest": res = await Email.sendOvernightDigest({ to, jobs: [{ title: "Newsletter draft — slow AI", summary: "Drafted 740 words. Pinned 3 quotes from your reading list.", openUrl: `${PUBLIC_BASE_URL}/app` }, { title: "PR triage", summary: "Found 4 PRs needing attention. 2 ready to merge, 1 conflict, 1 draft." }] }); break;
    case "subscription_canceled": res = await Email.sendSubscriptionCanceled({ to, plan: "pro", activeUntil: "May 31, 2026", resumeUrl: `${PUBLIC_BASE_URL}/app/billing` }); break;
    case "account_disabled": res = await Email.sendAccountDisabled({ to, reason: "Demo only — your account is fine." }); break;
    case "account_reactivated": res = await Email.sendAccountReactivated({ to }); break;
    case "email_verification": res = await Email.sendEmailVerification({ to, verifyUrl: `${PUBLIC_BASE_URL}/auth/verify?token=test_verify` }); break;
    case "order": res = await Email.sendOrderConfirmation({ to, orderName: "100 ChatHermes credits", amountCents: 1000, currency: "usd" }); break;
    default: return c.json({ error: "unknown template" }, 400);
  }
  DB.logEmail({ user_id: user.id, to_email: to, template, subject: `[test] ${template}`, status: res.ok ? "sent" : "failed", resend_id: res.id ?? null, error: res.error ?? null, meta: { test: true } });
  return c.json(res);
});

// List recent emails (admin global, or filter by user)
app.get("/api/admin/email/log", requireAdmin, (c) => {
  const userId = c.req.query("user_id") || undefined;
  const limit = Number(c.req.query("limit") || 100);
  return c.json({ emails: DB.listEmails({ user_id: userId, limit }), stats: DB.emailStats() });
});

// User-facing: list own email log
app.get("/api/me/email/log", requireUser, (c) => {
  const user = c.get("user") as DB.User;
  return c.json({ emails: DB.listEmails({ user_id: user.id, limit: 50 }) });
});

// Domain setup — create domain in Resend, return DNS records to add
app.post("/api/admin/email/domain/setup", requireAdmin, async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name) return c.json({ error: "name required" }, 400);
  const r = await Email.setupDomain(name);
  return c.json(r);
});

// List domains registered in Resend
app.get("/api/admin/email/domains", requireAdmin, async (c) => {
  const r = await Email.listDomains();
  return c.json(r);
});

// Trigger domain verification (after DNS records propagate)
app.post("/api/admin/email/domain/:id/verify", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const r = await Email.verifyDomain(id);
  return c.json(r);
});

// ============================================================
// RESEND WEBHOOK — track delivery / bounce / open / click / complaint
// ============================================================
app.post("/api/resend/webhook", async (c) => {
  // Resend webhooks are signed via Svix headers. For now we trust by IP / shared secret.
  // TODO: verify svix-id, svix-timestamp, svix-signature with RESEND_WEBHOOK_SECRET
  const body = await c.req.json<any>();
  const type = body?.type as string | undefined;
  const data = body?.data || {};
  const resendId = data?.email_id || data?.id;
  if (!type || !resendId) return c.json({ ok: true });

  const now = Date.now();
  const patches: Record<string, any> = {
    "email.sent": { status: "sent" },
    "email.delivered": { status: "delivered", delivered_at: now },
    "email.opened": { status: "opened", opened_at: now },
    "email.clicked": { status: "clicked", clicked_at: now },
    "email.bounced": { status: "bounced", bounced_at: now, error: data?.bounce?.message || "bounced" },
    "email.complained": { status: "complained", complained_at: now },
    "email.delivery_delayed": { status: "delayed" },
    "email.failed": { status: "failed", error: data?.failure?.reason || "failed" },
  };
  const patch = patches[type];
  if (patch) DB.updateEmailStatus(resendId, patch);
  return c.json({ ok: true });
});

// API root — exposes attribution metadata (Required Attribution)
app.get("/api", (c) => c.json({
  name: "chathermes",
  description: "ChatHermes — the chat that doesn't end when you close the tab",
  version: "1.0.0",
  license: "ChatHermes Open Source License v1.0 (AGPL-3.0 + Required Attribution)",
  source: "https://github.com/chathermes/chathermes",
  cloud: "https://chathermes.com",
  docs: "https://github.com/chathermes/chathermes/blob/main/docs/ARCHITECTURE.md",
  built_on: { hermes_agent: "https://github.com/NousResearch/hermes-agent", kimi: "https://moonshot.ai" },
}));


// ============================================================
// POWER ROUTES — API keys, webhooks, search, GDPR, status, public REST API
// (added by power.ts integration)
// ============================================================

// ---- API KEYS (user-managed) ----
app.get("/api/me/api-keys", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({ keys: Power.listApiKeys(u.id) });
});

app.post("/api/me/api-keys", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const body = await c.req.json<{ name?: string; scopes?: string; expires_days?: number }>();
  if (!body.name || body.name.length > 80) return c.json({ error: "invalid name" }, 400);
  const expiresAt = body.expires_days ? Date.now() + body.expires_days * 86_400_000 : null;
  const { token, record } = Power.createApiKey({ userId: u.id, name: body.name, scopes: body.scopes, expiresAt });
  DB.logActivity(u.id, "api_key.create", { name: body.name });
  return c.json({ ok: true, token, record: { ...record, token: undefined } });
});

app.delete("/api/me/api-keys/:id", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const ok = Power.deleteApiKey(u.id, c.req.param("id"));
  if (ok) DB.logActivity(u.id, "api_key.delete", { id: c.req.param("id") });
  return c.json({ ok });
});

// ---- OUTBOUND WEBHOOKS (user-managed) ----
app.get("/api/me/webhooks", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const subs = Power.listWebhooks(u.id);
  return c.json({ webhooks: subs.map((s) => ({ ...s, secret: s.secret.slice(0, 14) + "..." })), available_events: Power.WEBHOOK_EVENTS });
});

app.post("/api/me/webhooks", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const body = await c.req.json<{ url: string; events: string[] }>();
  if (!body.url || !/^https?:\/\//.test(body.url)) return c.json({ error: "invalid url" }, 400);
  if (!Array.isArray(body.events) || body.events.length === 0) return c.json({ error: "events required" }, 400);
  const valid = new Set([...Power.WEBHOOK_EVENTS, "*"]);
  const events = body.events.filter((e) => valid.has(e as any));
  if (events.length === 0) return c.json({ error: "no valid events" }, 400);
  const { record, secret } = Power.createWebhook({ userId: u.id, url: body.url, events });
  DB.logActivity(u.id, "webhook.create", { url: body.url, events });
  return c.json({ ok: true, webhook: record, secret });
});

app.delete("/api/me/webhooks/:id", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const ok = Power.deleteWebhook(u.id, c.req.param("id"));
  if (ok) DB.logActivity(u.id, "webhook.delete", { id: c.req.param("id") });
  return c.json({ ok });
});

app.get("/api/me/webhooks/:id/log", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const subs = Power.listWebhooks(u.id);
  const owned = subs.find((s) => s.id === c.req.param("id"));
  if (!owned) return c.json({ error: "not found" }, 404);
  return c.json({ log: Power.listWebhookLog(c.req.param("id"), 100) });
});

// Test fire — sends a sample event to verify endpoint works
app.post("/api/me/webhooks/:id/test", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const subs = Power.listWebhooks(u.id);
  const wh = subs.find((s) => s.id === c.req.param("id"));
  if (!wh) return c.json({ error: "not found" }, 404);
  Power.emitWebhook(u.id, "session.created" as any, { test: true, message: "This is a test event from ChatHermes." });
  return c.json({ ok: true, queued: true });
});

// ---- SEARCH ----
app.get("/api/me/search", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const q = (c.req.query("q") || "").trim();
  if (q.length < 2) return c.json({ q, counts: { messages: 0, memories: 0, projects: 0 }, messages: [], memories: [], projects: [] });
  return c.json(Power.search(u.id, q, 30));
});

// ---- GDPR ----
app.get("/api/me/export", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  DB.logActivity(u.id, "gdpr.export", {});
  const data = Power.exportUserData(u.id);
  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="chathermes-export-${u.id.slice(0,8)}.json"`);
  return c.json(data);
});

app.delete("/api/me", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const body = await c.req.json<{ confirm?: string }>().catch(() => ({}));
  if (body.confirm !== u.email) return c.json({ error: "must confirm by sending { confirm: \"<your-email>\" }" }, 400);
  const result = Power.deleteUserCompletely(u.id);
  return c.json(result);
});

// ---- NOTIFICATIONS ----
app.get("/api/me/notifications", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({
    notifications: Power.listNotifications(u.id, 30),
    unread: Power.unreadNotificationCount(u.id),
  });
});
app.post("/api/me/notifications/:id/read", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  Power.markNotificationRead(u.id, c.req.param("id"));
  return c.json({ ok: true });
});
app.post("/api/me/notifications/read-all", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  Power.markAllNotificationsRead(u.id);
  return c.json({ ok: true });
});

// ---- STATUS PAGE (public) ----
app.get("/api/status", async (c) => {
  const result = await Power.deepHealthCheck();
  return c.json({
    status: result.ok ? "operational" : "degraded",
    timestamp: result.ts,
    uptime_sec: result.uptime_sec,
    version: result.version,
    services: Object.fromEntries(Object.entries(result.checks).map(([k, v]: any) => [k, { status: v.ok ? "operational" : "down", latency_ms: v.latency_ms ?? null, message: v.detail || v.error || null }])),
  });
});

// ---- OpenAPI-lite spec ----
app.get("/api/openapi.json", (c) => {
  return c.json({
    openapi: "3.0.3",
    info: { title: "ChatHermes API", version: "1.0.0", description: "Public REST API. Auth via API key in `Authorization: Bearer ck_...` header." },
    servers: [{ url: PUBLIC_BASE_URL }],
    paths: {
      "/api/v1/me": { get: { summary: "Get authenticated user", security: [{ bearerAuth: [] }] } },
      "/api/v1/sessions": { get: { summary: "List chat sessions" }, post: { summary: "Create new session" } },
      "/api/v1/sessions/{id}/messages": { get: { summary: "List messages in session" } },
      "/api/v1/sessions/{id}/chat": { post: { summary: "Send message + stream response (SSE)" } },
      "/api/v1/projects": { get: { summary: "List projects" }, post: { summary: "Create project" } },
      "/api/v1/memories": { get: { summary: "List memories" }, post: { summary: "Add memory" } },
      "/api/v1/search": { get: { summary: "Search messages, memories, projects", parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }] } },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "ck_xxx" },
      },
    },
  });
});

// ---- PUBLIC REST API v1 — auth via Bearer ck_xxx ----
async function requireApiKeyOrUser(c: any, next: any) {
  // Try API key first
  const auth = c.req.header("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const tok = auth.slice(7).trim();
    const found = Power.lookupApiKey(tok);
    if (found) {
      // Rate limit per API key
      const rl = Power.rateLimitTake({ scope: "api:public", key: found.token.id, ...Power.POLICIES.API_PUBLIC });
      if (!rl.allowed) return c.json({ error: "rate_limited", retry_after_ms: rl.resetAt - Date.now() }, 429);
      c.set("user", found.user);
      c.set("api_key_id", found.token.id);
      await next();
      return;
    }
    return c.json({ error: "invalid api key" }, 401);
  }
  // Fall back to cookie session
  const sid = (await import("hono/cookie")).getCookie(c, "ch_sid");
  if (!sid) return c.json({ error: "unauthenticated" }, 401);
  const user = DB.getUserBySessionId(sid);
  if (!user) return c.json({ error: "unauthenticated" }, 401);
  c.set("user", user);
  await next();
}

app.get("/api/v1/me", requireApiKeyOrUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({ id: u.id, email: u.email, role: u.role });
});

app.get("/api/v1/sessions", requireApiKeyOrUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({ sessions: DB.listChatSessions(u.id) });
});

app.post("/api/v1/sessions", requireApiKeyOrUser, async (c) => {
  const u = c.get("user") as DB.User;
  const body = await c.req.json<{ title?: string }>().catch(() => ({}));
  const session = DB.createChatSession(u.id, body.title || "API session");
  Power.emitWebhook(u.id, "session.created", { session_id: session.id, title: session.title });
  return c.json({ session });
});

app.get("/api/v1/sessions/:id/messages", requireApiKeyOrUser, (c) => {
  const u = c.get("user") as DB.User;
  const sess = DB.getChatSession(u.id, c.req.param("id"));
  if (!sess) return c.json({ error: "not found" }, 404);
  return c.json({ messages: DB.listSessionMessages(u.id, c.req.param("id")) });
});

app.get("/api/v1/projects", requireApiKeyOrUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({ projects: DB.listProjects(u.id) });
});

app.get("/api/v1/memories", requireApiKeyOrUser, (c) => {
  const u = c.get("user") as DB.User;
  return c.json({ memories: DB.listMemories(u.id) });
});

app.post("/api/v1/memories", requireApiKeyOrUser, async (c) => {
  const u = c.get("user") as DB.User;
  const body = await c.req.json<{ topic: string; body: string }>();
  if (!body.topic || !body.body) return c.json({ error: "topic and body required" }, 400);
  const mem = DB.addMemory(u.id, body.topic, body.body);
  Power.emitWebhook(u.id, "memory.created", { id: mem.id, topic: mem.topic });
  return c.json({ memory: mem });
});

app.get("/api/v1/search", requireApiKeyOrUser, (c) => {
  const u = c.get("user") as DB.User;
  const q = (c.req.query("q") || "").trim();
  if (q.length < 2) return c.json({ error: "q must be at least 2 chars" }, 400);
  return c.json(Power.search(u.id, q, 30));
});

// ============================================================
// CRON JOBS — wired to power scheduler
// ============================================================
Power.defineCron({
  name: "webhook_retry_sweep",
  intervalMs: 60_000,
  run: async () => { await Power.processWebhookRetries(); },
});

Power.defineCron({
  name: "trial_ending_reminder",
  intervalMs: 6 * 60 * 60_000,  // every 6h
  run: async () => {
    // Find subs that end in next 3 days and haven't been reminded
    const nowMs = Date.now();
    const targetMin = nowMs + 2 * 86_400_000;
    const targetMax = nowMs + 3 * 86_400_000;
    const subs = (DB.db as any).query("SELECT s.user_id, s.period_end FROM subscriptions s WHERE s.plan != 'free' AND s.period_end BETWEEN ? AND ?").all(targetMin, targetMax) as any[];
    for (const s of subs) {
      const u = DB.getUserById(s.user_id);
      if (u) await Email.sendRenewalReminder?.({
        to: u.email,
        plan: "Pro",
        renewsOn: new Date(s.period_end).toLocaleDateString("en-US"),
        amountCents: 2000,
        currency: "usd",
        portalUrl: `${PUBLIC_BASE_URL}/app/billing`,
      }).catch(() => {});
    }
  },
});

Power.defineCron({
  name: "old_magic_link_cleanup",
  intervalMs: 60 * 60_000,
  run: async () => {
    const cutoff = Date.now() - 30 * 60_000;
    DB.db.run("DELETE FROM magic_links WHERE expires_at < ?", [cutoff]);
  },
});

Power.startCron();


// ============================================================
// CREDITS — balance, transactions, top-up packs
// ============================================================

app.get("/api/me/credits", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const plan = Credits.planFor(u.id);
  return c.json({
    plan,
    balance: Credits.getBalanceWithSummary(u.id, plan),
    packs: Credits.TOP_UP_PACKS.map((p) => ({
      id: p.id, name: p.name, credits: p.credits,
      price_cents: p.price_cents, currency: p.currency, bonus_pct: p.bonus_pct,
      has_stripe_price: !!p.stripe_price_id,
    })),
  });
});

app.get("/api/me/credits/transactions", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  // Strip meta + ref_id + user_id from response (kept in DB for audit only)
  const tx = (Credits.listTransactions(u.id, 100) as any[]).map((t) => ({
    id: t.id, delta: t.delta, reason: t.reason,
    balance_after: t.balance_after, created_at: t.created_at,
  }));
  return c.json({ transactions: tx });
});

app.get("/api/me/credits/usage", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const days = Math.min(90, Number(c.req.query("days") || 30));
  return c.json({ days, daily: Credits.dailyConsumption(u.id, days) });
});

// Top-up checkout — creates a Stripe one-time payment session
app.post("/api/me/credits/topup", requireUser, async (c) => {
  if (!isStripeEnabled()) return c.json({ error: "billing not configured" }, 503);
  const u = c.get("user") as DB.User;
  const { pack } = await c.req.json<{ pack: string }>();
  const packDef = Credits.findPackById(pack);
  if (!packDef) return c.json({ error: "invalid pack" }, 400);
  if (!packDef.stripe_price_id) return c.json({ error: `STRIPE_PRICE_PACK_${pack.toUpperCase()} not configured` }, 503);

  try {
    const dbUser = DB.getUserById(u.id) as any;
    const customerId = await ensureStripeCustomer({ userId: u.id, email: u.email, existingCustomerId: dbUser?.stripe_customer_id || null });
    if (!customerId) return c.json({ error: "could not create customer" }, 500);
    if (!dbUser?.stripe_customer_id || dbUser.stripe_customer_id !== customerId) {
      DB.setUserStripeCustomerId(u.id, customerId);
    }
    const session = await stripe!.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: packDef.stripe_price_id, quantity: 1 }],
      success_url: `${PUBLIC_BASE_URL}/app/billing?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/app/billing?topup=cancel`,
      metadata: { user_id: u.id, kind: "credit_topup", pack_id: packDef.id, credits: String(packDef.credits) },
      payment_intent_data: { metadata: { user_id: u.id, kind: "credit_topup", pack_id: packDef.id, credits: String(packDef.credits) } },
    });
    return c.json({ ok: true, url: session.url });
  } catch (e: any) {
    console.error("[stripe:topup:error]", e);
    return c.json({ error: e?.message || "topup failed" }, 500);
  }
});

// Admin: adjust credits (refund, gift, debug) — separate from old invoice-based plan credit
app.post("/api/admin/users/:id/credits/adjust", requireAdmin, async (c) => {
  const { delta, note } = await c.req.json<{ delta: number; note?: string }>();
  if (typeof delta !== "number" || delta === 0) return c.json({ error: "invalid delta" }, 400);
  const result = Credits.adminAdjust(c.req.param("id"), delta, note || "admin adjustment");
  return c.json({ ok: true, ...result });
});

app.get("/api/admin/users/:id/credits", requireAdmin, (c) => {
  const plan = (DB.db.query("SELECT plan FROM subscriptions WHERE user_id = ?").get(c.req.param("id")) as any)?.plan || "free";
  return c.json({
    balance: Credits.getBalanceWithSummary(c.req.param("id"), plan),
    transactions: Credits.listTransactions(c.req.param("id"), 50),
  });
});

// Cron: monthly grant reset for everyone
Power.defineCron({
  name: "credits_monthly_grant",
  intervalMs: 60 * 60_000,  // hourly check
  run: async () => {
    const r = Credits.applyAllPendingGrants();
    if (r.users > 0) console.log(`[credits:grant] refilled ${r.users} users, +${r.total_granted} total`);
  },
});


// ============================================================
// ONE-CLICK DEPLOY — Hetzner Cloud
// ============================================================

// Public catalogue (proxies Hetzner — needs user's token)
app.post("/api/deploy/hetzner/catalogue", async (c) => {
  const { token } = await c.req.json<{ token: string }>();
  if (!token || !token.startsWith("hcloud_")) return c.json({ error: "invalid Hetzner API token (must start with hcloud_)" }, 400);
  try {
    const [server_types, locations, ssh_keys] = await Promise.all([
      Deploy.listServerTypes(token),
      Deploy.listLocations(token),
      Deploy.listSshKeys(token),
    ]);
    return c.json({ ok: true, server_types, locations, ssh_keys });
  } catch (e: any) {
    return c.json({ error: e?.message || "Hetzner API call failed" }, 400);
  }
});

// Provision a server with cloud-init bootstrap
app.post("/api/deploy/hetzner", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("cf-connecting-ip") || "unknown";
  // Rate limit: 3 deploys per hour per IP (deploys cost real money — protect users from accidents)
  const rl = Power.rateLimitTake({ scope: "deploy:hetzner", key: ip, capacity: 3, ratePerSec: 3 / 3600 });
  if (!rl.allowed) return c.json({ error: "rate limited — too many deploy attempts. Try again in an hour." }, 429);

  const body = await c.req.json<Deploy.DeployRequest>();
  if (!body.token || !body.token.startsWith("hcloud_")) return c.json({ error: "invalid Hetzner API token" }, 400);
  if (!body.server_type || !body.location) return c.json({ error: "server_type and location required" }, 400);

  try {
    const result = await Deploy.deployToHetzner(body);
    return c.json({ ok: true, ...result });
  } catch (e: any) {
    return c.json({ error: e?.message || "deploy failed" }, 400);
  }
});

// Poll deploy status
app.post("/api/deploy/hetzner/status", async (c) => {
  const { token, server_id } = await c.req.json<{ token: string; server_id: number }>();
  if (!token || !server_id) return c.json({ error: "token + server_id required" }, 400);
  try {
    const status = await Deploy.getDeployStatus(token, server_id);
    return c.json({ ok: true, ...status });
  } catch (e: any) {
    return c.json({ error: e?.message || "status check failed" }, 400);
  }
});


// ============================================================
// HETZNER ADMIN — fleet management for managed deploys
// Stores token in system_settings (admin-only access).
// ============================================================

function getHetznerToken(): string | null {
  const r = (DB.db as any).query("SELECT value FROM system_settings WHERE key = 'hetzner_api_token'").get() as any;
  return r?.value || process.env.HETZNER_API_TOKEN || null;
}

function setHetznerToken(token: string | null): void {
  if (token === null) {
    DB.db.run("DELETE FROM system_settings WHERE key = 'hetzner_api_token'");
  } else {
    DB.db.run(
      "INSERT INTO system_settings (key, value, updated_at) VALUES ('hetzner_api_token', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      [token, Date.now()]
    );
  }
}

// Admin: get/set Hetzner token (returns redacted prefix only)
app.get("/api/admin/hetzner/token", requireAdmin, (c) => {
  const t = getHetznerToken();
  return c.json({
    configured: !!t,
    prefix: t ? t.slice(0, 14) + "..." : null,
  });
});
app.post("/api/admin/hetzner/token", requireAdmin, async (c) => {
  const u = c.get("user") as DB.User;
  const { token } = await c.req.json<{ token: string | null }>();
  if (token && !token.startsWith("hcloud_")) return c.json({ error: "invalid token format (must start with hcloud_)" }, 400);
  if (token) {
    // Verify it works first
    try { await Deploy.listServerTypes(token); }
    catch (e: any) { return c.json({ error: "token rejected by Hetzner: " + (e?.message || "") }, 400); }
  }
  setHetznerToken(token);
  DB.logActivity(u.id, "hetzner.token." + (token ? "set" : "clear"), {});
  return c.json({ ok: true });
});

// Admin: catalogue (server types + locations + ssh keys)
app.get("/api/admin/hetzner/catalogue", requireAdmin, async (c) => {
  const token = getHetznerToken();
  if (!token) return c.json({ error: "Hetzner token not configured" }, 400);
  try {
    const [server_types, locations, ssh_keys] = await Promise.all([
      Deploy.listServerTypes(token),
      Deploy.listLocations(token),
      Deploy.listSshKeys(token),
    ]);
    return c.json({ ok: true, server_types, locations, ssh_keys });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});

// Admin: list all managed servers
app.get("/api/admin/hetzner/servers", requireAdmin, async (c) => {
  const token = getHetznerToken();
  if (!token) return c.json({ error: "Hetzner token not configured" }, 400);
  try {
    const r = await fetch("https://api.hetzner.cloud/v1/servers?per_page=50", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const j: any = await r.json();
    if (!r.ok) return c.json({ error: j?.error?.message || `Hetzner ${r.status}` }, 400);
    const servers = (j.servers || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      ipv4: s.public_net?.ipv4?.ip,
      ipv6: s.public_net?.ipv6?.ip,
      server_type: s.server_type?.name,
      cores: s.server_type?.cores,
      memory_gb: s.server_type?.memory,
      location: s.datacenter?.location?.name,
      city: s.datacenter?.location?.city,
      country: s.datacenter?.location?.country,
      created: s.created,
      labels: s.labels,
      managed_by_chathermes: s.labels?.app === "chathermes",
    }));
    return c.json({ ok: true, servers });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});

// Admin: deploy new server
app.post("/api/admin/hetzner/deploy", requireAdmin, async (c) => {
  const u = c.get("user") as DB.User;
  const token = getHetznerToken();
  if (!token) return c.json({ error: "Hetzner token not configured" }, 400);
  const body = await c.req.json<any>();
  if (!body.server_type || !body.location) return c.json({ error: "server_type + location required" }, 400);
  if (!body.llm_keys || (!body.llm_keys.nous && !body.llm_keys.kimi)) {
    return c.json({ error: "at least one LLM API key required" }, 400);
  }
  try {
    const result = await Deploy.deployToHetzner({ ...body, token });
    DB.logActivity(u.id, "hetzner.deploy", { server_id: result.server_id, server_type: body.server_type, location: body.location });
    return c.json({ ok: true, ...result });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});

// Admin: server status (single)
app.get("/api/admin/hetzner/servers/:id", requireAdmin, async (c) => {
  const token = getHetznerToken();
  if (!token) return c.json({ error: "Hetzner token not configured" }, 400);
  try {
    const status = await Deploy.getDeployStatus(token, parseInt(c.req.param("id"), 10));
    return c.json({ ok: true, ...status });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});

// Admin: server actions (poweron / poweroff / reboot / shutdown / delete)
app.post("/api/admin/hetzner/servers/:id/action", requireAdmin, async (c) => {
  const u = c.get("user") as DB.User;
  const token = getHetznerToken();
  if (!token) return c.json({ error: "Hetzner token not configured" }, 400);
  const id = parseInt(c.req.param("id"), 10);
  const { action } = await c.req.json<{ action: string }>();
  const valid = ["poweron", "poweroff", "reboot", "shutdown", "reset"];
  if (!valid.includes(action)) return c.json({ error: `invalid action. Use one of: ${valid.join(", ")}` }, 400);
  try {
    const r = await fetch(`https://api.hetzner.cloud/v1/servers/${id}/actions/${action}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const j: any = await r.json();
    if (!r.ok) return c.json({ error: j?.error?.message || `Hetzner ${r.status}` }, 400);
    DB.logActivity(u.id, "hetzner.server.action", { server_id: id, action });
    return c.json({ ok: true, action: j.action });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});

// Admin: delete server (separate endpoint — destructive)
app.delete("/api/admin/hetzner/servers/:id", requireAdmin, async (c) => {
  const u = c.get("user") as DB.User;
  const token = getHetznerToken();
  if (!token) return c.json({ error: "Hetzner token not configured" }, 400);
  const id = parseInt(c.req.param("id"), 10);
  try {
    const r = await fetch(`https://api.hetzner.cloud/v1/servers/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!r.ok && r.status !== 204) {
      const j = await r.json().catch(() => ({}));
      return c.json({ error: (j as any)?.error?.message || `Hetzner ${r.status}` }, 400);
    }
    DB.logActivity(u.id, "hetzner.server.delete", { server_id: id });
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});


// ============================================================
// PRIVATE AGENT — admin fleet management + user-facing status
// ============================================================
// PRIVATE_AGENT_ADMIN_ROUTES

// User: get my private agent status
app.get("/api/me/private-agent", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const sub = DB.getSubscription(u.id);
  const plan = sub?.plan || "free";
  const pa = PrivateAgent.getPrivateAgent(u.id);
  return c.json({
    plan,
    eligible: plan !== "free",
    status: pa?.status || "none",
    endpoint: pa?.status === "ready" ? pa.endpoint : null,
    ipv4: pa?.ipv4,
    provisioned_at: pa?.provisioned_at,
    error: pa?.error,
    mode_for_chat: PrivateAgent.resolveHermesEndpoint(u.id, plan).mode,
  });
});

// User: manually trigger provision (idempotent)
app.post("/api/me/private-agent/provision", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const sub = DB.getSubscription(u.id);
  if (!sub || sub.plan === "free" || sub.status !== "active") {
    return c.json({ error: "paid subscription required" }, 403);
  }
  const r = await PrivateAgent.provisionPrivateAgent(u.id);
  return c.json(r, r.ok ? 200 : 400);
});

// User: probe readiness (forces a check)
app.post("/api/me/private-agent/check", requireUser, async (c) => {
  const u = c.get("user") as DB.User;
  const ready = await PrivateAgent.checkReadiness(u.id);
  const pa = PrivateAgent.getPrivateAgent(u.id);
  return c.json({ ready, status: pa?.status, endpoint: pa?.status === "ready" ? pa.endpoint : null });
});

// Admin: list all private agents (fleet view)
app.get("/api/admin/private-agents", requireAdmin, (c) => {
  const list = PrivateAgent.listAllPrivateAgents();
  // Enrich with user emails
  const enriched = list.map((pa) => {
    const u = DB.getUserById(pa.user_id);
    const sub = DB.getSubscription(pa.user_id);
    return {
      ...pa,
      email: u?.email,
      plan: sub?.plan,
      sub_status: sub?.status,
    };
  });
  return c.json({ ok: true, agents: enriched });
});

// Admin: force provision for a user
app.post("/api/admin/private-agents/:userId/provision", requireAdmin, async (c) => {
  const adminUser = c.get("user") as DB.User;
  const userId = c.req.param("userId");
  const r = await PrivateAgent.provisionPrivateAgent(userId);
  DB.logActivity(adminUser.id, "admin.private_agent.provision", { target_user_id: userId, ok: r.ok });
  return c.json(r, r.ok ? 200 : 400);
});

// Admin: force readiness check
app.post("/api/admin/private-agents/:userId/check", requireAdmin, async (c) => {
  const userId = c.req.param("userId");
  const ready = await PrivateAgent.checkReadiness(userId);
  return c.json({ ok: true, ready, agent: PrivateAgent.getPrivateAgent(userId) });
});

// Admin: destroy private agent
app.delete("/api/admin/private-agents/:userId", requireAdmin, async (c) => {
  const adminUser = c.get("user") as DB.User;
  const userId = c.req.param("userId");
  const r = await PrivateAgent.destroyPrivateAgent(userId);
  DB.logActivity(adminUser.id, "admin.private_agent.destroy", { target_user_id: userId, ok: r.ok });
  return c.json(r, r.ok ? 200 : 400);
});


// User: list my recent activity log entries (per-user)
app.get("/api/me/activity", requireUser, (c) => {
  const u = c.get("user") as DB.User;
  const limit = Math.min(50, parseInt(c.req.query("limit") || "20", 10));
  const rows = (DB.db as any).query(
    "SELECT id, kind, meta, created_at FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(u.id, limit) as any[];
  return c.json({
    activities: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      meta: r.meta ? (() => { try { return JSON.parse(r.meta); } catch { return null; } })() : null,
      created_at: r.created_at,
    })),
  });
});


export default { port: PORT, fetch: app.fetch };
