import Link from "next/link";

import { cn } from "@/lib/utils";

type BotLike = {
  id: string;
  name: string;
  host: string;
  status: string;
  capabilities?: unknown;
  lastSeenAt?: number | null;
};

function statusStyles(status?: string | null) {
  switch (status) {
    case "idle":
    case "online": // legacy
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "working":
    case "busy": // legacy
      return "border-blue-400/30 bg-blue-400/10 text-blue-200";
    case "waiting":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "recovering":
      return "border-purple-400/30 bg-purple-400/10 text-purple-200";
    case "error":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    case "offline":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function parseCapabilities(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // If it's not JSON, fall back to comma-separated strings.
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

function formatRelativeTime(ts?: number | null) {
  if (!ts) return null;

  const diffSeconds = Math.floor((Date.now() - ts) / 1000);
  if (Number.isNaN(diffSeconds)) return null;
  if (diffSeconds < 0) return "just now";
  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

export function BotCard({ bot }: { bot: BotLike }) {
  const capabilities = parseCapabilities(bot.capabilities);
  const lastSeenRelative = formatRelativeTime(bot.lastSeenAt);
  const lastSeenExact = bot.lastSeenAt
    ? new Date(bot.lastSeenAt).toLocaleString()
    : null;

  return (
    <Link
      href={`/dashboard/bots/${bot.id}`}
      className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {bot.name}
          </div>
          <div className="mt-1 truncate text-sm text-muted-foreground">
            <span className="font-mono">{bot.host}</span>
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-1 text-xs font-semibold",
            statusStyles(bot.status),
          )}
          title={bot.status}
        >
          {bot.status ?? "offline"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span title={lastSeenExact ?? undefined}>
          Last seen:{" "}
          {lastSeenRelative ? (
            <span className="text-foreground">{lastSeenRelative}</span>
          ) : (
            <span>never</span>
          )}
        </span>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          Open →
        </span>
      </div>

      {capabilities.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {capabilities.slice(0, 6).map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
            >
              {cap}
            </span>
          ))}
          {capabilities.length > 6 ? (
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
              +{capabilities.length - 6}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 text-xs text-muted-foreground">
          No capabilities reported.
        </div>
      )}
    </Link>
  );
}

