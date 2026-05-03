import { NextRequest, NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const r = await orchFetch("/auth/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await r.text();
  return new NextResponse(data, {
    status: r.status,
    headers: { "Content-Type": "application/json" },
  });
}
