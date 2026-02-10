import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ agentId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .query("agentThreads")
      .withIndex("by_agent", (q) => q.eq("agentId", input.agentId as any))
      .order("desc")
      .collect();
  });

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const thread = await ctx.db.get(input.id as any);
    if (!thread) return null;

    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", input.id as any))
      .order("asc")
      .collect();

    return { ...thread, messages };
  });

export const create = authMutation
  .input(
    z.object({
      agentId: z.string(),
      title: z.string().max(200).optional(),
      metadata: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("agentThreads", {
      agentId: input.agentId as any,
      title: input.title ?? "New conversation",
      status: "active",
      metadata: input.metadata,
      updatedAt: now(),
    });
  });

export const addMessage = authMutation
  .input(
    z.object({
      threadId: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().max(100000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const thread = await ctx.db.get(input.threadId as any);
    if (!thread) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Thread not found" });
    }

    const msgId = await ctx.db.insert("agentMessages", {
      threadId: input.threadId as any,
      role: input.role,
      content: input.content,
    });

    await ctx.db.patch(input.threadId as any, { updatedAt: now() });
    return msgId;
  });

// Internal: add message from agent (no auth required)
export const addAgentMessage = privateMutation
  .input(
    z.object({
      threadId: z.string(),
      role: z.enum(["assistant", "system"]),
      content: z.string().max(100000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const msgId = await ctx.db.insert("agentMessages", {
      threadId: input.threadId as any,
      role: input.role,
      content: input.content,
    });
    await ctx.db.patch(input.threadId as any, { updatedAt: now() });
    return msgId;
  });

export const closeThread = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.patch(input.id as any, { status: "closed", updatedAt: now() });
  });
