import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { fieldErrorsFrom, getApiSession, handleServiceError, unauthorized } from "@/lib/api";
import { createOrder } from "@/lib/orderService";

const createOrderSchema = z.object({
  patientName: z.string().trim().min(1, "Patient name is required.").max(120),
  medicationId: z.number().int().positive(),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1000, "Quantity is unreasonably large."),
  notes: z.string().trim().max(500).nullish(),
});

export async function POST(req: NextRequest) {
  const session = await getApiSession(req);
  if (!session) return unauthorized();

  const body: unknown = await req.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid order payload.",
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      },
      { status: 400 },
    );
  }

  try {
    const order = await createOrder(db, session, {
      patientName: parsed.data.patientName,
      medicationId: parsed.data.medicationId,
      quantity: parsed.data.quantity,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
