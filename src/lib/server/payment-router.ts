import "server-only";

/**
 * Unified payment dispatch — reads the provider type on the checkout session
 * and delegates to the correct handler (stripe / x402 / manual).
 */

import { eq } from "drizzle-orm";

import { checkoutSessions, paymentProviders } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { processCheckout } from "@/lib/server/checkout";
import { createPaymentIntent } from "@/lib/server/stripe";
import type { AnyDb } from "@/types";

export async function routePayment(
  db: AnyDb,
  checkoutSessionId: string,
  action: "authorize" | "capture" | "settle",
): Promise<{ ok: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const session = d
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, checkoutSessionId))
    .get();

  if (!session) {
    return { ok: false, error: "Checkout session not found" };
  }

  // If no payment provider is attached, treat as manual
  if (!session.paymentProviderId) {
    return processCheckout(db, checkoutSessionId, action);
  }

  const provider = d
    .select()
    .from(paymentProviders)
    .where(eq(paymentProviders.id, session.paymentProviderId))
    .get();

  if (!provider) {
    return { ok: false, error: "Payment provider not found" };
  }

  const providerType = provider.type as string;

  switch (providerType) {
    case "stripe": {
      if (action === "authorize") {
        // Create a Stripe PaymentIntent for the session amount
        const config = JSON.parse(decrypt(provider.configEncrypted));
        const result = await createPaymentIntent(
          session.totalCents,
          "usd",
          { checkoutSessionId, ...config.metadata },
        );
        if (!result) {
          return { ok: false, error: "Failed to create Stripe payment intent" };
        }
        // Store the payment ref
        d.update(checkoutSessions)
          .set({ paymentRef: result.paymentIntentId, updatedAt: Date.now() })
          .where(eq(checkoutSessions.id, checkoutSessionId))
          .run();
      }
      return processCheckout(db, checkoutSessionId, action);
    }

    case "x402": {
      // x402 transactions are settled on-chain; state machine is the same
      return processCheckout(db, checkoutSessionId, action);
    }

    case "manual":
    default: {
      return processCheckout(db, checkoutSessionId, action);
    }
  }
}
