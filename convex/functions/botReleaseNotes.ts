import { authQuery } from "../lib/crpc";

export const list = authQuery.query(async ({ ctx }) => {
  const notes = await ctx.db
    .query("botReleaseNotes")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .order("desc")
    .collect();

  return notes;
});
