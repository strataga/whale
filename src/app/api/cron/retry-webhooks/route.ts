import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { webhookDeliveries, webhooks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { verifyCronSecret } from "@/lib/server/cron-auth";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const isCron = verifyCronSecret(req);
  if (!isCron) {
    const ctx = await getAuthContext();
    if (!ctx) return jsonError(401, "Unauthorized");
    const roleCheck = checkRole(ctx, "admin");
    if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);
  }

  const failedDeliveries = db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "failed"),
        lt(webhookDeliveries.attempts, 5),
      ),
    )
    .all();

  let retried = 0;

  for (const delivery of failedDeliveries) {
    const webhook = db
      .select({ url: webhooks.url, active: webhooks.active })
      .from(webhooks)
      .where(eq(webhooks.id, delivery.webhookId))
      .get();

    if (!webhook || !webhook.active) continue;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: delivery.payload,
        signal: AbortSignal.timeout(10000),
      });

      db.update(webhookDeliveries)
        .set({
          attempts: delivery.attempts + 1,
          lastAttemptAt: Date.now(),
          status: response.ok ? "delivered" : "failed",
          responseStatus: response.status,
        })
        .where(eq(webhookDeliveries.id, delivery.id))
        .run();

      retried++;
    } catch {
      db.update(webhookDeliveries)
        .set({
          attempts: delivery.attempts + 1,
          lastAttemptAt: Date.now(),
        })
        .where(eq(webhookDeliveries.id, delivery.id))
        .run();

      retried++;
    }
  }

  return NextResponse.json({ retried });
}
