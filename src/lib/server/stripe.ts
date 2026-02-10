import "server-only";

/**
 * Stripe integration helpers.
 * Gracefully degrades to null if STRIPE_SECRET_KEY is not configured.
 */

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  // Lazy-import stripe to avoid module errors when key is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe") as typeof import("stripe").default;
  return new Stripe(secretKey);
}

export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
): Promise<{ clientSecret: string; paymentIntentId: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const pi = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      metadata,
    });
    return {
      clientSecret: pi.client_secret ?? "",
      paymentIntentId: pi.id,
    };
  } catch {
    return null;
  }
}

export function handleStripeWebhook(
  payload: string,
  signature: string,
): { type: string; data: Record<string, unknown> } | null {
  const stripe = getStripe();
  if (!stripe) return null;

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) return null;

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    return {
      type: event.type,
      data: event.data.object as unknown as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
