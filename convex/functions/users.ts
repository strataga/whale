import { z } from "zod";
import { authQuery, authMutation, adminMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  const users = await ctx.db
    .query("users")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
  // Don't expose sensitive fields
  return users.map((u) => ({
    _id: u._id,
    _creationTime: u._creationTime,
    email: u.email,
    name: u.name,
    role: u.role,
    lastActiveAt: u.lastActiveAt,
    totpEnabled: u.totpEnabled,
  }));
});

export const me = authQuery.query(async ({ ctx }) => {
  const user = await ctx.db.get(ctx.user._id as any);
  if (!user) {
    throw new CRPCError({ code: "NOT_FOUND", message: "User not found" });
  }
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    email: user.email,
    name: user.name,
    role: user.role,
    themePreference: user.themePreference,
    emailDigestFrequency: user.emailDigestFrequency,
    totpEnabled: user.totpEnabled,
  };
});

export const updateMe = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200).optional(),
      themePreference: z.enum(["dark", "light", "system"]).optional(),
      emailDigestFrequency: z.enum(["daily", "weekly", "never"]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const patch: Record<string, any> = { updatedAt: now() };
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(ctx.user._id as any, patch);
  });

export const updateRole = adminMutation
  .input(
    z.object({
      userId: z.string(),
      role: z.enum(["admin", "member"]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.db.get(input.userId as any);
    if (!user || user.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    await ctx.db.patch(input.userId as any, { role: input.role, updatedAt: now() });

    await ctx.db.insert("auditLogs", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id as any,
      action: "user.role_updated",
      metadata: JSON.stringify({
        targetUserId: input.userId,
        newRole: input.role,
      }),
    });
  });
