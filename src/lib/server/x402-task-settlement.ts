import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { x402Transactions } from "@/lib/db/schema";
import type { AnyDb } from "@/types";

/**
 * Link a verified x402 transaction to the task it paid for.
 *
 * We record the payment before the task exists (verification happens at request time),
 * then attach the `taskId` after the task is created.
 */
export function linkX402TransactionToTask(
  database: AnyDb,
  transactionId: string,
  taskId: string,
): boolean {
  const now = Date.now();
  const result = database
    .update(x402Transactions)
    .set({ taskId, updatedAt: now })
    .where(eq(x402Transactions.id, transactionId))
    .run() as { changes: number };

  return result.changes > 0;
}

/**
 * Settle any x402 transactions for a task.
 *
 * In this MVP, "settlement" is a DB state transition that mirrors the escrow
 * lifecycle: authorized -> captured -> settled.
 *
 * Returns the number of transactions moved to "settled".
 */
export function settleX402TransactionsForTask(
  database: AnyDb,
  workspaceId: string,
  taskId: string,
): number {
  const now = Date.now();

  const txns = database
    .select({ id: x402Transactions.id, status: x402Transactions.status })
    .from(x402Transactions)
    .where(
      and(
        eq(x402Transactions.workspaceId, workspaceId),
        eq(x402Transactions.taskId, taskId),
        inArray(x402Transactions.status, ["authorized", "captured"] as const),
      ),
    )
    .all() as Array<{ id: string; status: string }>;

  let settledCount = 0;
  for (const tx of txns) {
    if (tx.status === "authorized") {
      // authorized -> captured
      database
        .update(x402Transactions)
        .set({ status: "captured", verifiedAt: now, updatedAt: now })
        .where(and(eq(x402Transactions.id, tx.id), eq(x402Transactions.status, "authorized")))
        .run();
    }

    // captured -> settled (or authorized just captured above)
    const result = database
      .update(x402Transactions)
      .set({ status: "settled", settledAt: now, updatedAt: now })
      .where(and(eq(x402Transactions.id, tx.id), eq(x402Transactions.status, "captured")))
      .run() as { changes: number };

    if (result.changes > 0) settledCount += 1;
  }

  return settledCount;
}

