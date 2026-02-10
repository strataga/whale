"use client";

import { useMemo } from "react";

import { EconomyOverview } from "@/components/commerce/economy-overview";
import { useCRPC } from "@/lib/convex/crpc";

export default function EconomyPage() {
  const crpc = useCRPC();
  const agentsQuery = crpc.agents.list.useQuery({});
  const sessionsQuery = crpc.checkout.list.useQuery({});
  const tasksQuery = crpc.tasks.list.useQuery({ limit: 200 });
  const x402Query = crpc.x402.list.useQuery({});

  const isPending =
    agentsQuery.isPending ||
    sessionsQuery.isPending ||
    tasksQuery.isPending ||
    x402Query.isPending;

  const stats = useMemo(() => {
    const agents = agentsQuery.data ?? [];
    const sessions = sessionsQuery.data ?? [];
    const tasks = tasksQuery.data ?? [];
    const x402Txns = x402Query.data ?? [];

    const localAgents = agents.filter((a) => a.type === "local").length;
    const externalAgents = agents.filter((a) => a.type === "external").length;

    const activeNegotiations = tasks.filter((t) => t.status === "negotiating").length;

    const checkoutRevenue = sessions
      .filter((s) => s.status === "settled")
      .reduce((sum, s) => sum + s.totalCents, 0);

    const x402Revenue = x402Txns
      .filter((t) => t.status === "settled")
      .reduce((sum, t) => sum + Math.round(parseFloat(t.amount) * 100), 0);

    const totalRevenueCents = checkoutRevenue + x402Revenue;

    // Tasks by source protocol
    const protocolMap = new Map<string, number>();
    for (const t of tasks) {
      if (t.sourceAgentId) {
        const protocol = t.sourceProtocol ?? "direct";
        protocolMap.set(protocol, (protocolMap.get(protocol) ?? 0) + 1);
      }
    }
    const tasksByProtocol = Array.from(protocolMap.entries()).map(
      ([protocol, count]) => ({ protocol, count }),
    );

    return {
      localAgents,
      externalAgents,
      activeNegotiations,
      totalRevenueCents,
      tasksByProtocol,
    };
  }, [agentsQuery.data, sessionsQuery.data, tasksQuery.data, x402Query.data]);

  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Economy Overview
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Agent network, negotiations, and protocol-level task distribution.
        </p>
      </div>

      <EconomyOverview stats={stats} />
    </div>
  );
}
