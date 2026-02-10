import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("automationRules")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200),
      trigger: z.string(),
      conditions: z.string().optional(),
      actions: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("automationRules", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      trigger: input.trigger,
      conditions: input.conditions ?? "[]",
      actions: input.actions,
      active: true,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      trigger: z.string().optional(),
      conditions: z.string().optional(),
      actions: z.string().optional(),
      active: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const rule = await ctx.db.get(input.id as any);
    if (!rule || rule.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Rule not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const rule = await ctx.db.get(input.id as any);
    if (!rule || rule.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Rule not found" });
    }
    await ctx.db.delete(input.id as any);
  });
