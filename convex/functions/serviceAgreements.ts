import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ agentId: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    if (input.agentId) {
      return ctx.db
        .query("serviceAgreements")
        .withIndex("by_provider", (q) => q.eq("providerAgentId", input.agentId as any))
        .collect();
    }
    // Get all agreements involving workspace agents
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    const agreements = [];
    for (const agent of agents) {
      const providerAgreements = await ctx.db
        .query("serviceAgreements")
        .withIndex("by_provider", (q) => q.eq("providerAgentId", agent._id))
        .collect();
      const consumerAgreements = await ctx.db
        .query("serviceAgreements")
        .withIndex("by_consumer", (q) => q.eq("consumerAgentId", agent._id))
        .collect();
      agreements.push(...providerAgreements, ...consumerAgreements);
    }
    // Deduplicate
    const seen = new Set<string>();
    return agreements.filter((a) => {
      if (seen.has(a._id)) return false;
      seen.add(a._id);
      return true;
    });
  });

export const create = authMutation
  .input(
    z.object({
      providerAgentId: z.string(),
      consumerAgentId: z.string(),
      skillId: z.string().optional(),
      terms: z.string().max(10000),
      priceCents: z.number().int().min(0),
      maxRequestsPerDay: z.number().int().positive().optional(),
      slaResponseTimeSec: z.number().int().positive().optional(),
      expiresAt: z.number().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("serviceAgreements", {
      providerAgentId: input.providerAgentId as any,
      consumerAgentId: input.consumerAgentId as any,
      skillId: input.skillId,
      terms: input.terms,
      priceCents: input.priceCents,
      maxRequestsPerDay: input.maxRequestsPerDay,
      slaResponseTimeSec: input.slaResponseTimeSec,
      status: "active",
      expiresAt: input.expiresAt,
      updatedAt: now(),
    });
  });

export const terminate = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const agreement = await ctx.db.get(input.id as any);
    if (!agreement) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Agreement not found" });
    }
    await ctx.db.patch(input.id as any, { status: "terminated", updatedAt: now() });
  });
