import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ projectId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("milestones")
      .withIndex("by_project", (q) => q.eq("projectId", input.projectId as any))
      .collect();
  });

export const create = authMutation
  .input(
    z.object({
      projectId: z.string(),
      name: z.string().min(1).max(200),
      dueDate: z.number().int().positive().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const project = await ctx.db.get(input.projectId as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }

    // Get max position
    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_project", (q) => q.eq("projectId", input.projectId as any))
      .collect();
    const maxPos = existing.reduce((max, m) => Math.max(max, m.position), -1);

    return ctx.db.insert("milestones", {
      projectId: input.projectId as any,
      name: input.name,
      dueDate: input.dueDate,
      position: maxPos + 1,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      dueDate: z.number().int().positive().nullable().optional(),
      position: z.number().int().min(0).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const milestone = await ctx.db.get(input.id as any);
    if (!milestone) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Milestone not found" });
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
    const milestone = await ctx.db.get(input.id as any);
    if (!milestone) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Milestone not found" });
    }
    await ctx.db.delete(input.id as any);
  });
