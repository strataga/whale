import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  const tokens = await ctx.db
    .query("apiTokens")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
  // Mask token values
  return tokens.map((t) => ({
    ...t,
    tokenHash: undefined,
    prefix: t.prefix,
  }));
});

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(100),
      scopes: z.string(),
      expiresAt: z.number().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Generate a random token
    const tokenBytes = new Array(32);
    for (let i = 0; i < 32; i++) {
      tokenBytes[i] = Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0");
    }
    const rawToken = `whale_${tokenBytes.join("")}`;
    const prefix = rawToken.slice(0, 12);

    // In production, hash the token before storing
    const tokenHash = rawToken; // TODO: use proper hashing

    const id = await ctx.db.insert("apiTokens", {
      workspaceId: ctx.workspaceId,
      userId: ctx.user._id,
      name: input.name,
      tokenHash,
      prefix,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      lastUsedAt: undefined,
      updatedAt: now(),
    });

    // Return the raw token only on creation (never stored in plain text after this)
    return { id, token: rawToken, prefix };
  });

export const revoke = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const token = await ctx.db.get(input.id as any);
    if (!token || token.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Token not found" });
    }
    await ctx.db.delete(input.id as any);
  });
