import { NextResponse } from "next/server";

import { OrderServiceError } from "@/lib/orderService";
import { readSessionFromRequest, type SessionUser } from "@/lib/session";

const SERVICE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_TRANSITION: 409,
  INSUFFICIENT_STOCK: 409,
  STALE_STOCK: 409,
};

/** Upper bound for JSON request bodies; every payload here is a few hundred bytes. */
export const MAX_JSON_BODY_BYTES = 16 * 1024;

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401 },
  );
}

export async function getApiSession(
  req: Request,
): Promise<SessionUser | null> {
  return readSessionFromRequest(req);
}

export function handleServiceError(err: unknown): NextResponse {
  if (err instanceof OrderServiceError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: SERVICE_STATUS[err.code] ?? 400 },
    );
  }
  console.error("Unhandled API error", err);
  return NextResponse.json(
    { error: "Internal server error." },
    { status: 500 },
  );
}

/** Flatten zod issues into a { field: messages } map for form error display. */
export function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Parse a JSON body, refusing oversized payloads before reading them fully.
 * Returns `{ tooLarge: true }` (→ 413) or the parsed value (null if invalid).
 */
export async function readJsonBody(
  req: Request,
): Promise<{ tooLarge: true } | { tooLarge: false; body: unknown }> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_JSON_BODY_BYTES) return { tooLarge: true };

  const text = await req.text().catch(() => "");
  if (text.length > MAX_JSON_BODY_BYTES) return { tooLarge: true };
  try {
    return { tooLarge: false, body: JSON.parse(text) as unknown };
  } catch {
    return { tooLarge: false, body: null };
  }
}

export function payloadTooLarge(): NextResponse {
  return NextResponse.json({ error: "Request body too large." }, { status: 413 });
}

/**
 * Client address for rate limiting and audit.
 *
 * In production Caddy sets X-Real-IP from the socket address, trusting
 * CF-Connecting-IP only from Cloudflare's ranges, and strips client-supplied
 * copies (see Caddyfile). The app itself listens on loopback only. The other
 * headers are fallbacks for local runs and tests without Caddy.
 */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
