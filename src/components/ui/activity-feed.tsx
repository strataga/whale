"use client";

import * as React from "react";

type ActivityItem = {
  id: string;
  action: string;
  createdAt: number;
  userName?: string | null;
  userEmail?: string | null;
};

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

function actionLabel(action: string) {
  const map: Record<string, string> = {
    "project.create": "created a project",
    "project.update": "updated a project",
    "task.create": "created a task",
    "task.update": "updated a task",
    "task.delete": "deleted a task",
    "bot.register": "registered a bot",
    "bot_task.assign": "assigned a bot task",
    "bot_task.update": "updated a bot task",
    "comment.create": "commented on a task",
    "subtask.create": "added a subtask",
    "time.log": "logged time",
    "template.create": "created a template",
    "handoff.create": "set up a handoff",
  };
  return map[action] ?? action;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const user = item.userName?.trim() || item.userEmail?.trim() || "System";
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-muted text-[10px] font-semibold">
                {user.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-foreground">{user}</span>{" "}
                <span className="text-muted-foreground">{actionLabel(item.action)}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatTimeAgo(item.createdAt)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
