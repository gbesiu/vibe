import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { createTransaction } from "@/lib/imoje";

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Musisz być zalogowany" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { items, shippingData } = body as {
      items: { productId: string; quantity: number }[];
      shippingData: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        address: string;
        city: string;
        zip: string;
        country?: string;
      };
    };

    if (!items?.length) {
      return NextResponse.json({ error: "Koszyk jest pusty" }, { status: 400 });
    }

    // ── Fetch products and verify stock ────────────────────────────────────
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, isActive: true },
    });

    if (products.length !== items.length) {
      return NextResponse.json({ error: "Jeden lub więcej produktów jest niedostępny" }, { status: 400 });
    }

    // ── Calculate totals ───────────────────────────────────────────────────
    let subtotal = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      return {
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
      };
    });

    const shipping = 0; // TODO: add shipping logic
    const total = subtotal + shipping;

    // ── Create order in DB ─────────────────────────────────────────────────
    const order = await prisma.order.create({
      data: {
        userId,
        status: "AWAITING_PAYMENT",
        subtotal,
        shipping,
        total,
        shippingName: `${shippingData.firstName} ${shippingData.lastName}`,
        shippingEmail: shippingData.email,
        shippingPhone: shippingData.phone,
        shippingAddress: shippingData.address,
        shippingCity: shippingData.city,
        shippingZip: shippingData.zip,
        shippingCountry: shippingData.country || "PL",
        items: {
          create: orderItems,
        },
      },
    });

    // ── Create iMoje transaction ───────────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const amountInGrosze = Math.round(total * 100);

    const transaction = await createTransaction({
      amount: amountInGrosze,
      currency: "PLN",
      orderId: order.id,
      customerFirstName: shippingData.firstName,
      customerLastName: shippingData.lastName,
      customerEmail: shippingData.email,
      customerPhone: shippingData.phone,
      description: `Zamówienie Krypton #${order.id.slice(0, 8)}`,
      urlReturn: `${baseUrl}/orders/${order.id}`,
      urlSuccess: `${baseUrl}/orders/${order.id}?status=success`,
      urlFailure: `${baseUrl}/orders/${order.id}?status=failure`,
    });

    // ── Save transaction ID ────────────────────────────────────────────────
    await prisma.order.update({
      where: { id: order.id },
      data: {
        imojeTransactionId: transaction.id,
        imojePaymentUrl: transaction.paymentUrl,
        imojeStatus: transaction.status,
      },
    });

    // ── Clear user's cart ──────────────────────────────────────────────────
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentUrl: transaction.paymentUrl,
    });
  } catch (err) {
    console.error("[Checkout] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
