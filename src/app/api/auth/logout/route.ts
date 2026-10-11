import { NextResponse, type NextRequest } from "next/server";

import { isSecureRequest, publicOrigin, sessionCookieOptions } from "@/lib/session";

/**
 * Clears the session cookie. The Sign out button posts a plain form, so it
 * works before the page's JavaScript has loaded; that request is sent on to
 * the login page. Other callers (fetch, tests) get JSON.
 */
export async function POST(req: NextRequest) {
  const fromForm = (req.headers.get("content-type") ?? "").includes(
    "application/x-www-form-urlencoded",
  );
  // A form post from another site could otherwise sign users out at will.
  const origin = req.headers.get("origin");
  if (fromForm && origin && origin !== publicOrigin(req)) {
    return NextResponse.json({ error: "Cross-site sign-out refused." }, { status: 403 });
  }

  const res = fromForm
    ? NextResponse.redirect(new URL("/login", publicOrigin(req)), 303)
    : NextResponse.json({ ok: true });
  res.cookies.set({
    ...sessionCookieOptions(isSecureRequest(req)),
    value: "",
    maxAge: 0,
  });
  return res;
}
