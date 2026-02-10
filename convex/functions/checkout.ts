import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

// Checkout state machine: open → paid → fulfilled | expired | refunded
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["paid", "expired"],
  paid: ["fulfilled", "refunded"],
  fulfilled: [],
  expired: [],
  refunded: [],
};

export const list = authQuery
  .input(z.object({ status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    let sessions = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    if (input.status) {
      sessions = sessions.filter((s) => s.status === input.status);
    }
    return sessions;
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const session = await ctx.db.get(input.id as any);
    if (!session || session.workspaceId !== ctx.workspaceId) return null;
    return session;
  });

export const create = authMutation
  .input(
    z.object({
      lineItems: z.array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().positive(),
        }),
      ),
      buyerAgentId: z.string().optional(),
      paymentProviderId: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Calculate total from products
    let totalCents = 0;
    for (const item of input.lineItems) {
      const product = await ctx.db.get(item.productId as any);
      if (!product) {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: `Product ${item.productId} not found`,
        });
      }
      totalCents += product.priceCents * item.quantity;
    }

    return ctx.db.insert("checkoutSessions", {
      workspaceId: ctx.workspaceId,
      buyerAgentId: input.buyerAgentId as any,
      status: "open",
      lineItems: JSON.stringify(input.lineItems),
      totalCents,
      paymentProviderId: input.paymentProviderId as any,
      expiresAt: now() + 30 * 60 * 1000, // 30 minutes
      updatedAt: now(),
    });
  });

export const transition = authMutation
  .input(
    z.object({
      id: z.string(),
      status: z.enum(["paid", "fulfilled", "expired", "refunded"]),
      paymentRef: z.string().optional(),
      mandateId: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const session = await ctx.db.get(input.id as any);
    if (!session || session.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({
        code: "NOT_FOUND",
        message: "Checkout session not found",
      });
    }

    const allowed = VALID_TRANSITIONS[session.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: `Cannot transition from ${session.status} to ${input.status}`,
      });
    }

    const patch: Record<string, any> = {
      status: input.status,
      updatedAt: now(),
    };
    if (input.paymentRef) patch.paymentRef = input.paymentRef;
    if (input.mandateId) patch.mandateId = input.mandateId;

    await ctx.db.patch(input.id as any, patch);

    // Auto-create order on fulfillment
    if (input.status === "fulfilled") {
      await ctx.db.insert("orders", {
        checkoutSessionId: input.id as any,
        status: "pending_fulfillment",
        updatedAt: now(),
      });
    }
  });
