import { eq } from "drizzle-orm";

import { paymentDisputes, checkoutSessions, x402Transactions } from "@/lib/db/schema";
import { updateAgentReputation } from "@/lib/server/agent-registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { select: any; insert: any; update: any; delete: any };

interface OpenDisputeData {
  workspaceId: string;
  checkoutSessionId?: string;
  x402TransactionId?: string;
  reason: string;
}

/**
 * Open a payment dispute. Returns the dispute ID.
 */
export function openDispute(db: AnyDb, data: OpenDisputeData): string {
  const id = crypto.randomUUID();
  const now = Date.now();

  db.insert(paymentDisputes)
    .values({
      id,
      workspaceId: data.workspaceId,
      checkoutSessionId: data.checkoutSessionId ?? null,
      x402TransactionId: data.x402TransactionId ?? null,
      reason: data.reason,
      evidence: "{}",
      status: "open",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // If linked to a checkout session, mark it as disputed
  if (data.checkoutSessionId) {
    db.update(checkoutSessions)
      .set({ status: "disputed", updatedAt: now })
      .where(eq(checkoutSessions.id, data.checkoutSessionId))
      .run();
  }

  // If linked to an x402 transaction, mark it as disputed
  if (data.x402TransactionId) {
    db.update(x402Transactions)
      .set({ status: "disputed", updatedAt: now })
      .where(eq(x402Transactions.id, data.x402TransactionId))
      .run();
  }

  return id;
}

/**
 * Resolve a dispute, adjusting agent reputation accordingly.
 * Returns true if the dispute was resolved successfully.
 */
export function resolveDispute(
  db: AnyDb,
  disputeId: string,
  resolution: "resolved_buyer" | "resolved_seller",
  userId: string,
): boolean {
  const dispute = db
    .select()
    .from(paymentDisputes)
    .where(eq(paymentDisputes.id, disputeId))
    .get();

  if (!dispute || dispute.status !== "open") return false;

  const now = Date.now();

  db.update(paymentDisputes)
    .set({
      status: resolution,
      resolvedBy: userId,
      resolvedAt: now,
      updatedAt: now,
    })
    .where(eq(paymentDisputes.id, disputeId))
    .run();

  // Adjust agent reputation based on resolution
  if (dispute.checkoutSessionId) {
    const session = db
      .select()
      .from(checkoutSessions)
      .where(eq(checkoutSessions.id, dispute.checkoutSessionId))
      .get();

    if (session?.buyerAgentId) {
      // If resolved in buyer's favor, seller agent loses reputation
      // If resolved in seller's favor, buyer agent loses reputation
      const delta = resolution === "resolved_buyer" ? -10 : 5;
      updateAgentReputation(db, session.buyerAgentId, delta);
    }
  }

  return true;
}
