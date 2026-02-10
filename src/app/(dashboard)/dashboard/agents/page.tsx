"use client";

import { useMemo } from "react";
import Link from "next/link";

import { useCRPC } from "@/lib/convex/crpc";

export default function AgentsPage() {
  const crpc = useCRPC();
  const agentsQuery = crpc.agents.list.useQuery({});

  const isPending = agentsQuery.isPending;

  const allAgents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);

  // Skills are fetched per-agent inside the AgentCard component below,
  // since agentSkills.list requires a specific agentId.

  const typeBadgeColors: Record<string, string> = {
    local: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    external: "border-blue-400/30 bg-blue-400/10 text-blue-400",
    hybrid: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  };

  const statusDotColors: Record<string, string> = {
    online: "bg-emerald-400",
    offline: "bg-muted-foreground",
    error: "bg-rose-400",
  };

  function reputationColor(rep: number): string {
    if (rep >= 80) return "bg-emerald-400";
    if (rep >= 50) return "bg-cyan-400";
    if (rep >= 30) return "bg-amber-400";
    return "bg-rose-400";
  }

  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const onlineCount = allAgents.filter((a) => a.status === "online").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Agent Registry
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {allAgents.length} agents registered
            {onlineCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-400">{onlineCount} online</span>
              </span>
            )}
          </p>
        </div>

        <Link
          href="/dashboard/agents/discover"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-5 py-2.5 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
        >
          Discover Agent
        </Link>
      </div>

      {allAgents.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allAgents.map((agent) => (
            <AgentCard
              key={agent._id}
              agent={agent}
              typeBadgeColors={typeBadgeColors}
              statusDotColors={statusDotColors}
              reputationColor={reputationColor}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h4 className="mt-4 text-sm font-semibold">No agents registered</h4>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            Register your first agent by linking a local bot or discovering an
            external A2A agent from the network.
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

function AgentCard({
  agent,
  typeBadgeColors,
  statusDotColors,
  reputationColor,
}: {
  agent: any;
  typeBadgeColors: Record<string, string>;
  statusDotColors: Record<string, string>;
  reputationColor: (rep: number) => string;
}) {
  const crpc = useCRPC();
  const skillsQuery = crpc.agentSkills.list.useQuery({ agentId: agent._id });
  const skills = useMemo(() => (skillsQuery.data ?? []).map((s) => s.name), [skillsQuery.data]);

  const displaySkills = skills.slice(0, 4);
  const extraSkills = skills.length - 4;

  return (
    <div
      className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-cyan-500/20"
    >
      {/* Header: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-xs font-bold text-cyan-400">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
              <span className="text-[10px] text-muted-foreground">
                v{agent.protocolVersion}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeBadgeColors[agent.type] ?? typeBadgeColors.local}`}
          >
            {agent.type}
          </span>
          <span className="relative flex h-2.5 w-2.5" title={agent.status}>
            {agent.status === "online" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusDotColors[agent.status] ?? statusDotColors.offline}`} />
          </span>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {agent.description}
        </p>
      )}

      {/* Reputation bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground">Reputation</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {agent.reputation}/100
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full progress-bar-fill ${reputationColor(agent.reputation)}`}
            style={{ width: `${agent.reputation}%` }}
          />
        </div>
      </div>

      {/* Skills tags */}
      {displaySkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {displaySkills.map((skill) => (
            <span
              key={skill}
              className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {skill}
            </span>
          ))}
          {extraSkills > 0 && (
            <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{extraSkills}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
