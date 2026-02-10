"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { ArtifactLinks } from "@/components/bots/artifact-links";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { CommentThread } from "@/components/tasks/comment-thread";
import { TimeEntryForm } from "@/components/tasks/time-entry-form";
import { DecomposeButton } from "@/components/tasks/decompose-button";
import { ActivityTimeline } from "@/components/tasks/activity-timeline";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

function formatDate(ts?: number | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "urgent":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    case "high":
      return "border-orange-400/30 bg-orange-400/10 text-orange-200";
    case "medium":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "done":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "in_progress":
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

const statusLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

function safeParseJsonArray(val: string | string[] | null | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function TaskDetailPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const crpc = useCRPC();

  const { data: project, isPending: projectPending } =
    crpc.projects.get.useQuery({ id: projectId });
  const { data: task, isPending: taskPending } =
    crpc.tasks.get.useQuery({ id: taskId });
  const { data: taskSubtasks, isPending: subtasksPending } =
    crpc.subtasks.list.useQuery({ taskId });
  const { data: rawComments, isPending: commentsPending } =
    crpc.comments.list.useQuery({ taskId });
  const { data: rawTimeEntries, isPending: entriesPending } =
    crpc.timeEntries.listByTask.useQuery({ taskId });
  const { data: depData, isPending: depsPending } =
    crpc.taskDependencies.list.useQuery({ taskId });
  const { data: botTasksForTask, isPending: botTasksPending } =
    crpc.botTasks.listByTask.useQuery({ taskId });
  const { data: usersList } = crpc.users.list.useQuery({});
  const { data: allTasks } = crpc.tasks.list.useQuery({ limit: 200 });
  const { data: botsList } = crpc.bots.list.useQuery({});

  const isPending =
    projectPending ||
    taskPending ||
    subtasksPending ||
    commentsPending ||
    entriesPending ||
    depsPending ||
    botTasksPending;

  // Build user name map
  const userMap = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string }>();
    if (!usersList) return map;
    for (const u of usersList) {
      map.set(u._id, { name: u.name ?? null, email: u.email });
    }
    return map;
  }, [usersList]);

  // Build task lookup for dependency titles/statuses
  const taskMap = useMemo(() => {
    const map = new Map<string, { title: string; status: string }>();
    if (!allTasks) return map;
    for (const t of allTasks) {
      map.set(t._id, { title: t.title, status: t.status });
    }
    return map;
  }, [allTasks]);

  // Build bot name map
  const botMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!botsList) return map;
    for (const b of botsList) {
      map.set(b._id, b.name);
    }
    return map;
  }, [botsList]);

  // Process comments with author info
  const comments = useMemo(() => {
    if (!rawComments) return [];
    return rawComments.map((c: any) => {
      const user = c.authorId ? userMap.get(c.authorId as string) : null;
      return {
        id: c._id,
        body: c.body,
        authorType: c.authorType,
        authorName: user?.name ?? null,
        authorEmail: user?.email ?? null,
        createdAt: c._creationTime,
      };
    });
  }, [rawComments, userMap]);

  // Process time entries with user info
  const entries = useMemo(() => {
    if (!rawTimeEntries) return [];
    return rawTimeEntries.map((e: any) => {
      const user = e.userId ? userMap.get(e.userId as string) : null;
      return {
        id: e._id,
        minutes: e.minutes,
        note: e.description ?? null,
        userName: user?.name ?? null,
        createdAt: e._creationTime,
      };
    });
  }, [rawTimeEntries, userMap]);

  const totalMinutes = useMemo(() => {
    if (!rawTimeEntries) return 0;
    return rawTimeEntries.reduce((sum: number, e: any) => sum + e.minutes, 0);
  }, [rawTimeEntries]);

  // Process dependencies
  const deps = useMemo(() => {
    if (!depData?.dependencies) return [];
    return depData.dependencies.map((d: any) => {
      const depTask = taskMap.get(d.dependsOnTaskId as string);
      return {
        id: d._id,
        dependsOnTaskId: d.dependsOnTaskId as string,
        depTitle: depTask?.title ?? "Unknown task",
        depStatus: depTask?.status ?? "todo",
      };
    });
  }, [depData?.dependencies, taskMap]);

  const blockedByThis = useMemo(() => {
    if (!depData?.blockedBy) return [];
    return depData.blockedBy.map((b: any) => {
      const blockedTask = taskMap.get(b.taskId as string);
      return {
        id: b._id,
        taskId: b.taskId as string,
        taskTitle: blockedTask?.title ?? "Unknown task",
      };
    });
  }, [depData?.blockedBy, taskMap]);

  // Latest bot task
  const latestBotTask = useMemo(() => {
    if (!botTasksForTask || botTasksForTask.length === 0) return null;
    // Sort by _creationTime descending, take first
    const sorted = [...botTasksForTask].sort(
      (a, b) => b._creationTime - a._creationTime,
    );
    const bt = sorted[0];
    return {
      id: bt._id,
      status: bt.status,
      botName: botMap.get(bt.botId as string) ?? "Unknown bot",
      artifactLinks: bt.artifactLinks,
      outputSummary: bt.outputSummary,
    };
  }, [botTasksForTask, botMap]);

  const artifactLinks: string[] = latestBotTask?.artifactLinks
    ? safeParseJsonArray(latestBotTask.artifactLinks as any)
    : [];

  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-8 w-72 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-[200px] animate-pulse rounded-2xl border border-border bg-muted" />
            <div className="h-[200px] animate-pulse rounded-2xl border border-border bg-muted" />
          </div>
          <div className="space-y-6">
            <div className="h-[150px] animate-pulse rounded-2xl border border-border bg-muted" />
            <div className="h-[100px] animate-pulse rounded-2xl border border-border bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!project || !task) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold">Not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The task or project could not be found.
        </p>
      </div>
    );
  }

  const isBlocked = deps.some((d: any) => d.depStatus !== "done");
  const dueStr = formatDate(task.dueDate);
  const now = Date.now();
  const isOverdue = task.dueDate && task.status !== "done" && task.dueDate < now;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/projects" className="hover:text-foreground">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/projects/${project._id}`}
          className="hover:text-foreground"
        >
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">{task.title}</span>
      </nav>

      {/* Task header */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{task.title}</h2>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              statusBadge(task.status),
            )}
          >
            {statusLabels[task.status] ?? task.status}
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              priorityBadge(task.priority),
            )}
          >
            {task.priority}
          </span>
          {isBlocked ? (
            <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs font-semibold text-yellow-300">
              Blocked
            </span>
          ) : null}
          {isOverdue ? (
            <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
              Overdue
            </span>
          ) : null}
        </div>

        {task.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {task.description}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {dueStr ? <span>Due: {dueStr}</span> : null}
          {task.estimatedMinutes ? <span>Estimate: ~{task.estimatedMinutes}m</span> : null}
          {task.assigneeId ? <span>Assigned</span> : <span>Unassigned</span>}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: subtasks + comments */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <SubtaskList
              projectId={projectId}
              taskId={taskId}
              subtasks={(taskSubtasks ?? []).map((s: any) => ({
                ...s,
                id: s._id,
              }))}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <CommentThread
              projectId={projectId}
              taskId={taskId}
              comments={comments}
            />
          </section>
        </div>

        {/* Right column: time, dependencies, AI */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <TimeEntryForm
              projectId={projectId}
              taskId={taskId}
              entries={entries}
              totalMinutes={totalMinutes}
            />
          </section>

          {deps.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                Depends on
              </h4>
              <ul className="space-y-1">
                {deps.map((d: any) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        d.depStatus === "done" ? "bg-emerald-400" : "bg-yellow-400",
                      )}
                    />
                    <Link
                      href={`/dashboard/projects/${projectId}/tasks/${d.dependsOnTaskId}`}
                      className="text-foreground hover:underline"
                    >
                      {d.depTitle}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      ({statusLabels[d.depStatus] ?? d.depStatus})
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {blockedByThis.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                Blocks
              </h4>
              <ul className="space-y-1">
                {blockedByThis.map((b: any) => (
                  <li key={b.id} className="text-sm">
                    <Link
                      href={`/dashboard/projects/${projectId}/tasks/${b.taskId}`}
                      className="text-foreground hover:underline"
                    >
                      {b.taskTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {latestBotTask ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground">
                Bot Assignment
              </h4>
              <div className="text-sm">
                <span className="text-muted-foreground">Bot: </span>
                <span className="font-medium text-foreground">{latestBotTask.botName}</span>
                <span className="ml-2 text-xs text-muted-foreground">({latestBotTask.status})</span>
              </div>
              {latestBotTask.outputSummary ? (
                <p className="text-xs text-muted-foreground">{latestBotTask.outputSummary}</p>
              ) : null}
              <ArtifactLinks links={artifactLinks} />
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <ActivityTimeline projectId={projectId} taskId={taskId} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h4 className="mb-3 text-xs font-semibold text-muted-foreground">
              AI Tools
            </h4>
            <DecomposeButton projectId={projectId} taskId={taskId} />
          </section>
        </div>
      </div>
    </div>
  );
}
