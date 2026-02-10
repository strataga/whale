"use client";

import { useMemo } from "react";
import Link from "next/link";

import { useCRPC } from "@/lib/convex/crpc";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CommercePage() {
  const crpc = useCRPC();
  const sessionsQuery = crpc.checkout.list.useQuery({});
  const ordersQuery = crpc.orders.list.useQuery({});
  const productsQuery = crpc.products.list.useQuery({});
  const x402Query = crpc.x402.list.useQuery({});

  const isPending =
    sessionsQuery.isPending ||
    ordersQuery.isPending ||
    productsQuery.isPending ||
    x402Query.isPending;

  const { checkoutRevenue, x402Revenue, totalRevenue, activeProductCount, pendingOrderCount, recentSessions } =
    useMemo(() => {
      const sessions = sessionsQuery.data ?? [];
      const orders = ordersQuery.data ?? [];
      const products = productsQuery.data ?? [];
      const x402Txns = x402Query.data ?? [];

      const ckRev = sessions
        .filter((s) => s.status === "settled")
        .reduce((sum, s) => sum + s.totalCents, 0);

      const x4Rev = x402Txns
        .filter((t) => t.status === "settled")
        .reduce((sum, t) => sum + Math.round(parseFloat(t.amount) * 100), 0);

      return {
        checkoutRevenue: ckRev,
        x402Revenue: x4Rev,
        totalRevenue: ckRev + x4Rev,
        activeProductCount: products.filter((p) => p.active).length,
        pendingOrderCount: orders.filter((o) => o.status === "pending_fulfillment").length,
        recentSessions: [...sessions]
          .sort((a, b) => b._creationTime - a._creationTime)
          .slice(0, 10),
      };
    }, [sessionsQuery.data, ordersQuery.data, productsQuery.data, x402Query.data]);

  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    open: "border-blue-400/30 bg-blue-400/10 text-blue-300",
    settled: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    disputed: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    expired: "border-muted-foreground/30 bg-muted text-muted-foreground",
    refunded: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  };

  // Revenue breakdown bars
  const maxRevenue = Math.max(checkoutRevenue, x402Revenue, 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Commerce</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue, products, and transaction history.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/dashboard/commerce/products"
            className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
          >
            View Products
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm card-gradient-emerald">
          <p className="text-xs font-semibold text-muted-foreground">
            Total Revenue
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {formatCents(totalRevenue)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm card-gradient-blue">
          <p className="text-xs font-semibold text-muted-foreground">
            Active Products
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {activeProductCount}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm card-gradient-amber">
          <p className="text-xs font-semibold text-muted-foreground">
            Pending Orders
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {pendingOrderCount}
          </p>
        </div>
      </section>

      {/* Revenue breakdown */}
      {totalRevenue > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Revenue Breakdown</h3>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">Checkout (ACP)</span>
                <span className="text-xs text-muted-foreground">{formatCents(checkoutRevenue)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 progress-bar-fill"
                  style={{ width: `${Math.round((checkoutRevenue / maxRevenue) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">x402 Micropayments</span>
                <span className="text-xs text-muted-foreground">{formatCents(x402Revenue)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 progress-bar-fill"
                  style={{ width: `${Math.round((x402Revenue / maxRevenue) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent transactions */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-tight">
          Recent Transactions
        </h3>

        {recentSessions.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentSessions.map((s) => (
                    <tr key={s._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        {s._id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColors[s.status] ?? statusColors.open}`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatCents(s.totalCents)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(s._creationTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            No transactions yet. Revenue will appear here when agents complete checkout sessions.
          </div>
        )}
      </section>
    </div>
  );
}
