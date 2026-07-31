import { NextRequest, NextResponse } from "next/server";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const url = new URL(req.url);
  const target = `${ORCH_URL}/api/setup/${path.join("/")}${url.search}`;

  const r = await fetch(target, {
    method: req.method,
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
  });

  const res = new NextResponse(r.body, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" },
  });
  // /api/setup/complete signs the operator in, so the session cookie has to
  // survive the hop through this proxy.
  const setCookie = r.headers.get("set-cookie");
  if (setCookie) res.headers.set("set-cookie", setCookie);
  return res;
}

export const GET = proxy;
export const POST = proxy;
export const dynamic = "force-dynamic";
