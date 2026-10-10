import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for the container healthcheck. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Health check failed", err);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
