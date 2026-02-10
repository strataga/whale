import "server-only";

import { eq } from "drizzle-orm";
import { x402Prices, x402Transactions } from "@/lib/db/schema";
import type { AnyDb } from "@/types";

/**
 * Minimal glob-style matcher: supports `*` (any segment chars) and `**` (any path).
 * For route patterns like `/api/agents/** /skills/*`.
 */
function globMatch(pattern: string, path: string): boolean {
  // Escape regex-special chars except * and **
  const regexStr = pattern
    .split("**")
    .map((segment) =>
      segment
        .split("*")
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${regexStr}$`).test(path);
}

type CheckResult =
  | { required: false; transactionId?: string }
  | { required: true; price: { amount: string; network: string; asset: string } };

/**
 * Checks whether a route requires x402 payment.
 * - If no price is configured for the route, returns { required: false }.
 * - If a price exists but no PAYMENT-SIGNATURE header, returns { required: true, price }.
 * - If a valid PAYMENT-SIGNATURE is present and verified, returns { required: false, transactionId }.
 */
export async function checkX402Payment(
  database: AnyDb,
  routePath: string,
  workspaceId: string,
  request: Request,
): Promise<CheckResult> {
  // Find matching price rule
  const prices = database
    .select()
    .from(x402Prices)
    .where(eq(x402Prices.workspaceId, workspaceId))
    .all() as (typeof x402Prices.$inferSelect)[];

  const matchedPrice = prices.find((p) => globMatch(p.routePattern, routePath));

  if (!matchedPrice) {
    return { required: false };
  }

  const paymentSignature = request.headers.get("payment-signature");

  if (!paymentSignature) {
    return {
      required: true,
      price: {
        amount: matchedPrice.amountUsdc,
        network: matchedPrice.network,
        asset: "USDC",
      },
    };
  }

  // Verify payment via facilitator
  const facilitatorUrl = process.env.X402_FACILITATOR_URL;
  if (!facilitatorUrl) {
    // No facilitator configured -- cannot verify; reject
    return {
      required: true,
      price: {
        amount: matchedPrice.amountUsdc,
        network: matchedPrice.network,
        asset: "USDC",
      },
    };
  }

  try {
    const verifyResponse = await fetch(`${facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentSignature,
        amount: matchedPrice.amountUsdc,
        network: matchedPrice.network,
        asset: "USDC",
      }),
    });

    if (!verifyResponse.ok) {
      return {
        required: true,
        price: {
          amount: matchedPrice.amountUsdc,
          network: matchedPrice.network,
          asset: "USDC",
        },
      };
    }

    const verifyData = (await verifyResponse.json()) as {
      valid?: boolean;
      txHash?: string;
      payerAddress?: string;
    };

    if (!verifyData.valid) {
      return {
        required: true,
        price: {
          amount: matchedPrice.amountUsdc,
          network: matchedPrice.network,
          asset: "USDC",
        },
      };
    }

    // Record verified transaction
    const transactionId = crypto.randomUUID();
    const now = Date.now();

    database
      .insert(x402Transactions)
      .values({
        id: transactionId,
        workspaceId,
        payerAddress: verifyData.payerAddress ?? "unknown",
        amount: matchedPrice.amountUsdc,
        asset: "USDC",
        network: matchedPrice.network,
        txHash: verifyData.txHash ?? null,
        status: "authorized",
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return { required: false, transactionId };
  } catch {
    // Network error talking to facilitator -- require payment
    return {
      required: true,
      price: {
        amount: matchedPrice.amountUsdc,
        network: matchedPrice.network,
        asset: "USDC",
      },
    };
  }
}
