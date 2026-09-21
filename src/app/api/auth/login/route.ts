import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { recordLogin, verifyCredentials } from "@/lib/authService";
import {
  isSecureRequest,
  mintSessionToken,
  sessionCookieOptions,
} from "@/lib/session";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const secure = isSecureRequest(req);
  const token = await mintSessionToken(user, secure);
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
  res.cookies.set({
    ...sessionCookieOptions(secure),
    value: token,
  });

  await recordLogin(user);
  return res;
}
