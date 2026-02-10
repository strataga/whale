import { authQuery } from "../lib/crpc";

export const list = authQuery.query(async ({ ctx }) => {
  const guidelines = await ctx.db
    .query("botGuidelines")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .order("desc")
    .collect();

  return guidelines;
});
