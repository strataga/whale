import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("webhookSubscriptions")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const create = authMutation
  .input(
    z.object({
      eventType: z.string().min(1).max(100),
      url: z.string().max(2000),
      secret: z.string().max(500).optional(),
      active: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("webhookSubscriptions", {
      workspaceId: ctx.workspaceId,
      eventType: input.eventType,
      url: input.url,
      secret: input.secret,
      active: input.active ?? true,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      url: z.string().max(2000).optional(),
      active: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const sub = await ctx.db.get(input.id as any);
    if (!sub || sub.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const sub = await ctx.db.get(input.id as any);
    if (!sub || sub.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
    }
    await ctx.db.delete(input.id as any);
  });
