import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("savedViews")
    .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
    .collect();
});

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(100),
      filterJson: z.string(),
      sortJson: z.string().optional(),
      columnsJson: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("savedViews", {
      userId: ctx.user._id,
      name: input.name,
      filterJson: input.filterJson,
      sortJson: input.sortJson ?? "{}",
      columnsJson: input.columnsJson ?? "[]",
      isDefault: input.isDefault ?? false,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      filterJson: z.string().optional(),
      sortJson: z.string().optional(),
      columnsJson: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const view = await ctx.db.get(input.id as any);
    if (!view || view.userId !== ctx.user._id) {
      throw new CRPCError({ code: "NOT_FOUND", message: "View not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const view = await ctx.db.get(input.id as any);
    if (!view || view.userId !== ctx.user._id) {
      throw new CRPCError({ code: "NOT_FOUND", message: "View not found" });
    }
    await ctx.db.delete(input.id as any);
  });
