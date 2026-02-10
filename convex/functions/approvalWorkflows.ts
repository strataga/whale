import { z } from "zod";
import { authQuery, authMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("approvalWorkflows")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const workflow = await ctx.db.get(input.id as any);
    if (!workflow || workflow.workspaceId !== ctx.workspaceId) return null;

    // Load associated gates
    const gates = await ctx.db
      .query("approvalGates")
      .withIndex("by_workflow", (q) => q.eq("workflowId", input.id as any))
      .collect();

    return { ...workflow, gates };
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200),
      triggerCondition: z.string().max(2000),
      approverIds: z.string(),
      requiredApprovals: z.number().int().positive(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    return ctx.db.insert("approvalWorkflows", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      triggerCondition: input.triggerCondition,
      approverIds: input.approverIds,
      requiredApprovals: input.requiredApprovals,
      enabled: true,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      triggerCondition: z.string().max(2000).optional(),
      approverIds: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const workflow = await ctx.db.get(input.id as any);
    if (!workflow || workflow.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
    }
    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

export const remove = authMutation
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const workflow = await ctx.db.get(input.id as any);
    if (!workflow || workflow.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
    }
    await ctx.db.delete(input.id as any);
  });

// Approve/reject a gate
export const resolveGate = authMutation
  .input(
    z.object({
      gateId: z.string(),
      decision: z.enum(["approved", "rejected"]),
      comment: z.string().max(2000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const gate = await ctx.db.get(input.gateId as any);
    if (!gate) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Gate not found" });
    }
    await ctx.db.patch(input.gateId as any, {
      status: input.decision,
      decidedBy: ctx.user._id,
      decidedAt: now(),
      comment: input.comment,
    });
  });
