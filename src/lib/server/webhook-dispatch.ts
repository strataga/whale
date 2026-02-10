import { eq, and } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { webhooks, webhookDeliveries } from "@/lib/db/schema";

/**
 * Dispatch webhook events to all registered webhooks for a workspace.
 * Fire-and-forget: errors are logged but don't block the caller.
 */
export function dispatchWebhook(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const hooks = db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.active, 1)))
    .all();

  for (const hook of hooks) {
    const events: string[] = JSON.parse(hook.events);
    // Match exact event or wildcard
    if (!events.includes(event) && !events.includes("*")) continue;

    const deliveryId = crypto.randomUUID();
    const body = JSON.stringify({ event, payload, deliveryId, timestamp: Date.now() });
    const signature = createHmac("sha256", hook.secret).update(body).digest("hex");

    db.insert(webhookDeliveries)
      .values({
        id: deliveryId,
        webhookId: hook.id,
        event,
        payload: body,
        status: "pending",
        createdAt: Date.now(),
      })
      .run();

    // Fire-and-forget HTTP POST
    fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Whale-Signature": signature,
        "X-Whale-Event": event,
        "X-Whale-Delivery": deliveryId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
      .then((res) => {
        db.update(webhookDeliveries)
          .set({
            status: res.ok ? "delivered" : "failed",
            attempts: 1,
            lastAttemptAt: Date.now(),
            responseStatus: res.status,
          })
          .where(eq(webhookDeliveries.id, deliveryId))
          .run();
      })
      .catch(() => {
        db.update(webhookDeliveries)
          .set({
            status: "failed",
            attempts: 1,
            lastAttemptAt: Date.now(),
          })
          .where(eq(webhookDeliveries.id, deliveryId))
          .run();
      });
  }
}
