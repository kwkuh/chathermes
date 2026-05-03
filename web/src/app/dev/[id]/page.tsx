import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { orchFetch } from "@/lib/orch";
import VibeWorkspace from "./_vibe-workspace";

export default async function DevPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await cookies();
  const sid = c.get("ch_sid")?.value;
  if (!sid) redirect("/auth/login");

  const r = await orchFetch(`/api/me/projects/${id}`, { headers: { cookie: `ch_sid=${sid}` } });
  if (r.status === 404) redirect("/app/projects");
  if (!r.ok) redirect("/auth/login");
  const data = (await r.json()) as { project: any; messages: any[] };

  return <VibeWorkspace project={data.project} initialMessages={data.messages} />;
}
