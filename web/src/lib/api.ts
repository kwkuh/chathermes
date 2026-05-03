"use client";
export function uid(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}


async function req<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, { credentials: "include", ...init });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${r.status}: ${txt || r.statusText}`);
  }
  return r.json();
}

export const api = {
  me: () => req("/api/me"),

  memory: {
    list: () => req<{ memories: any[] }>("/api/me/memory"),
    add: (topic: string, body: string) =>
      req("/api/me/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, body }) }),
    remove: (id: string) => req(`/api/me/memory/${id}`, { method: "DELETE" }),
  },

  skills: {
    state: () => req<{ active: Record<string, boolean> }>("/api/me/skills"),
    toggle: (id: string, active: boolean) =>
      req(`/api/me/skills/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) }),
  },

  connectors: {
    list: () => req<{ connectors: any[] }>("/api/me/connectors"),
    save: (kind: string, body: any) =>
      req(`/api/me/connectors/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    remove: (kind: string) => req(`/api/me/connectors/${kind}`, { method: "DELETE" }),
  },

  messages: {
    list: () => req<{ messages: any[] }>("/api/me/messages"),
    clear: () => req("/api/me/messages", { method: "DELETE" }),
  },


  projects: {
    list: () => req<{ projects: any[] }>("/api/me/projects"),
    get: (id: string) => req<{ project: any; messages: any[] }>(`/api/me/projects/${id}`),
    create: (title?: string) =>
      req<{ project: any }>("/api/me/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title ?? "Untitled project" }) }),
    update: (id: string, patch: any) =>
      req<{ project: any }>(`/api/me/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }),
    remove: (id: string) => req(`/api/me/projects/${id}`, { method: "DELETE" }),
  },

  settings: {
    update: (patch: any) =>
      req("/api/me/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }),
  },
};

export async function* chatStream(content: string): AsyncGenerator<{ token?: string; toolCall?: any; toolResult?: any; error?: string; done?: boolean }> {
  const r = await fetch("/api/me/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok || !r.body) {
    yield { error: `chat ${r.status}` };
    return;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const e of events) {
      const ev = /^event:\s*(.+)$/m.exec(e)?.[1];
      const data = /^data:\s*(.+)$/m.exec(e)?.[1];
      if (!ev || !data) continue;
      try {
        const j = JSON.parse(data);
        if (ev === "token") yield { token: j.t };
        else if (ev === "tool_call") yield { toolCall: j };
        else if (ev === "tool_result") yield { toolResult: j };
        else if (ev === "error") yield { error: j.error };
        else if (ev === "done") yield { done: true };
      } catch {}
    }
  }
}

export async function* projectChatStream(projectId: string, content: string): AsyncGenerator<{ token?: string; html?: string; error?: string; done?: boolean }> {
  const r = await fetch(`/api/me/projects/${projectId}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok || !r.body) {
    yield { error: `chat ${r.status}` };
    return;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const e of events) {
      const ev = /^event:\s*(.+)$/m.exec(e)?.[1];
      const data = /^data:\s*(.+)$/m.exec(e)?.[1];
      if (!ev || !data) continue;
      try {
        const j = JSON.parse(data);
        if (ev === "token") yield { token: j.t };
        else if (ev === "html") yield { html: j.html };
        else if (ev === "error") yield { error: j.error };
        else if (ev === "done") yield { done: true };
      } catch {}
    }
  }
}
