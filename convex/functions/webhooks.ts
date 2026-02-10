import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("webhooks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const create = authMutation
  .input(
    z.object({
      url: z.string().url(),
      secret: z.string().min(16),
      events: z.array(z.string()),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("webhooks", {
      workspaceId: ctx.workspaceId,
      url: input.url,
      secret: input.secret,
      events: input.events,
      active: true,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      active: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const webhook = await ctx.db.get(input.id as any);
    if (!webhook || webhook.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const webhook = await ctx.db.get(input.id as any);
    if (!webhook || webhook.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
    }
    await ctx.db.delete(input.id as any);
  });

export const deliveries = authQuery
  .input(z.object({ webhookId: z.string(), limit: z.number().optional() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhook", (q) => q.eq("webhookId", input.webhookId as any))
      .order("desc")
      .take(input.limit ?? 50);
  });
