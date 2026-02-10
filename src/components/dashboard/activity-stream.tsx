"use client";

import * as React from "react";
import {
  Bot,
  CheckCircle2,
  FileText,
  FolderKanban,
  MessageSquare,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";

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

function getActionIcon(action: string) {
  if (action.includes("project.create")) return FolderKanban;
  if (action.includes("task.create")) return Plus;
  if (action.includes("task.update")) return CheckCircle2;
  if (action.includes("task.delete")) return Trash2;
  if (action.includes("bot.register")) return Bot;
  if (action.includes("bot_task")) return Bot;
  if (action.includes("comment")) return MessageSquare;
  if (action.includes("user")) return UserPlus;
  return FileText;
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
    "user.invite": "invited a user",
    "webhook.create": "created a webhook",
  };
  return map[action] ?? action;
}

export function ActivityStream() {
  const crpc = useCRPC();
  const { data: activities, isLoading: loading } =
    crpc.dashboard.activityFeed.useQuery({});

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-border bg-background">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-medium">No live activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Activity will appear here as agents negotiate, execute tasks, and settle payments.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <ul className="divide-y divide-border">
        {activities.map((activity) => {
          const user =
            activity.userName?.trim() || activity.userEmail?.trim() || "System";
          const Icon = getActionIcon(activity.action);

          return (
            <li key={activity._id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium text-foreground">{user}</span>{" "}
                <span className="text-muted-foreground">
                  {actionLabel(activity.action)}
                </span>
              </div>

              <span className="shrink-0 text-xs text-muted-foreground">
                {formatTimeAgo(activity._creationTime)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
