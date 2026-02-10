import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
  createTestBot,
  createTestBotTask,
  type TestDb,
} from "../helpers/setup";
import { scanAnomalies, scanAllWorkspaces } from "@/lib/server/anomaly-scanner";

describe("Anomaly Scanner", () => {
  let db: TestDb;
  let workspaceId: string;
  const NOW = Date.now();

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
  });

  describe("failure spike detection", () => {
    it("creates critical alert when >50% tasks fail in last hour with >=3 tasks", async () => {
      const project = createTestProject(db, workspaceId);
      const bot = createTestBot(db, workspaceId, { status: "idle" });
      const completedAt = NOW - 30 * 60 * 1000; // 30 min ago

      // 2 failed, 1 success = 66% failure rate with 3 tasks
      for (let i = 0; i < 2; i++) {
        const task = createTestTask(db, project.id);
        createTestBotTask(db, bot.id, task.id, {
          status: "failed",
          completedAt,
        });
      }
      const successTask = createTestTask(db, project.id);
      createTestBotTask(db, bot.id, successTask.id, {
        status: "completed",
        completedAt,
      });

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(1);

      const alert = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.id, alertIds[0]))
        .get();
      expect(alert).toBeDefined();
      expect(alert!.type).toBe("bot_failure_spike");
      expect(alert!.severity).toBe("critical");
      expect(alert!.message).toContain("2/3 failed tasks");
    });

    it("does not alert when fewer than 3 tasks", () => {
      const project = createTestProject(db, workspaceId);
      const bot = createTestBot(db, workspaceId, { status: "idle" });
      const completedAt = NOW - 30 * 60 * 1000;

      // 2 tasks, both failed — but under threshold of 3
      for (let i = 0; i < 2; i++) {
        const task = createTestTask(db, project.id);
        createTestBotTask(db, bot.id, task.id, {
          status: "failed",
          completedAt,
        });
      }

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(0);
    });

    it("does not alert when failure rate is <= 50%", () => {
      const project = createTestProject(db, workspaceId);
      const bot = createTestBot(db, workspaceId, { status: "idle" });
      const completedAt = NOW - 30 * 60 * 1000;

      // 1 failed, 2 success = 33% failure
      const failTask = createTestTask(db, project.id);
      createTestBotTask(db, bot.id, failTask.id, {
        status: "failed",
        completedAt,
      });
      for (let i = 0; i < 2; i++) {
        const task = createTestTask(db, project.id);
        createTestBotTask(db, bot.id, task.id, {
          status: "completed",
          completedAt,
        });
      }

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(0);
    });

    it("ignores tasks completed more than 1 hour ago", () => {
      const project = createTestProject(db, workspaceId);
      const bot = createTestBot(db, workspaceId, { status: "idle" });
      const oldCompletedAt = NOW - 2 * 60 * 60 * 1000; // 2 hours ago

      for (let i = 0; i < 4; i++) {
        const task = createTestTask(db, project.id);
        createTestBotTask(db, bot.id, task.id, {
          status: "failed",
          completedAt: oldCompletedAt,
        });
      }

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(0);
    });
  });

  describe("stale bot detection", () => {
    it("creates warning alert for bot with no heartbeat in 15+ minutes", () => {
      const staleLastSeen = NOW - 20 * 60 * 1000; // 20 min ago
      const bot = createTestBot(db, workspaceId, { status: "idle" });
      // Set lastSeenAt manually
      db.update(schema.bots)
        .set({ lastSeenAt: staleLastSeen })
        .where(eq(schema.bots.id, bot.id))
        .run();

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(1);

      const alert = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.id, alertIds[0]))
        .get();
      expect(alert!.type).toBe("bot_stale");
      expect(alert!.severity).toBe("warning");
      expect(alert!.message).toContain("heartbeat");
    });

    it("does not alert for offline bots", () => {
      const staleLastSeen = NOW - 20 * 60 * 1000;
      const bot = createTestBot(db, workspaceId, { status: "offline" });
      db.update(schema.bots)
        .set({ lastSeenAt: staleLastSeen })
        .where(eq(schema.bots.id, bot.id))
        .run();

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(0);
    });

    it("does not alert for bots with no lastSeenAt", () => {
      createTestBot(db, workspaceId, { status: "idle" });
      // lastSeenAt is null by default
      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(0);
    });

    it("does not alert for recently seen bots", () => {
      const recentLastSeen = NOW - 5 * 60 * 1000; // 5 min ago
      const bot = createTestBot(db, workspaceId, { status: "idle" });
      db.update(schema.bots)
        .set({ lastSeenAt: recentLastSeen })
        .where(eq(schema.bots.id, bot.id))
        .run();

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(0);
    });
  });

  describe("combined detection", () => {
    it("creates multiple alerts for different anomalies", () => {
      const project = createTestProject(db, workspaceId);
      const completedAt = NOW - 30 * 60 * 1000;

      // Bot 1: failure spike
      const bot1 = createTestBot(db, workspaceId, {
        name: "FailBot",
        status: "idle",
      });
      for (let i = 0; i < 3; i++) {
        const task = createTestTask(db, project.id);
        createTestBotTask(db, bot1.id, task.id, {
          status: "failed",
          completedAt,
        });
      }

      // Bot 2: stale
      const bot2 = createTestBot(db, workspaceId, {
        name: "StaleBot",
        status: "idle",
      });
      db.update(schema.bots)
        .set({ lastSeenAt: NOW - 20 * 60 * 1000 })
        .where(eq(schema.bots.id, bot2.id))
        .run();

      const alertIds = scanAnomalies(db, workspaceId, NOW);
      expect(alertIds).toHaveLength(2);

      const alertTypes = db
        .select({ type: schema.alerts.type })
        .from(schema.alerts)
        .all()
        .map((a) => a.type);
      expect(alertTypes).toContain("bot_failure_spike");
      expect(alertTypes).toContain("bot_stale");
    });
  });

  describe("scanAllWorkspaces", () => {
    it("scans all workspaces and aggregates results", () => {
      // workspaceId already has no bots/anomalies, so no alerts
      const result = scanAllWorkspaces(db, NOW);
      expect(result.alertsCreated).toBe(0);
      expect(result.alertIds).toEqual([]);
    });

    it("returns combined alert count across workspaces", async () => {
      const project = createTestProject(db, workspaceId);
      const bot = createTestBot(db, workspaceId, { status: "idle" });
      db.update(schema.bots)
        .set({ lastSeenAt: NOW - 20 * 60 * 1000 })
        .where(eq(schema.bots.id, bot.id))
        .run();

      const result = scanAllWorkspaces(db, NOW);
      expect(result.alertsCreated).toBe(1);
      expect(result.alertIds).toHaveLength(1);
    });
  });
});
