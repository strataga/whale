"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type Risk = {
  severity: string;
  category: string;
  description: string;
  recommendation: string;
};

type ScanResult = {
  risks: Risk[];
  overallHealth: string;
  summary: string;
};

const healthStyles: Record<string, string> = {
  good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  warning: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  critical: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const severityStyles: Record<string, string> = {
  high: "text-rose-300",
  medium: "text-yellow-300",
  low: "text-muted-foreground",
};

export function RiskScan() {
  const [result, setResult] = React.useState<ScanResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function runScan() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/risk-scan", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError((d as { error?: string } | null)?.error ?? "Scan failed");
        return;
      }
      const d = await res.json();
      setResult(d.scan);
    } catch {
      setError("Failed to run risk scan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">AI Risk Scan</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Detect overdue tasks, stalled milestones, and bot issues.
          </p>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {loading ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {result.overallHealth === "good" ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            )}
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                healthStyles[result.overallHealth] ?? healthStyles.warning,
              )}
            >
              {result.overallHealth}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">{result.summary}</p>

          {result.risks.length > 0 ? (
            <ul className="space-y-2">
              {result.risks.map((r, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border bg-background p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase",
                        severityStyles[r.severity] ?? severityStyles.low,
                      )}
                    >
                      {r.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.category}</span>
                  </div>
                  <p className="text-sm text-foreground">{r.description}</p>
                  <p className="text-xs text-muted-foreground">{r.recommendation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-emerald-300">No risks detected.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
