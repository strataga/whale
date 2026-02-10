import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { eq, and, lt } from "drizzle-orm";
import {
  createTestDb,
  createTestUser,
  createTestWebhook,
  type TestDb,
} from "../helpers/setup";
import { webhooks, webhookDeliveries } from "@/lib/db/schema";

/**
 * Test-friendly wrapper for dispatchWebhook that accepts a db parameter.
 * In production, dispatchWebhook uses the singleton db import.
 */
function dispatchWebhookEvent(
  db: TestDb,
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
    const body = JSON.stringify({
      event,
      payload,
      deliveryId,
      timestamp: Date.now(),
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const signature = require("node:crypto")
      .createHmac("sha256", hook.secret)
      .update(body)
      .digest("hex");

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

/**
 * Test-friendly function for retrying failed webhook deliveries.
 * Based on the cron route implementation at src/app/api/cron/retry-webhooks/route.ts
 */
async function retryFailedDeliveries(db: TestDb): Promise<number> {
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
      .select({ url: webhooks.url, active: webhooks.active, secret: webhooks.secret })
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

  return retried;
}

describe("webhook-dispatch", () => {
  let db: TestDb;
  let workspaceId: string;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    db = createTestDb();
    const { workspaceId: wsId } = await createTestUser(db);
    workspaceId = wsId;

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("dispatchWebhookEvent", () => {
    it("creates delivery records for matching webhooks", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook1",
        events: ["task.created"],
      });
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook2",
        events: ["task.created", "task.updated"],
      });

      // Mock successful responses
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      dispatchWebhookEvent(db, workspaceId, "task.created", {
        taskId: "test-task-123",
      });

      // Allow fetch promises to settle
      await new Promise((resolve) => setTimeout(resolve, 10));

      const deliveries = db.select().from(webhookDeliveries).all();
      expect(deliveries).toHaveLength(2);
      expect(deliveries[0].event).toBe("task.created");
      expect(deliveries[0].status).toBe("delivered");
      expect(deliveries[1].event).toBe("task.created");
      expect(deliveries[1].status).toBe("delivered");
    });

    it("creates delivery for wildcard webhook", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/wildcard",
        events: ["*"],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      dispatchWebhookEvent(db, workspaceId, "any.event", { data: "test" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const deliveries = db.select().from(webhookDeliveries).all();
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].event).toBe("any.event");
    });

    it("skips inactive webhooks", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/inactive",
        events: ["task.created"],
        active: 0,
      });

      dispatchWebhookEvent(db, workspaceId, "task.created", {
        taskId: "test-123",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const deliveries = db.select().from(webhookDeliveries).all();
      expect(deliveries).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("skips webhooks with non-matching events", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook",
        events: ["task.updated", "task.deleted"],
      });

      dispatchWebhookEvent(db, workspaceId, "task.created", {
        taskId: "test-123",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const deliveries = db.select().from(webhookDeliveries).all();
      expect(deliveries).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("updates status to delivered on successful fetch", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/success",
        events: ["test.event"],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      dispatchWebhookEvent(db, workspaceId, "test.event", { foo: "bar" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const delivery = db.select().from(webhookDeliveries).get();
      expect(delivery).toBeDefined();
      expect(delivery!.status).toBe("delivered");
      expect(delivery!.attempts).toBe(1);
      expect(delivery!.responseStatus).toBe(200);
      expect(delivery!.lastAttemptAt).toBeGreaterThan(0);
    });

    it("updates status to failed on non-ok response", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/error",
        events: ["test.event"],
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      dispatchWebhookEvent(db, workspaceId, "test.event", { foo: "bar" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const delivery = db.select().from(webhookDeliveries).get();
      expect(delivery).toBeDefined();
      expect(delivery!.status).toBe("failed");
      expect(delivery!.attempts).toBe(1);
      expect(delivery!.responseStatus).toBe(500);
    });

    it("updates status to failed on fetch exception", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/timeout",
        events: ["test.event"],
      });

      mockFetch.mockRejectedValue(new Error("Network timeout"));

      dispatchWebhookEvent(db, workspaceId, "test.event", { foo: "bar" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const delivery = db.select().from(webhookDeliveries).get();
      expect(delivery).toBeDefined();
      expect(delivery!.status).toBe("failed");
      expect(delivery!.attempts).toBe(1);
      expect(delivery!.responseStatus).toBeNull();
    });

    it("sends correct headers and signature", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook",
        secret: "test-secret-key",
        events: ["test.event"],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      dispatchWebhookEvent(db, workspaceId, "test.event", { data: "value" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe(hook.url);
      expect(call[1].method).toBe("POST");
      expect(call[1].headers["Content-Type"]).toBe("application/json");
      expect(call[1].headers["X-Whale-Event"]).toBe("test.event");
      expect(call[1].headers["X-Whale-Delivery"]).toBeDefined();
      expect(call[1].headers["X-Whale-Signature"]).toBeDefined();
      expect(call[1].headers["X-Whale-Signature"]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("dispatches to multiple webhooks in same workspace", async () => {
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook1",
        events: ["*"],
      });
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook2",
        events: ["task.created"],
      });
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook3",
        events: ["task.created", "task.updated"],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      dispatchWebhookEvent(db, workspaceId, "task.created", {
        taskId: "multi-test",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).toHaveBeenCalledTimes(3);
      const deliveries = db.select().from(webhookDeliveries).all();
      expect(deliveries).toHaveLength(3);
    });

    it("does not dispatch to webhooks in different workspace", async () => {
      // Create second workspace with its own webhook
      const { workspaceId: workspace2 } = await createTestUser(db, {
        email: "user2@test.com",
      });
      createTestWebhook(db, workspace2, {
        url: "https://example.com/other-workspace",
        events: ["*"],
      });

      // Create webhook in original workspace
      createTestWebhook(db, workspaceId, {
        url: "https://example.com/my-workspace",
        events: ["*"],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      dispatchWebhookEvent(db, workspaceId, "task.created", {
        taskId: "workspace-test",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only dispatch to the webhook in the specified workspace
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const deliveries = db.select().from(webhookDeliveries).all();
      expect(deliveries).toHaveLength(1);
    });
  });

  describe("retryFailedDeliveries", () => {
    it("retries failed deliveries with attempts < 5", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/retry",
        events: ["test.event"],
      });

      // Create failed delivery
      const deliveryId = crypto.randomUUID();
      db.insert(webhookDeliveries)
        .values({
          id: deliveryId,
          webhookId: hook.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test" }),
          status: "failed",
          attempts: 2,
          lastAttemptAt: Date.now() - 60000,
          createdAt: Date.now() - 120000,
        })
        .run();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const updated = db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId))
        .get();

      expect(updated!.status).toBe("delivered");
      expect(updated!.attempts).toBe(3);
      expect(updated!.responseStatus).toBe(200);
    });

    it("does not retry deliveries with 5 or more attempts", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/exhausted",
        events: ["test.event"],
      });

      // Create delivery with max attempts
      const deliveryId = crypto.randomUUID();
      db.insert(webhookDeliveries)
        .values({
          id: deliveryId,
          webhookId: hook.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test" }),
          status: "failed",
          attempts: 5,
          lastAttemptAt: Date.now() - 60000,
          createdAt: Date.now() - 120000,
        })
        .run();

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();

      const unchanged = db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId))
        .get();

      expect(unchanged!.attempts).toBe(5);
    });

    it("skips retries for inactive webhooks", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/inactive",
        events: ["test.event"],
        active: 0,
      });

      const deliveryId = crypto.randomUUID();
      db.insert(webhookDeliveries)
        .values({
          id: deliveryId,
          webhookId: hook.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test" }),
          status: "failed",
          attempts: 1,
          lastAttemptAt: Date.now() - 60000,
          createdAt: Date.now() - 120000,
        })
        .run();

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("increments attempts on retry failure", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/still-failing",
        events: ["test.event"],
      });

      const deliveryId = crypto.randomUUID();
      db.insert(webhookDeliveries)
        .values({
          id: deliveryId,
          webhookId: hook.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test" }),
          status: "failed",
          attempts: 1,
          lastAttemptAt: Date.now() - 60000,
          createdAt: Date.now() - 120000,
        })
        .run();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(1);

      const updated = db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId))
        .get();

      expect(updated!.status).toBe("failed");
      expect(updated!.attempts).toBe(2);
      expect(updated!.responseStatus).toBe(503);
    });

    it("increments attempts on retry exception", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/timeout-again",
        events: ["test.event"],
      });

      const deliveryId = crypto.randomUUID();
      db.insert(webhookDeliveries)
        .values({
          id: deliveryId,
          webhookId: hook.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test" }),
          status: "failed",
          attempts: 3,
          lastAttemptAt: Date.now() - 60000,
          createdAt: Date.now() - 120000,
        })
        .run();

      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(1);

      const updated = db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, deliveryId))
        .get();

      expect(updated!.status).toBe("failed");
      expect(updated!.attempts).toBe(4);
    });

    it("retries multiple failed deliveries", async () => {
      const hook1 = createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook1",
        events: ["test.event"],
      });
      const hook2 = createTestWebhook(db, workspaceId, {
        url: "https://example.com/hook2",
        events: ["test.event"],
      });

      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId: hook1.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test1" }),
          status: "failed",
          attempts: 1,
          lastAttemptAt: Date.now() - 60000,
          createdAt: Date.now() - 120000,
        })
        .run();

      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId: hook2.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test2" }),
          status: "failed",
          attempts: 2,
          lastAttemptAt: Date.now() - 60000,
          createdAt: Date.now() - 120000,
        })
        .run();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry pending deliveries", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/pending",
        events: ["test.event"],
      });

      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId: hook.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test" }),
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
        })
        .run();

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not retry delivered deliveries", async () => {
      const hook = createTestWebhook(db, workspaceId, {
        url: "https://example.com/delivered",
        events: ["test.event"],
      });

      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId: hook.id,
          event: "test.event",
          payload: JSON.stringify({ data: "test" }),
          status: "delivered",
          attempts: 1,
          lastAttemptAt: Date.now(),
          createdAt: Date.now(),
        })
        .run();

      const retried = await retryFailedDeliveries(db);

      expect(retried).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
