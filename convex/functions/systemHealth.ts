import { authQuery } from "../lib/crpc";

export const get = authQuery.query(async ({ ctx }) => {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Active bots (seen within last 5 minutes)
  const allBots = await ctx.db
    .query("bots")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();

  const activeBotsCount = allBots.filter(
    (b) => b.lastSeenAt && b.lastSeenAt >= fiveMinAgo,
  ).length;
  const totalBotsCount = allBots.length;

  // Tasks in progress
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
  const projectIds = new Set(projects.map((p) => p._id));

  const allTasks = await ctx.db.query("tasks").collect();
  const workspaceTasks = allTasks.filter(
    (t) => t.projectId === undefined || projectIds.has(t.projectId),
  );
  const pendingTasksCount = workspaceTasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  ).length;

  // Failed bot tasks in last 24h
  const allBotTasks = await ctx.db.query("botTasks").collect();
  const botIds = new Set(allBots.map((b) => b._id));
  const failedTasksLast24h = allBotTasks.filter(
    (bt) =>
      botIds.has(bt.botId) &&
      bt.status === "failed" &&
      bt.updatedAt &&
      bt.updatedAt >= oneDayAgo,
  ).length;

  // Pending alerts
  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", ctx.workspaceId))
    .collect();
  const pendingAlerts = alerts.filter((a) => !a.acknowledgedAt).length;

  // Recent alerts for display
  const recentAlerts = alerts
    .filter((a) => !a.acknowledgedAt)
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, 10)
    .map((a) => ({
      id: a._id,
      severity: a.severity,
      message: a.message,
      createdAt: a._creationTime,
    }));

  // Compute composite health score (0-100)
  let score = 100;

  if (totalBotsCount > 0) {
    const botHealthPct = (activeBotsCount / totalBotsCount) * 100;
    if (botHealthPct < 50) score -= 30;
    else if (botHealthPct < 80) score -= 15;
  }

  if (failedTasksLast24h >= 10) score -= 25;
  else if (failedTasksLast24h >= 5) score -= 15;
  else if (failedTasksLast24h >= 1) score -= 5;

  if (pendingAlerts >= 10) score -= 20;
  else if (pendingAlerts >= 5) score -= 10;
  else if (pendingAlerts >= 1) score -= 5;

  score = Math.max(0, score);

  return {
    score,
    activeBotsCount,
    totalBotsCount,
    pendingTasksCount,
    failedTasksLast24h,
    pendingAlerts,
    recentAlerts,
    checkedAt: now,
  };
});
