import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  const groups = await ctx.db
    .query("botGroups")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();

  // Load member counts
  const result = [];
  for (const group of groups) {
    const members = await ctx.db
      .query("botGroupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();
    result.push({ ...group, memberCount: members.length });
  }
  return result;
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const group = await ctx.db.get(input.id as any);
    if (!group || group.workspaceId !== ctx.workspaceId) return null;

    const members = await ctx.db
      .query("botGroupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", input.id as any))
      .collect();

    return { ...group, members };
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(1000).optional(),
      concurrencyLimit: z.number().int().positive().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("botGroups", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      description: input.description ?? "",
      concurrencyLimit: input.concurrencyLimit,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).optional(),
      concurrencyLimit: z.number().int().positive().nullable().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const group = await ctx.db.get(input.id as any);
    if (!group || group.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Group not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const group = await ctx.db.get(input.id as any);
    if (!group || group.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Group not found" });
    }
    // Delete members first
    const members = await ctx.db
      .query("botGroupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", input.id as any))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(input.id as any);
  });

export const addMember = authMutation
  .input(z.object({ groupId: z.string(), botId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const group = await ctx.db.get(input.groupId as any);
    if (!group || group.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Group not found" });
    }
    return ctx.db.insert("botGroupMembers", {
      groupId: input.groupId as any,
      botId: input.botId as any,
    });
  });

export const removeMember = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.delete(input.id as any);
  });
