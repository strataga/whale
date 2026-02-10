import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

import {
  evaluateConditions,
  executeAction,
  evaluateRules,
  type RuleCondition,
  type RuleAction,
} from "@/lib/server/rule-engine";
import { tasks, subtasks, alerts, notifications, automationRules } from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
  createTestAutomationRule,
  type TestDb,
} from "../helpers/setup";

// ---------------------------------------------------------------------------
// evaluateConditions — pure function tests
// ---------------------------------------------------------------------------

describe("evaluateConditions", () => {
  it("returns true for an empty conditions array", () => {
    expect(evaluateConditions([], { anything: "goes" })).toBe(true);
  });

  // --- eq operator ---
  describe("eq operator", () => {
    it("returns true when field equals value", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "eq", value: "done" },
      ];
      expect(evaluateConditions(conditions, { status: "done" })).toBe(true);
    });

    it("returns false when field does not equal value", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "eq", value: "done" },
      ];
      expect(evaluateConditions(conditions, { status: "todo" })).toBe(false);
    });

    it("uses strict equality (number vs string)", () => {
      const conditions: RuleCondition[] = [
        { field: "count", operator: "eq", value: 5 },
      ];
      expect(evaluateConditions(conditions, { count: "5" })).toBe(false);
    });

    it("returns false when field is missing from payload", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "eq", value: "done" },
      ];
      expect(evaluateConditions(conditions, {})).toBe(false);
    });
  });

  // --- neq operator ---
  describe("neq operator", () => {
    it("returns true when field does not equal value", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "neq", value: "done" },
      ];
      expect(evaluateConditions(conditions, { status: "todo" })).toBe(true);
    });

    it("returns false when field equals value", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "neq", value: "done" },
      ];
      expect(evaluateConditions(conditions, { status: "done" })).toBe(false);
    });

    it("returns true when field is missing (undefined !== value)", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "neq", value: "done" },
      ];
      expect(evaluateConditions(conditions, {})).toBe(true);
    });
  });

  // --- gt operator ---
  describe("gt operator", () => {
    it("returns true when numeric field is greater than value", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "gt", value: 5 },
      ];
      expect(evaluateConditions(conditions, { priority: 10 })).toBe(true);
    });

    it("returns false when numeric field is equal to value", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "gt", value: 5 },
      ];
      expect(evaluateConditions(conditions, { priority: 5 })).toBe(false);
    });

    it("returns false when numeric field is less than value", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "gt", value: 5 },
      ];
      expect(evaluateConditions(conditions, { priority: 3 })).toBe(false);
    });

    it("returns false when field is not a number", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "gt", value: 5 },
      ];
      expect(evaluateConditions(conditions, { priority: "high" })).toBe(false);
    });

    it("returns false when field is missing", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "gt", value: 5 },
      ];
      expect(evaluateConditions(conditions, {})).toBe(false);
    });
  });

  // --- lt operator ---
  describe("lt operator", () => {
    it("returns true when numeric field is less than value", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "lt", value: 10 },
      ];
      expect(evaluateConditions(conditions, { priority: 3 })).toBe(true);
    });

    it("returns false when numeric field is equal to value", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "lt", value: 10 },
      ];
      expect(evaluateConditions(conditions, { priority: 10 })).toBe(false);
    });

    it("returns false when numeric field is greater than value", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "lt", value: 10 },
      ];
      expect(evaluateConditions(conditions, { priority: 20 })).toBe(false);
    });

    it("returns false when field is not a number", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "lt", value: 10 },
      ];
      expect(evaluateConditions(conditions, { priority: "low" })).toBe(false);
    });

    it("returns false when field is missing", () => {
      const conditions: RuleCondition[] = [
        { field: "priority", operator: "lt", value: 10 },
      ];
      expect(evaluateConditions(conditions, {})).toBe(false);
    });
  });

  // --- contains operator ---
  describe("contains operator", () => {
    it("returns true when string field contains value", () => {
      const conditions: RuleCondition[] = [
        { field: "title", operator: "contains", value: "urgent" },
      ];
      expect(evaluateConditions(conditions, { title: "This is urgent!" })).toBe(true);
    });

    it("returns false when string field does not contain value", () => {
      const conditions: RuleCondition[] = [
        { field: "title", operator: "contains", value: "urgent" },
      ];
      expect(evaluateConditions(conditions, { title: "Normal task" })).toBe(false);
    });

    it("returns false when field is not a string", () => {
      const conditions: RuleCondition[] = [
        { field: "title", operator: "contains", value: "urgent" },
      ];
      expect(evaluateConditions(conditions, { title: 42 })).toBe(false);
    });

    it("returns false when field is missing", () => {
      const conditions: RuleCondition[] = [
        { field: "title", operator: "contains", value: "urgent" },
      ];
      expect(evaluateConditions(conditions, {})).toBe(false);
    });
  });

  // --- in operator ---
  describe("in operator", () => {
    it("returns true when actual is included in value array", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "in", value: ["todo", "in_progress"] },
      ];
      expect(evaluateConditions(conditions, { status: "todo" })).toBe(true);
    });

    it("returns false when actual is not included in value array", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "in", value: ["todo", "in_progress"] },
      ];
      expect(evaluateConditions(conditions, { status: "done" })).toBe(false);
    });

    it("returns false when value is not an array", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "in", value: "todo" },
      ];
      expect(evaluateConditions(conditions, { status: "todo" })).toBe(false);
    });

    it("returns false when field is missing and not in array", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "in", value: ["todo", "done"] },
      ];
      expect(evaluateConditions(conditions, {})).toBe(false);
    });
  });

  // --- multiple conditions (AND logic) ---
  describe("multiple conditions (AND logic)", () => {
    it("returns true when all conditions match", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "eq", value: "in_progress" },
        { field: "priority", operator: "gt", value: 3 },
        { field: "title", operator: "contains", value: "fix" },
      ];
      const payload = { status: "in_progress", priority: 5, title: "fix bug" };
      expect(evaluateConditions(conditions, payload)).toBe(true);
    });

    it("returns false when first condition fails", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "eq", value: "done" },
        { field: "priority", operator: "gt", value: 3 },
      ];
      expect(evaluateConditions(conditions, { status: "todo", priority: 5 })).toBe(false);
    });

    it("returns false when last condition fails", () => {
      const conditions: RuleCondition[] = [
        { field: "status", operator: "eq", value: "todo" },
        { field: "priority", operator: "gt", value: 10 },
      ];
      expect(evaluateConditions(conditions, { status: "todo", priority: 5 })).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// executeAction — DB-dependent tests
// ---------------------------------------------------------------------------

describe("executeAction", () => {
  let db: TestDb;
  let workspaceId: string;
  let userId: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
    userId = user.userId;
    const project = createTestProject(db, workspaceId);
    projectId = project.id;
    const task = createTestTask(db, projectId);
    taskId = task.id;
  });

  // --- update_status ---
  describe("update_status", () => {
    it("updates the task status in the database", () => {
      const action: RuleAction = {
        type: "update_status",
        params: { status: "in_progress" },
      };
      const result = executeAction(db, action, { taskId, workspaceId });

      expect(result.executed).toBe(true);
      expect(result.detail).toContain("in_progress");

      const updated = db
        .select({ status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .get();
      expect(updated?.status).toBe("in_progress");
    });

    it("returns executed false when taskId is missing", () => {
      const action: RuleAction = {
        type: "update_status",
        params: { status: "done" },
      };
      const result = executeAction(db, action, { workspaceId });

      expect(result.executed).toBe(false);
      expect(result.detail).toBe("no taskId");
    });
  });

  // --- add_tag ---
  describe("add_tag", () => {
    it("adds a tag to the task's tags array", () => {
      const action: RuleAction = {
        type: "add_tag",
        params: { tag: "automated" },
      };
      const result = executeAction(db, action, { taskId, workspaceId });

      expect(result.executed).toBe(true);
      expect(result.detail).toContain("automated");

      const updated = db
        .select({ tags: tasks.tags })
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .get();
      const parsedTags: string[] = JSON.parse(updated!.tags);
      expect(parsedTags).toContain("automated");
    });

    it("does not duplicate an existing tag", () => {
      // Add the tag once
      const action: RuleAction = {
        type: "add_tag",
        params: { tag: "flagged" },
      };
      executeAction(db, action, { taskId, workspaceId });

      // Add the same tag again
      const result = executeAction(db, action, { taskId, workspaceId });
      expect(result.executed).toBe(true);

      const updated = db
        .select({ tags: tasks.tags })
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .get();
      const parsedTags: string[] = JSON.parse(updated!.tags);
      const flaggedCount = parsedTags.filter((t) => t === "flagged").length;
      expect(flaggedCount).toBe(1);
    });

    it("returns executed false when taskId is missing", () => {
      const action: RuleAction = {
        type: "add_tag",
        params: { tag: "test" },
      };
      const result = executeAction(db, action, { workspaceId });

      expect(result.executed).toBe(false);
      expect(result.detail).toBe("no taskId");
    });

    it("returns executed false when task does not exist", () => {
      const action: RuleAction = {
        type: "add_tag",
        params: { tag: "test" },
      };
      const result = executeAction(db, action, {
        taskId: "nonexistent-task-id",
        workspaceId,
      });

      expect(result.executed).toBe(false);
      expect(result.detail).toBe("task not found");
    });
  });

  // --- notify ---
  describe("notify", () => {
    it("creates a notification record for the specified user", () => {
      const action: RuleAction = {
        type: "notify",
        params: { userId, message: "Task was auto-escalated" },
      };
      const result = executeAction(db, action, { taskId, workspaceId });

      expect(result.executed).toBe(true);
      expect(result.detail).toBe("notification sent");

      const notifs = db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .all();
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe("automation");
      expect(notifs[0].title).toBe("Automation Rule Triggered");
      expect(notifs[0].body).toBe("Task was auto-escalated");
    });

    it("still returns executed true when userId is not provided (no insert)", () => {
      const action: RuleAction = {
        type: "notify",
        params: { message: "No user specified" },
      };
      const result = executeAction(db, action, { taskId, workspaceId });

      expect(result.executed).toBe(true);
      expect(result.detail).toBe("notification sent");

      // No notification rows should exist since userId was not provided
      const notifs = db.select().from(notifications).all();
      expect(notifs.length).toBe(0);
    });
  });

  // --- create_subtask ---
  describe("create_subtask", () => {
    it("creates a subtask linked to the context task", () => {
      const action: RuleAction = {
        type: "create_subtask",
        params: { title: "Review code changes" },
      };
      const result = executeAction(db, action, { taskId, workspaceId });

      expect(result.executed).toBe(true);
      expect(result.detail).toBe("subtask created");

      const subs = db
        .select()
        .from(subtasks)
        .where(eq(subtasks.taskId, taskId))
        .all();
      expect(subs.length).toBe(1);
      expect(subs[0].title).toBe("Review code changes");
      expect(subs[0].done).toBe(0);
    });

    it("returns executed false when taskId is missing", () => {
      const action: RuleAction = {
        type: "create_subtask",
        params: { title: "Some subtask" },
      };
      const result = executeAction(db, action, { workspaceId });

      expect(result.executed).toBe(false);
      expect(result.detail).toBe("no taskId");
    });
  });

  // --- escalate ---
  describe("escalate", () => {
    it("creates an alert of type escalation", () => {
      const action: RuleAction = {
        type: "escalate",
        params: { message: "Task overdue by 3 days" },
      };
      const result = executeAction(db, action, { taskId, workspaceId });

      expect(result.executed).toBe(true);
      expect(result.detail).toBe("escalation alert created");

      const alertRows = db
        .select()
        .from(alerts)
        .where(eq(alerts.workspaceId, workspaceId))
        .all();
      expect(alertRows.length).toBe(1);
      expect(alertRows[0].type).toBe("escalation");
      expect(alertRows[0].severity).toBe("warning");
      expect(alertRows[0].message).toBe("Task overdue by 3 days");

      const metadata = JSON.parse(alertRows[0].metadata);
      expect(metadata.taskId).toBe(taskId);
    });

    it("includes botId in alert metadata when provided", () => {
      const botId = "test-bot-123";
      const action: RuleAction = {
        type: "escalate",
        params: { message: "Bot failure escalation" },
      };
      const result = executeAction(db, action, {
        taskId,
        botId,
        workspaceId,
      });

      expect(result.executed).toBe(true);

      const alertRows = db
        .select()
        .from(alerts)
        .where(eq(alerts.workspaceId, workspaceId))
        .all();
      const metadata = JSON.parse(alertRows[0].metadata);
      expect(metadata.botId).toBe(botId);
    });

    it("works without taskId (escalate does not require it)", () => {
      const action: RuleAction = {
        type: "escalate",
        params: { message: "General escalation" },
      };
      const result = executeAction(db, action, { workspaceId });

      expect(result.executed).toBe(true);

      const alertRows = db
        .select()
        .from(alerts)
        .where(eq(alerts.workspaceId, workspaceId))
        .all();
      expect(alertRows.length).toBe(1);
    });
  });

  // --- unknown action type ---
  describe("unknown action type", () => {
    it("returns executed false for an unrecognized action type", () => {
      const action = {
        type: "assign_bot" as RuleAction["type"],
        params: { botId: "some-bot" },
      };
      const result = executeAction(db, action, { taskId, workspaceId });

      expect(result.executed).toBe(false);
      expect(result.detail).toContain("unknown action type");
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — full integration tests
// ---------------------------------------------------------------------------

describe("evaluateRules", () => {
  let db: TestDb;
  let workspaceId: string;
  let userId: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
    userId = user.userId;
    const project = createTestProject(db, workspaceId);
    projectId = project.id;
    const task = createTestTask(db, projectId);
    taskId = task.id;
  });

  it("matches a rule and executes its actions", () => {
    createTestAutomationRule(db, workspaceId, {
      name: "Auto-tag urgent tasks",
      trigger: "task.updated",
      conditions: JSON.stringify([
        { field: "priority", operator: "eq", value: "high" },
      ]),
      actions: JSON.stringify([
        { type: "add_tag", params: { tag: "urgent" } },
      ]),
    });

    const result = evaluateRules(
      db,
      "task.updated",
      { priority: "high" },
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(1);
    expect(result.actionsExecuted).toBe(1);
    expect(result.results.length).toBe(1);
    expect(result.results[0].ruleName).toBe("Auto-tag urgent tasks");

    // Verify the tag was actually added
    const updated = db
      .select({ tags: tasks.tags })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get();
    const parsedTags: string[] = JSON.parse(updated!.tags);
    expect(parsedTags).toContain("urgent");
  });

  it("matches multiple rules for the same trigger", () => {
    createTestAutomationRule(db, workspaceId, {
      name: "Rule A",
      trigger: "task.created",
      conditions: JSON.stringify([
        { field: "status", operator: "eq", value: "todo" },
      ]),
      actions: JSON.stringify([
        { type: "add_tag", params: { tag: "new" } },
      ]),
    });

    createTestAutomationRule(db, workspaceId, {
      name: "Rule B",
      trigger: "task.created",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: "escalate", params: { message: "New task created" } },
      ]),
    });

    const result = evaluateRules(
      db,
      "task.created",
      { status: "todo" },
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(2);
    expect(result.actionsExecuted).toBe(2);
    expect(result.results.length).toBe(2);
  });

  it("executes multiple actions from a single rule", () => {
    createTestAutomationRule(db, workspaceId, {
      name: "Multi-action rule",
      trigger: "task.updated",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: "update_status", params: { status: "in_progress" } },
        { type: "add_tag", params: { tag: "auto-started" } },
        { type: "escalate", params: { message: "Task auto-started" } },
      ]),
    });

    const result = evaluateRules(
      db,
      "task.updated",
      {},
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(1);
    expect(result.actionsExecuted).toBe(3);
    expect(result.results[0].actions.length).toBe(3);
  });

  it("skips inactive rules", () => {
    createTestAutomationRule(db, workspaceId, {
      name: "Inactive rule",
      trigger: "task.created",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: "add_tag", params: { tag: "should-not-appear" } },
      ]),
      active: 0,
    });

    const result = evaluateRules(
      db,
      "task.created",
      {},
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(0);
    expect(result.actionsExecuted).toBe(0);
    expect(result.results.length).toBe(0);

    // Verify the tag was NOT added
    const updated = db
      .select({ tags: tasks.tags })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get();
    const parsedTags: string[] = JSON.parse(updated!.tags);
    expect(parsedTags).not.toContain("should-not-appear");
  });

  it("does not match rules with a different trigger", () => {
    createTestAutomationRule(db, workspaceId, {
      name: "Wrong trigger",
      trigger: "task.deleted",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: "escalate", params: { message: "deleted" } },
      ]),
    });

    const result = evaluateRules(
      db,
      "task.created",
      {},
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(0);
    expect(result.actionsExecuted).toBe(0);
  });

  it("does not match rules from a different workspace", async () => {
    const otherUser = await createTestUser(db, { email: "other@test.com" });
    createTestAutomationRule(db, otherUser.workspaceId, {
      name: "Other workspace rule",
      trigger: "task.created",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: "escalate", params: { message: "wrong workspace" } },
      ]),
    });

    const result = evaluateRules(
      db,
      "task.created",
      {},
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(0);
    expect(result.actionsExecuted).toBe(0);
  });

  it("skips rules whose conditions do not match the payload", () => {
    createTestAutomationRule(db, workspaceId, {
      name: "Condition mismatch",
      trigger: "task.updated",
      conditions: JSON.stringify([
        { field: "status", operator: "eq", value: "done" },
      ]),
      actions: JSON.stringify([
        { type: "add_tag", params: { tag: "completed" } },
      ]),
    });

    const result = evaluateRules(
      db,
      "task.updated",
      { status: "todo" },
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(0);
    expect(result.actionsExecuted).toBe(0);
  });

  it("counts only executed actions (not failed ones)", () => {
    // Create a rule that has an action requiring taskId, but call without it
    createTestAutomationRule(db, workspaceId, {
      name: "Partial execution",
      trigger: "bot.failed",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: "update_status", params: { status: "blocked" } },
        { type: "escalate", params: { message: "Bot failure" } },
      ]),
    });

    // No taskId in context — update_status will fail, escalate will succeed
    const result = evaluateRules(
      db,
      "bot.failed",
      {},
      { workspaceId },
    );

    expect(result.matched).toBe(1);
    // Only escalate should count as executed
    expect(result.actionsExecuted).toBe(1);
    expect(result.results[0].actions.length).toBe(2);
  });

  it("returns empty results when no rules exist for the trigger", () => {
    const result = evaluateRules(
      db,
      "task.created",
      {},
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(0);
    expect(result.actionsExecuted).toBe(0);
    expect(result.results).toEqual([]);
  });

  it("includes rule name and action details in results", () => {
    createTestAutomationRule(db, workspaceId, {
      name: "Notify on completion",
      trigger: "task.completed",
      conditions: JSON.stringify([]),
      actions: JSON.stringify([
        { type: "notify", params: { userId, message: "Task complete!" } },
      ]),
    });

    const result = evaluateRules(
      db,
      "task.completed",
      {},
      { taskId, workspaceId },
    );

    expect(result.matched).toBe(1);
    expect(result.results[0].ruleName).toBe("Notify on completion");
    expect(result.results[0].actions[0]).toContain("notify");
    expect(result.results[0].actions[0]).toContain("notification sent");
  });
});
