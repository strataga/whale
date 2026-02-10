import { eq, and } from "drizzle-orm";
import { x402Transactions } from "@/lib/db/schema";
import type { AnyDb } from "@/types";

/**
 * Creates an x402 transaction in "authorized" state and returns its ID.
 */
export function authorizePayment(
  database: AnyDb,
  data: {
    workspaceId: string;
    payerAddress: string;
    amount: string;
    asset: string;
    network: string;
    txHash?: string;
    taskId?: string;
  },
): string {
  const id = crypto.randomUUID();
  const now = Date.now();

  database
    .insert(x402Transactions)
    .values({
      id,
      workspaceId: data.workspaceId,
      payerAddress: data.payerAddress,
      amount: data.amount,
      asset: data.asset,
      network: data.network,
      txHash: data.txHash ?? null,
      taskId: data.taskId ?? null,
      status: "authorized",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

/**
 * Moves an authorized transaction to "captured" state.
 * Returns true if the transition succeeded.
 */
export function capturePayment(database: AnyDb, transactionId: string): boolean {
  const result = database
    .update(x402Transactions)
    .set({ status: "captured", updatedAt: Date.now() })
    .where(
      and(
        eq(x402Transactions.id, transactionId),
        eq(x402Transactions.status, "authorized"),
      ),
    )
    .run() as { changes: number };

  return result.changes > 0;
}

/**
 * Moves a captured transaction to "settled" state.
 * Returns true if the transition succeeded.
 */
export function settlePayment(database: AnyDb, transactionId: string): boolean {
  const now = Date.now();
  const result = database
    .update(x402Transactions)
    .set({ status: "settled", settledAt: now, updatedAt: now })
    .where(
      and(
        eq(x402Transactions.id, transactionId),
        eq(x402Transactions.status, "captured"),
      ),
    )
    .run() as { changes: number };

  return result.changes > 0;
}

/**
 * Moves an authorized or captured transaction to "refunded" state.
 * Returns true if the transition succeeded.
 */
export function refundPayment(database: AnyDb, transactionId: string): boolean {
  const now = Date.now();

  // Refund from either authorized or captured state
  const tx = database
    .select({ status: x402Transactions.status })
    .from(x402Transactions)
    .where(eq(x402Transactions.id, transactionId))
    .get() as { status: string } | undefined;

  if (!tx || (tx.status !== "authorized" && tx.status !== "captured")) {
    return false;
  }

  const result = database
    .update(x402Transactions)
    .set({ status: "refunded", refundedAt: now, updatedAt: now })
    .where(eq(x402Transactions.id, transactionId))
    .run() as { changes: number };

  return result.changes > 0;
}
