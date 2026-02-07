import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createTaskSchema,
  updateTaskSchema,
} from "@/lib/validators";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestMilestone,
  createTestTask,
  type TestDb,
} from "../helpers/setup";

describe("Tasks — createTaskSchema validation", () => {
  it("accepts valid task with just a title", () => {
    const result = createTaskSchema.safeParse({ title: "My Task" });
    expect(result.success).toBe(true);
  });

  it("accepts full task input", () => {
    const result = createTaskSchema.safeParse({
      title: "My Task",
      description: "Do this thing",
      priority: "high",
      milestoneId: crypto.randomUUID(),
      dueDate: Date.now() + 86400000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 200 chars", () => {
    const result = createTaskSchema.safeParse({
      title: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid priorities", () => {
    for (const priority of ["low", "medium", "high", "urgent"]) {
      const result = createTaskSchema.safeParse({ title: "Task", priority });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid milestoneId format", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      milestoneId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative dueDate", () => {
    const result = createTaskSchema.safeParse({
      title: "Task",
      dueDate: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("Tasks — updateTaskSchema validation", () => {
  it("accepts valid partial update", () => {
    const result = updateTaskSchema.safeParse({ title: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts status transition", () => {
    const result = updateTaskSchema.safeParse({ status: "in_progress" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["todo", "in_progress", "done"]) {
      const result = updateTaskSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = updateTaskSchema.safeParse({ status: "cancelled" });
    expect(result.success).toBe(false);
  });

  it("accepts nullable milestoneId", () => {
    const result = updateTaskSchema.safeParse({ milestoneId: null });
    expect(result.success).toBe(true);
  });

  it("accepts nullable assigneeId", () => {
    const result = updateTaskSchema.safeParse({ assigneeId: null });
    expect(result.success).toBe(true);
  });

  it("accepts tags array", () => {
    const result = updateTaskSchema.safeParse({
      tags: ["frontend", "bug"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = updateTaskSchema.safeParse({
      title: "Ok",
      extraField: "not allowed",
    });
    expect(result.success).toBe(false);
  });

  it("rejects tags with strings longer than 100 chars", () => {
    const result = updateTaskSchema.safeParse({
      tags: ["A".repeat(101)],
    });
    expect(result.success).toBe(false);
  });
});

describe("Tasks — creation with valid milestone", () => {
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

  it("creates a task without a milestone", () => {
    const task = createTestTask(db, projectId, { title: "Standalone Task" });

    const found = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();

    expect(found).toBeDefined();
    expect(found!.title).toBe("Standalone Task");
    expect(found!.milestoneId).toBeNull();
  });

  it("creates a task with a valid milestone", () => {
    const milestone = createTestMilestone(db, projectId, { name: "Sprint 1" });
    const task = createTestTask(db, projectId, {
      title: "Milestone Task",
      milestoneId: milestone.id,
    });

    const found = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();

    expect(found).toBeDefined();
    expect(found!.milestoneId).toBe(milestone.id);
  });

  it("rejects task with non-existent milestone via FK constraint", () => {
    expect(() => {
      createTestTask(db, projectId, {
        title: "Bad Milestone Task",
        milestoneId: crypto.randomUUID(), // Does not exist
      });
    }).toThrow(); // FK constraint violation
  });
});

describe("Tasks — status transitions", () => {
  let db: TestDb;
  let projectId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    const project = createTestProject(db, user.workspaceId);
    projectId = project.id;
  });

  it("transitions task from todo to in_progress", () => {
    const task = createTestTask(db, projectId, { status: "todo" });

    db.update(schema.tasks)
      .set({ status: "in_progress", updatedAt: Date.now() })
      .where(eq(schema.tasks.id, task.id))
      .run();

    const updated = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();

    expect(updated!.status).toBe("in_progress");
  });

  it("transitions task from in_progress to done", () => {
    const task = createTestTask(db, projectId, { status: "in_progress" });

    db.update(schema.tasks)
      .set({ status: "done", updatedAt: Date.now() })
      .where(eq(schema.tasks.id, task.id))
      .run();

    const updated = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();

    expect(updated!.status).toBe("done");
  });

  it("transitions task from done back to todo", () => {
    const task = createTestTask(db, projectId, { status: "done" });

    db.update(schema.tasks)
      .set({ status: "todo", updatedAt: Date.now() })
      .where(eq(schema.tasks.id, task.id))
      .run();

    const updated = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();

    expect(updated!.status).toBe("todo");
  });

  it("updates tags as JSON string", () => {
    const task = createTestTask(db, projectId);

    const newTags = JSON.stringify(["frontend", "bug"]);
    db.update(schema.tasks)
      .set({ tags: newTags, updatedAt: Date.now() })
      .where(eq(schema.tasks.id, task.id))
      .run();

    const updated = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, task.id))
      .get();

    expect(JSON.parse(updated!.tags)).toEqual(["frontend", "bug"]);
  });

  it("auto-increments position for tasks in the same project/milestone", () => {
    const milestone = createTestMilestone(db, projectId);

    createTestTask(db, projectId, {
      title: "Task 1",
      milestoneId: milestone.id,
      position: 0,
    });
    createTestTask(db, projectId, {
      title: "Task 2",
      milestoneId: milestone.id,
      position: 1,
    });
    createTestTask(db, projectId, {
      title: "Task 3",
      milestoneId: milestone.id,
      position: 2,
    });

    const tasks = db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, projectId),
          eq(schema.tasks.milestoneId, milestone.id),
        ),
      )
      .all();

    expect(tasks).toHaveLength(3);
    const positions = tasks.map((t) => t.position).sort();
    expect(positions).toEqual([0, 1, 2]);
  });
});
