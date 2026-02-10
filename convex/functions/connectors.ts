import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("connectors")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const connector = await ctx.db.get(input.id as any);
    if (!connector || connector.workspaceId !== ctx.workspaceId) return null;
    return { ...connector, config: connector.config ? "••••••••" : "" };
  });

export const create = authMutation
  .input(
    z.object({
      type: z.enum(["github", "gitlab", "jira", "linear", "slack", "custom"]),
      name: z.string().min(1).max(100),
      config: z.string().max(10000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("connectors", {
      workspaceId: ctx.workspaceId,
      type: input.type,
      name: input.name,
      config: input.config,
      status: "active",
      lastSyncAt: undefined,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      config: z.string().max(10000).optional(),
      status: z.enum(["active", "paused", "error"]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const connector = await ctx.db.get(input.id as any);
    if (!connector || connector.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Connector not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const connector = await ctx.db.get(input.id as any);
    if (!connector || connector.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Connector not found" });
    }
    await ctx.db.delete(input.id as any);
  });

export const sync = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const connector = await ctx.db.get(input.id as any);
    if (!connector || connector.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Connector not found" });
    }
    await ctx.db.patch(input.id as any, { lastSyncAt: now(), updatedAt: now() });
  });
