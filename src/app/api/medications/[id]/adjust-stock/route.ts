import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { getApiSession, handleServiceError, unauthorized } from "@/lib/api";
import { adjustStock } from "@/lib/orderService";

const adjustStockSchema = z.object({
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(0, "Quantity cannot be negative.")
    .max(1_000_000, "Quantity is unreasonably large."),
  reason: z.string().trim().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getApiSession(req);
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  const medicationId = Number(id);
  if (!Number.isInteger(medicationId)) {
    return NextResponse.json(
      { error: "Invalid medication id." },
      { status: 400 },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = adjustStockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const medication = await adjustStock(db, session, {
      medicationId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason ?? null,
    });
    return NextResponse.json({ medication });
  } catch (err) {
    return handleServiceError(err);
  }
}
