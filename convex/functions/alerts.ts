import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(
    z.object({
      severity: z.string().optional(),
      acknowledged: z.boolean().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    let alerts = await ctx.db
      .query("alerts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .order("desc")
      .collect();

    if (input.severity) {
      alerts = alerts.filter((a) => a.severity === input.severity);
    }
    if (input.acknowledged !== undefined) {
      alerts = input.acknowledged
        ? alerts.filter((a) => a.acknowledgedAt)
        : alerts.filter((a) => !a.acknowledgedAt);
    }

    return alerts;
  });

export const acknowledge = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const alert = await ctx.db.get(input.id as any);
    if (!alert || alert.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Alert not found" });
    }
    await ctx.db.patch(input.id as any, {
      acknowledgedAt: now(),
      acknowledgedBy: ctx.user._id as any,
    });
  });

// Internal: create an alert (called by anomaly scanner, rule engine, etc.)
export const createInternal = privateMutation
  .input(
    z.object({
      workspaceId: z.string(),
      type: z.string(),
      severity: z.enum(["info", "warning", "critical"]),
      message: z.string(),
      metadata: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("alerts", {
      workspaceId: input.workspaceId as any,
      type: input.type,
      severity: input.severity,
      message: input.message,
      metadata: input.metadata ?? "{}",
      notificationsSent: 0,
    });
  });
