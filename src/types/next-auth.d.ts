import type { DefaultSession } from "next-auth";

import type { UserRole } from "@/db/schema";

declare module "next-auth" {
  interface User {
    role?: UserRole;
  }

  interface Session {
    user: {
      id: string;
      /** Undefined when the token carries no known role: treat as signed out. */
      role?: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
  }
}
