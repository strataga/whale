"use client";

import { useMemo } from "react";
import Link from "next/link";

import { useCRPC } from "@/lib/convex/crpc";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductsPage() {
  const crpc = useCRPC();
  const productsQuery = crpc.products.list.useQuery({});
  const agentsQuery = crpc.agents.list.useQuery({});

  const isPending = productsQuery.isPending || agentsQuery.isPending;

  const agentNameMap = useMemo(
    () =>
      new Map<string, string>(
        (agentsQuery.data ?? []).map((a: any) => [a._id, a.name] as [string, string]),
      ),
    [agentsQuery.data],
  );

  const products = useMemo(() => {
    const raw = productsQuery.data ?? [];
    return [...raw].sort((a, b) => b._creationTime - a._creationTime);
  }, [productsQuery.data]);

  if (isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Product Catalog
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} products available via ACP checkout.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/dashboard/commerce"
            className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
          >
            Back to Commerce
          </Link>
        </div>
      </div>

      {products.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p: any) => (
            <div
              key={p._id}
              className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-cyan-500/20"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    by {agentNameMap.get(p.agentId) ?? "Unknown Agent"}
                  </p>
                </div>
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full mt-1.5 ${p.active ? "bg-emerald-400" : "bg-muted-foreground"}`}
                  title={p.active ? "Active" : "Inactive"}
                />
              </div>

              {/* Description */}
              {p.description && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              )}

              {/* Price + model */}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <span className="text-xl font-semibold tracking-tight">
                    {formatCents(p.priceCents)}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {p.currency}
                  </span>
                </div>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {p.pricingModel}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-muted-foreground" stroke="currentColor" strokeWidth="1.5">
              <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h4 className="mt-4 text-sm font-semibold">No products yet</h4>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            Create agent products to sell skills via the Agent Commerce Protocol.
          </p>
        </div>
      )}
    </div>
  );
}
