import { describe, it, expect, beforeEach } from "vitest";
import { eq, desc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/lib/validators";
import {
  createTestDb,
  createTestUser,
  createTestProject,
  type TestDb,
} from "../helpers/setup";

describe("Projects — createProjectSchema validation", () => {
  it("accepts valid project input", () => {
    const result = createProjectSchema.safeParse({
      name: "My Project",
      description: "A cool project",
    });
    expect(result.success).toBe(true);
  });

  it("accepts project without description", () => {
    const result = createProjectSchema.safeParse({ name: "My Project" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createProjectSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    const result = createProjectSchema.safeParse({
      name: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 5000 chars", () => {
    const result = createProjectSchema.safeParse({
      name: "Project",
      description: "A".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const result = createProjectSchema.safeParse({
      name: "  My Project  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("My Project");
    }
  });
});

describe("Projects — updateProjectSchema validation", () => {
  it("accepts valid partial update", () => {
    const result = updateProjectSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts status update", () => {
    const result = updateProjectSchema.safeParse({ status: "active" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateProjectSchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = updateProjectSchema.safeParse({
      name: "Ok",
      extraField: "not allowed",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["draft", "active", "completed", "archived"]) {
      const result = updateProjectSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });
});

describe("Projects — CRUD operations", () => {
  let db: TestDb;
  let workspaceId: string;

  beforeEach(async () => {
    db = createTestDb();
    const user = await createTestUser(db);
    workspaceId = user.workspaceId;
  });

  it("creates a project in the workspace", () => {
    const project = createTestProject(db, workspaceId, {
      name: "New Project",
      description: "Description here",
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe("New Project");
    expect(project.description).toBe("Description here");
    expect(project.workspaceId).toBe(workspaceId);
  });

  it("reads a project by ID", () => {
    const created = createTestProject(db, workspaceId, { name: "Read Me" });

    const found = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, created.id))
      .get();

    expect(found).toBeDefined();
    expect(found!.name).toBe("Read Me");
  });

  it("lists all projects in a workspace", () => {
    createTestProject(db, workspaceId, { name: "Project 1" });
    createTestProject(db, workspaceId, { name: "Project 2" });

    const rows = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.workspaceId, workspaceId))
      .orderBy(desc(schema.projects.updatedAt))
      .all();

    expect(rows).toHaveLength(2);
  });

  it("updates a project", () => {
    const project = createTestProject(db, workspaceId, { name: "Original" });

    db.update(schema.projects)
      .set({ name: "Updated", status: "active", updatedAt: Date.now() })
      .where(eq(schema.projects.id, project.id))
      .run();

    const updated = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id))
      .get();

    expect(updated!.name).toBe("Updated");
    expect(updated!.status).toBe("active");
  });

  it("deletes a project and its related data", () => {
    const project = createTestProject(db, workspaceId);

    // Add milestone and task
    const msId = crypto.randomUUID();
    const now = Date.now();
    db.insert(schema.milestones)
      .values({
        id: msId,
        projectId: project.id,
        name: "MS1",
        position: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(schema.tasks)
      .values({
        id: crypto.randomUUID(),
        projectId: project.id,
        milestoneId: msId,
        title: "Task 1",
        status: "todo",
        priority: "medium",
        tags: "[]",
        position: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Delete in correct order (same as route handler)
    db.delete(schema.tasks)
      .where(eq(schema.tasks.projectId, project.id))
      .run();
    db.delete(schema.milestones)
      .where(eq(schema.milestones.projectId, project.id))
      .run();
    db.delete(schema.projects)
      .where(eq(schema.projects.id, project.id))
      .run();

    const found = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project.id))
      .get();

    expect(found).toBeUndefined();

    const remainingTasks = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, project.id))
      .all();

    expect(remainingTasks).toHaveLength(0);

    const remainingMilestones = db
      .select()
      .from(schema.milestones)
      .where(eq(schema.milestones.projectId, project.id))
      .all();

    expect(remainingMilestones).toHaveLength(0);
  });
});

describe("Projects — workspace scoping", () => {
  let db: TestDb;

  it("cannot see projects from another workspace", async () => {
    db = createTestDb();

    // Create two different workspaces
    const user1 = await createTestUser(db, { email: "user1@test.com" });
    const user2 = await createTestUser(db, { email: "user2@test.com" });

    createTestProject(db, user1.workspaceId, { name: "WS1 Project" });
    createTestProject(db, user2.workspaceId, { name: "WS2 Project" });

    // Query only workspace 1's projects
    const ws1Projects = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.workspaceId, user1.workspaceId))
      .all();

    expect(ws1Projects).toHaveLength(1);
    expect(ws1Projects[0].name).toBe("WS1 Project");

    // Query only workspace 2's projects
    const ws2Projects = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.workspaceId, user2.workspaceId))
      .all();

    expect(ws2Projects).toHaveLength(1);
    expect(ws2Projects[0].name).toBe("WS2 Project");
  });
});
