"use client";

import { useCRPC } from "@/lib/convex/crpc";

interface TimelineEntry {
  type: "event" | "comment" | "approval";
  timestamp: number;
  data: Record<string, unknown>;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function typeColor(type: string) {
  switch (type) {
    case "event":
      return "bg-blue-400";
    case "comment":
      return "bg-emerald-400";
    case "approval":
      return "bg-amber-400";
    default:
      return "bg-zinc-400";
  }
}

function typeLabel(type: string) {
  switch (type) {
    case "event":
      return "Event";
    case "comment":
      return "Comment";
    case "approval":
      return "Approval";
    default:
      return type;
  }
}

function renderData(entry: TimelineEntry) {
  const { type, data } = entry;

  if (type === "event") {
    return (
      <span className="text-sm text-zinc-300">
        {(data.event as string) ?? "Event"}
        {data.botTaskId ? (
          <span className="ml-1 text-xs text-zinc-500">
            (bot task: {(data.botTaskId as string).slice(0, 8)}...)
          </span>
        ) : null}
      </span>
    );
  }

  if (type === "comment") {
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-zinc-500">
          {(data.authorType as string) === "bot" ? "Bot" : "User"} comment
        </span>
        <p className="text-sm text-zinc-300 line-clamp-2">
          {data.body as string}
        </p>
      </div>
    );
  }

  if (type === "approval") {
    const status = data.status as string;
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-zinc-500">
          Approval gate:{" "}
          <span
            className={
              status === "approved"
                ? "text-emerald-400"
                : status === "rejected"
                  ? "text-rose-400"
                  : "text-amber-400"
            }
          >
            {status}
          </span>
        </span>
        {data.reviewNote ? (
          <p className="text-xs text-zinc-400">{data.reviewNote as string}</p>
        ) : null}
      </div>
    );
  }

  return <span className="text-sm text-zinc-400">Unknown entry</span>;
}

export function ActivityTimeline({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const crpc = useCRPC();
  const query = crpc.tasks.journey.useQuery({ projectId, taskId });
  const entries: TimelineEntry[] = query.data?.timeline ?? [];
  const loading = query.isLoading;

  if (loading) {
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground">
          Activity Timeline
        </h4>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground">
        Activity Timeline
      </h4>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-700" />

          {entries.map((entry, i) => (
            <div key={i} className="relative flex gap-3 pb-4">
              {/* Dot */}
              <div className="relative z-10 mt-1.5">
                <div
                  className={`h-[14px] w-[14px] rounded-full border-2 border-zinc-900 ${typeColor(entry.type)}`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {typeLabel(entry.type)}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                {renderData(entry)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
