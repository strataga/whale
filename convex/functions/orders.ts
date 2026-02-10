import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ checkoutSessionId: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    if (input.checkoutSessionId) {
      return ctx.db
        .query("orders")
        .filter((q) => q.eq(q.field("checkoutSessionId"), input.checkoutSessionId as any))
        .order("desc")
        .collect();
    }
    // Get all orders via workspace checkout sessions
    const sessions = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    const orders = [];
    for (const session of sessions) {
      const sessionOrders = await ctx.db
        .query("orders")
        .filter((q) => q.eq(q.field("checkoutSessionId"), session._id))
        .collect();
      orders.push(...sessionOrders);
    }
    return orders.sort((a, b) => b._creationTime - a._creationTime);
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db.get(input.id as any);
  });

// Internal: create order from completed checkout
export const createFromCheckout = privateMutation
  .input(
    z.object({
      checkoutSessionId: z.string(),
      agentId: z.string(),
      productId: z.string().optional(),
      totalCents: z.number().int().min(0),
      currency: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("orders", {
      checkoutSessionId: input.checkoutSessionId as any,
      agentId: input.agentId as any,
      productId: input.productId,
      status: "pending",
      totalCents: input.totalCents,
      currency: input.currency,
      fulfilledAt: undefined,
      updatedAt: now(),
    });
  });

export const updateStatus = authMutation
  .input(
    z.object({
      id: z.string(),
      status: z.enum(["pending", "processing", "fulfilled", "cancelled"]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const order = await ctx.db.get(input.id as any);
    if (!order) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Order not found" });
    }
    const patch: Record<string, any> = { status: input.status, updatedAt: now() };
    if (input.status === "fulfilled") {
      patch.fulfilledAt = now();
    }
    await ctx.db.patch(input.id as any, patch);
  });
