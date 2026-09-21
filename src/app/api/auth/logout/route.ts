import { NextResponse, type NextRequest } from "next/server";

import { isSecureRequest, sessionCookieOptions } from "@/lib/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    ...sessionCookieOptions(isSecureRequest(req)),
    value: "",
    maxAge: 0,
  });
  return res;
}
