import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const listByProject = authQuery
  .input(z.object({ projectId: z.string(), limit: z.number().min(1).max(50).optional() }))
  .query(async ({ ctx, input }) => {
    const project = await ctx.db.get(input.projectId as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }

    const limit = input.limit ?? 10;
    return ctx.db
      .query("missionStatements")
      .withIndex("by_project_createdAt", (q) => q.eq("projectId", input.projectId as any))
      .order("desc")
      .take(limit);
  });

export const listRecent = authQuery
  .input(z.object({ limit: z.number().min(1).max(50).optional() }))
  .query(async ({ ctx, input }) => {
    const limit = input.limit ?? 10;
    const statements = await ctx.db
      .query("missionStatements")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .order("desc")
      .take(limit);

    // Best-effort project name hydration for UI display.
    const projectIds = Array.from(
      new Set(statements.map((s) => (s.projectId as any)?.toString?.() ?? s.projectId)),
    );
    const projects = await Promise.all(projectIds.map((id) => ctx.db.get(id as any)));
    const projectNameById = new Map(
      projects
        .filter(Boolean)
        .map((p: any) => [p._id?.toString?.() ?? p._id, (p as any).name] as const),
    );

    return statements.map((s) => ({
      ...s,
      projectName: projectNameById.get((s.projectId as any)?.toString?.() ?? (s.projectId as any)) ?? "Project",
    }));
  });

export const create = authMutation
  .input(z.object({ projectId: z.string(), body: z.string().min(1).max(10_000) }))
  .mutation(async ({ ctx, input }) => {
    const project = await ctx.db.get(input.projectId as any);
    if (!project || project.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }

    const ts = now();
    const id = await ctx.db.insert("missionStatements", {
      workspaceId: ctx.workspaceId,
      projectId: input.projectId as any,
      body: input.body,
      createdByUserId: ctx.user._id as any,
      createdAt: ts,
      updatedAt: ts,
    });

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "missionStatement.created",
      metadata: JSON.stringify({ projectId: input.projectId, missionStatementId: id }),
    });

    return id;
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const statement = await ctx.db.get(input.id as any);
    if (!statement || statement.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Mission statement not found" });
    }

    await ctx.db.delete(input.id as any);

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "missionStatement.deleted",
      metadata: JSON.stringify({ missionStatementId: input.id, projectId: statement.projectId }),
    });
  });

