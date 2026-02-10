import { createHmac } from "node:crypto";

import type {
  AP2Mandate,
  AP2MandateCreateRequest,
} from "@/types/ap2";
import type { AnyDb } from "@/types";
import { paymentMandates } from "@/lib/db/schema";

const DEFAULT_TTL_SECONDS = 3600; // 1 hour

/**
 * Signs a mandate payload with HMAC-SHA256 using NEXTAUTH_SECRET.
 */
function signMandate(
  type: string,
  amount: string,
  currency: string,
  payerIdentity: string,
  expiresAt: string,
): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  const payload = `${type}:${amount}:${currency}:${payerIdentity}:${expiresAt}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Creates an AP2 mandate, signs it, and stores it in the paymentMandates table.
 */
export function createMandate(
  database: AnyDb,
  data: AP2MandateCreateRequest,
  workspaceId: string,
): AP2Mandate {
  const id = crypto.randomUUID();
  const ttl = data.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // Determine the amount field based on mandate type
  const amount = data.amount;

  const signature = signMandate(
    data.type,
    amount,
    data.currency,
    data.payerIdentity,
    expiresAt,
  );

  const now = Date.now();

  // Store in DB
  database
    .insert(paymentMandates)
    .values({
      id,
      workspaceId,
      type: data.type,
      payerIdentity: data.payerIdentity,
      amount,
      currency: data.currency,
      status: "authorized",
      signature,
      expiresAt: new Date(expiresAt).getTime(),
      metadata: JSON.stringify({
        description: data.description,
        lineItems: data.lineItems,
        recipientIdentity: data.recipientIdentity,
        reference: data.reference,
      }),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Build the typed mandate object
  if (data.type === "intent") {
    return {
      type: "intent",
      id,
      payerIdentity: data.payerIdentity,
      maxAmount: amount,
      currency: data.currency,
      description: data.description ?? "",
      expiresAt,
      signature,
    };
  }

  if (data.type === "cart") {
    return {
      type: "cart",
      id,
      payerIdentity: data.payerIdentity,
      lineItems: data.lineItems ?? [],
      totalAmount: amount,
      currency: data.currency,
      expiresAt,
      signature,
    };
  }

  // type === "payment"
  return {
    type: "payment",
    id,
    payerIdentity: data.payerIdentity,
    amount,
    currency: data.currency,
    recipientIdentity: data.recipientIdentity ?? "",
    reference: data.reference ?? "",
    expiresAt,
    signature,
  };
}
