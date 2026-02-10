import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";

export const list = authQuery
  .input(z.object({ projectId: z.string() }))
  .query(async ({ ctx, input }) => {
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", input.projectId as any))
      .collect();

    // Enrich with user info
    const enriched = [];
    for (const m of members) {
      const user = await ctx.db.get(m.userId);
      enriched.push({
        ...m,
        userName: user?.name ?? user?.email ?? "Unknown",
        userEmail: user?.email,
      });
    }
    return enriched;
  });

export const add = authMutation
  .input(
    z.object({
      projectId: z.string(),
      userId: z.string(),
      role: z.enum(["viewer", "member", "admin"]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Check project belongs to workspace
    const project = await ctx.db.get(input.projectId as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }

    // Check not already a member
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", input.projectId as any))
      .collect();
    if (existing.some((m) => m.userId === (input.userId as any))) {
      throw new CRPCError({ code: "BAD_REQUEST", message: "User already a member" });
    }

    return ctx.db.insert("projectMembers", {
      projectId: input.projectId as any,
      userId: input.userId as any,
      role: input.role ?? "member",
    });
  });

export const updateRole = authMutation
  .input(
    z.object({
      id: z.string(),
      role: z.enum(["viewer", "member", "admin"]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.db.patch(input.id as any, { role: input.role });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.delete(input.id as any);
  });
