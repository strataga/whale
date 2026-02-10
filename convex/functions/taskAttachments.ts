import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ taskId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", input.taskId as any))
      .collect();
  });

export const create = authMutation
  .input(
    z.object({
      taskId: z.string(),
      filename: z.string().min(1).max(500),
      url: z.string().max(2000),
      mimeType: z.string().max(100).optional(),
      sizeBytes: z.number().int().min(0).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("taskAttachments", {
      taskId: input.taskId as any,
      uploadedBy: ctx.user._id,
      filename: input.filename,
      url: input.url,
      mimeType: input.mimeType ?? "application/octet-stream",
      sizeBytes: input.sizeBytes ?? 0,
      updatedAt: now(),
    });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const attachment = await ctx.db.get(input.id as any);
    if (!attachment) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Attachment not found" });
    }
    await ctx.db.delete(input.id as any);
  });
