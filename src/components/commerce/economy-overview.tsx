"use client";

import Link from "next/link";
import { Network, TrendingUp, Handshake, DollarSign } from "lucide-react";

interface EconomyStats {
  localAgents: number;
  externalAgents: number;
  activeNegotiations: number;
  totalRevenueCents: number;
  tasksByProtocol: { protocol: string; count: number }[];
}

const protocolColors: Record<string, string> = {
  a2a: "bg-blue-400",
  mcp: "bg-emerald-400",
  x402: "bg-amber-400",
  direct: "bg-muted-foreground",
};

function getProtocolColor(protocol: string): string {
  return protocolColors[protocol.toLowerCase()] ?? "bg-cyan-400";
}

export function EconomyOverview({ stats }: { stats: EconomyStats }) {
  const totalAgents = stats.localAgents + stats.externalAgents;
  const maxProtocolCount = Math.max(...stats.tasksByProtocol.map((r) => r.count), 1);

  const cards = [
    {
      label: "Local Agents",
      value: stats.localAgents,
      icon: Network,
      gradient: "card-gradient-blue",
    },
    {
      label: "External Agents",
      value: stats.externalAgents,
      icon: TrendingUp,
      gradient: "card-gradient-cyan",
    },
    {
      label: "Active Negotiations",
      value: stats.activeNegotiations,
      icon: Handshake,
      gradient: "card-gradient-emerald",
    },
    {
      label: "Total Revenue",
      value: `$${(stats.totalRevenueCents / 100).toFixed(2)}`,
      icon: DollarSign,
      gradient: "card-gradient-amber",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-2xl border bg-card p-5 shadow-sm ${card.gradient}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {card.label}
                </p>
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Protocol distribution */}
      {stats.tasksByProtocol.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">
            Protocol Distribution
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tasks by source protocol
          </p>
          <div className="mt-5 space-y-3">
            {stats.tasksByProtocol.map((row) => {
              const pct = Math.round((row.count / maxProtocolCount) * 100);
              return (
                <div key={row.protocol}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{row.protocol || "direct"}</span>
                    <span className="text-xs text-muted-foreground">{row.count} tasks</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full progress-bar-fill ${getProtocolColor(row.protocol)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent fleet overview */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Agent Fleet</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalAgents} agents registered
            </p>
          </div>
          <Link
            href="/dashboard/agents"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-muted-foreground">Local</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight">{stats.localAgents}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-xs font-medium text-muted-foreground">External</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight">{stats.externalAgents}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/agents/discover"
          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-4 py-1.5 text-sm font-medium text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          Discover Agent
        </Link>
        <Link
          href="/dashboard/commerce/products"
          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          View Products
        </Link>
        <Link
          href="/dashboard/negotiations"
          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          View Negotiations
        </Link>
      </div>
    </div>
  );
}
