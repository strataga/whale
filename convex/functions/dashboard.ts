import { z } from "zod";
import { authQuery } from "../lib/crpc";

/**
 * Dashboard stats — replaces the old server-component SQL aggregate queries.
 * All counts are computed in JS from collected documents.
 */
export const stats = authQuery.query(async ({ ctx }) => {
  const [projects, tasks, bots, agents, alerts] = await Promise.all([
    ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect(),
    // Tasks: get via projects
    ctx.db.query("tasks").collect(),
    ctx.db
      .query("bots")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect(),
    ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect(),
    ctx.db
      .query("alerts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
      .collect(),
  ]);

  // Filter tasks to workspace projects
  const projectIds = new Set(projects.map((p) => p._id));
  const workspaceTasks = tasks.filter(
    (t) => t.projectId === undefined || projectIds.has(t.projectId),
  );

  const now = Date.now();
  const oneDayAgo = now - 86400000;

  // Task status breakdown
  const tasksByStatus = {
    todo: 0,
    in_progress: 0,
    done: 0,
  };
  for (const t of workspaceTasks) {
    if (t.status in tasksByStatus) {
      tasksByStatus[t.status as keyof typeof tasksByStatus]++;
    }
  }

  // Bot status breakdown
  const staleBefore = now - 120000; // 2 minutes
  const botsByStatus = {
    online: 0,
    offline: 0,
    error: 0,
  };
  for (const b of bots) {
    if (b.status === "error") {
      botsByStatus.error++;
    } else if (b.lastSeenAt && b.lastSeenAt > staleBefore) {
      botsByStatus.online++;
    } else {
      botsByStatus.offline++;
    }
  }

  // Recent task completions (last 24h)
  const recentCompletions = workspaceTasks.filter(
    (t) => t.status === "done" && t.updatedAt > oneDayAgo,
  ).length;

  // Unacknowledged alerts
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledgedAt).length;

  return {
    projects: {
      total: projects.length,
      active: projects.filter((p) => p.status === "active").length,
    },
    tasks: {
      total: workspaceTasks.length,
      byStatus: tasksByStatus,
      recentCompletions,
    },
    bots: {
      total: bots.length,
      byStatus: botsByStatus,
    },
    agents: {
      total: agents.length,
      online: agents.filter((a) => a.status === "online").length,
    },
    alerts: {
      unacknowledged: unacknowledgedAlerts,
    },
  };
});

/**
 * Activity feed — recent audit log entries for the workspace.
 */
export const activityFeed = authQuery.query(async ({ ctx }) => {
  const logs = await ctx.db
    .query("auditLogs")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .order("desc")
    .take(20);

  return logs;
});

/**
 * Recommended actions — heuristic queue for quickly delegating work to bots.
 */
export const recommendedActions = authQuery
  .input(z.object({ limit: z.number().min(1).max(20).optional() }))
  .query(async ({ ctx, input }) => {
    const limit = input.limit ?? 3;

    const [projects, tasks, bots, botTasks] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
        .collect(),
      ctx.db.query("tasks").collect(),
      ctx.db
        .query("bots")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
        .collect(),
      ctx.db.query("botTasks").collect(),
    ]);

    const projectIds = new Set(projects.map((p) => p._id));
    const projectNameById = new Map(projects.map((p) => [p._id, p.name] as const));

    const workspaceTasks = tasks.filter(
      (t) => t.projectId === undefined || projectIds.has(t.projectId),
    );

    const now = Date.now();
    const dayMs = 86400000;

    function priorityScore(p?: string) {
      switch (p) {
        case "urgent":
          return 5;
        case "high":
          return 3;
        case "medium":
          return 1;
        case "low":
        default:
          return 0;
      }
    }

    function dueScore(dueDate?: number) {
      if (!dueDate) return 0;
      const delta = dueDate - now;
      if (delta < 0) return 4; // overdue
      if (delta < 3 * dayMs) return 2;
      if (delta < 7 * dayMs) return 1;
      return 0;
    }

    function ageScore(createdAt?: number) {
      // Use Convex creationTime if present.
      if (!createdAt) return 0;
      const age = now - createdAt;
      if (age > 30 * dayMs) return 2;
      if (age > 7 * dayMs) return 1;
      return 0;
    }

    const candidates = workspaceTasks
      .filter((t) => t.status !== "done")
      .filter((t) => !t.assigneeId)
      .map((t) => {
        const pScore = priorityScore(t.priority);
        const dScore = dueScore(t.dueDate);
        const aScore = ageScore((t as any)._creationTime);
        const score = pScore + dScore + aScore;

        let reason = "Unassigned";
        if (t.dueDate && t.dueDate < now) reason = "Overdue";
        else if (t.priority === "urgent" || t.priority === "high") reason = "High priority";
        else if (t.dueDate && t.dueDate - now < 3 * dayMs) reason = "Due soon";
        else if (aScore > 0) reason = "Stale";

        return {
          task: t,
          score,
          reason,
        };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Suggest a bot: prefer online bots with lowest in-flight tasks.
    const staleBefore = now - 120000;
    const onlineBots = bots.filter((b) => b.lastSeenAt && b.lastSeenAt > staleBefore);
    const botLoad = new Map<string, number>();
    for (const bt of botTasks) {
      if (bt.status === "pending" || bt.status === "running") {
        const id = (bt.botId as any)?.toString?.() ?? bt.botId;
        botLoad.set(id, (botLoad.get(id) ?? 0) + 1);
      }
    }

    function pickSuggestedBot() {
      if (!onlineBots.length) return null;
      const sorted = [...onlineBots].sort((a, b) => {
        const aId = (a._id as any)?.toString?.() ?? a._id;
        const bId = (b._id as any)?.toString?.() ?? b._id;
        const la = botLoad.get(aId) ?? 0;
        const lb = botLoad.get(bId) ?? 0;
        if (la !== lb) return la - lb;
        return (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
      });
      return sorted[0];
    }

    const suggestedBot = pickSuggestedBot();

    return {
      items: candidates.map(({ task, score, reason }) => ({
        taskId: task._id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
        reason,
        score,
        projectId: task.projectId,
        projectName: task.projectId ? projectNameById.get(task.projectId) ?? "Project" : "External",
        suggestedBotId: suggestedBot?._id ?? null,
        suggestedBotName: suggestedBot?.name ?? null,
      })),
    };
  });
