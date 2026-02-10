import { z } from "zod";
import { authQuery, authMutation, publicMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    const bots = await ctx.db
      .query("bots")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect();

    if (input.status) {
      return bots.filter((b) => b.status === input.status);
    }
    return bots;
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.id as any);
    if (!bot || bot.workspaceId !== ctx.workspaceId) return null;
    return bot;
  });

export const heartbeat = publicMutation
  .input(
    z.object({
      botId: z.string(),
      tokenPrefix: z.string(),
      status: z.enum(["idle", "working", "waiting", "error", "recovering"]).optional(),
      metrics: z
        .object({
          cpuPercent: z.number().optional(),
          memoryMb: z.number().optional(),
          diskPercent: z.number().optional(),
        })
        .optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.tokenPrefix !== input.tokenPrefix) {
      throw new CRPCError({ code: "UNAUTHORIZED", message: "Invalid bot credentials" });
    }

    const patch: Record<string, any> = {
      lastSeenAt: now(),
      updatedAt: now(),
    };
    if (input.status) {
      patch.status = input.status;
      patch.statusChangedAt = now();
    }
    await ctx.db.patch(input.botId as any, patch);

    // Store metrics if provided
    if (input.metrics) {
      await ctx.db.insert("botMetrics", {
        botId: input.botId as any,
        cpuPercent: input.metrics.cpuPercent,
        memoryMb: input.metrics.memoryMb,
        diskPercent: input.metrics.diskPercent,
        customMetrics: "{}",
      });
    }

    // Return pending commands
    const commands = await ctx.db
      .query("botCommands")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .collect();

    return {
      commands: commands.filter((c) => c.status === "pending"),
    };
  });

export const updateStatus = authMutation
  .input(
    z.object({
      id: z.string(),
      status: z.enum(["offline", "idle", "working", "waiting", "error", "recovering"]),
      reason: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.id as any);
    if (!bot || bot.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot not found" });
    }

    await ctx.db.patch(input.id as any, {
      status: input.status,
      statusReason: input.reason,
      statusChangedAt: now(),
      updatedAt: now(),
    });
  });

export const remove = authMutation
  .meta({ role: "admin" })
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.id as any);
    if (!bot || bot.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot not found" });
    }

    await ctx.db.delete(input.id as any);

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "bot.deleted",
      metadata: JSON.stringify({ botId: input.id, name: bot.name }),
    });
  });
