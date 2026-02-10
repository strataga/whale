"use client";

import { useMemo } from "react";
import Link from "next/link";

import { useCRPC } from "@/lib/convex/crpc";

function getAgeInfo(createdAt: number): { label: string; color: string } {
  const now = Date.now();
  const ageMs = now - createdAt;
  const hours = ageMs / (1000 * 60 * 60);

  if (hours < 1) {
    const mins = Math.round(ageMs / (1000 * 60));
    return { label: `${mins}m ago`, color: "text-emerald-400" };
  }
  if (hours < 24) {
    return { label: `${Math.round(hours)}h ago`, color: "text-amber-400" };
  }
  const days = Math.round(hours / 24);
  return { label: `${days}d ago`, color: "text-rose-400" };
}

export default function NegotiationsPage() {
  const crpc = useCRPC();
  const tasksQuery = crpc.tasks.list.useQuery({ status: "negotiating" });
  const agentsQuery = crpc.agents.list.useQuery({});
  const projectsQuery = crpc.projects.list.useQuery({});

  const isPending =
    tasksQuery.isPending || agentsQuery.isPending || projectsQuery.isPending;

  const agentMap = useMemo(
    () =>
      new Map<string, string>(
        (agentsQuery.data ?? []).map((a: any) => [a._id, a.name] as [string, string]),
      ),
    [agentsQuery.data],
  );

  const projectMap = useMemo(
    () =>
      new Map<string, string>(
        (projectsQuery.data ?? []).map((p: any) => [p._id, p.name] as [string, string]),
      ),
    [projectsQuery.data],
  );

  const negotiatingTasks = useMemo(() => {
    const raw = tasksQuery.data ?? [];
    return [...raw].sort((a, b) => b._creationTime - a._creationTime);
  }, [tasksQuery.data]);

  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    critical: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    high: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    medium: "border-blue-400/30 bg-blue-400/10 text-blue-300",
    low: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Active Negotiations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {negotiatingTasks.length} tasks awaiting terms approval from external agents.
          </p>
        </div>

        <Link
          href="/dashboard/economy"
          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Economy Overview
        </Link>
      </div>

      {negotiatingTasks.length ? (
        <div className="space-y-3">
          {negotiatingTasks.map((t) => {
            const age = getAgeInfo(t._creationTime);
            const agentName = t.sourceAgentId
              ? agentMap.get(t.sourceAgentId) ?? t.sourceAgentId.slice(0, 8)
              : "Unknown";
            const projectName = t.projectId
              ? projectMap.get(t.projectId) ?? null
              : null;

            return (
              <div
                key={t._id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-cyan-500/20"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: task info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityColors[t.priority] ?? priorityColors.medium}`}
                      >
                        {t.priority}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {/* Agent */}
                      <span className="flex items-center gap-1">
                        <span className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 grid place-items-center text-[8px] font-bold text-cyan-400">
                          {agentName.charAt(0).toUpperCase()}
                        </span>
                        {agentName}
                      </span>

                      {/* Protocol */}
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold">
                        {t.sourceProtocol ?? "direct"}
                      </span>

                      {/* Project */}
                      {projectName && (
                        <span>{projectName}</span>
                      )}

                      {/* Age */}
                      <span className={`font-medium ${age.color}`}>
                        {age.label}
                      </span>
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/negotiations/${t._id}/accept`}
                      className="inline-flex min-h-[32px] items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      Accept
                    </Link>
                    <Link
                      href={`/dashboard/negotiations/${t._id}/reject`}
                      className="inline-flex min-h-[32px] items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                      Reject
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" stroke="currentColor" strokeWidth="1.5">
              <path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h4 className="mt-4 text-sm font-semibold">No active negotiations</h4>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            Negotiations appear here when external agents propose terms for task
            execution. Discover agents to start receiving proposals.
          </p>
          <div className="mt-5">
            <Link
              href="/dashboard/agents/discover"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-5 py-2.5 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            >
              Discover Agent
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
