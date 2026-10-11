import { NextResponse, type NextRequest } from "next/server";

import { readSessionFromRequest } from "@/lib/session";

/**
 * Next.js 16 proxy (formerly middleware). Protects all pages:
 * unauthenticated users are redirected to /login, authenticated users
 * away from /login. API routes are excluded — they enforce their own
 * session + role checks so they stay independently testable.
 *
 * The session cookie is only read here, never written. Auth.js's `auth()`
 * wrapper re-issued it on every page and prefetch request, so a request still
 * in flight during sign-out could put the cleared cookie straight back.
 * Sessions keep the fixed lifetime set at login.
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(await readSessionFromRequest(req));

  if (!isLoggedIn && pathname !== "/login") {
    const loginUrl = new URL("/login", publicOrigin(req));
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/", publicOrigin(req)));
  }

  return NextResponse.next();
}

/**
 * The origin the browser used. Behind the Cloudflare tunnel the app is
 * reached over plain HTTP, so take the protocol from X-Forwarded-Proto and the
 * host from the Host header, as Auth.js did.
 */
function publicOrigin(req: NextRequest): string {
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    req.nextUrl.protocol.replace(/:$/, "");
  const host = req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export const config = {
  matcher: [
    // All pages except API routes, Next internals and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
