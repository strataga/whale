import { z } from "zod";
import { authQuery, authMutation } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery
  .input(
    z.object({
      unreadOnly: z.boolean().optional(),
      limit: z.number().min(1).max(100).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    let notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id as any))
      .order("desc")
      .collect();

    if (input.unreadOnly) {
      notifications = notifications.filter((n) => !n.readAt);
    }

    return notifications.slice(0, input.limit ?? 50);
  });

export const unreadCount = authQuery.query(async ({ ctx }) => {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", ctx.user._id as any))
    .collect();

  return notifications.filter((n) => !n.readAt).length;
});

export const markRead = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const notif = await ctx.db.get(input.id as any);
    if (notif && notif.userId === ctx.user._id) {
      await ctx.db.patch(input.id as any, { readAt: now() });
    }
  });

export const markAllRead = authMutation.mutation(async ({ ctx }) => {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", ctx.user._id as any))
    .collect();

  const timestamp = now();
  for (const n of notifications.filter((n) => !n.readAt)) {
    await ctx.db.patch(n._id, { readAt: timestamp });
  }
});
