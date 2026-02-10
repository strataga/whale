import { z } from "zod";
import { authQuery, authMutation, publicQuery, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(
    z.object({
      type: z.enum(["local", "external"]).optional(),
      status: z.string().optional(),
      visibility: z.string().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    let agents = await ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    if (input.type) agents = agents.filter((a) => a.type === input.type);
    if (input.status) agents = agents.filter((a) => a.status === input.status);
    if (input.visibility) agents = agents.filter((a) => a.visibility === input.visibility);

    return agents;
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const agent = await ctx.db.get(input.id as any);
    if (!agent || agent.workspaceId !== ctx.workspaceId) return null;

    // Load skills
    const skills = await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", input.id as any))
      .collect();

    return { ...agent, skills };
  });

// Public endpoint for agent discovery (A2A)
export const getBySlug = publicQuery
  .input(z.object({ slug: z.string() }))
  .query(async ({ ctx, input }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_slug", (q) => q.eq("slug", input.slug))
      .first();

    if (!agent || agent.visibility === "private") return null;

    const skills = await ctx.db
      .query("agentSkills")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .collect();

    return { ...agent, skills };
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200),
      type: z.enum(["local", "external"]).optional(),
      description: z.string().max(5000).optional(),
      url: z.string().url().optional(),
      botId: z.string().optional(),
      slug: z.string().min(1).max(100).optional(),
      visibility: z.enum(["private", "unlisted", "public"]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Check slug uniqueness if provided
    if (input.slug) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_slug", (q) => q.eq("slug", input.slug))
        .first();
      if (existing) {
        throw new CRPCError({ code: "BAD_REQUEST", message: "Slug already in use" });
      }
    }

    const id = await ctx.db.insert("agents", {
      workspaceId: ctx.workspaceId,
      type: input.type ?? "local",
      name: input.name,
      description: input.description ?? "",
      url: input.url,
      status: "offline",
      botId: input.botId as any,
      protocolVersion: "0.3",
      capabilities: "{}",
      securitySchemes: "{}",
      reputation: 50,
      verified: false,
      slug: input.slug,
      tagline: "",
      bio: "",
      agentRole: "agent",
      visibility: input.visibility ?? "private",
      tags: [],
      currency: "USD",
      links: "{}",
      featured: false,
      updatedAt: now(),
    });

    return id;
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      url: z.string().url().nullable().optional(),
      slug: z.string().min(1).max(100).optional(),
      visibility: z.enum(["private", "unlisted", "public"]).optional(),
      tagline: z.string().max(500).optional(),
      bio: z.string().max(5000).optional(),
      hourlyRate: z.number().int().min(0).nullable().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const agent = await ctx.db.get(input.id as any);
    if (!agent || agent.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Agent not found" });
    }

    const { id, ...updates } = input;
    const patch: Record<string, any> = { updatedAt: now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value === null ? undefined : value;
      }
    }

    await ctx.db.patch(id as any, patch);
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const agent = await ctx.db.get(input.id as any);
    if (!agent || agent.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Agent not found" });
    }

    await ctx.db.delete(input.id as any);
  });
