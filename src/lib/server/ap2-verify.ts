import { createHmac } from "node:crypto";

import type {
  AP2Mandate,
  AP2MandateVerification,
} from "@/types/ap2";

/**
 * Computes the expected HMAC-SHA256 signature for a mandate.
 */
function computeSignature(mandate: AP2Mandate): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }

  let amount: string;
  if (mandate.type === "intent") {
    amount = mandate.maxAmount;
  } else if (mandate.type === "cart") {
    amount = mandate.totalAmount;
  } else {
    amount = mandate.amount;
  }

  const payload = `${mandate.type}:${amount}:${mandate.currency}:${mandate.payerIdentity}:${mandate.expiresAt}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies an AP2 mandate:
 * 1. Checks HMAC-SHA256 signature using NEXTAUTH_SECRET
 * 2. Validates that the mandate has not expired
 */
export function verifyMandate(mandate: AP2Mandate): AP2MandateVerification {
  // Check expiry before doing crypto — fail fast on stale mandates
  const expiresAt = new Date(mandate.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return { valid: false, error: "Invalid expiresAt format" };
  }
  if (expiresAt < Date.now()) {
    return { valid: false, expired: true, error: "Mandate has expired" };
  }

  try {
    const expectedSignature = computeSignature(mandate);

    if (mandate.signature !== expectedSignature) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, mandate };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return { valid: false, error: message };
  }
}
