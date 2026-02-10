import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("costBudgets")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const budget = await ctx.db.get(input.id as any);
    if (!budget || budget.workspaceId !== ctx.workspaceId) return null;
    return budget;
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(100),
      limitCents: z.number().int().positive(),
      periodType: z.enum(["daily", "weekly", "monthly"]),
      alertThresholdPercent: z.number().min(0).max(100).optional(),
      scope: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("costBudgets", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      limitCents: input.limitCents,
      spentCents: 0,
      periodType: input.periodType,
      alertThresholdPercent: input.alertThresholdPercent ?? 80,
      scope: input.scope ?? "workspace",
      periodStart: now(),
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      limitCents: z.number().int().positive().optional(),
      alertThresholdPercent: z.number().min(0).max(100).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const budget = await ctx.db.get(input.id as any);
    if (!budget || budget.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Budget not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const budget = await ctx.db.get(input.id as any);
    if (!budget || budget.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Budget not found" });
    }
    await ctx.db.delete(input.id as any);
  });
