import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { orchFetch } from "./orch";

export type User = { id: string; email: string; name: string | null; role: "user" | "admin"; created_at: number };
export type Tenant = { id: string; user_id: string; port: number; status: string; last_active_at: number; created_at: number } | null;

export async function getMe(): Promise<{ user: User; tenant: Tenant } | null> {
  const c = await cookies();
  const sid = c.get("ch_sid")?.value;
  if (!sid) return null;
  const r = await orchFetch("/api/me", { headers: { cookie: `ch_sid=${sid}` } });
  if (!r.ok) return null;
  return r.json();
}

export async function requireUser() {
  const me = await getMe();
  if (!me) redirect("/auth/login");
  return me;
}

export async function requireAdmin() {
  const me = await getMe();
  if (!me) redirect("/auth/login");
  if (me.user.role !== "admin") redirect("/app");
  return me;
}

export async function adminFetch<T = unknown>(path: string): Promise<T | null> {
  const c = await cookies();
  const sid = c.get("ch_sid")?.value;
  if (!sid) return null;
  const r = await orchFetch(path, { headers: { cookie: `ch_sid=${sid}` } });
  if (!r.ok) return null;
  return r.json();
}
