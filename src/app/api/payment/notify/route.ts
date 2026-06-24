import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyNotificationSignature, parseNotification } from "@/lib/imoje";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-imoje-signature") || "";

    // Verify signature
    if (process.env.IMOJE_SERVICE_KEY) {
      const isValid = verifyNotificationSignature(rawBody, signature);
      if (!isValid) {
        console.warn("[iMoje notify] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const body = parseNotification(JSON.parse(rawBody));
    const { transaction } = body;

    if (!transaction?.orderId || !transaction?.status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Find order by ID
    const order = await prisma.order.findUnique({
      where: { id: transaction.orderId },
    });

    if (!order) {
      console.error(`[iMoje notify] Order not found: ${transaction.orderId}`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Map iMoje status to our OrderStatus
    type OrderStatus = "PENDING" | "AWAITING_PAYMENT" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
    const statusMap: Record<string, OrderStatus> = {
      new: "AWAITING_PAYMENT",
      pending: "AWAITING_PAYMENT",
      completed: "PAID",
      cancelled: "CANCELLED",
      rejected: "CANCELLED",
      error: "CANCELLED",
    };

    const newStatus = statusMap[transaction.status] || order.status;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        imojeStatus: transaction.status,
        imojeTransactionId: transaction.id,
        paidAt: transaction.status === "completed" ? new Date() : order.paidAt,
      },
    });

    console.log(`[iMoje notify] Order ${order.id} → ${newStatus}`);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[iMoje notify] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
