import { NextResponse, type NextRequest } from "next/server";

import { getApiSession, handleServiceError, unauthorized } from "@/lib/api";
import { getOrderDetail } from "@/lib/queries";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getApiSession(req);
  if (!session) return unauthorized();

  const { id } = await ctx.params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  try {
    const order = await getOrderDetail(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (err) {
    return handleServiceError(err);
  }
}
