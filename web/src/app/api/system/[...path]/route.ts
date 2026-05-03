import { NextRequest, NextResponse } from "next/server";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const url = new URL(req.url);
  const target = `${ORCH_URL}/api/system/${path.join("/")}${url.search}`;
  const r = await fetch(target, { method: req.method });
  return new NextResponse(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" } });
}
export const GET = proxy;
export const dynamic = "force-dynamic";
