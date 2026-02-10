import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";

export const list = authQuery
  .input(z.object({ taskId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", input.taskId as any))
      .collect();
  });

export const create = authMutation
  .input(
    z.object({
      taskId: z.string(),
      body: z.string().min(1).max(10000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("taskComments", {
      taskId: input.taskId as any,
      authorId: ctx.user._id,
      authorType: "user",
      body: input.body,
    });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const comment = await ctx.db.get(input.id as any);
    if (!comment) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Comment not found" });
    }
    // Only author or admin can delete
    if (comment.authorId !== ctx.user._id && ctx.user.role !== "admin") {
      throw new CRPCError({ code: "FORBIDDEN", message: "Cannot delete this comment" });
    }
    await ctx.db.delete(input.id as any);
  });
