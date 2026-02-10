import { z } from "zod";
import { authQuery, privateMutation } from "../lib/crpc";

export const list = authQuery
  .input(
    z.object({
      limit: z.number().min(1).max(500).optional(),
      provider: z.string().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    let logs = await ctx.db
      .query("aiUsageLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .order("desc")
      .collect();

    if (input.provider) {
      logs = logs.filter((l) => l.provider === input.provider);
    }

    return logs.slice(0, input.limit ?? 100);
  });

export const stats = authQuery.query(async ({ ctx }) => {
  const logs = await ctx.db
    .query("aiUsageLogs")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();

  const totalCost = logs.reduce((sum, l) => sum + (l.costCents ?? 0), 0);
  const totalTokens = logs.reduce((sum, l) => sum + (l.inputTokens ?? 0) + (l.outputTokens ?? 0), 0);

  // Group by provider
  const byProvider: Record<string, { count: number; costCents: number }> = {};
  for (const log of logs) {
    const key = log.provider ?? "unknown";
    if (!byProvider[key]) byProvider[key] = { count: 0, costCents: 0 };
    byProvider[key].count++;
    byProvider[key].costCents += log.costCents ?? 0;
  }

  return { totalCost, totalTokens, totalCalls: logs.length, byProvider };
});

// Internal: log AI usage
export const logUsage = privateMutation
  .input(
    z.object({
      workspaceId: z.string(),
      provider: z.string(),
      model: z.string(),
      feature: z.string(),
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
      costCents: z.number().min(0),
      durationMs: z.number().int().min(0).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("aiUsageLogs", {
      workspaceId: input.workspaceId as any,
      provider: input.provider,
      model: input.model,
      feature: input.feature,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costCents: input.costCents,
      durationMs: input.durationMs,
    });
  });
