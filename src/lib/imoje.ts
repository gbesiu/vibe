/**
 * iMoje / ING Pay Payment Gateway Client
 * API docs: https://imoje.pl/dokumentacja
 * Sandbox: https://sandbox.imoje.pl
 */

const API_URL = process.env.IMOJE_API_URL || "https://sandbox.imoje.pl";
const MERCHANT_ID = process.env.IMOJE_MERCHANT_ID!;
const SERVICE_ID = process.env.IMOJE_SERVICE_ID!;
const SERVICE_KEY = process.env.IMOJE_SERVICE_KEY!;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImojeTransactionStatus =
  | "new"
  | "pending"
  | "completed"
  | "cancelled"
  | "rejected"
  | "error";

export type ImojeCreateTransactionParams = {
  amount: number; // grosze (PLN * 100)
  currency?: string; // default "PLN"
  orderId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone?: string;
  description?: string;
  urlReturn: string;
  urlSuccess: string;
  urlFailure: string;
};

export type ImojeTransaction = {
  id: string;
  status: ImojeTransactionStatus;
  orderId: string;
  amount: number;
  currency: string;
  paymentUrl: string;
  createdAt: string;
};

// ─── Auth header ──────────────────────────────────────────────────────────────

function getAuthHeader(): string {
  const credentials = Buffer.from(`${SERVICE_ID}:${SERVICE_KEY}`).toString("base64");
  return `Basic ${credentials}`;
}

// ─── Create transaction ───────────────────────────────────────────────────────

export async function createTransaction(
  params: ImojeCreateTransactionParams
): Promise<ImojeTransaction> {
  const body = {
    serviceId: SERVICE_ID,
    merchantId: MERCHANT_ID,
    amount: params.amount,
    currency: params.currency || "PLN",
    orderId: params.orderId,
    customer: {
      firstName: params.customerFirstName,
      lastName: params.customerLastName,
      email: params.customerEmail,
      phone: params.customerPhone,
    },
    billing: {
      firstName: params.customerFirstName,
      lastName: params.customerLastName,
      email: params.customerEmail,
    },
    transaction: {
      description: params.description || `Zamówienie #${params.orderId}`,
      notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/notify`,
      returnUrl: params.urlReturn,
      successUrl: params.urlSuccess,
      failureUrl: params.urlFailure,
    },
  };

  const res = await fetch(`${API_URL}/v1/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`iMoje create transaction failed: ${res.status} – ${err}`);
  }

  const data = await res.json();
  return {
    id: data.transaction?.id || data.id,
    status: data.transaction?.status || "new",
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency || "PLN",
    paymentUrl: data.transaction?.paymentUrl || data.paymentUrl || data.redirectUrl,
    createdAt: data.transaction?.createdAt || new Date().toISOString(),
  };
}

// ─── Get transaction status ───────────────────────────────────────────────────

export async function getTransactionStatus(transactionId: string): Promise<{
  id: string;
  status: ImojeTransactionStatus;
  orderId: string;
  amount: number;
}> {
  const res = await fetch(`${API_URL}/v1/payment/${transactionId}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!res.ok) {
    throw new Error(`iMoje get status failed: ${res.status}`);
  }

  return await res.json();
}

// ─── Verify notification signature ───────────────────────────────────────────

import crypto from "crypto";

export function verifyNotificationSignature(
  payload: string,
  receivedSignature: string
): boolean {
  // iMoje signs with HMAC-SHA256 using service key
  const expected = crypto
    .createHmac("sha256", SERVICE_KEY)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(receivedSignature, "hex")
  );
}

// ─── Parse notification ───────────────────────────────────────────────────────

export type ImojeNotification = {
  transaction: {
    id: string;
    orderId: string;
    status: ImojeTransactionStatus;
    amount: number;
    currency: string;
  };
};

export function parseNotification(body: unknown): ImojeNotification {
  return body as ImojeNotification;
}
