"use client";

import * as React from "react";
import { Activity, AlertTriangle, Server } from "lucide-react";
import { useCRPC } from "@/lib/convex/crpc";

function formatTimeAgo(ts: number) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SystemHealthPage() {
  const crpc = useCRPC();
  const healthQuery = crpc.systemHealth.get.useQuery();

  if (healthQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const health = healthQuery.data;

  if (!health) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
        <h3 className="mt-3 text-sm font-semibold">Failed to load system health</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Unable to retrieve system health data.
        </p>
      </div>
    );
  }

  const scoreStatus =
    health.score < 50 ? "critical" : health.score < 80 ? "warning" : "healthy";

  function getStatusColor(status: string) {
    if (status === "critical") return "text-rose-400 border-rose-400/30 bg-rose-400/10";
    if (status === "warning") return "text-amber-400 border-amber-400/30 bg-amber-400/10";
    return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Server className="h-6 w-6 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">System Health</h2>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Health Score
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-3xl font-semibold tracking-tight">
              {health.score}
            </p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(scoreStatus)}`}
            >
              {scoreStatus}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Activity className="h-4 w-4" />
            Active Bots
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {health.activeBotsCount}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {health.totalBotsCount}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Pending Tasks
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {health.pendingTasksCount}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Failed Tasks (24h)
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-3xl font-semibold tracking-tight">
              {health.failedTasksLast24h}
            </p>
            {health.failedTasksLast24h > 0 && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(
                  health.failedTasksLast24h >= 10
                    ? "critical"
                    : health.failedTasksLast24h >= 5
                      ? "warning"
                      : "healthy",
                )}`}
              >
                {health.failedTasksLast24h >= 10
                  ? "critical"
                  : health.failedTasksLast24h >= 5
                    ? "warning"
                    : "ok"}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Pending Alerts
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {health.pendingAlerts}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Last Checked
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {new Date(health.checkedAt).toLocaleTimeString()}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Auto-refreshes via Convex subscriptions
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Recent Alerts</h3>
        </div>

        {health.recentAlerts.length === 0 ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No recent alerts.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {health.recentAlerts.map((alert: any) => {
              const severityColor =
                alert.severity === "critical"
                  ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
                  : alert.severity === "warning"
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                    : "border-sky-400/30 bg-sky-400/10 text-sky-300";

              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background p-4"
                >
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityColor}`}
                  >
                    {alert.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{alert.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTimeAgo(alert.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
