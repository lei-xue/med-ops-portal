import { NextResponse } from "next/server";

import { OrderServiceError } from "@/lib/orderService";
import { readSessionFromRequest, type SessionUser } from "@/lib/session";

const SERVICE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_TRANSITION: 409,
  INSUFFICIENT_STOCK: 409,
};

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
