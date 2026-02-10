import { z } from "zod";
import { authQuery, authMutation, privateMutation, CRPCError } from "../lib/crpc";
import { now } from "../lib/helpers";

// Scheduled tasks — things like "run this task at 3pm" or recurring actions

export const list = authQuery.query(async ({ ctx }) => {
  // Get all workflow runs that are scheduled (pending)
  const workflows = await ctx.db
    .query("workflows")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();

  const scheduledRuns = [];
  for (const wf of workflows) {
    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_workflow", (q) => q.eq("workflowId", wf._id))
      .collect();
    const pending = runs.filter((r) => r.status === "pending" || r.status === "running");
    scheduledRuns.push(...pending.map((r) => ({ ...r, workflowName: wf.name })));
  }
  return scheduledRuns;
});

// Internal: process all scheduled items (called by cron)
export const processScheduled = privateMutation
  .input(z.object({}))
  .mutation(async ({ ctx }) => {
    // Find tasks that have a scheduledAt in the past and status 'todo'
    const allTasks = await ctx.db.query("tasks").collect();
    const nowMs = now();

    let processed = 0;
    for (const task of allTasks) {
      if (task.scheduledAt && task.scheduledAt <= nowMs && task.status === "todo") {
        await ctx.db.patch(task._id, { status: "in_progress", updatedAt: nowMs });
        processed++;
      }
    }

    return { processed };
  });

// Schedule a task for future execution
export const scheduleTask = authMutation
  .input(
    z.object({
      taskId: z.string(),
      scheduledAt: z.number(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const task = await ctx.db.get(input.taskId as any);
    if (!task) {
      throw new CRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }
    await ctx.db.patch(input.taskId as any, {
      scheduledAt: input.scheduledAt,
      updatedAt: now(),
    });
  });
