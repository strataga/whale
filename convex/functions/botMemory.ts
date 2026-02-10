import { z } from "zod";
import { authQuery, authMutation, publicMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ botId: z.string(), namespace: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    let memories = await ctx.db
      .query("botMemory")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .order("desc")
      .collect();

    if (input.namespace) {
      memories = memories.filter((m) => m.namespace === input.namespace);
    }
    return memories;
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db.get(input.id as any);
  });

export const upsert = authMutation
  .input(
    z.object({
      botId: z.string(),
      namespace: z.string().min(1).max(100),
      key: z.string().min(1).max(200),
      value: z.string().max(50000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot not found" });
    }

    const existing = await ctx.db
      .query("botMemory")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .collect();
    const found = existing.find((m) => m.namespace === input.namespace && m.key === input.key);

    if (found) {
      await ctx.db.patch(found._id, { value: input.value, updatedAt: now() });
      return found._id;
    }

    return ctx.db.insert("botMemory", {
      botId: input.botId as any,
      namespace: input.namespace,
      key: input.key,
      value: input.value,
      updatedAt: now(),
    });
  });

// Bot-facing: store memory from within a running task
export const botStore = publicMutation
  .input(
    z.object({
      botId: z.string(),
      tokenPrefix: z.string(),
      namespace: z.string().min(1).max(100),
      key: z.string().min(1).max(200),
      value: z.string().max(50000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.tokenPrefix !== input.tokenPrefix) {
      throw new CRPCError({ code: "UNAUTHORIZED", message: "Invalid bot credentials" });
    }

    const existing = await ctx.db
      .query("botMemory")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .collect();
    const found = existing.find((m) => m.namespace === input.namespace && m.key === input.key);

    if (found) {
      await ctx.db.patch(found._id, { value: input.value, updatedAt: now() });
      return found._id;
    }

    return ctx.db.insert("botMemory", {
      botId: input.botId as any,
      namespace: input.namespace,
      key: input.key,
      value: input.value,
      updatedAt: now(),
    });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.delete(input.id as any);
  });
