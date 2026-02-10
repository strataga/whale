import { z } from "zod";
import { authQuery, authMutation, privateMutation } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(z.object({ projectId: z.string().optional(), status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    let suggestions = await ctx.db
      .query("taskSuggestions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .order("desc")
      .collect();

    if (input.projectId) {
      suggestions = suggestions.filter((s) => s.projectId === (input.projectId as any));
    }
    if (input.status) {
      suggestions = suggestions.filter((s) => s.status === input.status);
    }
    return suggestions;
  });

// Internal: create suggestion from AI analysis
export const createInternal = privateMutation
  .input(
    z.object({
      workspaceId: z.string(),
      projectId: z.string().optional(),
      title: z.string(),
      description: z.string(),
      priority: z.string().optional(),
      source: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("taskSuggestions", {
      workspaceId: input.workspaceId as any,
      projectId: input.projectId as any,
      title: input.title,
      description: input.description,
      priority: input.priority ?? "medium",
      source: input.source,
      confidence: input.confidence,
      status: "pending",
      updatedAt: now(),
    });
  });

export const accept = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.patch(input.id as any, { status: "accepted", updatedAt: now() });
  });

export const dismiss = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.db.patch(input.id as any, { status: "dismissed", updatedAt: now() });
  });
