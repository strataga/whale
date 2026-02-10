import { z } from "zod";
import { authQuery, authMutation, publicMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const listByBot = authQuery
  .input(z.object({ botId: z.string(), status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    let tasks = await ctx.db
      .query("botTasks")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .order("desc")
      .collect();

    if (input.status) {
      tasks = tasks.filter((t) => t.status === input.status);
    }
    return tasks;
  });

export const listByTask = authQuery
  .input(z.object({ taskId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("botTasks")
      .withIndex("by_task", (q) => q.eq("taskId", input.taskId as any))
      .collect();
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const botTask = await ctx.db.get(input.id as any);
    if (!botTask) return null;

    // Load checkpoints
    const checkpoints = await ctx.db
      .query("botTaskCheckpoints")
      .withIndex("by_botTask", (q) => q.eq("botTaskId", input.id as any))
      .collect();

    return { ...botTask, checkpoints };
  });

export const assign = authMutation
  .input(
    z.object({
      botId: z.string(),
      taskId: z.string(),
      timeoutMinutes: z.number().int().positive().optional(),
      maxRetries: z.number().int().min(0).max(10).optional(),
      structuredSpec: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot not found" });
    }

    return ctx.db.insert("botTasks", {
      botId: input.botId as any,
      taskId: input.taskId as any,
      status: "pending",
      artifactLinks: [],
      retryCount: 0,
      maxRetries: input.maxRetries ?? 0,
      timeoutMinutes: input.timeoutMinutes,
      structuredSpec: input.structuredSpec,
      updatedAt: now(),
    });
  });

// Bot-facing: update task status (called by bot heartbeat / task completion)
export const updateStatus = publicMutation
  .input(
    z.object({
      botTaskId: z.string(),
      botId: z.string(),
      tokenPrefix: z.string(),
      status: z.enum(["running", "completed", "failed"]),
      outputSummary: z.string().optional(),
      outputData: z.string().optional(),
      artifactLinks: z.array(z.string()).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Verify bot identity
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.tokenPrefix !== input.tokenPrefix) {
      throw new CRPCError({ code: "UNAUTHORIZED", message: "Invalid bot credentials" });
    }

    const botTask = await ctx.db.get(input.botTaskId as any);
    if (!botTask || botTask.botId !== (input.botId as any)) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot task not found" });
    }

    const patch: Record<string, any> = {
      status: input.status,
      updatedAt: now(),
    };

    if (input.status === "running" && !botTask.startedAt) {
      patch.startedAt = now();
    }
    if (input.status === "completed" || input.status === "failed") {
      patch.completedAt = now();
    }
    if (input.outputSummary) patch.outputSummary = input.outputSummary;
    if (input.outputData) patch.outputData = input.outputData;
    if (input.artifactLinks) patch.artifactLinks = input.artifactLinks;

    await ctx.db.patch(input.botTaskId as any, patch);

    // If completed, update the parent task status
    if (input.status === "completed" && botTask.taskId) {
      await ctx.db.patch(botTask.taskId, { status: "done", updatedAt: now() });
    }
  });

export const cancel = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const botTask = await ctx.db.get(input.id as any);
    if (!botTask) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot task not found" });
    }
    if (botTask.status === "completed" || botTask.status === "cancelled") {
      throw new CRPCError({ code: "BAD_REQUEST", message: "Cannot cancel this task" });
    }

    await ctx.db.patch(input.id as any, {
      status: "cancelled",
      cancelledAt: now(),
      cancelledBy: ctx.user._id,
      updatedAt: now(),
    });
  });
