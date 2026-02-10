export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { lt, eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { checkoutSessions, x402Transactions } from "@/lib/db/schema";
import { verifyCronSecret } from "@/lib/server/cron-auth";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * GET /api/cron/reconcile-settlements
 * Expire stale checkout sessions and mark timed-out x402 transactions.
 */
export async function GET(req: Request) {
  const isCron = verifyCronSecret(req);
  const ctx = isCron ? null : await getAuthContext();
  if (!isCron && !ctx) return jsonError(401, "Unauthorized");

  if (ctx) {
    const roleCheck = checkRole(ctx, "admin");
    if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);
  }

  const now = Date.now();

  // 1. Expire stale checkout sessions past their expiresAt
  const expiredSessions = db
    .update(checkoutSessions)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(checkoutSessions.status, "open"),
        lt(checkoutSessions.expiresAt, now),
      ),
    )
    .run();

  // 2. Mark x402 transactions authorized for > 24h as timed out
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const timedOutTx = db
    .update(x402Transactions)
    .set({ status: "timed_out", updatedAt: now })
    .where(
      and(
        eq(x402Transactions.status, "authorized"),
        lt(x402Transactions.createdAt, twentyFourHoursAgo),
      ),
    )
    .run();

  return NextResponse.json({
    success: true,
    expiredSessions: expiredSessions.changes,
    timedOutTransactions: timedOutTx.changes,
  });
}
