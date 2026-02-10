import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";

export const list = authQuery
  .input(z.object({ taskId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", input.taskId as any))
      .collect();
  });

export const create = authMutation
  .input(
    z.object({
      taskId: z.string(),
      title: z.string().min(1).max(200),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Get max position
    const existing = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", input.taskId as any))
      .collect();
    const maxPos = existing.reduce((max, s) => Math.max(max, s.position), -1);

    return ctx.db.insert("subtasks", {
      taskId: input.taskId as any,
      title: input.title,
      done: false,
      position: maxPos + 1,
    });
  });

export const toggle = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const subtask = await ctx.db.get(input.id as any);
    if (!subtask) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Subtask not found" });
    }
    await ctx.db.patch(input.id as any, { done: !subtask.done });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.delete(input.id as any);
  });
