import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import {
  fieldErrorsFrom,
  getApiSession,
  handleServiceError,
  payloadTooLarge,
  readJsonBody,
  unauthorized,
} from "@/lib/api";
import { createOrder } from "@/lib/orderService";

const createOrderSchema = z.object({
  patientId: z.number({ error: "Choose a patient." }).int().positive("Choose a patient."),
  // Whether it's required depends on the medication; the service decides.
  prescriberId: z.number().int().positive().nullish(),
  medicationId: z.number({ error: "Choose a medication." }).int().positive("Choose a medication."),
  quantity: z
    .number({ error: "Enter a quantity." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(1000, "Quantity is unreasonably large."),
  directions: z.string().trim().max(500).nullish(),
  refills: z
    .number()
    .int("Refills must be a whole number.")
    .min(0, "Refills cannot be negative.")
    .optional(),
  daysSupply: z
    .number()
    .int("Days supply must be a whole number.")
    .min(1, "Days supply must be at least 1.")
    .max(365, "Days supply can be at most 365.")
    .nullish(),
  notes: z.string().trim().max(500).nullish(),
});

export async function POST(req: NextRequest) {
  const session = await getApiSession(req);
  if (!session) return unauthorized();

  const read = await readJsonBody(req);
  if (read.tooLarge) return payloadTooLarge();
  const body = read.body;
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
      patientId: parsed.data.patientId,
      prescriberId: parsed.data.prescriberId ?? null,
      medicationId: parsed.data.medicationId,
      quantity: parsed.data.quantity,
      directions: parsed.data.directions ?? null,
      refills: parsed.data.refills ?? 0,
      daysSupply: parsed.data.daysSupply ?? null,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
