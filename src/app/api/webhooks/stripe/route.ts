export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { checkoutSessions } from "@/lib/db/schema";
import { handleStripeWebhook } from "@/lib/server/stripe";
import { processCheckout } from "@/lib/server/checkout";

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler. Verifies signature and dispatches events.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let payload: string;
  try {
    payload = await req.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const event = handleStripeWebhook(payload, signature);
  if (!event) {
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntentId = event.data.id as string | undefined;
    if (paymentIntentId) {
      // Find checkout session with this payment ref and authorize it
      const session = db
        .select()
        .from(checkoutSessions)
        .where(eq(checkoutSessions.paymentRef, paymentIntentId))
        .get();

      if (session && session.status === "open") {
        processCheckout(db, session.id, "authorize");
      }
    }
  }

  return NextResponse.json({ received: true });
}
