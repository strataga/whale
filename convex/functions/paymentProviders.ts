import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("paymentProviders")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const provider = await ctx.db.get(input.id as any);
    if (!provider || provider.workspaceId !== ctx.workspaceId) return null;
    // Mask sensitive config
    return {
      ...provider,
      config: provider.config ? "••••••••" : "",
    };
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(100),
      type: z.enum(["stripe", "x402", "ap2", "manual"]),
      config: z.string().max(10000),
      isDefault: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // If setting as default, unset other defaults of same type
    if (input.isDefault) {
      const existing = await ctx.db
        .query("paymentProviders")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
        .collect();
      for (const p of existing) {
        if (p.type === input.type && p.isDefault) {
          await ctx.db.patch(p._id, { isDefault: false, updatedAt: now() });
        }
      }
    }

    return ctx.db.insert("paymentProviders", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      type: input.type,
      config: input.config,
      enabled: true,
      isDefault: input.isDefault ?? false,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      config: z.string().max(10000).optional(),
      enabled: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const provider = await ctx.db.get(input.id as any);
    if (!provider || provider.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const provider = await ctx.db.get(input.id as any);
    if (!provider || provider.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    }
    await ctx.db.delete(input.id as any);
  });
