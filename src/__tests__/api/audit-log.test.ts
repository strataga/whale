import { describe, it, expect, beforeEach } from "vitest";
import { eq, desc, sql, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  type TestDb,
} from "../helpers/setup";

function insertAuditLog(
  db: TestDb,
  params: {
    workspaceId: string;
    userId?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
    createdAt?: number;
  },
) {
  const now = params.createdAt ?? Date.now();
  db.insert(schema.auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      userId: params.userId ?? null,
      action: params.action,
      metadata: JSON.stringify(params.metadata ?? {}),
      createdAt: now,
    })
    .run();
}

describe("Audit Log — writing", () => {
  let db: TestDb;
  let workspaceId: string;
  let userId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, {
      email: "admin@test.com",
      role: "admin",
    });
    workspaceId = user.workspaceId;
    userId = user.userId;
  });

  it("writes an audit log entry", () => {
    insertAuditLog(db, {
      workspaceId,
      userId,
      action: "project.create",
      metadata: { projectId: "p1", name: "Test" },
    });

    const rows = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("project.create");
    expect(rows[0].userId).toBe(userId);
    expect(JSON.parse(rows[0].metadata)).toEqual({
      projectId: "p1",
      name: "Test",
    });
  });

  it("writes audit log without userId (for bot actions)", () => {
    insertAuditLog(db, {
      workspaceId,
      userId: null,
      action: "bot.register",
      metadata: { botId: "b1" },
    });

    const rows = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].action).toBe("bot.register");
  });

  it("writes audit log with empty metadata", () => {
    insertAuditLog(db, {
      workspaceId,
      userId,
      action: "user.login",
    });

    const row = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .get();

    expect(row).toBeDefined();
    expect(JSON.parse(row!.metadata)).toEqual({});
  });

  it("records createdAt timestamp", () => {
    const before = Date.now();

    insertAuditLog(db, {
      workspaceId,
      userId,
      action: "test.action",
    });

    const after = Date.now();

    const row = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .get();

    expect(row!.createdAt).toBeGreaterThanOrEqual(before);
    expect(row!.createdAt).toBeLessThanOrEqual(after);
  });

  it("scopes audit logs by workspace", async () => {
    const user2 = await createTestUser(db, { email: "other@test.com" });
    const otherWorkspaceId = user2.workspaceId;

    insertAuditLog(db, {
      workspaceId,
      userId,
      action: "ws1.action",
    });

    insertAuditLog(db, {
      workspaceId: otherWorkspaceId,
      userId: user2.userId,
      action: "ws2.action",
    });

    const ws1Logs = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .all();

    expect(ws1Logs).toHaveLength(1);
    expect(ws1Logs[0].action).toBe("ws1.action");
  });
});

describe("Audit Log — pagination", () => {
  let db: TestDb;
  let workspaceId: string;
  let userId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, {
      email: "admin@test.com",
      role: "admin",
    });
    workspaceId = user.workspaceId;
    userId = user.userId;

    // Insert 75 audit log entries with sequential timestamps
    const baseTime = Date.now();
    for (let i = 0; i < 75; i++) {
      insertAuditLog(db, {
        workspaceId,
        userId,
        action: `action.${i}`,
        createdAt: baseTime + i,
      });
    }
  });

  it("counts total entries correctly", () => {
    const totalRow = db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .get();

    expect(totalRow!.count).toBe(75);
  });

  it("returns first page with default limit", () => {
    const limit = 50;
    const offset = 0;

    const rows = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    expect(rows).toHaveLength(50);
    // Should be ordered by createdAt desc
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].createdAt).toBeGreaterThanOrEqual(rows[i].createdAt);
    }
  });

  it("returns second page with remaining entries", () => {
    const limit = 50;
    const offset = 50;

    const rows = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    expect(rows).toHaveLength(25);
  });

  it("calculates total pages correctly", () => {
    const limit = 50;
    const totalRow = db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .get();

    const total = totalRow!.count;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    expect(totalPages).toBe(2);
  });

  it("returns custom page size", () => {
    const limit = 10;

    const rows = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
      .offset(0)
      .all();

    expect(rows).toHaveLength(10);
  });

  it("handles page beyond available data gracefully", () => {
    const limit = 50;
    const total = 75;
    const totalPages = Math.ceil(total / limit); // 2
    const requestedPage = 5;
    const clampedPage = Math.min(requestedPage, totalPages); // 2
    const offset = (clampedPage - 1) * limit; // 50

    const rows = db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    expect(rows).toHaveLength(25);
  });

  it("filters by action", () => {
    const action = "action.42";

    const rows = db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.workspaceId, workspaceId),
          eq(schema.auditLogs.action, action),
        ),
      )
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("action.42");
  });

  it("joins user data for audit log entries", () => {
    const rows = db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        userId: schema.users.id,
        userName: schema.users.name,
        userEmail: schema.users.email,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .where(eq(schema.auditLogs.workspaceId, workspaceId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(5)
      .all();

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.userId).toBe(userId);
      expect(row.userEmail).toBeDefined();
    }
  });
});
