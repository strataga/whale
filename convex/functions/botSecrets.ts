import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ botId: z.string() }))
  .query(async ({ ctx, input }) => {
    const secrets = await ctx.db
      .query("botSecrets")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .collect();
    // Mask values — only return key names and metadata
    return secrets.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      botId: s.botId,
      key: s.key,
      maskedValue: s.encryptedValue ? "••••••••" : "",
      updatedAt: s.updatedAt,
    }));
  });

export const set = authMutation
  .input(
    z.object({
      botId: z.string(),
      key: z.string().min(1).max(100),
      value: z.string().max(10000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot not found" });
    }

    // Check if key already exists
    const existing = await ctx.db
      .query("botSecrets")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .collect();
    const found = existing.find((s) => s.key === input.key);

    if (found) {
      await ctx.db.patch(found._id, {
        encryptedValue: input.value, // In production, encrypt before storing
        updatedAt: now(),
      });
      return found._id;
    }

    return ctx.db.insert("botSecrets", {
      botId: input.botId as any,
      workspaceId: ctx.workspaceId,
      key: input.key,
      encryptedValue: input.value,
      updatedAt: now(),
    });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const secret = await ctx.db.get(input.id as any);
    if (!secret) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Secret not found" });
    }
    await ctx.db.delete(input.id as any);
  });
