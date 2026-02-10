"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

import { useCRPC } from "@/lib/convex/crpc";

export default function BotAnalyticsPage() {
  const { botId } = useParams<{ botId: string }>();
  const crpc = useCRPC();

  const botQuery = crpc.bots.get.useQuery({ id: botId });
  const botTasksQuery = crpc.botTasks.listByBot.useQuery({ botId });
  const botLogsQuery = crpc.botLogs.list.useQuery({ botId, level: "error", limit: 500 });

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const weeklyStats = useMemo(() => {
    const allTasks = botTasksQuery.data ?? [];
    const weekTasks = allTasks.filter((t) => t._creationTime >= weekAgo);
    const completed = weekTasks.filter((t) => t.status === "completed").length;
    const failed = weekTasks.filter((t) => t.status === "failed").length;
    const total = weekTasks.length;

    const completionTimes = weekTasks
      .filter((t) => t.completedAt && t.startedAt)
      .map((t) => t.completedAt! - t.startedAt!);

    const avgMs =
      completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : null;

    return { completed, failed, total, avgMs };
  }, [botTasksQuery.data, weekAgo]);

  const monthlyStats = useMemo(() => {
    const allTasks = botTasksQuery.data ?? [];
    const monthTasks = allTasks.filter((t) => t._creationTime >= monthAgo);
    const completed = monthTasks.filter((t) => t.status === "completed").length;
    const total = monthTasks.length;
    return { completed, total };
  }, [botTasksQuery.data, monthAgo]);

  const errorCount = useMemo(() => {
    const logs = botLogsQuery.data ?? [];
    return logs.filter((l) => l._creationTime >= weekAgo).length;
  }, [botLogsQuery.data, weekAgo]);

  if (botQuery.isPending || botTasksQuery.isPending || botLogsQuery.isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const bot = botQuery.data;
  if (!bot) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <h3 className="text-sm font-semibold">Bot not found</h3>
      </div>
    );
  }

  const weekSuccessRate = weeklyStats.total
    ? Math.round((weeklyStats.completed / weeklyStats.total) * 100)
    : 0;

  const avgMinutes = weeklyStats.avgMs
    ? Math.round(weeklyStats.avgMs / 60000)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{bot.name} Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance metrics and activity trends.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Tasks (7d)</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{weeklyStats.total}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Success Rate (7d)</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{weekSuccessRate}%</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Avg Completion</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {avgMinutes !== null ? `${avgMinutes}m` : "N/A"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Errors (7d)</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-400">
            {errorCount}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">30-Day Summary</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total tasks</span>
              <span className="font-semibold">{monthlyStats.total}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-semibold text-emerald-400">{monthlyStats.completed}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Success rate</span>
              <span className="font-semibold">
                {monthlyStats.total
                  ? Math.round((monthlyStats.completed / monthlyStats.total) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Bot Info</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold">{bot.status}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <span className="font-semibold">{bot.version ?? "Unknown"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Host</span>
              <span className="font-semibold">{bot.host}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last seen</span>
              <span className="font-semibold">
                {bot.lastSeenAt
                  ? new Date(bot.lastSeenAt).toLocaleString()
                  : "Never"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
