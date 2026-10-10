import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Session for a server-rendered page, or a redirect to /login.
 *
 * The proxy already redirects signed-out visitors; pages check again so a
 * proxy misconfiguration fails closed instead of rendering data anonymously.
 */
export async function requirePageSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  return session;
}
