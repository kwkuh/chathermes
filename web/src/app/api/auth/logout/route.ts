import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ORCH_URL = process.env.ORCH_URL ?? "http://127.0.0.1:7010";

export async function POST(req: NextRequest) {
  const c = await cookies();
  const sid = c.get("ch_sid")?.value;
  try {
    await fetch(`${ORCH_URL}/auth/logout`, { method: "POST", headers: { cookie: sid ? `ch_sid=${sid}` : "" } });
  } catch {}
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ch_sid", "", { path: "/", maxAge: 0 });
  return res;
}
