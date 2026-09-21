import { encode, getToken } from "next-auth/jwt";

import type { UserRole } from "@/db/schema";

/**
 * Session handling for Auth.js v5 (JWT strategy).
 *
 * Sessions are stateless JWTs encrypted with AUTH_SECRET. The login route
 * handler mints the token with `encode` using the session cookie name as the
 * salt — exactly what Auth.js core does internally — so `auth()` (server
 * components) and `getToken` (route handlers) both read the same cookie.
 */

export const SESSION_COOKIE_NAME = "authjs.session-token";
export const SESSION_COOKIE_NAME_SECURE = `__Secure-${SESSION_COOKIE_NAME}`;
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export function sessionCookieName(secure: boolean): string {
  return secure ? SESSION_COOKIE_NAME_SECURE : SESSION_COOKIE_NAME;
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export interface SessionCookieOptions {
  name: string;
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
}

export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
  return {
    name: sessionCookieName(secure),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function mintSessionToken(user: SessionUser): Promise<string> {
  return encode({
    token: {
      sub: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    secret: requireAuthSecret(),
    salt: SESSION_COOKIE_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function readSessionFromRequest(
  req: Request,
): Promise<SessionUser | null> {
  const secure = isSecureRequest(req);
  const payload = await getToken({
    req,
    secret: requireAuthSecret(),
    secureCookie: secure,
  });

  if (!payload?.sub || typeof payload.role !== "string") return null;
  return {
    id: Number(payload.sub),
    name: typeof payload.name === "string" ? payload.name : "",
    email: typeof payload.email === "string" ? payload.email : "",
    role: payload.role as UserRole,
  };
}

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Configure it in .env");
  }
  return secret;
}
