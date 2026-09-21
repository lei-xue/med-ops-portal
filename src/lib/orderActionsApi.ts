import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { getApiSession, handleServiceError, unauthorized } from "@/lib/api";
import {
  cancelOrder,
  completeOrder,
  fillOrder,
  verifyOrder,
} from "@/lib/orderService";

export type TransitionAction = "verify" | "fill" | "complete" | "cancel";

const SERVICE_BY_ACTION = {
  verify: verifyOrder,
  fill: fillOrder,
  complete: completeOrder,
  cancel: cancelOrder,
} as const;

/** Builds a POST route handler for one order lifecycle transition. */
export function makeTransitionHandler(action: TransitionAction) {
  const transition = SERVICE_BY_ACTION[action];

  return async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
  ) {
    const session = await getApiSession(req);
    if (!session) return unauthorized();

    const { id } = await ctx.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return NextResponse.json(
        { error: "Invalid order id." },
        { status: 400 },
      );
    }

    try {
      const order = await transition(db, session, orderId);
      return NextResponse.json({ order });
    } catch (err) {
      return handleServiceError(err);
    }
  };
}
