import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const get = authQuery.query(async ({ ctx }) => {
  const workspace = await ctx.db.get(ctx.workspaceId as any);
  if (!workspace) {
    throw new CRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
  }
  return workspace;
});

export const update = authMutation
  .meta({ role: "admin" })
  .input(
    z.object({
      name: z.string().min(1).max(200).optional(),
      timezone: z.string().optional(),
      aiProvider: z.string().optional(),
      aiApiKey: z.string().optional(),
      whaleMdContent: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const patch: Record<string, any> = { updatedAt: now() };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) patch[key] = value;
    }

    if (input.whaleMdContent !== undefined) {
      patch.whaleMdUpdatedAt = now();
    }

    await ctx.db.patch(ctx.workspaceId as any, patch);

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "workspace.updated",
      metadata: JSON.stringify({ fields: Object.keys(input) }),
    });
  });
