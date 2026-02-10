import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";

import { maybeRetryBotTask } from "@/lib/server/bot-task-retry";
import { botTasks, auditLogs } from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
  createTestBot,
  type TestDb,
} from "../helpers/setup";

describe("maybeRetryBotTask", () => {
  let db: TestDb;
  let workspaceId: string;
  let taskId: string;
  let botId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id);
    taskId = task.id;
    const bot = createTestBot(db, workspaceId);
    botId = bot.id;
  });

  it("does not retry when maxRetries is 0", () => {
    const result = maybeRetryBotTask(
      db,
      {
        id: "failed-1",
        botId,
        taskId,
        retryCount: 0,
        maxRetries: 0,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    expect(result.retried).toBe(false);
    expect(result.newTaskId).toBeUndefined();
  });

  it("does not retry when retryCount >= maxRetries", () => {
    const result = maybeRetryBotTask(
      db,
      {
        id: "failed-2",
        botId,
        taskId,
        retryCount: 3,
        maxRetries: 3,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    expect(result.retried).toBe(false);
    expect(result.newTaskId).toBeUndefined();
  });

  it("creates a new pending botTask on successful retry", () => {
    const result = maybeRetryBotTask(
      db,
      {
        id: "failed-3",
        botId,
        taskId,
        retryCount: 0,
        maxRetries: 3,
        timeoutMinutes: 30,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    expect(result.retried).toBe(true);
    expect(result.newTaskId).toBeDefined();

    // Verify the new botTask was created
    const newTask = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.id, result.newTaskId!))
      .get();

    expect(newTask).toBeDefined();
    expect(newTask!.status).toBe("pending");
    expect(newTask!.botId).toBe(botId);
    expect(newTask!.taskId).toBe(taskId);
    expect(newTask!.retryCount).toBe(1);
    expect(newTask!.maxRetries).toBe(3);
    expect(newTask!.timeoutMinutes).toBe(30);
  });

  it("preserves botGroupId and structuredSpec on retry", () => {
    const result = maybeRetryBotTask(
      db,
      {
        id: "failed-4",
        botId,
        taskId,
        retryCount: 1,
        maxRetries: 5,
        timeoutMinutes: null,
        botGroupId: "group-abc",
        structuredSpec: '{"step":"build"}',
      },
      workspaceId,
    );

    expect(result.retried).toBe(true);
    const newTask = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.id, result.newTaskId!))
      .get();

    expect(newTask!.botGroupId).toBe("group-abc");
    expect(newTask!.structuredSpec).toBe('{"step":"build"}');
  });

  it("calculates exponential backoff correctly: 30s * 2^(n-1)", () => {
    const now = Date.now();

    // First retry (retryCount goes from 0 to 1): 30s * 2^0 = 30s
    const result1 = maybeRetryBotTask(
      db,
      {
        id: "failed-r1",
        botId,
        taskId,
        retryCount: 0,
        maxRetries: 5,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    const task1 = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.id, result1.newTaskId!))
      .get();

    // retryAfter should be ~ now + 30_000 (tolerance of 2s for test execution)
    expect(task1!.retryAfter).toBeGreaterThanOrEqual(now + 30_000 - 2000);
    expect(task1!.retryAfter).toBeLessThanOrEqual(now + 30_000 + 2000);

    // Second retry (retryCount goes from 1 to 2): 30s * 2^1 = 60s
    const result2 = maybeRetryBotTask(
      db,
      {
        id: "failed-r2",
        botId,
        taskId,
        retryCount: 1,
        maxRetries: 5,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    const task2 = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.id, result2.newTaskId!))
      .get();

    expect(task2!.retryAfter).toBeGreaterThanOrEqual(now + 60_000 - 2000);
    expect(task2!.retryAfter).toBeLessThanOrEqual(now + 60_000 + 2000);

    // Third retry (retryCount goes from 2 to 3): 30s * 2^2 = 120s
    const result3 = maybeRetryBotTask(
      db,
      {
        id: "failed-r3",
        botId,
        taskId,
        retryCount: 2,
        maxRetries: 5,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    const task3 = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.id, result3.newTaskId!))
      .get();

    expect(task3!.retryAfter).toBeGreaterThanOrEqual(now + 120_000 - 2000);
    expect(task3!.retryAfter).toBeLessThanOrEqual(now + 120_000 + 2000);
  });

  it("creates an audit log entry on retry", () => {
    const result = maybeRetryBotTask(
      db,
      {
        id: "failed-audit",
        botId,
        taskId,
        retryCount: 0,
        maxRetries: 2,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    expect(result.retried).toBe(true);

    const logs = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "bot_task.retry"))
      .all();

    expect(logs.length).toBe(1);
    expect(logs[0].workspaceId).toBe(workspaceId);

    const meta = JSON.parse(logs[0].metadata);
    expect(meta.originalTaskId).toBe("failed-audit");
    expect(meta.newTaskId).toBe(result.newTaskId);
    expect(meta.retryCount).toBe(1);
  });

  it("does not create audit log when no retry occurs", () => {
    maybeRetryBotTask(
      db,
      {
        id: "failed-no-audit",
        botId,
        taskId,
        retryCount: 3,
        maxRetries: 3,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    const logs = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "bot_task.retry"))
      .all();

    expect(logs.length).toBe(0);
  });

  it("increments retryCount correctly", () => {
    const result = maybeRetryBotTask(
      db,
      {
        id: "failed-count",
        botId,
        taskId,
        retryCount: 2,
        maxRetries: 5,
        timeoutMinutes: null,
        botGroupId: null,
        structuredSpec: null,
      },
      workspaceId,
    );

    const newTask = db
      .select()
      .from(botTasks)
      .where(eq(botTasks.id, result.newTaskId!))
      .get();

    expect(newTask!.retryCount).toBe(3);
  });
});
