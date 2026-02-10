import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

// ── Queries ──

export const list = authQuery
  .input(
    z.object({
      projectId: z.string().optional(),
      status: z.string().optional(),
      assigneeId: z.string().optional(),
      limit: z.number().min(1).max(200).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    let tasks;

    if (input.projectId) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", input.projectId as any))
        .collect();
    } else {
      // For workspace-level task lists, get all projects then their tasks
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
        .collect();
      const projectIds = new Set(projects.map((p) => p._id));

      // Also include tasks without a project (A2A/ACP inbound)
      tasks = await ctx.db.query("tasks").collect();
      tasks = tasks.filter(
        (t) => t.projectId === undefined || projectIds.has(t.projectId),
      );
    }

    if (input.status) {
      if (input.status === "open") {
        tasks = tasks.filter((t) => t.status !== "done");
      } else {
        tasks = tasks.filter((t) => t.status === input.status);
      }
    }
    if (input.assigneeId) {
      tasks = tasks.filter((t) => t.assigneeId === (input.assigneeId as any));
    }

    // Sort by sortOrder descending (newest first)
    tasks.sort((a, b) => b.sortOrder - a.sortOrder);

    const limit = input.limit ?? 50;
    return tasks.slice(0, limit);
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const task = await ctx.db.get(input.id as any);
    if (!task) return null;
    return task;
  });

// ── Mutations ──

export const create = authMutation
  .input(
    z.object({
      projectId: z.string().optional(),
      title: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      priority: taskPrioritySchema.optional(),
      milestoneId: z.string().optional(),
      dueDate: z.number().int().positive().optional(),
      estimatedMinutes: z.number().int().positive().max(2400).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Verify project belongs to workspace if provided
    if (input.projectId) {
      const project = await ctx.db.get(input.projectId as any);
      if (!project || project.workspaceId !== ctx.workspaceId) {
        throw new CRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
    }

    const id = await ctx.db.insert("tasks", {
      projectId: input.projectId as any,
      milestoneId: input.milestoneId as any,
      title: input.title,
      description: input.description ?? "",
      status: "todo",
      priority: input.priority ?? "medium",
      assigneeId: undefined,
      dueDate: input.dueDate,
      tags: [],
      position: 0,
      sortOrder: 0,
      estimatedMinutes: input.estimatedMinutes,
      recurrence: undefined,
      requiresApproval: false,
      sourceAgentId: undefined,
      sourceProtocol: undefined,
      updatedAt: now(),
    });

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "task.created",
      metadata: JSON.stringify({ taskId: id, title: input.title }),
    });

    return id;
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      status: z.enum(["todo", "in_progress", "done"]).optional(),
      priority: taskPrioritySchema.optional(),
      milestoneId: z.string().nullable().optional(),
      assigneeId: z.string().nullable().optional(),
      dueDate: z.number().int().positive().nullable().optional(),
      tags: z.array(z.string().max(100)).max(100).optional(),
      estimatedMinutes: z.number().int().positive().max(2400).nullable().optional(),
      sortOrder: z.number().int().min(0).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const task = await ctx.db.get(input.id as any);
    if (!task) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }

    const { id, ...updates } = input;

    // Build patch object, converting null to undefined for Convex
    const patch: Record<string, any> = { updatedAt: now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value === null ? undefined : value;
      }
    }

    await ctx.db.patch(id as any, patch);
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const task = await ctx.db.get(input.id as any);
    if (!task) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }

    await ctx.db.delete(input.id as any);

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "task.deleted",
      metadata: JSON.stringify({ taskId: input.id, title: task.title }),
    });
  });
