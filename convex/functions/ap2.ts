import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    let mandates = await ctx.db
      .query("paymentMandates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    if (input.status) {
      mandates = mandates.filter((m) => m.status === input.status);
    }
    return mandates;
  });

export const create = authMutation
  .input(
    z.object({
      type: z.string(),
      payerIdentity: z.string(),
      amount: z.string(),
      currency: z.string().optional(),
      signature: z.string(),
      expiresAt: z.number().optional(),
      metadata: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("paymentMandates", {
      workspaceId: ctx.workspaceId,
      type: input.type,
      payerIdentity: input.payerIdentity,
      amount: input.amount,
      currency: input.currency ?? "USD",
      status: "authorized",
      signature: input.signature,
      expiresAt: input.expiresAt,
      metadata: input.metadata ?? "{}",
      updatedAt: now(),
    });
  });

export const capture = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const mandate = await ctx.db.get(input.id as any);
    if (!mandate || mandate.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Mandate not found" });
    }
    if (mandate.status !== "authorized") {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Mandate not in authorized state" });
    }
    // Check expiry
    if (mandate.expiresAt && mandate.expiresAt < now()) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Mandate has expired" });
    }

    await ctx.db.patch(input.id as any, {
      status: "captured",
      capturedAt: now(),
      updatedAt: now(),
    });
  });

export const settle = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const mandate = await ctx.db.get(input.id as any);
    if (!mandate || mandate.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Mandate not found" });
    }
    if (mandate.status !== "captured") {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Mandate not in captured state" });
    }

    await ctx.db.patch(input.id as any, {
      status: "settled",
      settledAt: now(),
      updatedAt: now(),
    });
  });
