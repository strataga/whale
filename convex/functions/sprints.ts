import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ projectId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("sprints")
      .withIndex("by_project", (q) => q.eq("projectId", input.projectId as any))
      .collect();
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const sprint = await ctx.db.get(input.id as any);
    if (!sprint) return null;

    const sprintTasks = await ctx.db
      .query("sprintTasks")
      .withIndex("by_sprint", (q) => q.eq("sprintId", input.id as any))
      .collect();

    // Load full task details
    const tasks = await Promise.all(
      sprintTasks.map(async (st) => ctx.db.get(st.taskId)),
    );

    return { ...sprint, tasks: tasks.filter(Boolean) };
  });

export const create = authMutation
  .input(
    z.object({
      projectId: z.string(),
      name: z.string().min(1).max(200),
      startDate: z.number().int().positive(),
      endDate: z.number().int().positive(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const project = await ctx.db.get(input.projectId as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }

    return ctx.db.insert("sprints", {
      projectId: input.projectId as any,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "planning",
      updatedAt: now(),
    });
  });

export const addTask = authMutation
  .input(z.object({ sprintId: z.string(), taskId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("sprintTasks", {
      sprintId: input.sprintId as any,
      taskId: input.taskId as any,
    });
  });

export const removeTask = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.delete(input.id as any);
  });
