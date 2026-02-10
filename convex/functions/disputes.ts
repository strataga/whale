import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    let disputes = await ctx.db
      .query("paymentDisputes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    if (input.status) {
      disputes = disputes.filter((d) => d.status === input.status);
    }
    return disputes;
  });

export const create = authMutation
  .input(
    z.object({
      checkoutSessionId: z.string().optional(),
      x402TransactionId: z.string().optional(),
      reason: z.string().min(1).max(5000),
      evidence: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (!input.checkoutSessionId && !input.x402TransactionId) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Either checkoutSessionId or x402TransactionId is required",
      });
    }

    return ctx.db.insert("paymentDisputes", {
      workspaceId: ctx.workspaceId,
      checkoutSessionId: input.checkoutSessionId as any,
      x402TransactionId: input.x402TransactionId as any,
      reason: input.reason,
      evidence: input.evidence ?? "{}",
      status: "open",
      updatedAt: now(),
    });
  });

export const resolve = authMutation
  .meta({ role: "admin" })
  .input(
    z.object({
      id: z.string(),
      status: z.enum(["resolved_buyer", "resolved_seller", "dismissed"]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const dispute = await ctx.db.get(input.id as any);
    if (!dispute || dispute.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Dispute not found" });
    }
    if (dispute.status !== "open") {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Dispute already resolved" });
    }

    await ctx.db.patch(input.id as any, {
      status: input.status,
      resolvedBy: ctx.user._id as any,
      resolvedAt: now(),
      updatedAt: now(),
    });
  });
