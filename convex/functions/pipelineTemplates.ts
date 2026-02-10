import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("pipelineTemplates")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const template = await ctx.db.get(input.id as any);
    if (!template || template.workspaceId !== ctx.workspaceId) return null;
    return template;
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      stagesJson: z.string(),
      category: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("pipelineTemplates", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      description: input.description ?? "",
      stagesJson: input.stagesJson,
      category: input.category ?? "general",
      usageCount: 0,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      stagesJson: z.string().optional(),
      category: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const template = await ctx.db.get(input.id as any);
    if (!template || template.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Template not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const template = await ctx.db.get(input.id as any);
    if (!template || template.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Template not found" });
    }
    await ctx.db.delete(input.id as any);
  });

export const incrementUsage = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const template = await ctx.db.get(input.id as any);
    if (!template) return;
    await ctx.db.patch(input.id as any, {
      usageCount: (template.usageCount ?? 0) + 1,
      updatedAt: now(),
    });
  });
