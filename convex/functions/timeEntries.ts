import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const listByTask = authQuery
  .input(z.object({ taskId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("timeEntries")
      .withIndex("by_task", (q) => q.eq("taskId", input.taskId as any))
      .order("desc")
      .collect();
  });

export const listByUser = authQuery
  .input(z.object({ userId: z.string().optional(), startDate: z.number().optional() }))
  .query(async ({ ctx, input }) => {
    const uid = input.userId ?? ctx.user._id;
    let entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_user", (q) => q.eq("userId", uid as any))
      .order("desc")
      .collect();
    if (input.startDate) {
      entries = entries.filter((e) => e._creationTime >= input.startDate!);
    }
    return entries;
  });

export const create = authMutation
  .input(
    z.object({
      taskId: z.string(),
      minutes: z.number().int().positive(),
      description: z.string().max(1000).optional(),
      date: z.number(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("timeEntries", {
      taskId: input.taskId as any,
      userId: ctx.user._id,
      minutes: input.minutes,
      description: input.description ?? "",
      date: input.date,
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      minutes: z.number().int().positive().optional(),
      description: z.string().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const entry = await ctx.db.get(input.id as any);
    if (!entry || entry.userId !== ctx.user._id) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Time entry not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, updates);
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const entry = await ctx.db.get(input.id as any);
    if (!entry || entry.userId !== ctx.user._id) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Time entry not found" });
    }
    await ctx.db.delete(input.id as any);
  });
