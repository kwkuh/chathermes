import { NextRequest, NextResponse } from "next/server";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const r = await fetch(`${ORCH_URL}/api`);
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
