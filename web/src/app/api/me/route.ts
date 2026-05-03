import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

async function proxy(req: NextRequest) {
  const c = await cookies();
  const sid = c.get("ch_sid")?.value ?? "";
  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (["host", "content-length"].includes(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  if (sid) headers.set("cookie", `ch_sid=${sid}`);
  const init: RequestInit = {
    method: req.method, headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    // @ts-ignore
    duplex: "half",
  };
  const r = await fetch(`${ORCH_URL}/api/me`, init);
  const h = new Headers();
  r.headers.forEach((v, k) => {
    if (["content-length", "content-encoding", "transfer-encoding"].includes(k.toLowerCase())) return;
    h.set(k, v);
  });
  return new NextResponse(r.body, { status: r.status, headers: h });
}
export const GET = proxy;
export const PUT = proxy;
export const dynamic = "force-dynamic";
