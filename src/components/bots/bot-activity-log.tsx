"use client";

import { useCallback, useEffect, useState } from "react";

type LogLevel = "info" | "warn" | "error" | "debug";

type BotLog = {
  id: string;
  botId: string;
  workspaceId: string;
  level: string;
  message: string;
  metadata: string;
  botTaskId: string | null;
  createdAt: number;
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "border-gray-400/30 bg-gray-400/10 text-gray-300",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  error: "border-red-400/30 bg-red-400/10 text-red-200",
  debug: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};

const LEVELS: LogLevel[] = ["info", "warn", "error", "debug"];

const PAGE_SIZE = 25;

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseMetadata(raw: string): Record<string, unknown> | null {
  if (!raw || raw === "{}") return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Object.keys(parsed).length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function BotActivityLog({ botId }: { botId: string }) {
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [total, setTotal] = useState(0);
  const [level, setLevel] = useState<LogLevel | "">("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (offset: number, append: boolean) => {
      try {
        const params = new URLSearchParams();
        if (level) params.set("level", level);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));

        const res = await fetch(
          `/api/bots/${botId}/logs?${params.toString()}`,
        );

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { logs: BotLog[]; total: number };
        setLogs((prev) => (append ? [...prev, ...data.logs] : data.logs));
        setTotal(data.total);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch logs");
      }
    },
    [botId, level],
  );

  useEffect(() => {
    setLoading(true);
    fetchLogs(0, false).finally(() => setLoading(false));
  }, [fetchLogs]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchLogs(logs.length, true);
    setLoadingMore(false);
  };

  const hasMore = logs.length < total;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Activity log
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent log entries reported by this bot.
          </p>
        </div>

        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as LogLevel | "")}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : loading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-2xl border border-border bg-background"
            />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
          No log entries{level ? ` with level "${level}"` : ""}.
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-2">
            {logs.map((log) => {
              const meta = parseMetadata(log.metadata);
              const lvl = (log.level as LogLevel) || "info";
              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${LEVEL_STYLES[lvl] ?? LEVEL_STYLES.info}`}
                    >
                      {lvl}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-foreground">
                          {log.message}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatTimestamp(log.createdAt)}
                        {log.botTaskId ? (
                          <span className="ml-2 font-mono">
                            task:{log.botTaskId.slice(0, 8)}
                          </span>
                        ) : null}
                      </div>
                      {meta ? (
                        <pre className="mt-2 max-h-32 overflow-auto rounded-md border border-border bg-card p-2 text-xs text-muted-foreground">
                          {JSON.stringify(meta, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
