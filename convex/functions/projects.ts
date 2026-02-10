import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

// ── Queries ──

export const list = authQuery
  .input(z.object({ status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    const q = ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId));

    const projects = await q.collect();

    if (input.status) {
      return projects.filter((p) => p.status === input.status);
    }
    return projects;
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const project = await ctx.db.get(input.id as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      return null;
    }
    return project;
  });

// ── Mutations ──

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(5000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const id = await ctx.db.insert("projects", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      description: input.description ?? "",
      status: "draft",
      visibility: "workspace",
      updatedAt: now(),
    });

    // Audit log
    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "project.created",
      metadata: JSON.stringify({ projectId: id, name: input.name }),
    });

    return id;
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(5000).optional(),
      status: z.enum(["draft", "active", "completed", "archived"]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const project = await ctx.db.get(input.id as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }

    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const project = await ctx.db.get(input.id as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }

    // Soft delete via Ents
    await ctx.db.delete(input.id as any);

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "project.deleted",
      metadata: JSON.stringify({ projectId: input.id, name: project.name }),
    });
  });
