import { describe, it, expect, beforeEach } from "vitest";
import { eq, and, asc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createMilestoneSchema } from "@/lib/validators";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestMilestone,
  createTestTask,
  type TestDb,
} from "../helpers/setup";

describe("Milestones — createMilestoneSchema validation", () => {
  it("accepts valid milestone with just a name", () => {
    const result = createMilestoneSchema.safeParse({ name: "Sprint 1" });
    expect(result.success).toBe(true);
  });

  it("accepts milestone with dueDate", () => {
    const result = createMilestoneSchema.safeParse({
      name: "Sprint 1",
      dueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createMilestoneSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = createMilestoneSchema.safeParse({
      name: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative dueDate", () => {
    const result = createMilestoneSchema.safeParse({
      name: "Sprint 1",
      dueDate: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer dueDate", () => {
    const result = createMilestoneSchema.safeParse({
      name: "Sprint 1",
      dueDate: 123.456,
    });
    expect(result.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const result = createMilestoneSchema.safeParse({
      name: "  Sprint 1  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Sprint 1");
    }
  });
});

describe("Milestones — CRUD operations", () => {
  let db: TestDb;
  let workspaceId: string;
  let projectId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
    const project = createTestProject(db, workspaceId);
    projectId = project.id;
  });

  it("creates a milestone for a project", () => {
    const ms = createTestMilestone(db, projectId, { name: "M1" });

    const found = db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.id, ms.id))
      .get();

    expect(found).toBeDefined();
    expect(found!.name).toBe("M1");
    expect(found!.projectId).toBe(projectId);
  });

  it("lists milestones in position order", () => {
    createTestMilestone(db, projectId, { name: "M3", position: 2 });
    createTestMilestone(db, projectId, { name: "M1", position: 0 });
    createTestMilestone(db, projectId, { name: "M2", position: 1 });

    const rows = db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.projectId, projectId))
      .orderBy(asc(schema.milestones.position))
      .all();

    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe("M1");
    expect(rows[1].name).toBe("M2");
    expect(rows[2].name).toBe("M3");
  });

  it("updates a milestone name", () => {
    const ms = createTestMilestone(db, projectId, { name: "Old Name" });

    db.update(schema.milestones)
      .set({ name: "New Name", updatedAt: Date.now() })
      .where(
        and(
          eq(schema.milestones.id, ms.id),
          eq(schema.milestones.projectId, projectId),
        ),
      )
      .run();

    const updated = db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.id, ms.id))
      .get();

    expect(updated!.name).toBe("New Name");
  });

  it("updates a milestone dueDate", () => {
    const ms = createTestMilestone(db, projectId);
    const futureDate = Date.now() + 86400000 * 7;

    db.update(schema.milestones)
      .set({ dueDate: futureDate, updatedAt: Date.now() })
      .where(eq(schema.milestones.id, ms.id))
      .run();

    const updated = db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.id, ms.id))
      .get();

    expect(updated!.dueDate).toBe(futureDate);
  });

  it("deletes a milestone and moves tasks to backlog", () => {
    const ms = createTestMilestone(db, projectId, { name: "To Delete" });

    // Create tasks in this milestone
    const task1 = createTestTask(db, projectId, {
      title: "MS Task 1",
      milestoneId: ms.id,
    });
    const task2 = createTestTask(db, projectId, {
      title: "MS Task 2",
      milestoneId: ms.id,
    });

    // Simulate the delete flow from the route handler:
    // 1. Move tasks to backlog (milestoneId = null)
    db.update(schema.tasks)
      .set({ milestoneId: null, updatedAt: Date.now() })
      .where(
        and(
          eq(schema.tasks.milestoneId, ms.id),
          eq(schema.tasks.projectId, projectId),
        ),
      )
      .run();

    // 2. Delete the milestone
    const res = db
      .delete(schema.milestones)
      .where(
        and(
          eq(schema.milestones.id, ms.id),
          eq(schema.milestones.projectId, projectId),
        ),
      )
      .run();

    expect(res.changes).toBe(1);

    // Milestone gone
    const msRow = db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.id, ms.id))
      .get();
    expect(msRow).toBeUndefined();

    // Tasks still exist but with null milestoneId
    const t1 = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task1.id))
      .get();
    expect(t1).toBeDefined();
    expect(t1!.milestoneId).toBeNull();

    const t2 = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task2.id))
      .get();
    expect(t2).toBeDefined();
    expect(t2!.milestoneId).toBeNull();
  });

  it("rejects milestone for non-existent project via FK constraint", () => {
    expect(() => {
      createTestMilestone(db, crypto.randomUUID(), { name: "Bad" });
    }).toThrow();
  });
});
