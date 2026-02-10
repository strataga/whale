import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ agentId: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    if (input.agentId) {
      return ctx.db
        .query("agentProducts")
        .withIndex("by_agent", (q) => q.eq("agentId", input.agentId as any))
        .collect();
    }
    // Get all products from workspace agents
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    const products = [];
    for (const agent of agents) {
      const agentProducts = await ctx.db
        .query("agentProducts")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();
      products.push(...agentProducts);
    }
    return products;
  });

export const create = authMutation
  .input(
    z.object({
      agentId: z.string(),
      name: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
      priceCents: z.number().int().min(0),
      currency: z.string().optional(),
      pricingModel: z.enum(["per_task", "per_hour", "flat"]).optional(),
      skillId: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const agent = await ctx.db.get(input.agentId as any);
    if (!agent || agent.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Agent not found" });
    }

    return ctx.db.insert("agentProducts", {
      agentId: input.agentId as any,
      name: input.name,
      description: input.description ?? "",
      priceCents: input.priceCents,
      currency: input.currency ?? "USD",
      pricingModel: input.pricingModel ?? "per_task",
      skillId: input.skillId,
      active: true,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      priceCents: z.number().int().min(0).optional(),
      active: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const product = await ctx.db.get(input.id as any);
    if (!product) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Product not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });
