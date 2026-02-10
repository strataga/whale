"use client";

import * as React from "react";
import { DollarSign, Zap } from "lucide-react";
import { useCRPC } from "@/lib/convex/crpc";

export default function CostsPage() {
  const crpc = useCRPC();

  const budgetsQuery = crpc.costBudgets.list.useQuery();
  const aiStatsQuery = crpc.aiUsage.stats.useQuery();
  const aiLogsQuery = crpc.aiUsage.list.useQuery({});

  const isLoading = budgetsQuery.isPending || aiStatsQuery.isPending || aiLogsQuery.isPending;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const aiStats = aiStatsQuery.data;
  const totalTokens = aiStats?.totalTokens ?? 0;
  const totalCost = (aiStats?.totalCost ?? 0) / 100; // costCents to dollars
  const budgets = budgetsQuery.data ?? [];
  const primaryBudget = budgets[0];
  const budgetLimit = primaryBudget ? primaryBudget.limitCents / 100 : null;
  const budgetUtilization = budgetLimit
    ? ((aiStats?.totalCost ?? 0) / primaryBudget.limitCents) * 100
    : 0;

  const operations = (aiLogsQuery.data ?? []).map((op) => ({
    id: op._id,
    operation: op.feature,
    provider: op.provider,
    model: op.model,
    tokens: (op.inputTokens ?? 0) + (op.outputTokens ?? 0),
    cost: (op.costCents ?? 0) / 100,
    createdAt: op._creationTime,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">
          Cost & AI Usage
        </h2>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Zap className="h-4 w-4" />
            Total Tokens
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {totalTokens.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Total Cost
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            ${totalCost.toFixed(2)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Budget Utilization
          </p>
          <p
            className={`mt-2 text-3xl font-semibold tracking-tight ${
              budgetUtilization > 90
                ? "text-rose-400"
                : budgetUtilization > 75
                  ? "text-amber-400"
                  : ""
            }`}
          >
            {budgetUtilization.toFixed(1)}%
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold">Recent AI Operations</h3>

        {operations.length === 0 ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No AI operations recorded yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="pb-2 pr-4">Operation</th>
                  <th className="pb-2 pr-4">Provider</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4">Tokens</th>
                  <th className="pb-2 pr-4">Cost</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {operations.map((op) => {
                  const date = new Date(op.createdAt);
                  const timeStr = date.toLocaleString();

                  return (
                    <tr key={op.id}>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {op.operation}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {op.provider}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {op.model}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {op.tokens.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        ${op.cost.toFixed(4)}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {timeStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
