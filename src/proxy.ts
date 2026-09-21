import { NextResponse } from "next/server";

import { auth } from "@/auth";

/**
 * Next.js 16 proxy (formerly middleware). Protects all pages:
 * unauthenticated users are redirected to /login, authenticated users
 * away from /login. API routes are excluded — they enforce their own
 * session + role checks so they stay independently testable.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);

  if (!isLoggedIn && pathname !== "/login") {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // All pages except API routes, Next internals and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
