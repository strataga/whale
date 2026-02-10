import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("teams")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const team = await ctx.db.get(input.id as any);
    if (!team || team.workspaceId !== ctx.workspaceId) return null;

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", input.id as any))
      .collect();

    return { ...team, members };
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200),
      slug: z.string().min(1).max(100),
      description: z.string().max(5000).optional(),
      visibility: z.enum(["public", "unlisted", "private"]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("teams", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? "",
      isDefault: false,
      visibility: input.visibility ?? "private",
      updatedAt: now(),
    });
  });

export const addMember = authMutation
  .input(
    z.object({
      teamId: z.string(),
      memberType: z.enum(["user", "bot"]),
      userId: z.string().optional(),
      botId: z.string().optional(),
      role: z.enum(["lead", "member", "observer"]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const team = await ctx.db.get(input.teamId as any);
    if (!team || team.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Team not found" });
    }

    return ctx.db.insert("teamMembers", {
      teamId: input.teamId as any,
      memberType: input.memberType,
      userId: input.userId as any,
      botId: input.botId as any,
      role: input.role ?? "member",
      joinedAt: now(),
    });
  });

export const removeMember = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const member = await ctx.db.get(input.id as any);
    if (!member) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Member not found" });
    }
    await ctx.db.patch(input.id as any, { removedAt: now() });
  });

export const remove = authMutation
  .meta({ role: "admin" })
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const team = await ctx.db.get(input.id as any);
    if (!team || team.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Team not found" });
    }
    await ctx.db.delete(input.id as any);
  });
