import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ botId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("botSkills")
      .withIndex("by_bot", (q) => q.eq("botId", input.botId as any))
      .collect();
  });

export const create = authMutation
  .input(
    z.object({
      botId: z.string(),
      name: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      inputSchema: z.string().optional(),
      outputSchema: z.string().optional(),
      estimatedDurationMin: z.number().int().positive().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await ctx.db.get(input.botId as any);
    if (!bot || bot.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Bot not found" });
    }

    return ctx.db.insert("botSkills", {
      botId: input.botId as any,
      name: input.name,
      description: input.description ?? "",
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      estimatedDurationMin: input.estimatedDurationMin,
      enabled: true,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      enabled: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const skill = await ctx.db.get(input.id as any);
    if (!skill) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Skill not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.delete(input.id as any);
  });
