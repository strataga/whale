"use client";

import { useMemo } from "react";

import { useCRPC } from "@/lib/convex/crpc";

export default function BotFleetHealthPage() {
  const crpc = useCRPC();
  const botsQuery = crpc.bots.list.useQuery({});
  const dashboardQuery = crpc.dashboard.stats.useQuery({});
  const allBots = botsQuery.data ?? [];

  // Compute fleet-level metrics from the bots list
  const fleetMetrics = useMemo(() => {
    const totalBots = allBots.length;
    const onlineBots = allBots.filter((b) => b.status !== "offline").length;
    const errorBots = allBots.filter((b) => b.status === "error").length;
    const uptimePercent = totalBots ? Math.round((onlineBots / totalBots) * 100) : 0;
    return { totalBots, onlineBots, errorBots, uptimePercent };
  }, [allBots]);

  const stats = dashboardQuery.data;

  if (botsQuery.isPending || dashboardQuery.isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Bot Fleet Health</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fleet-wide metrics for the past 7 days.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Fleet Uptime</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{fleetMetrics.uptimePercent}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fleetMetrics.onlineBots}/{fleetMetrics.totalBots} online
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Total Bots</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{stats?.bots.total ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats?.bots.byStatus.online ?? 0} online / {stats?.bots.byStatus.error ?? 0} error
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Tasks Completed</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {stats?.tasks.recentCompletions ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">last 24 hours</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Errors</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-400">
            {fleetMetrics.errorBots}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fleetMetrics.errorBots} bot{fleetMetrics.errorBots === 1 ? "" : "s"} in error state
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-tight">Per-Bot Status</h3>
        {allBots.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold">Bot</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allBots.map((bot) => (
                  <tr key={bot._id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{bot.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bot.status}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bot.lastSeenAt
                        ? new Date(bot.lastSeenAt).toLocaleString()
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            No bots connected to this workspace.
          </div>
        )}
      </section>
    </div>
  );
}
