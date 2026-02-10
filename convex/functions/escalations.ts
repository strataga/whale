import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const listRules = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("escalationRules")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const createRule = authMutation
  .input(
    z.object({
      trigger: z.string(),
      threshold: z.number().int().positive(),
      escalateToUserId: z.string().optional(),
      escalateToRole: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("escalationRules", {
      workspaceId: ctx.workspaceId,
      trigger: input.trigger,
      threshold: input.threshold,
      escalateToUserId: input.escalateToUserId as any,
      escalateToRole: input.escalateToRole,
      updatedAt: now(),
    });
  });

export const updateRule = authMutation
  .input(
    z.object({
      id: z.string(),
      trigger: z.string().optional(),
      threshold: z.number().int().positive().optional(),
      escalateToUserId: z.string().nullable().optional(),
      escalateToRole: z.string().nullable().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const rule = await ctx.db.get(input.id as any);
    if (!rule || rule.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Rule not found" });
    }
    const { id, ...updates } = input;
    const patch: Record<string, any> = { updatedAt: now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value === null ? undefined : value;
      }
    }
    await ctx.db.patch(id as any, patch);
  });

export const removeRule = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const rule = await ctx.db.get(input.id as any);
    if (!rule || rule.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Rule not found" });
    }
    await ctx.db.delete(input.id as any);
  });

// Internal: evaluate escalation rules (called by cron or triggers)
export const evaluate = privateMutation
  .input(z.object({ workspaceId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const rules = await ctx.db
      .query("escalationRules")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", input.workspaceId as any))
      .collect();

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", input.workspaceId as any))
      .collect();

    const unacknowledged = alerts.filter((a) => !a.acknowledgedAt);

    for (const rule of rules) {
      const matching = unacknowledged.filter((a) => a.type === rule.trigger);
      if (matching.length >= rule.threshold) {
        // Create notification for escalation target
        if (rule.escalateToUserId) {
          await ctx.db.insert("notifications", {
            userId: rule.escalateToUserId,
            type: "escalation",
            title: `Escalation: ${rule.trigger}`,
            body: `${matching.length} unacknowledged ${rule.trigger} alerts (threshold: ${rule.threshold})`,
            link: "/dashboard/alerts",
          });
        }
      }
    }
  });
