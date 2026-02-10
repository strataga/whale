import { z } from "zod";
import { authQuery } from "../lib/crpc";

export const list = authQuery
  .input(
    z.object({
      action: z.string().optional(),
      userId: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    let logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .order("desc")
      .collect();

    if (input.action) {
      logs = logs.filter((l) => l.action.startsWith(input.action!));
    }
    if (input.userId) {
      logs = logs.filter((l) => l.userId === (input.userId as any));
    }

    return logs.slice(0, input.limit ?? 100);
  });
