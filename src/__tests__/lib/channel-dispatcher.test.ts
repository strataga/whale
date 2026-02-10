import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";

import {
  matchEventGlob,
  dispatchToChannels,
} from "@/lib/server/channel-dispatcher";
import * as schema from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestChannel,
  type TestDb,
} from "../helpers/setup";

// ---------------------------------------------------------------------------
// matchEventGlob (pure)
// ---------------------------------------------------------------------------
describe("matchEventGlob", () => {
  it("matches bare * wildcard against any event", () => {
    expect(matchEventGlob("task.created", "*")).toBe(true);
    expect(matchEventGlob("bot.failed", "*")).toBe(true);
  });

  it("matches ** globstar against any event", () => {
    expect(matchEventGlob("task.created", "**")).toBe(true);
  });

  it("matches exact event name", () => {
    expect(matchEventGlob("task.created", "task.created")).toBe(true);
    expect(matchEventGlob("task.created", "task.updated")).toBe(false);
  });

  it("matches single-segment wildcard", () => {
    expect(matchEventGlob("task.created", "task.*")).toBe(true);
    expect(matchEventGlob("task.updated", "task.*")).toBe(true);
    expect(matchEventGlob("bot.failed", "task.*")).toBe(false);
  });

  it("single * does not cross dots", () => {
    expect(matchEventGlob("task.sub.created", "task.*")).toBe(false);
  });

  it("matches multi-segment globstar in the middle", () => {
    expect(matchEventGlob("task.sub.created", "task.**")).toBe(true);
    expect(matchEventGlob("task.sub.deep.event", "task.**")).toBe(true);
  });

  it("returns false for non-matching patterns", () => {
    expect(matchEventGlob("alert.triggered", "task.created")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dispatchToChannels (DB-integrated)
// ---------------------------------------------------------------------------
describe("dispatchToChannels", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;

    // Stub global fetch so HTTP-based channels don't hit the network
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches to a matching in_app channel and creates notification", async () => {
    const user = await createTestUser(db, { workspaceId });
    createTestChannel(db, workspaceId, {
      type: "in_app",
      config: { userId: user.userId },
      events: ["task.*"],
    });

    const result = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      title: "New Task",
      body: "A task was created",
    });

    expect(result.dispatched).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    // Verify notification row was created
    const notifs = db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, user.userId))
      .all();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("New Task");
  });

  it("dispatches to email channel and queues email", async () => {
    const user = await createTestUser(db, { workspaceId });
    createTestChannel(db, workspaceId, {
      type: "email",
      config: { userId: user.userId },
      events: ["alert.*"],
    });

    const result = await dispatchToChannels(db, workspaceId, {
      event: "alert.triggered",
      severity: "warning",
      title: "Alert",
      body: "Something happened",
    });

    expect(result.dispatched).toBe(1);
    expect(result.succeeded).toBe(1);

    const emails = db
      .select()
      .from(schema.emailQueue)
      .where(eq(schema.emailQueue.userId, user.userId))
      .all();
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe("Alert");
  });

  it("skips inactive channels", async () => {
    createTestChannel(db, workspaceId, {
      type: "webhook",
      events: ["*"],
      active: 0,
    });

    const result = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      title: "Test",
      body: "test",
    });

    expect(result.dispatched).toBe(0);
  });

  it("filters by severity threshold", async () => {
    const user = await createTestUser(db, { workspaceId });
    createTestChannel(db, workspaceId, {
      type: "in_app",
      config: { userId: user.userId },
      events: ["*"],
      minSeverity: "warning",
    });

    // Info should be skipped
    const r1 = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      severity: "info",
      title: "Low sev",
      body: "test",
    });
    expect(r1.dispatched).toBe(0);

    // Warning should match
    const r2 = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      severity: "warning",
      title: "Med sev",
      body: "test",
    });
    expect(r2.dispatched).toBe(1);

    // Critical should also match (above threshold)
    const r3 = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      severity: "critical",
      title: "High sev",
      body: "test",
    });
    expect(r3.dispatched).toBe(1);
  });

  it("filters by event glob patterns", async () => {
    createTestChannel(db, workspaceId, {
      type: "webhook",
      events: ["task.*"],
      config: { url: "https://example.com/hook" },
    });

    const r1 = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      title: "Match",
      body: "should match",
    });
    expect(r1.dispatched).toBe(1);

    const r2 = await dispatchToChannels(db, workspaceId, {
      event: "bot.failed",
      title: "No match",
      body: "should not match",
    });
    expect(r2.dispatched).toBe(0);
  });

  it("creates channelDeliveries records for HTTP channels", async () => {
    const ch = createTestChannel(db, workspaceId, {
      type: "slack_webhook",
      config: { url: "https://hooks.slack.com/test" },
      events: ["*"],
    });

    await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      title: "Slack test",
      body: "test body",
    });

    const deliveries = db
      .select()
      .from(schema.channelDeliveries)
      .where(eq(schema.channelDeliveries.channelId, ch.id))
      .all();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("delivered");
    expect(deliveries[0].event).toBe("task.created");
  });

  it("records failed delivery when fetch rejects", async () => {
    vi.useFakeTimers();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const ch = createTestChannel(db, workspaceId, {
      type: "webhook",
      config: { url: "https://example.com/fail", secret: "s" },
      events: ["*"],
    });

    // Start dispatch but don't await yet — advance timers to bypass backoff
    const promise = dispatchToChannels(db, workspaceId, {
      event: "test.fail",
      title: "Fail",
      body: "fail",
    });

    // Advance past all three retry backoff delays (1s, 4s, 16s)
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(4_000);
    await vi.advanceTimersByTimeAsync(16_000);

    const result = await promise;
    vi.useRealTimers();

    expect(result.failed).toBe(1);

    const deliveries = db
      .select()
      .from(schema.channelDeliveries)
      .where(eq(schema.channelDeliveries.channelId, ch.id))
      .all();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("failed");
    expect(deliveries[0].attempts).toBe(3); // 3 retries
  });

  it("dispatches to multiple channels in one call", async () => {
    const user = await createTestUser(db, { workspaceId });
    createTestChannel(db, workspaceId, {
      type: "in_app",
      name: "App notifs",
      config: { userId: user.userId },
      events: ["*"],
    });
    createTestChannel(db, workspaceId, {
      type: "webhook",
      name: "External hook",
      config: { url: "https://example.com/hook", secret: "abc" },
      events: ["*"],
    });

    const result = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      title: "Multi",
      body: "multi dispatch",
    });

    expect(result.dispatched).toBe(2);
    expect(result.succeeded).toBe(2);
  });

  it("ignores channels from other workspaces", async () => {
    const other = await createTestUser(db);
    createTestChannel(db, other.workspaceId, {
      type: "webhook",
      config: { url: "https://other.com/hook" },
      events: ["*"],
    });

    const result = await dispatchToChannels(db, workspaceId, {
      event: "task.created",
      title: "Test",
      body: "test",
    });

    expect(result.dispatched).toBe(0);
  });
});
