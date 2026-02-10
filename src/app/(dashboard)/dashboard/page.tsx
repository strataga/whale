"use client";

import Link from "next/link";

import { ActivityStream } from "@/components/dashboard/activity-stream";
import { ProjectCard } from "@/components/projects/project-card";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { RiskScan } from "@/components/ui/risk-scan";
import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

export default function DashboardHomePage() {
  const { toast } = useToast();
  const crpc = useCRPC();
  const statsQuery = crpc.dashboard.stats.useQuery({});
  const activityQuery = crpc.dashboard.activityFeed.useQuery({ limit: 10 });
  const projectsQuery = crpc.projects.list.useQuery({});
  const myTasksQuery = crpc.tasks.list.useQuery({ assignedToMe: true, status: "open" });
  const recommendedQuery = crpc.dashboard.recommendedActions.useQuery({ limit: 3 });
  const assignBotTask = crpc.botTasks.assign.useMutation();

  const isLoading =
    statsQuery.isPending ||
    activityQuery.isPending ||
    projectsQuery.isPending ||
    recommendedQuery.isPending;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const stats = statsQuery.data;
  const recentActivity = activityQuery.data ?? [];
  const allProjects = projectsQuery.data ?? [];
  const recommended = recommendedQuery.data?.items ?? [];
  const recentProjects = allProjects.slice(0, 6);
  const myTasks = (myTasksQuery.data ?? []).slice(0, 5);

  const onlineAgents = stats?.onlineAgents ?? 0;
  const totalAgents = stats?.totalAgents ?? 0;
  const activeNegotiations = stats?.activeNegotiations ?? 0;
  const tasksInFlight = stats?.tasksInFlight ?? 0;
  const revenueToday = (stats?.revenueToday ?? 0) / 100;
  const activeProjects = stats?.activeProjects ?? 0;
  const completedThisWeek = stats?.completedThisWeek ?? 0;
  const onlineBots = stats?.onlineBots ?? 0;

  async function sendToBot(item: any) {
    const botId = item.suggestedBotId as string | null;
    if (!botId) return;
    try {
      await assignBotTask.mutateAsync({ botId, taskId: item.taskId });
      toast(`Sent to ${item.suggestedBotName ?? "bot"}.`, "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to assign task to bot.", "error");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {stats?.workspaceName ?? "Your workspace"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Mission Control
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back. Here&apos;s your agent economy at a glance.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/dashboard/agents/discover"
            className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-1.5 text-sm font-medium text-cyan-400 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
          >
            Discover Agent
          </Link>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex min-h-[36px] items-center justify-center rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            New Project
          </Link>
        </div>
      </div>

      {/* Economy stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm card-gradient-blue">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Agents Online</p>
            <div className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                {onlineAgents > 0 && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${onlineAgents > 0 ? "bg-emerald-400" : "bg-muted-foreground"}`} />
              </span>
            </div>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {onlineAgents}
            <span className="text-sm font-normal text-muted-foreground">/{totalAgents}</span>
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm card-gradient-cyan">
          <p className="text-xs font-semibold text-muted-foreground">Active Negotiations</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {activeNegotiations}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm card-gradient-emerald">
          <p className="text-xs font-semibold text-muted-foreground">Tasks in Flight</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {tasksInFlight}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm card-gradient-amber">
          <p className="text-xs font-semibold text-muted-foreground">Revenue (24h)</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            ${revenueToday.toFixed(2)}
          </p>
        </div>
      </section>

      {/* Secondary stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/projects" className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-blue-500/20 transition-colors">
          <p className="text-xs font-semibold text-muted-foreground">Active Projects</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {activeProjects}
          </p>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Completed (7d)</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {completedThisWeek}
          </p>
        </div>
        <Link href="/dashboard/bots" className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-emerald-500/20 transition-colors">
          <p className="text-xs font-semibold text-muted-foreground">Online Bots</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {onlineBots}
          </p>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">Quick Actions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link
              href="/dashboard/economy"
              className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
            >
              Economy
            </Link>
            <Link
              href="/dashboard/negotiations"
              className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
            >
              Negotiations
            </Link>
            <Link
              href="/dashboard/commerce/products"
              className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
            >
              Products
            </Link>
          </div>
        </div>
      </section>

      {myTasks.length > 0 ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold tracking-tight">My Open Tasks</h3>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {myTasks.map((t: any) => {
                const isOverdue = t.dueDate && t.dueDate < Date.now();
                return (
                  <li key={t._id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.title}</span>
                        {isOverdue ? (
                          <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {t.priority}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {recommended.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Recommended</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Priority actions to delegate next.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {recommended.map((item: any) => {
              const due =
                item.dueDate ? new Date(item.dueDate).toLocaleDateString() : null;
              const disabled =
                !item.suggestedBotId || assignBotTask.isPending;

              return (
                <div
                  key={item.taskId}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-muted-foreground">
                        {item.projectName}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-foreground">
                        {item.title}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {item.reason}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 font-semibold">
                      {item.priority}
                    </span>
                    {due ? (
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 font-semibold">
                        Due {due}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => sendToBot(item)}
                      disabled={disabled}
                      className="inline-flex w-full min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {item.suggestedBotName
                        ? `Send to ${item.suggestedBotName}`
                        : "No online bot"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold tracking-tight">Recent Activity</h3>
          <Link
            href="/dashboard/audit-log"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View audit log
          </Link>
        </div>

        <ActivityFeed items={recentActivity} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">
            Recent Projects
          </h3>
          <Link
            href="/dashboard/projects"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>

        {recentProjects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project: any) => (
              <ProjectCard
                key={project._id}
                project={project}
                taskCount={0}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <h4 className="text-sm font-semibold">No projects yet</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with a goal. Whale will help you break it down into
              milestones and tasks.
            </p>
            <div className="mt-5">
              <Link
                href="/dashboard/projects/new"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Create your first project
              </Link>
            </div>
          </div>
        )}
      </section>

      <RiskScan />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-tight">Live Activity</h3>
        <ActivityStream />
      </section>
    </div>
  );
}
