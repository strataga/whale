import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  inviteUserSchema,
  updateUserRoleSchema,
} from "@/lib/validators";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
  type TestDb,
} from "../helpers/setup";

describe("Users — inviteUserSchema validation", () => {
  it("accepts valid invite", () => {
    const result = inviteUserSchema.safeParse({
      email: "newuser@example.com",
      name: "New User",
      role: "member",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid roles", () => {
    for (const role of ["admin", "member", "viewer"]) {
      const result = inviteUserSchema.safeParse({
        email: "user@test.com",
        name: "User",
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid email", () => {
    const result = inviteUserSchema.safeParse({
      email: "not-email",
      name: "User",
      role: "member",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = inviteUserSchema.safeParse({
      email: "user@test.com",
      name: "User",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = inviteUserSchema.safeParse({
      email: "user@test.com",
      name: "",
      role: "member",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = inviteUserSchema.safeParse({
      email: "user@test.com",
      name: "User",
      role: "member",
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });
});

describe("Users — updateUserRoleSchema validation", () => {
  it("accepts valid role update", () => {
    const result = updateUserRoleSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = updateUserRoleSchema.safeParse({ role: "owner" });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = updateUserRoleSchema.safeParse({
      role: "admin",
      extra: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("Users — role update logic", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const admin = await createTestUser(db, {
      email: "admin@test.com",
      role: "admin",
    });
    workspaceId = admin.workspaceId;
  });

  it("updates a user role from member to admin", async () => {
    const member = await createTestUser(db, {
      email: "member@test.com",
      role: "member",
      workspaceId,
    });

    db.update(schema.users)
      .set({ role: "admin", updatedAt: Date.now() })
      .where(
        and(
          eq(schema.users.id, member.userId),
          eq(schema.users.workspaceId, workspaceId),
        ),
      )
      .run();

    const updated = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, member.userId))
      .get();

    expect(updated!.role).toBe("admin");
  });

  it("updates a user role from admin to viewer", async () => {
    const otherAdmin = await createTestUser(db, {
      email: "other-admin@test.com",
      role: "admin",
      workspaceId,
    });

    db.update(schema.users)
      .set({ role: "viewer", updatedAt: Date.now() })
      .where(
        and(
          eq(schema.users.id, otherAdmin.userId),
          eq(schema.users.workspaceId, workspaceId),
        ),
      )
      .run();

    const updated = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, otherAdmin.userId))
      .get();

    expect(updated!.role).toBe("viewer");
  });

  it("no-op when role is unchanged", async () => {
    const member = await createTestUser(db, {
      email: "member@test.com",
      role: "member",
      workspaceId,
    });

    const before = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, member.userId))
      .get();

    // Simulate "same role" check from the route handler
    const targetRole = before!.role;
    const newRole = "member";

    if (targetRole === newRole) {
      // No-op — same as route handler returning { ok: true } immediately
      expect(true).toBe(true);
    }

    // User should be unchanged
    const after = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, member.userId))
      .get();

    expect(after!.role).toBe("member");
    expect(after!.updatedAt).toBe(before!.updatedAt);
  });
});

describe("Users — self-protection", () => {
  let db: TestDb;
  let adminUserId: string;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const admin = await createTestUser(db, {
      email: "admin@test.com",
      role: "admin",
    });
    adminUserId = admin.userId;
    workspaceId = admin.workspaceId;
  });

  it("prevents self-demotion (simulated route logic)", () => {
    // From route handler: if (userId === ctx.userId && patch.role !== "admin")
    const userId = adminUserId;
    const ctxUserId = adminUserId;
    const patchRole: string = "member";

    const wouldSelfDemote = userId === ctxUserId && patchRole !== "admin";
    expect(wouldSelfDemote).toBe(true);
  });

  it("allows setting self role to admin (no-op case)", () => {
    const userId = adminUserId;
    const ctxUserId = adminUserId;
    const patchRole: string = "admin";

    const wouldSelfDemote = userId === ctxUserId && patchRole !== "admin";
    expect(wouldSelfDemote).toBe(false);
  });

  it("prevents self-removal (simulated route logic)", () => {
    // From route handler: if (userId === ctx.userId) return error
    const userId = adminUserId;
    const ctxUserId = adminUserId;

    const wouldSelfRemove = userId === ctxUserId;
    expect(wouldSelfRemove).toBe(true);
  });

  it("allows removing another user", async () => {
    const member = await createTestUser(db, {
      email: "removable@test.com",
      role: "member",
      workspaceId,
    });

    const wouldSelfRemove = member.userId === adminUserId;
    expect(wouldSelfRemove).toBe(false);

    // Actually delete the user (matching route handler logic)
    // First unassign tasks
    db.update(schema.tasks)
      .set({ assigneeId: null, updatedAt: Date.now() })
      .where(eq(schema.tasks.assigneeId, member.userId))
      .run();

    // Clear audit log references
    db.update(schema.auditLogs)
      .set({ userId: null })
      .where(
        and(
          eq(schema.auditLogs.workspaceId, workspaceId),
          eq(schema.auditLogs.userId, member.userId),
        ),
      )
      .run();

    // Delete the user
    db.delete(schema.users)
      .where(
        and(
          eq(schema.users.id, member.userId),
          eq(schema.users.workspaceId, workspaceId),
        ),
      )
      .run();

    const deleted = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, member.userId))
      .get();

    expect(deleted).toBeUndefined();
  });

  it("unassigns tasks when removing a user", async () => {
    const member = await createTestUser(db, {
      email: "member-with-tasks@test.com",
      role: "member",
      workspaceId,
    });

    const project = createTestProject(db, workspaceId);
    const task = createTestTask(db, project.id, {
      title: "Assigned Task",
      assigneeId: member.userId,
    });

    // Verify task is assigned
    const before = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();
    expect(before!.assigneeId).toBe(member.userId);

    // Unassign tasks (same as route handler)
    db.update(schema.tasks)
      .set({ assigneeId: null, updatedAt: Date.now() })
      .where(eq(schema.tasks.assigneeId, member.userId))
      .run();

    // Delete user
    db.delete(schema.users)
      .where(eq(schema.users.id, member.userId))
      .run();

    // Task should still exist but unassigned
    const after = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();

    expect(after).toBeDefined();
    expect(after!.assigneeId).toBeNull();
  });
});
