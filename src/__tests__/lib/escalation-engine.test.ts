import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

import { checkEscalations } from "@/lib/server/escalation-engine";
import * as schema from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
  createTestBot,
  createTestBotTask,
  createTestEscalationRule,
  type TestDb,
} from "../helpers/setup";

describe("checkEscalations", () => {
  let db: TestDb;
  let workspaceId: string;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
    userId = user.userId;
    const project = createTestProject(db, workspaceId);
    projectId = project.id;
  });

  // ---------------------------------------------------------------
  // bot_failure trigger
  // ---------------------------------------------------------------
  describe("bot_failure trigger", () => {
    it("creates a critical alert when failures >= threshold", () => {
      const bot = createTestBot(db, workspaceId);
      const task = createTestTask(db, projectId);

      // Create 3 failed bot tasks (threshold default is 3)
      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });

      createTestEscalationRule(db, workspaceId, {
        trigger: "bot_failure",
        threshold: 3,
      });

      const { results, rulesChecked } = checkEscalations(db, workspaceId);

      expect(rulesChecked).toBe(1);
      expect(results).toHaveLength(1);
      expect(results[0].trigger).toBe("bot_failure");
      expect(results[0].alertCreated).toBe(true);

      // Verify the alert was actually inserted with severity "critical"
      const alerts = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.workspaceId, workspaceId))
        .all();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("critical");
      expect(alerts[0].type).toBe("escalation");
      expect(alerts[0].message).toContain("3 failed tasks");
    });

    it("creates nothing when failures are below threshold", () => {
      const bot = createTestBot(db, workspaceId);
      const task = createTestTask(db, projectId);

      // Only 2 failures, threshold is 3
      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });

      createTestEscalationRule(db, workspaceId, {
        trigger: "bot_failure",
        threshold: 3,
      });

      const { results } = checkEscalations(db, workspaceId);

      expect(results).toHaveLength(0);

      const alerts = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.workspaceId, workspaceId))
        .all();

      expect(alerts).toHaveLength(0);
    });

    it("sends notification when escalateToUserId is provided", () => {
      const bot = createTestBot(db, workspaceId);
      const task = createTestTask(db, projectId);

      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });

      createTestEscalationRule(db, workspaceId, {
        trigger: "bot_failure",
        threshold: 3,
        escalateToUserId: userId,
      });

      const { results } = checkEscalations(db, workspaceId);

      expect(results).toHaveLength(1);
      expect(results[0].notificationSent).toBe(true);

      // Verify notification was inserted
      const notifications = db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .all();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("escalation");
      expect(notifications[0].title).toBe("Bot Failure Escalation");
      expect(notifications[0].body).toContain("3 failures");
      expect(notifications[0].body).toContain("threshold of 3");
    });

    it("does not send notification when escalateToUserId is null", () => {
      const bot = createTestBot(db, workspaceId);
      const task = createTestTask(db, projectId);

      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });

      createTestEscalationRule(db, workspaceId, {
        trigger: "bot_failure",
        threshold: 3,
        // no escalateToUserId
      });

      const { results } = checkEscalations(db, workspaceId);

      expect(results).toHaveLength(1);
      expect(results[0].alertCreated).toBe(true);
      expect(results[0].notificationSent).toBe(false);

      // Confirm no notifications exist
      const notifications = db
        .select()
        .from(schema.notifications)
        .all();

      expect(notifications).toHaveLength(0);
    });

    it("handles multiple bots independently", () => {
      const botA = createTestBot(db, workspaceId, { name: "Bot A" });
      const botB = createTestBot(db, workspaceId, { name: "Bot B" });
      const task = createTestTask(db, projectId);

      // Bot A: 3 failures (meets threshold)
      createTestBotTask(db, botA.id, task.id, { status: "failed" });
      createTestBotTask(db, botA.id, task.id, { status: "failed" });
      createTestBotTask(db, botA.id, task.id, { status: "failed" });

      // Bot B: 1 failure (below threshold)
      createTestBotTask(db, botB.id, task.id, { status: "failed" });

      createTestEscalationRule(db, workspaceId, {
        trigger: "bot_failure",
        threshold: 3,
      });

      const { results } = checkEscalations(db, workspaceId);

      // Only Bot A should trigger
      expect(results).toHaveLength(1);

      const alerts = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.workspaceId, workspaceId))
        .all();

      expect(alerts).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------
  // task_overdue trigger
  // ---------------------------------------------------------------
  describe("task_overdue trigger", () => {
    it("creates a warning alert for a task overdue past threshold", () => {
      // Insert a task with dueDate 48 hours ago; threshold is 24 hours
      db.insert(schema.tasks)
        .values({
          id: crypto.randomUUID(),
          projectId,
          title: "Overdue Task",
          status: "todo",
          priority: "high",
          dueDate: Date.now() - 48 * 60 * 60 * 1000,
          tags: "[]",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();

      createTestEscalationRule(db, workspaceId, {
        trigger: "task_overdue",
        threshold: 24, // 24 hours
      });

      const { results, rulesChecked } = checkEscalations(db, workspaceId);

      expect(rulesChecked).toBe(1);
      expect(results).toHaveLength(1);
      expect(results[0].trigger).toBe("task_overdue");
      expect(results[0].alertCreated).toBe(true);

      const alerts = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.workspaceId, workspaceId))
        .all();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].type).toBe("escalation");
      expect(alerts[0].message).toContain("Overdue Task");
      expect(alerts[0].message).toContain("overdue");
    });

    it("creates nothing when task is not overdue past threshold", () => {
      // Task due 12 hours ago, but threshold is 24 hours
      db.insert(schema.tasks)
        .values({
          id: crypto.randomUUID(),
          projectId,
          title: "Slightly Late Task",
          status: "todo",
          priority: "medium",
          dueDate: Date.now() - 12 * 60 * 60 * 1000,
          tags: "[]",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();

      createTestEscalationRule(db, workspaceId, {
        trigger: "task_overdue",
        threshold: 24,
      });

      const { results } = checkEscalations(db, workspaceId);

      expect(results).toHaveLength(0);

      const alerts = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.workspaceId, workspaceId))
        .all();

      expect(alerts).toHaveLength(0);
    });

    it("excludes tasks with status 'done'", () => {
      // Task is overdue but completed
      db.insert(schema.tasks)
        .values({
          id: crypto.randomUUID(),
          projectId,
          title: "Finished Overdue Task",
          status: "done",
          priority: "high",
          dueDate: Date.now() - 48 * 60 * 60 * 1000,
          tags: "[]",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();

      createTestEscalationRule(db, workspaceId, {
        trigger: "task_overdue",
        threshold: 24,
      });

      const { results } = checkEscalations(db, workspaceId);

      expect(results).toHaveLength(0);
    });

    it("sends notification when escalateToUserId is provided", () => {
      db.insert(schema.tasks)
        .values({
          id: crypto.randomUUID(),
          projectId,
          title: "Overdue Notify Task",
          status: "in_progress",
          priority: "high",
          dueDate: Date.now() - 72 * 60 * 60 * 1000,
          tags: "[]",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();

      createTestEscalationRule(db, workspaceId, {
        trigger: "task_overdue",
        threshold: 24,
        escalateToUserId: userId,
      });

      const { results } = checkEscalations(db, workspaceId);

      expect(results).toHaveLength(1);
      expect(results[0].notificationSent).toBe(true);

      const notifications = db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .all();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("escalation");
      expect(notifications[0].title).toBe("Overdue Task Escalation");
      expect(notifications[0].body).toContain("Overdue Notify Task");
    });
  });

  // ---------------------------------------------------------------
  // approval_timeout trigger (no-op)
  // ---------------------------------------------------------------
  describe("approval_timeout trigger", () => {
    it("produces no results (no-op)", () => {
      createTestEscalationRule(db, workspaceId, {
        trigger: "approval_timeout",
        threshold: 48,
      });

      const { results, rulesChecked } = checkEscalations(db, workspaceId);

      expect(rulesChecked).toBe(1);
      expect(results).toHaveLength(0);

      // No alerts or notifications should be created
      const alerts = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.workspaceId, workspaceId))
        .all();

      expect(alerts).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // Multiple rules
  // ---------------------------------------------------------------
  describe("multiple rules", () => {
    it("evaluates rules of different triggers and reports correct rulesChecked", () => {
      // Set up bot_failure data
      const bot = createTestBot(db, workspaceId);
      const task = createTestTask(db, projectId);
      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });
      createTestBotTask(db, bot.id, task.id, { status: "failed" });

      // Set up task_overdue data
      db.insert(schema.tasks)
        .values({
          id: crypto.randomUUID(),
          projectId,
          title: "Very Overdue Task",
          status: "todo",
          priority: "high",
          dueDate: Date.now() - 96 * 60 * 60 * 1000,
          tags: "[]",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();

      // Create two rules
      createTestEscalationRule(db, workspaceId, {
        trigger: "bot_failure",
        threshold: 3,
      });
      createTestEscalationRule(db, workspaceId, {
        trigger: "task_overdue",
        threshold: 24,
      });

      const { results, rulesChecked } = checkEscalations(db, workspaceId);

      expect(rulesChecked).toBe(2);
      expect(results).toHaveLength(2);

      const triggers = results.map((r) => r.trigger).sort();
      expect(triggers).toEqual(["bot_failure", "task_overdue"]);

      // Both should have created alerts
      expect(results.every((r) => r.alertCreated)).toBe(true);

      const alerts = db
        .select()
        .from(schema.alerts)
        .where(eq(schema.alerts.workspaceId, workspaceId))
        .all();

      expect(alerts).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  // No rules
  // ---------------------------------------------------------------
  describe("no rules", () => {
    it("returns empty results and rulesChecked=0", () => {
      const { results, rulesChecked } = checkEscalations(db, workspaceId);

      expect(rulesChecked).toBe(0);
      expect(results).toHaveLength(0);
    });
  });
});
