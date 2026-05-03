import { NextRequest, NextResponse } from "next/server";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return new NextResponse("Bad request", { status: 400 });
  try {
    const r = await fetch(`${ORCH_URL}/p/${encodeURIComponent(slug)}`, { method: "GET" });
    if (!r.ok) {
      return new NextResponse(`Not found or not published`, { status: r.status });
    }
    const body = await r.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Powered-By": "ChatHermes.dev",
      },
    });
  } catch (e: any) {
    return new NextResponse(`Upstream error: ${e.message}`, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
