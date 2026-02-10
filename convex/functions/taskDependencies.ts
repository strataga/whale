import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";

export const list = authQuery
  .input(z.object({ taskId: z.string() }))
  .query(async ({ ctx, input }) => {
    const deps = await ctx.db
      .query("taskDependencies")
      .filter((q) => q.eq(q.field("taskId"), input.taskId as any))
      .collect();

    const blocking = await ctx.db
      .query("taskDependencies")
      .filter((q) => q.eq(q.field("dependsOnTaskId"), input.taskId as any))
      .collect();

    return { dependencies: deps, blockedBy: blocking };
  });

export const create = authMutation
  .input(
    z.object({
      taskId: z.string(),
      dependsOnTaskId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.taskId === input.dependsOnTaskId) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Task cannot depend on itself" });
    }

    // Check for existing dependency
    const existing = await ctx.db
      .query("taskDependencies")
      .filter((q) =>
        q.and(
          q.eq(q.field("taskId"), input.taskId as any),
          q.eq(q.field("dependsOnTaskId"), input.dependsOnTaskId as any),
        ),
      )
      .first();

    if (existing) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Dependency already exists" });
    }

    return ctx.db.insert("taskDependencies", {
      taskId: input.taskId as any,
      dependsOnTaskId: input.dependsOnTaskId as any,
    });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.delete(input.id as any);
  });
