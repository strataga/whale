import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("channels")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const channel = await ctx.db.get(input.id as any);
    if (!channel || channel.workspaceId !== ctx.workspaceId) return null;
    return channel;
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(100),
      type: z.enum(["email", "slack", "discord", "webhook", "sms"]),
      config: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("channels", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      type: input.type,
      config: input.config,
      enabled: true,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      config: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const channel = await ctx.db.get(input.id as any);
    if (!channel || channel.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Channel not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const channel = await ctx.db.get(input.id as any);
    if (!channel || channel.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Channel not found" });
    }
    await ctx.db.delete(input.id as any);
  });

// List deliveries for a channel
export const deliveries = authQuery
  .input(z.object({ channelId: z.string(), limit: z.number().min(1).max(200).optional() }))
  .query(async ({ ctx, input }) => {
    const deliveries = await ctx.db
      .query("channelDeliveries")
      .withIndex("by_channel", (q) => q.eq("channelId", input.channelId as any))
      .order("desc")
      .collect();
    return deliveries.slice(0, input.limit ?? 50);
  });

// Internal: record a delivery
export const recordDelivery = privateMutation
  .input(
    z.object({
      channelId: z.string(),
      eventType: z.string(),
      payload: z.string(),
      status: z.enum(["pending", "sent", "failed"]),
      errorMessage: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("channelDeliveries", {
      channelId: input.channelId as any,
      eventType: input.eventType,
      payload: input.payload,
      status: input.status,
      errorMessage: input.errorMessage,
      sentAt: input.status === "sent" ? now() : undefined,
    });
  });
