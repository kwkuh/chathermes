// ChatHermes — tools.ts
// Copyright (c) 2026 Getid, Inc. and ChatHermes contributors.
// Licensed under the ChatHermes Open Source License v1.0 (see LICENSE.md).
// REQUIRED ATTRIBUTION: removing this header or the X-Powered-By emission in
// index.ts violates §2 of the license. See https://chathermes.com.

import * as DB from "./db";

export type ToolCall = { id: string; name: string; arguments: any };
export type ToolResult = { tool_call_id: string; name: string; output: string };

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for up-to-date information. Use when the user asks about current events, prices, news, or facts you might not know.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch the text content of a URL. Use to read articles, docs, GitHub READMEs, etc.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "Full URL including https://" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Persist a fact about the user. Use when the user shares a preference, fact, or context worth remembering across sessions.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Short topic label, e.g. 'voice', 'stack', 'preferences'" },
          body: { type: "string", description: "The actual fact to remember" },
        },
        required: ["topic", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_memory",
      description: "Search the user's saved memories by keyword. Use to recall context before answering.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Keyword or topic to recall" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "telegram_send",
      description: "Send a message to the user's connected Telegram. Only works if Telegram connector is configured.",
      parameters: {
        type: "object",
        properties: { message: { type: "string", description: "The message to send" } },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_js",
      description: "Execute JavaScript in a sandbox. For calculations, parsing, simple data transforms. NO network, NO filesystem.",
      parameters: {
        type: "object",
        properties: { code: { type: "string", description: "Valid JS expression or statements. Last expression returned." } },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browse",
      description: "Visit a URL, render the page, extract main readable content (article text, READMEs, docs). Strips nav/ads/scripts. Use for reading articles, docs, GitHub READMEs, blog posts, news.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "Full URL to visit (https://...)" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "github_repo",
      description: "Fetch GitHub repo info: stars, forks, description, latest release, README excerpt. Use 'owner/name' format.",
      parameters: {
        type: "object",
        properties: { repo: { type: "string", description: "owner/name e.g. 'NousResearch/hermes-agent'" } },
        required: ["repo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "news_search",
      description: "Search recent news. Returns titles, snippets, dates, URLs.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search query for news" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "weather",
      description: "Get current weather for a location.",
      parameters: {
        type: "object",
        properties: { location: { type: "string", description: "City, country e.g. 'Jakarta, ID' or 'New York'" } },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wikipedia",
      description: "Look up Wikipedia article summary on a topic.",
      parameters: {
        type: "object",
        properties: { topic: { type: "string", description: "Article title or topic" } },
        required: ["topic"],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image from text prompt. Returns URL. Uses Flux via Replicate.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Image description' },
          aspect_ratio: { type: 'string', description: '1:1, 16:9, 9:16, 4:3, 3:4' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_image',
      description: 'Analyze image at URL. Vision model describes contents or answers question.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Image URL' },
          question: { type: 'string', description: 'Optional specific question' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dispatch_subagent',
      description: 'Delegate sub-task to different model (Kimi K2 Thinking, Claude, GPT-5). Returns full reply. Default: Kimi K2 Thinking for reasoning-heavy tasks.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Complete task instruction' },
          model: { type: 'string', description: 'moonshotai/kimi-k2-thinking (default — strong reasoning), anthropic/claude-sonnet-4.6, openai/gpt-5' },
        },
        required: ['task'],
      },
    },
  },
];

export async function executeTool(userId: string, call: ToolCall): Promise<string> {
  const args = typeof call.arguments === "string" ? JSON.parse(call.arguments || "{}") : call.arguments;
  try {
    switch (call.name) {
      case "web_search": {
        const query = String(args.query ?? "").trim();
        if (!query) return "Empty query.";
        const tavilyKey = DB.getSetting("tavily_api_key");
        const braveKey = DB.getSetting("brave_api_key");

        // Tier 1: Tavily (purpose-built for agents, real web results)
        if (tavilyKey) {
          try {
            const r = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ api_key: tavilyKey, query, max_results: 6, include_answer: true, search_depth: "basic" }),
            });
            if (r.ok) {
              const j: any = await r.json();
              const out: string[] = [];
              if (j.answer) out.push(`[answer] ${j.answer}`);
              for (const r of (j.results ?? []).slice(0, 6)) out.push(`- ${r.title} — ${r.content?.slice(0, 200)} (${r.url})`);
              if (out.length) return "[via tavily]\n" + out.join("\n");
            }
          } catch {}
        }

        // Tier 2: Brave Search API
        if (braveKey) {
          try {
            const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6`, {
              headers: { "X-Subscription-Token": braveKey, Accept: "application/json" },
            });
            if (r.ok) {
              const j: any = await r.json();
              const items = j.web?.results ?? [];
              if (items.length) {
                return "[via brave]\n" + items.slice(0, 6).map((it: any) => `- ${it.title} — ${(it.description ?? "").slice(0, 200)} (${it.url})`).join("\n");
              }
            }
          } catch {}
        }

        // Tier 3: DuckDuckGo HTML scrape (no key, brittle but works)
        try {
          const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ChatHermes/1.0)" },
          });
          if (r.ok) {
            const html = await r.text();
            const out: string[] = [];
            const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
            let m;
            while ((m = re.exec(html)) !== null && out.length < 6) {
              const url = m[1].replace(/&amp;/g, "&");
              const title = m[2].replace(/<[^>]+>/g, "").trim();
              const snip = m[3].replace(/<[^>]+>/g, "").trim();
              out.push(`- ${title} — ${snip.slice(0, 200)} (${url})`);
            }
            if (out.length) return "[via ddg-html]\n" + out.join("\n");
          }
        } catch {}

        // Tier 4: Wikipedia API (always works, structured, free)
        try {
          const wr = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&origin=*`);
          const wj: any = await wr.json();
          const hits = wj.query?.search ?? [];
          if (hits.length) {
            const out = hits.map((h: any) => `- ${h.title}: ${(h.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 200)} (https://en.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))})`);
            return "[via wikipedia fallback]\n" + out.join("\n");
          }
        } catch {}

        // Tier 5: DDG instant answer (last resort, often empty)
        try {
          const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
          const j: any = await r.json();
          if (j.AbstractText) return `[via ddg-instant]\n[abstract] ${j.AbstractText} (${j.AbstractURL})`;
        } catch {}

        return `No results for "${query}". All search backends returned empty. Admin: configure tavily_api_key or brave_api_key in /admin/settings for better search.`;
      }

      case "fetch_url": {
        const r = await fetch(String(args.url), { headers: { "User-Agent": "ChatHermes/1.0" } });
        if (!r.ok) return `HTTP ${r.status}`;
        const ct = r.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) return JSON.stringify(await r.json()).slice(0, 4000);
        const text = await r.text();
        // Strip HTML tags crudely
        const stripped = text.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return stripped.slice(0, 4000);
      }

      case "save_memory": {
        const m = DB.addMemory(userId, String(args.topic ?? "note").slice(0, 60), String(args.body ?? "").slice(0, 2000));
        return `Saved memory "${m.topic}" (id ${m.id.slice(0, 8)}).`;
      }

      case "recall_memory": {
        const q = String(args.query ?? "").toLowerCase();
        const all = DB.listMemories(userId);
        const hits = all.filter((m) => m.topic.toLowerCase().includes(q) || m.body.toLowerCase().includes(q)).slice(0, 8);
        if (hits.length === 0) return `No memories matching "${args.query}". Total memories: ${all.length}.`;
        return hits.map((m) => `[${m.topic}] ${m.body}`).join("\n");
      }

      case "telegram_send": {
        const conns = DB.listConnectors(userId);
        const tg = conns.find((c) => c.kind === "telegram");
        if (!tg || !tg.secret) return "Telegram is not connected. Tell the user to go to /app/connectors and connect Telegram first.";
        const cfg = tg.config ? JSON.parse(tg.config) : {};
        // Try to use stored chat_id if available; otherwise instruct user
        if (!cfg.chat_id) {
          return "Telegram bot is connected but I don't know your chat_id yet. Open Telegram, send /start to your bot once. Then I can message you.";
        }
        const r = await fetch(`https://api.telegram.org/bot${tg.secret}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: cfg.chat_id, text: String(args.message) }),
        });
        const j: any = await r.json();
        return j.ok ? "Sent." : `Telegram error: ${j.description}`;
      }

      case "browse": {
        const url = String(args.url ?? "");
        if (!url.startsWith("http")) return "Error: url must start with http(s)://";
        try {
          const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 ChatHermes/1.0", Accept: "text/html,application/xhtml+xml" } });
          if (!r.ok) return `HTTP ${r.status} from ${url}`;
          const ct = r.headers.get("content-type") ?? "";
          if (ct.includes("application/json")) return JSON.stringify(await r.json()).slice(0, 6000);
          if (!ct.includes("html") && !ct.includes("text")) return `Non-text content (${ct})`;
          let html = await r.text();
          // Extract <title>
          const titleM = /<title>([\s\S]*?)<\/title>/i.exec(html);
          const title = titleM ? titleM[1].trim() : "";
          // Try main / article / div#content
          const mainM = /<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i.exec(html);
          let body = mainM ? mainM[1] : html;
          // Strip noise
          body = body.replace(/<script[\s\S]*?<\/script>/g, "")
                     .replace(/<style[\s\S]*?<\/style>/g, "")
                     .replace(/<nav[\s\S]*?<\/nav>/gi, "")
                     .replace(/<header[\s\S]*?<\/header>/gi, "")
                     .replace(/<footer[\s\S]*?<\/footer>/gi, "")
                     .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
                     .replace(/<aside[\s\S]*?<\/aside>/gi, "")
                     .replace(/<form[\s\S]*?<\/form>/gi, "")
                     .replace(/<svg[\s\S]*?<\/svg>/gi, "")
                     .replace(/<[^>]+>/g, " ")
                     .replace(/&nbsp;/g, " ")
                     .replace(/&amp;/g, "&")
                     .replace(/&lt;/g, "<")
                     .replace(/&gt;/g, ">")
                     .replace(/&quot;/g, "\"")
                     .replace(/&#39;/g, "'")
                     .replace(/\s+/g, " ")
                     .trim();
          const out = (title ? `Title: ${title}\n\n` : "") + body.slice(0, 5000);
          return out || "(empty page)";
        } catch (e: any) { return `Browse error: ${e.message}`; }
      }

      case "github_repo": {
        const repo = String(args.repo ?? "");
        try {
          const [r, rel] = await Promise.all([
            fetch(`https://api.github.com/repos/${repo}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "ChatHermes" } }),
            fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "ChatHermes" } }),
          ]);
          if (!r.ok) return `GitHub: ${r.status}`;
          const j: any = await r.json();
          let release = "";
          if (rel.ok) {
            const rj: any = await rel.json();
            release = `Latest release: ${rj.tag_name} — ${rj.name} (${new Date(rj.published_at).toLocaleDateString()})`;
          }
          return [
            `${j.full_name}`,
            `${j.description ?? ""}`,
            `★ ${j.stargazers_count} · forks ${j.forks_count} · open issues ${j.open_issues_count}`,
            `Language: ${j.language ?? "—"}  ·  License: ${j.license?.spdx_id ?? "—"}`,
            `Created ${new Date(j.created_at).toLocaleDateString()}, updated ${new Date(j.updated_at).toLocaleDateString()}`,
            `Homepage: ${j.homepage || "—"}`,
            release,
          ].filter(Boolean).join("\n");
        } catch (e: any) { return `Error: ${e.message}`; }
      }

      case "news_search": {
        const q = String(args.query ?? "");
        try {
          const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`);
          const xml = await r.text();
          const items: string[] = [];
          const re = /<item>([\s\S]*?)<\/item>/g;
          let m;
          while ((m = re.exec(xml)) !== null && items.length < 8) {
            const block = m[1];
            const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
            const link = /<link>([^<]+)<\/link>/.exec(block)?.[1] ?? "";
            const pub = /<pubDate>([^<]+)<\/pubDate>/.exec(block)?.[1] ?? "";
            if (title) items.push(`- ${title} [${pub}] ${link}`);
          }
          return items.length ? items.join("\n") : `No news for "${q}"`;
        } catch (e: any) { return `Error: ${e.message}`; }
      }

      case "weather": {
        const loc = String(args.location ?? "");
        try {
          const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1`);
          const gj: any = await geo.json();
          if (!gj.results?.length) return `Location not found: ${loc}`;
          const { latitude, longitude, name, country } = gj.results[0];
          const wr = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
          const wj: any = await wr.json();
          const c = wj.current;
          const codes: any = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 80: "Showers", 95: "Thunderstorm" };
          return `${name}, ${country}: ${c.temperature_2m}°C, ${codes[c.weather_code] ?? "unknown"}, humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m}km/h. Today: ${wj.daily.temperature_2m_min[0]}°C – ${wj.daily.temperature_2m_max[0]}°C.`;
        } catch (e: any) { return `Error: ${e.message}`; }
      }

      case "wikipedia": {
        const t = String(args.topic ?? "");
        try {
          const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, "_"))}`);
          if (!r.ok) return `Not found: ${t}`;
          const j: any = await r.json();
          return `${j.title}\n\n${j.extract ?? ""}\n\nMore: ${j.content_urls?.desktop?.page ?? ""}`;
        } catch (e: any) { return `Error: ${e.message}`; }
      }

      case "generate_image": {
        const replicateKey = DB.getSetting("replicate_api_token") || process.env.REPLICATE_API_TOKEN;
        if (!replicateKey) return "Image generation not configured. Admin: set REPLICATE_API_TOKEN in /admin/settings to enable. Until then, describe the image instead.";
        const prompt = String(args.prompt ?? "").trim();
        if (!prompt) return "Empty prompt.";
        const aspect = String(args.aspect_ratio || "1:1");
        try {
          // Replicate Flux Schnell — fast generation (~2s), good quality
          const r = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${replicateKey}`, "Content-Type": "application/json", "Prefer": "wait" },
            body: JSON.stringify({ input: { prompt, aspect_ratio: aspect, output_format: "webp", output_quality: 90, num_outputs: 1 } }),
          });
          const j: any = await r.json();
          if (!r.ok) return `Image gen error: ${j?.detail || j?.error || `HTTP ${r.status}`}`;
          const url = Array.isArray(j.output) ? j.output[0] : j.output;
          if (!url) return `Image gen returned no URL. Status: ${j.status}.`;
          return `Image generated: ${url}\n\n(prompt: "${prompt}", aspect: ${aspect})`;
        } catch (e: any) { return `Image gen failed: ${e.message}`; }
      }

      case "analyze_image": {
        const url = String(args.url ?? "").trim();
        if (!url.startsWith("http")) return "Error: url must start with http(s)://";
        const question = String(args.question ?? "Describe this image in detail.");
        // Try Gemini Pro Vision first (free tier generous), fall back to OpenAI gpt-4o
        const geminiKey = DB.getSetting("gemini_api_key") || process.env.GEMINI_API_KEY;
        const openaiKey = DB.getSetting("openai_api_key") || process.env.OPENAI_API_KEY;
        if (geminiKey) {
          try {
            // Fetch image and convert to base64
            const imgRes = await fetch(url);
            if (!imgRes.ok) return `Could not fetch image: HTTP ${imgRes.status}`;
            const buf = await imgRes.arrayBuffer();
            const b64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""));
            const mime = imgRes.headers.get("content-type") || "image/jpeg";
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: question }, { inline_data: { mime_type: mime, data: b64 } }] }],
              }),
            });
            const j: any = await r.json();
            if (!r.ok) return `Vision error: ${j?.error?.message || r.status}`;
            const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
            return text || "(empty response from vision model)";
          } catch (e: any) { return `Vision failed: ${e.message}`; }
        }
        if (openaiKey) {
          try {
            const r = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: { url } }] }],
                max_tokens: 800,
              }),
            });
            const j: any = await r.json();
            if (!r.ok) return `Vision error: ${j?.error?.message || r.status}`;
            return j.choices?.[0]?.message?.content || "(empty response)";
          } catch (e: any) { return `Vision failed: ${e.message}`; }
        }
        return "Vision analysis not configured. Admin: set GEMINI_API_KEY or OPENAI_API_KEY in /admin/settings.";
      }

      case "dispatch_subagent": {
        const task = String(args.task ?? "").trim();
        if (!task) return "Empty task.";
        const model = String(args.model || "moonshotai/kimi-k2-thinking");
        // Look up provider for this model
        const modelRow = (DB.db as any).query("SELECT m.model_id, p.api_key, p.base_url FROM llm_models m JOIN providers p ON p.id = m.provider_id WHERE m.model_id = ? LIMIT 1").get(model) as any;
        if (!modelRow?.api_key) return `Subagent model "${model}" not configured. Available models: hermes-4-405b, kimi-k2-thinking, claude-sonnet-4.6, gpt-5, gemini-3.1-pro-preview.`;
        try {
          const r = await fetch(`${modelRow.base_url.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${modelRow.api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelRow.model_id,
              messages: [
                { role: "system", content: "You are a focused subagent. Complete the task fully. Return structured, actionable output. No filler." },
                { role: "user", content: task },
              ],
              max_tokens: 2000,
            }),
          });
          const j: any = await r.json();
          if (!r.ok) return `Subagent error: ${j?.error?.message || r.status}`;
          const reply = j.choices?.[0]?.message?.content || "(empty subagent reply)";
          return `[subagent: ${model}]\n${reply}`;
        } catch (e: any) { return `Subagent failed: ${e.message}`; }
      }

      case "run_js": {
        const code = String(args.code ?? "").trim();
        if (!code) return "Error: empty code";
        const stringify = (v: any) => typeof v === "object" ? JSON.stringify(v).slice(0, 2000) : String(v).slice(0, 2000);
        // Try as expression first (works for: 17*23, Math.PI, [1,2,3].length)
        try {
          const fn = new Function(`"use strict"; return (${code});`);
          return stringify(fn());
        } catch {}
        // Fall back: wrap in IIFE that returns last expression
        try {
          const lines = code.split(/[;\n]+/).map((l) => l.trim()).filter(Boolean);
          const last = lines[lines.length - 1];
          const setup = lines.slice(0, -1).join("\n");
          // If last line is just an expression (no = or var/let/const), evaluate it
          const isExpr = !/^(var |let |const |if |for |while |function |return |throw )/.test(last) && !last.endsWith(";");
          const body = isExpr
            ? `"use strict"; ${setup}\nreturn (${last.replace(/;$/, "")});`
            : `"use strict"; ${code}\nreturn undefined;`;
          const fn = new Function(body);
          return stringify(fn());
        } catch (e: any) { return `Error: ${e.message}`; }
      }
    }
  } catch (e: any) {
    return `Tool error: ${e.message}`;
  }
  return "Unknown tool.";
}
