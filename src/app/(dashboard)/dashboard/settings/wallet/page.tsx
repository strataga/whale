"use client";

import { useMemo } from "react";

import { useCRPC } from "@/lib/convex/crpc";

function maskAddress(addr: string | undefined | null): string {
  if (!addr) return "Not configured";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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

export default function WalletSettingsPage() {
  const crpc = useCRPC();

  const { data: workspace, isPending: workspacePending } =
    crpc.workspaces.get.useQuery({});
  const { data: paymentProvidersList, isPending: providersPending } =
    crpc.paymentProviders.list.useQuery({});
  const { data: x402Txns, isPending: txnsPending } =
    crpc.x402.list.useQuery({});

  const isPending = workspacePending || providersPending || txnsPending;

  const stripeProvider = useMemo(() => {
    if (!paymentProvidersList) return null;
    return paymentProvidersList.find((p: any) => p.type === "stripe") ?? null;
  }, [paymentProvidersList]);

  const walletAddress = workspace?.walletAddress ?? null;

  const txStats = useMemo(() => {
    if (!x402Txns) return { total: 0, settled: 0, totalAmount: 0 };
    const total = x402Txns.length;
    const settled = x402Txns.filter((t: any) => t.status === "settled").length;
    const totalAmount = x402Txns
      .filter((t: any) => t.status === "settled")
      .reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);
    return { total, settled, totalAmount };
  }, [x402Txns]);

  const recentTx = useMemo(() => {
    if (!x402Txns) return [];
    return x402Txns.slice(0, 10);
  }, [x402Txns]);

  const statusColors: Record<string, string> = {
    authorized: "border-blue-400/30 bg-blue-400/10 text-blue-300",
    settled: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    disputed: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    refunded: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  };

  if (isPending) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Wallet Settings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            x402 wallet configuration and payment provider status.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[220px] animate-pulse rounded-2xl border border-border bg-muted" />
          <div className="h-[220px] animate-pulse rounded-2xl border border-border bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[100px] animate-pulse rounded-2xl border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Wallet Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          x402 wallet configuration and payment provider status.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">
            x402 Wallet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            On-chain wallet for receiving x402 micropayments.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Wallet address
              </span>
              <span className="font-mono text-sm">
                {maskAddress(walletAddress)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                x402 Enabled
              </span>
              <span className="text-sm">
                {workspace?.x402Enabled ? "Yes" : "No"}
              </span>
            </div>
          </div>

          {!walletAddress && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-xs text-amber-300">
                Configure a wallet address in your workspace settings to enable x402 payments.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">
            Stripe Connection
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Fiat payment processing for ACP checkout sessions.
          </p>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span
                className={`text-sm font-medium ${stripeProvider ? "text-emerald-400" : "text-muted-foreground"}`}
              >
                {stripeProvider ? "Connected" : "Not connected"}
              </span>
            </div>
            {stripeProvider && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Provider status
                </span>
                <span className="text-sm">
                  {stripeProvider.enabled ? "Active" : "Disabled"}
                </span>
              </div>
            )}
          </div>

          {!stripeProvider && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-xs text-amber-300">
                Add a Stripe payment provider in your payment settings to enable fiat payments.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Total x402 transactions
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {txStats.total}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Settled transactions
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {txStats.settled}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Settled volume
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            ${txStats.totalAmount.toFixed(2)}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-tight">
          Recent x402 transactions
        </h3>

        {recentTx.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Payer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Network
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTx.map((tx: any) => (
                    <tr key={tx._id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        {(tx._id as string).slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {maskAddress(tx.payerAddress)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColors[tx.status] ?? "border-border bg-muted text-muted-foreground"}`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {tx.amount} {tx.asset}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {tx.network}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(tx._creationTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            No x402 transactions yet.
          </div>
        )}
      </section>
    </div>
  );
}
