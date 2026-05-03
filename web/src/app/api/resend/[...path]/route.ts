import { NextRequest, NextResponse } from "next/server";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const url = new URL(req.url);
  const target = `${ORCH_URL}/api/resend/${path.join("/")}${url.search}`;
  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (["host", "content-length"].includes(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  // Webhook needs raw body — use req.text() to read once and pass forward
  const rawBody = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
  const r = await fetch(target, {
    method: req.method,
    headers,
    body: rawBody,
  });
  const respHeaders = new Headers();
  r.headers.forEach((v, k) => {
    if (["content-length", "content-encoding", "transfer-encoding"].includes(k.toLowerCase())) return;
    respHeaders.set(k, v);
  });
  const body = await r.arrayBuffer();
  return new NextResponse(body, { status: r.status, headers: respHeaders });
}

export const GET = proxy;
export const POST = proxy;
