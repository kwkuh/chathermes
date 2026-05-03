import { NextRequest, NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse("missing token", { status: 400 });

  const r = await orchFetch(`/auth/verify?token=${encodeURIComponent(token)}`, {
    method: "GET",
    redirect: "manual",
  });

  if (r.status >= 400) {
    return new NextResponse(await r.text(), { status: r.status });
  }

  // Build absolute redirect using forwarded host (works behind proxies/binds)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "chathermes.com";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const setCookie = r.headers.get("set-cookie");
  const res = NextResponse.redirect(`${proto}://${host}/app`);
  if (setCookie) res.headers.set("set-cookie", setCookie);
  return res;
}
