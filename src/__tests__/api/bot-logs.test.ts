import { describe, it, expect, beforeEach } from "vitest";
import { eq, desc, and } from "drizzle-orm";
import { hash } from "bcryptjs";
import * as schema from "@/lib/db/schema";
import { createBotLogSchema } from "@/lib/validators";
import { createTestDb, createTestUser, type TestDb } from "../helpers/setup";

describe("Bot logs — createBotLogSchema validation", () => {
  it("accepts valid log with all fields", () => {
    const result = createBotLogSchema.safeParse({
      level: "error",
      message: "Something went wrong",
      metadata: { file: "index.ts", line: 42 },
      botTaskId: crypto.randomUUID(),
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal log with just message", () => {
    const result = createBotLogSchema.safeParse({
      message: "Bot started",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe("info");
      expect(result.data.metadata).toEqual({});
    }
  });

  it("rejects invalid level", () => {
    const result = createBotLogSchema.safeParse({
      level: "critical",
      message: "Bad level",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid levels", () => {
    for (const level of ["info", "warn", "error", "debug"]) {
      const result = createBotLogSchema.safeParse({
        level,
        message: `Log at ${level}`,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty message", () => {
    const result = createBotLogSchema.safeParse({
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing message", () => {
    const result = createBotLogSchema.safeParse({
      level: "info",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional metadata", () => {
    const result = createBotLogSchema.safeParse({
      message: "No metadata",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({});
    }
  });

  it("accepts optional botTaskId", () => {
    const taskId = crypto.randomUUID();
    const result = createBotLogSchema.safeParse({
      message: "With task",
      botTaskId: taskId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.botTaskId).toBe(taskId);
    }
  });

  it("rejects extra fields (strict mode)", () => {
    const result = createBotLogSchema.safeParse({
      message: "Some message",
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });
});

describe("Bot logs — DB integration", () => {
  let db: TestDb;
  let workspaceId: string;
  let botId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;

    // Create a bot
    botId = crypto.randomUUID();
    const now = Date.now();
    const tokenHash = await hash("test-token", 4);
    db.insert(schema.bots)
      .values({
        id: botId,
        workspaceId,
        name: "Log Test Bot",
        host: "localhost:9090",
        status: "idle",
        capabilities: "[]",
        lastSeenAt: now,
        tokenPrefix: "abcd1234",
        tokenHash,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("inserts a bot log entry", () => {
    const logId = crypto.randomUUID();
    const now = Date.now();

    db.insert(schema.botLogs)
      .values({
        id: logId,
        botId,
        workspaceId,
        level: "info",
        message: "Task started",
        metadata: JSON.stringify({ step: 1 }),
        createdAt: now,
      })
      .run();

    const found = db
      .select()
      .from(schema.botLogs)
      .where(eq(schema.botLogs.id, logId))
      .get();

    expect(found).toBeDefined();
    expect(found!.botId).toBe(botId);
    expect(found!.workspaceId).toBe(workspaceId);
    expect(found!.level).toBe("info");
    expect(found!.message).toBe("Task started");
    expect(JSON.parse(found!.metadata)).toEqual({ step: 1 });
  });

  it("queries logs by level filter", () => {
    const baseTime = Date.now();

    // Insert logs with different levels
    const levels = ["info", "error", "warn", "info", "debug"];
    for (let i = 0; i < levels.length; i++) {
      db.insert(schema.botLogs)
        .values({
          id: crypto.randomUUID(),
          botId,
          workspaceId,
          level: levels[i],
          message: `Log at ${levels[i]}`,
          metadata: "{}",
          createdAt: baseTime + i,
        })
        .run();
    }

    // Query only error logs
    const errorLogs = db
      .select()
      .from(schema.botLogs)
      .where(
        and(eq(schema.botLogs.botId, botId), eq(schema.botLogs.level, "error")),
      )
      .all();

    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].level).toBe("error");

    // Query only info logs
    const infoLogs = db
      .select()
      .from(schema.botLogs)
      .where(
        and(eq(schema.botLogs.botId, botId), eq(schema.botLogs.level, "info")),
      )
      .all();

    expect(infoLogs).toHaveLength(2);
  });

  it("paginates logs with limit and offset", () => {
    const baseTime = Date.now();

    // Insert 10 logs
    for (let i = 0; i < 10; i++) {
      db.insert(schema.botLogs)
        .values({
          id: crypto.randomUUID(),
          botId,
          workspaceId,
          level: "info",
          message: `Log entry ${i}`,
          metadata: "{}",
          createdAt: baseTime + i,
        })
        .run();
    }

    // Get first page (limit 3)
    const page1 = db
      .select()
      .from(schema.botLogs)
      .where(eq(schema.botLogs.botId, botId))
      .orderBy(desc(schema.botLogs.createdAt))
      .limit(3)
      .offset(0)
      .all();

    expect(page1).toHaveLength(3);
    expect(page1[0].message).toBe("Log entry 9"); // Most recent first

    // Get second page (limit 3, offset 3)
    const page2 = db
      .select()
      .from(schema.botLogs)
      .where(eq(schema.botLogs.botId, botId))
      .orderBy(desc(schema.botLogs.createdAt))
      .limit(3)
      .offset(3)
      .all();

    expect(page2).toHaveLength(3);
    expect(page2[0].message).toBe("Log entry 6");
  });

  it("orders logs by createdAt descending", () => {
    const baseTime = Date.now();

    // Insert logs in order
    for (let i = 0; i < 5; i++) {
      db.insert(schema.botLogs)
        .values({
          id: crypto.randomUUID(),
          botId,
          workspaceId,
          level: "info",
          message: `Log ${i}`,
          metadata: "{}",
          createdAt: baseTime + i * 1000,
        })
        .run();
    }

    const logs = db
      .select()
      .from(schema.botLogs)
      .where(eq(schema.botLogs.botId, botId))
      .orderBy(desc(schema.botLogs.createdAt))
      .all();

    expect(logs).toHaveLength(5);
    // Most recent first
    expect(logs[0].message).toBe("Log 4");
    expect(logs[4].message).toBe("Log 0");
    // Verify strictly descending
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i - 1].createdAt).toBeGreaterThan(logs[i].createdAt);
    }
  });

  it("stores and retrieves botTaskId association", async () => {
    // Create a project and task for the botTask FK
    const projectId = crypto.randomUUID();
    const now = Date.now();
    db.insert(schema.projects)
      .values({
        id: projectId,
        workspaceId,
        name: "Test Project",
        description: "",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const taskId = crypto.randomUUID();
    db.insert(schema.tasks)
      .values({
        id: taskId,
        projectId,
        title: "Test Task",
        description: "",
        status: "todo",
        priority: "medium",
        tags: "[]",
        position: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const botTaskId = crypto.randomUUID();
    db.insert(schema.botTasks)
      .values({
        id: botTaskId,
        botId,
        taskId,
        status: "running",
        outputSummary: "",
        artifactLinks: "[]",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const logId = crypto.randomUUID();
    db.insert(schema.botLogs)
      .values({
        id: logId,
        botId,
        workspaceId,
        level: "info",
        message: "Working on task",
        metadata: "{}",
        botTaskId,
        createdAt: now,
      })
      .run();

    const found = db
      .select()
      .from(schema.botLogs)
      .where(eq(schema.botLogs.id, logId))
      .get();

    expect(found).toBeDefined();
    expect(found!.botTaskId).toBe(botTaskId);
  });

  it("returns empty array when no logs exist for bot", () => {
    const logs = db
      .select()
      .from(schema.botLogs)
      .where(eq(schema.botLogs.botId, botId))
      .all();

    expect(logs).toHaveLength(0);
  });
});
