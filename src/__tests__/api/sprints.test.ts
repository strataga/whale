import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  createTestTask,
  createTestSprint,
  type TestDb,
} from "../helpers/setup";
import { createSprintSchema, updateSprintSchema } from "@/lib/validators";

describe("Sprints", () => {
  let db: TestDb;
  let workspaceId: string;
  let projectId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db, { role: "admin" });
    workspaceId = user.workspaceId;
    const project = createTestProject(db, workspaceId);
    projectId = project.id;
  });

  describe("createSprintSchema validation", () => {
    it("accepts valid sprint data", () => {
      const now = Date.now();
      const result = createSprintSchema.safeParse({
        name: "Sprint 1",
        startDate: now,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const now = Date.now();
      const result = createSprintSchema.safeParse({
        name: "",
        startDate: now,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing startDate", () => {
      const result = createSprintSchema.safeParse({
        name: "Sprint 1",
        endDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing endDate", () => {
      const result = createSprintSchema.safeParse({
        name: "Sprint 1",
        startDate: Date.now(),
      });
      expect(result.success).toBe(false);
    });

    it("rejects extra fields (strict mode)", () => {
      const now = Date.now();
      const result = createSprintSchema.safeParse({
        name: "Sprint 1",
        startDate: now,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
        extra: "field",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateSprintSchema validation", () => {
    it("accepts name update", () => {
      const result = updateSprintSchema.safeParse({ name: "Sprint 2" });
      expect(result.success).toBe(true);
    });

    it("accepts status transition", () => {
      const result = updateSprintSchema.safeParse({ status: "active" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = updateSprintSchema.safeParse({ status: "cancelled" });
      expect(result.success).toBe(false);
    });
  });

  describe("Sprint CRUD via DB", () => {
    it("creates a sprint with correct fields", () => {
      const sprint = createTestSprint(db, projectId, {
        name: "Sprint Alpha",
        status: "planning",
      });
      expect(sprint.id).toBeDefined();
      expect(sprint.name).toBe("Sprint Alpha");
      expect(sprint.status).toBe("planning");

      const row = db
        .select()
        .from(schema.sprints)
        .where(eq(schema.sprints.id, sprint.id))
        .get();
      expect(row).toBeDefined();
      expect(row!.projectId).toBe(projectId);
      expect(row!.name).toBe("Sprint Alpha");
      expect(row!.status).toBe("planning");
    });

    it("lists sprints for a project", () => {
      createTestSprint(db, projectId, { name: "Sprint 1" });
      createTestSprint(db, projectId, { name: "Sprint 2" });

      const rows = db
        .select()
        .from(schema.sprints)
        .where(eq(schema.sprints.projectId, projectId))
        .all();
      expect(rows).toHaveLength(2);
    });

    it("updates sprint status", () => {
      const sprint = createTestSprint(db, projectId, { status: "planning" });

      db.update(schema.sprints)
        .set({ status: "active", updatedAt: Date.now() })
        .where(eq(schema.sprints.id, sprint.id))
        .run();

      const updated = db
        .select()
        .from(schema.sprints)
        .where(eq(schema.sprints.id, sprint.id))
        .get();
      expect(updated!.status).toBe("active");
    });

    it("deletes a sprint", () => {
      const sprint = createTestSprint(db, projectId);

      db.delete(schema.sprints)
        .where(eq(schema.sprints.id, sprint.id))
        .run();

      const deleted = db
        .select()
        .from(schema.sprints)
        .where(eq(schema.sprints.id, sprint.id))
        .get();
      expect(deleted).toBeUndefined();
    });
  });

  describe("Sprint tasks", () => {
    it("assigns tasks to a sprint", () => {
      const sprint = createTestSprint(db, projectId);
      const task1 = createTestTask(db, projectId, { title: "Task A" });
      const task2 = createTestTask(db, projectId, { title: "Task B" });

      const now = Date.now();
      db.insert(schema.sprintTasks)
        .values([
          {
            id: crypto.randomUUID(),
            sprintId: sprint.id,
            taskId: task1.id,
            createdAt: now,
          },
          {
            id: crypto.randomUUID(),
            sprintId: sprint.id,
            taskId: task2.id,
            createdAt: now,
          },
        ])
        .run();

      const assigned = db
        .select()
        .from(schema.sprintTasks)
        .where(eq(schema.sprintTasks.sprintId, sprint.id))
        .all();
      expect(assigned).toHaveLength(2);
    });

    it("removes task from sprint", () => {
      const sprint = createTestSprint(db, projectId);
      const task = createTestTask(db, projectId);
      const stId = crypto.randomUUID();

      db.insert(schema.sprintTasks)
        .values({
          id: stId,
          sprintId: sprint.id,
          taskId: task.id,
          createdAt: Date.now(),
        })
        .run();

      db.delete(schema.sprintTasks)
        .where(eq(schema.sprintTasks.id, stId))
        .run();

      const remaining = db
        .select()
        .from(schema.sprintTasks)
        .where(eq(schema.sprintTasks.sprintId, sprint.id))
        .all();
      expect(remaining).toHaveLength(0);
    });
  });

  describe("Sprint status transitions", () => {
    it("planning → active → completed lifecycle", () => {
      const sprint = createTestSprint(db, projectId, { status: "planning" });

      // planning → active
      db.update(schema.sprints)
        .set({ status: "active", updatedAt: Date.now() })
        .where(eq(schema.sprints.id, sprint.id))
        .run();

      let row = db
        .select()
        .from(schema.sprints)
        .where(eq(schema.sprints.id, sprint.id))
        .get();
      expect(row!.status).toBe("active");

      // active → completed
      db.update(schema.sprints)
        .set({ status: "completed", updatedAt: Date.now() })
        .where(eq(schema.sprints.id, sprint.id))
        .run();

      row = db
        .select()
        .from(schema.sprints)
        .where(eq(schema.sprints.id, sprint.id))
        .get();
      expect(row!.status).toBe("completed");
    });
  });

  describe("Sprint analytics", () => {
    it("computes completion stats from sprint tasks", () => {
      const sprint = createTestSprint(db, projectId, { status: "active" });

      // Add tasks with various statuses
      const tasks = [
        createTestTask(db, projectId, { status: "done" }),
        createTestTask(db, projectId, { status: "done" }),
        createTestTask(db, projectId, { status: "in_progress" }),
        createTestTask(db, projectId, { status: "todo" }),
      ];

      const now = Date.now();
      for (const task of tasks) {
        db.insert(schema.sprintTasks)
          .values({
            id: crypto.randomUUID(),
            sprintId: sprint.id,
            taskId: task.id,
            createdAt: now,
          })
          .run();
      }

      // Compute analytics: join sprintTasks with tasks
      const sprintTaskRows = db
        .select()
        .from(schema.sprintTasks)
        .where(eq(schema.sprintTasks.sprintId, sprint.id))
        .all();

      const taskIds = sprintTaskRows.map((st) => st.taskId);
      const allTasks = db.select().from(schema.tasks).all();
      const sprintTaskStatuses = allTasks
        .filter((t) => taskIds.includes(t.id))
        .map((t) => t.status);

      const totalTasks = sprintTaskStatuses.length;
      const doneTasks = sprintTaskStatuses.filter((s) => s === "done").length;
      const completionPercent = Math.round((doneTasks / totalTasks) * 100);

      expect(totalTasks).toBe(4);
      expect(doneTasks).toBe(2);
      expect(completionPercent).toBe(50);
    });
  });
});
