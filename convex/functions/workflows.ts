import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

export const list = authQuery.query(async ({ ctx }) => {
  return ctx.db
    .query("workflows")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
});

export const get = authQuery
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const workflow = await ctx.db.get(input.id as any);
    if (!workflow || workflow.workspaceId !== ctx.workspaceId) return null;

    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_workflow", (q) => q.eq("workflowId", input.id as any))
      .order("desc")
      .take(10);

    return { ...workflow, recentRuns: runs };
  });

export const create = authMutation
  .input(
    z.object({
      name: z.string().min(1).max(200),
      definition: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // Validate definition is valid JSON
    try {
      JSON.parse(input.definition);
    } catch {
      throw new CRPCError({
        code: "BAD_REQUEST",
        message: "Workflow definition must be valid JSON",
      });
    }

    return ctx.db.insert("workflows", {
      workspaceId: ctx.workspaceId,
      name: input.name,
      definition: input.definition,
      updatedAt: now(),
    });
  });

export const update = authMutation
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      definition: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const workflow = await ctx.db.get(input.id as any);
    if (!workflow || workflow.workspaceId !== ctx.workspaceId) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
    }

    if (input.definition) {
      try {
        JSON.parse(input.definition);
      } catch {
        throw new CRPCError({
          code: "BAD_REQUEST",
          message: "Workflow definition must be valid JSON",
        });
      }
    }

    const { id, ...updates } = input;
    await ctx.db.patch(id as any, { ...updates, updatedAt: now() });
  });

// Internal: start a workflow run (called by scheduler or triggers)
export const startRun = privateMutation
  .input(z.object({ workflowId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const workflow = await ctx.db.get(input.workflowId as any);
    if (!workflow) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
    }

    const runId = await ctx.db.insert("workflowRuns", {
      workflowId: input.workflowId as any,
      status: "running",
      startedAt: now(),
    });

    // Parse definition and create initial steps
    const definition = JSON.parse(workflow.definition);
    const steps = definition.steps ?? [];
    for (const step of steps) {
      await ctx.db.insert("workflowRunSteps", {
        workflowRunId: runId,
        stepId: step.id ?? crypto.randomUUID(),
        status: "pending",
      });
    }

    return runId;
  });

// Internal: complete a workflow run step
export const completeStep = privateMutation
  .input(
    z.object({
      stepId: z.string(),
      result: z.string().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const step = await ctx.db.get(input.stepId as any);
    if (!step) return;

    await ctx.db.patch(input.stepId as any, {
      status: "completed",
      result: input.result,
      completedAt: now(),
    });

    // Check if all steps are complete
    const allSteps = await ctx.db
      .query("workflowRunSteps")
      .withIndex("by_workflowRun", (q) => q.eq("workflowRunId", step.workflowRunId))
      .collect();

    const allDone = allSteps.every(
      (s) => s._id === step._id || s.status === "completed" || s.status === "failed",
    );

    if (allDone) {
      const anyFailed = allSteps.some((s) => s.status === "failed");
      await ctx.db.patch(step.workflowRunId, {
        status: anyFailed ? "failed" : "completed",
        completedAt: now(),
      });
    }
  });
