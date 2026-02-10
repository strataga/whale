import { z } from "zod";
import { authQuery, publicMutation, CRPCError } from "../lib/crpc";

export const list = authQuery
  .input(
    z.object({
      botId: z.string(),
      level: z.enum(["debug", "info", "warn", "error"]).optional(),
      limit: z.number().min(1).max(500).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    let logs = await ctx.db
      .query("botLogs")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .order("desc")
      .collect();

    if (input.level) {
      const levels = ["debug", "info", "warn", "error"];
      const minLevel = levels.indexOf(input.level);
      logs = logs.filter((l) => levels.indexOf(l.level) >= minLevel);
    }

    return logs.slice(0, input.limit ?? 100);
  });

export const stream = authQuery
  .input(z.object({ botId: z.string(), after: z.number().optional() }))
  .query(async ({ ctx, input }) => {
    let logs = await ctx.db
      .query("botLogs")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .order("desc")
      .collect();

    if (input.after) {
      logs = logs.filter((l) => l._creationTime > input.after!);
    }

    return logs.slice(0, 50);
  });

// Bot-facing: push log entry
export const push = publicMutation
  .input(
    z.object({
      botId: z.string(),
      tokenPrefix: z.string(),
      level: z.enum(["debug", "info", "warn", "error"]),
      message: z.string().max(10000),
      metadata: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.tokenPrefix !== input.tokenPrefix) {
      throw new CRPCError({ code: "UNAUTHORIZED", message: "Invalid bot credentials" });
    }

    return ctx.db.insert("botLogs", {
      botId: input.botId as any,
      workspaceId: bot.workspaceId,
      level: input.level,
      message: input.message,
      metadata: input.metadata,
    });
  });
