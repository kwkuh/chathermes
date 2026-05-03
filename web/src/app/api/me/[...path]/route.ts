import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const c = await cookies();
  const sid = c.get("ch_sid")?.value ?? "";
  const url = new URL(req.url);
  const target = `${ORCH_URL}/api/me/${path.join("/")}${url.search}`;

  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (["host", "content-length"].includes(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  if (sid) headers.set("cookie", `ch_sid=${sid}`);

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    // @ts-ignore bun/node duplex for streaming
    duplex: "half",
  };

  const r = await fetch(target, init);
  const respHeaders = new Headers();
  r.headers.forEach((v, k) => {
    if (["content-length", "content-encoding", "transfer-encoding"].includes(k.toLowerCase())) return;
    respHeaders.set(k, v);
  });
  return new NextResponse(r.body, { status: r.status, headers: respHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
export const dynamic = "force-dynamic";
