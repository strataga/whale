"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { AlertCard } from "@/components/alerts/alert-card";
import { useCRPC } from "@/lib/convex/crpc";

type FilterSeverity = "all" | "critical" | "warning" | "info";

export default function AlertsPage() {
  const crpc = useCRPC();
  const [filter, setFilter] = React.useState<FilterSeverity>("all");
  const [showAcknowledged, setShowAcknowledged] = React.useState(false);

  const alertsQuery = crpc.alerts.list.useQuery({});
  const acknowledgeMutation = crpc.alerts.acknowledge.useMutation();

  const alerts = (alertsQuery.data ?? []).map((a) => ({
    id: a._id,
    type: a.type,
    severity: a.severity,
    message: a.message,
    metadata: typeof a.metadata === "string" ? JSON.parse(a.metadata) : (a.metadata ?? {}),
    acknowledgedAt: a.acknowledgedAt ?? null,
    acknowledgedBy: a.acknowledgedBy ?? null,
    createdAt: a._creationTime,
  }));

  async function handleAcknowledge(id: string) {
    await acknowledgeMutation.mutateAsync({ id });
  }

  // Sort: unacknowledged first, then by severity (critical > warning > info), then by date
  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  const filtered = alerts
    .filter((a) => {
      if (!showAcknowledged && a.acknowledgedAt) return false;
      if (filter !== "all" && a.severity !== filter) return false;
      return true;
    })
    .sort((a, b) => {
      // Unacknowledged first
      if (!a.acknowledgedAt && b.acknowledgedAt) return -1;
      if (a.acknowledgedAt && !b.acknowledgedAt) return 1;
      // Then severity
      const sa = severityOrder[a.severity] ?? 2;
      const sb = severityOrder[b.severity] ?? 2;
      if (sa !== sb) return sa - sb;
      // Then newest first
      return b.createdAt - a.createdAt;
    });

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledgedAt).length;

  if (alertsQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Alerts</h2>
          {unacknowledgedCount > 0 && (
            <span className="rounded-full bg-rose-400/10 px-2.5 py-0.5 text-xs font-bold text-rose-400">
              {unacknowledgedCount} unacknowledged
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterSeverity)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={(e) => setShowAcknowledged(e.target.checked)}
              className="rounded border-border"
            />
            Show acknowledged
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">No alerts</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {alerts.length > 0
              ? "All alerts have been acknowledged."
              : "No alerts have been generated yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
            />
          ))}
        </div>
      )}
    </div>
  );
}
