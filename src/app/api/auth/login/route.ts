import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { clientIp, payloadTooLarge, readJsonBody } from "@/lib/api";
import {
  auditInBackground,
  recordFailedLogin,
  recordLogin,
  verifyCredentials,
} from "@/lib/authService";
import {
  loginPerAccount,
  loginPerAddress,
  loginPerEmail,
} from "@/lib/loginRateLimit";
import {
  isSecureRequest,
  mintSessionToken,
  sessionCookieOptions,
} from "@/lib/session";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function tooManyAttempts(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Too many sign-in attempts. Try again in a few minutes." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: NextRequest) {
  const read = await readJsonBody(req);
  if (read.tooLarge) return payloadTooLarge();

  const parsed = loginSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  const context = {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  };
  const email = parsed.data.email.trim().toLowerCase();

  const byAddress = loginPerAddress.hit(context.ip);
  if (!byAddress.ok) return tooManyAttempts(byAddress.retryAfter);
  const byAccount = loginPerAccount.hit(`${context.ip}|${email}`);
  if (!byAccount.ok) return tooManyAttempts(byAccount.retryAfter);
  const byEmail = loginPerEmail.hit(email);
  if (!byEmail.ok) return tooManyAttempts(byEmail.retryAfter);

  const user = await verifyCredentials(email, parsed.data.password);
  if (!user) {
    auditInBackground(recordFailedLogin(email, context));
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  loginPerAccount.reset(`${context.ip}|${email}`);
  const secure = isSecureRequest(req);
  const token = await mintSessionToken(user, secure);
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  res.cookies.set({
    ...sessionCookieOptions(secure),
    value: token,
  });

  auditInBackground(recordLogin(user, context));
  return res;
}
