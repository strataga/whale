"use client";

import { AlertTriangle, CheckCircle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertData {
  id: string;
  type: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  createdAt: number;
}

const severityConfig: Record<
  string,
  { icon: typeof AlertTriangle; className: string; label: string }
> = {
  critical: {
    icon: ShieldAlert,
    className: "border-rose-400/30 bg-rose-400/5 text-rose-400",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-400/30 bg-amber-400/5 text-amber-400",
    label: "Warning",
  },
  info: {
    icon: Info,
    className: "border-blue-400/30 bg-blue-400/5 text-blue-400",
    label: "Info",
  },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AlertCard({
  alert,
  onAcknowledge,
}: {
  alert: AlertData;
  onAcknowledge: (id: string) => void;
}) {
  const config = severityConfig[alert.severity] ?? severityConfig.info!;
  const Icon = config.icon;
  const isAcked = !!alert.acknowledgedAt;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isAcked
          ? "border-border bg-card opacity-60"
          : config.className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                isAcked ? "bg-muted text-muted-foreground" : config.className,
              )}
            >
              {config.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {alert.type}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {timeAgo(alert.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">
            {alert.message}
          </p>
          {isAcked ? (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <CheckCircle className="h-3 w-3" />
              Acknowledged {timeAgo(alert.acknowledgedAt!)}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onAcknowledge(alert.id)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CheckCircle className="h-3 w-3" />
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
