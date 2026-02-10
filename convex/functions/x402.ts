import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

// x402 escrow lifecycle: authorized → captured → settled | refunded

const VALID_TRANSITIONS: Record<string, string[]> = {
  authorized: ["captured", "refunded"],
  captured: ["settled", "refunded"],
  settled: [],
  refunded: [],
};

export const list = authQuery
  .input(z.object({ status: z.string().optional() }))
  .query(async ({ ctx, input }) => {
    let txns = await ctx.db
      .query("x402Transactions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .order("desc")
      .collect();

    if (input.status) {
      txns = txns.filter((t) => t.status === input.status);
    }
    return txns;
  });

export const authorize = privateMutation
  .input(
    z.object({
      workspaceId: z.string(),
      payerAddress: z.string(),
      amount: z.string(),
      asset: z.string().optional(),
      network: z.string().optional(),
      taskId: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("x402Transactions", {
      workspaceId: input.workspaceId as any,
      payerAddress: input.payerAddress,
      amount: input.amount,
      asset: input.asset ?? "USDC",
      network: input.network ?? "base",
      status: "authorized",
      taskId: input.taskId as any,
      updatedAt: now(),
    });
  });

export const transition = authMutation
  .input(
    z.object({
      id: z.string(),
      status: z.enum(["captured", "settled", "refunded"]),
      txHash: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const txn = await ctx.db.get(input.id as any);
    if (!txn || txn.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
    }

    const allowed = VALID_TRANSITIONS[txn.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: `Cannot transition from ${txn.status} to ${input.status}`,
      });
    }

    const patch: Record<string, any> = {
      status: input.status,
      updatedAt: now(),
    };
    if (input.txHash) patch.txHash = input.txHash;
    if (input.status === "captured") patch.verifiedAt = now();
    if (input.status === "settled") patch.settledAt = now();
    if (input.status === "refunded") patch.refundedAt = now();

    await ctx.db.patch(input.id as any, patch);
  });
