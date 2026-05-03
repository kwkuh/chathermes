import { NextRequest, NextResponse } from "next/server";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const url = new URL(req.url);
  const target = `${ORCH_URL}/api/billing/${path.join("/")}${url.search}`;
  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (["host", "content-length"].includes(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  const init: RequestInit = {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
    // @ts-ignore
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
