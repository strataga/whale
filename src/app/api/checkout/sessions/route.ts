export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { checkoutSessions, agentProducts, agents } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/**
 * POST /api/checkout/sessions
 * Create a new checkout session with line items.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const { lineItems, buyerAgentId, paymentProviderId } = body as {
    lineItems?: Array<{ productId: string; quantity: number }>;
    buyerAgentId?: string;
    paymentProviderId?: string;
  };

  if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    return jsonError(400, "lineItems must be a non-empty array");
  }

  // Validate each line item and calculate total
  let totalCents = 0;
  for (const item of lineItems) {
    if (!item.productId || typeof item.productId !== "string") {
      return jsonError(400, "Each lineItem must have a productId");
    }
    if (!item.quantity || typeof item.quantity !== "number" || item.quantity < 1) {
      return jsonError(400, "Each lineItem must have a positive quantity");
    }

    const product = db
      .select()
      .from(agentProducts)
      .where(eq(agentProducts.id, item.productId))
      .get();

    if (!product) {
      return jsonError(404, `Product not found: ${item.productId}`);
    }
    if (!product.active) {
      return jsonError(400, `Product is not active: ${item.productId}`);
    }

    totalCents += product.priceCents * item.quantity;
  }

  // Validate buyerAgentId if provided
  if (buyerAgentId) {
    const buyer = db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.id, buyerAgentId))
      .get();

    if (!buyer) {
      return jsonError(404, "Buyer agent not found");
    }
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  db.insert(checkoutSessions)
    .values({
      id,
      workspaceId: ctx.workspaceId,
      buyerAgentId: buyerAgentId ?? null,
      status: "open",
      lineItems: JSON.stringify(lineItems),
      totalCents,
      paymentProviderId: paymentProviderId ?? null,
      expiresAt: now + THIRTY_MINUTES_MS,
    })
    .run();

  const session = db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, id))
    .get();

  return NextResponse.json({ session }, { status: 201 });
}
