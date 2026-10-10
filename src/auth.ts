import NextAuth from "next-auth";

import { USER_ROLES, type UserRole } from "@/db/schema";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session";

/**
 * Auth.js is used only to *read* the session (`auth()` in server components
 * and the proxy). Sessions are *minted* by POST /api/auth/login, which signs
 * the same JWT cookie with `encode` (see src/lib/session.ts). That keeps login
 * a plain JSON route that the API tests can call directly, so no Auth.js
 * sign-in provider or catch-all route is configured.
 */
export const { auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    session({ session, token }) {
      const role = token.role;
      session.user.id = token.sub ?? "";
      // Fail closed: a token without a known role is treated as signed out
      // by every page (they all check session.user.role).
      session.user.role =
        typeof role === "string" &&
        (USER_ROLES as readonly string[]).includes(role)
          ? (role as UserRole)
          : undefined;
      return session;
    },
  },
});
