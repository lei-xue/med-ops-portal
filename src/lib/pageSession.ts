import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { UserRole } from "@/db/schema";

export type PageSession = Session & {
  user: Session["user"] & { role: UserRole };
};

/**
 * Session for a server-rendered page, or a redirect to /login.
 *
 * The proxy already redirects signed-out visitors; pages check again so a
 * proxy misconfiguration fails closed instead of rendering data anonymously.
 */
export async function requirePageSession(): Promise<PageSession> {
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  return session as PageSession;
}
