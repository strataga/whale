"use client";

import { useState } from "react";

import { BotCard } from "@/components/bots/bot-card";
import { PairingTokenModal } from "@/components/bots/pairing-token-modal";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

const DEFAULT_LIMIT = 12;

export default function BotsPage() {
  const crpc = useCRPC();
  const botsQuery = crpc.bots.list.useQuery({});
  const meQuery = crpc.users.me.useQuery({});

  const [page, setPage] = useState(1);

  if (botsQuery.isPending || meQuery.isPending) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const isAdmin = meQuery.data?.role === "admin";
  const allBots = botsQuery.data ?? [];
  const total = allBots.length;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_LIMIT));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * DEFAULT_LIMIT;
  const rows = allBots.slice(offset, offset + DEFAULT_LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bots</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            OpenClaw bots connected to this workspace.
          </p>
        </div>

        {isAdmin ? <PairingTokenModal /> : null}
      </div>

      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((bot) => (
            <BotCard key={bot._id} bot={{ ...bot, id: bot._id }} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <h3 className="text-sm font-semibold">No bots connected</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Pair an OpenClaw bot to start delegating tasks from Whale.
          </p>
          {isAdmin ? (
            <div className="mt-5 flex justify-center">
              <PairingTokenModal />
            </div>
          ) : null}
        </div>
      )}

      {totalPages > 1 ? (
        <ClientPagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

/* ---------- Client-side pagination ---------- */

function ClientPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const baseButtonClass =
    "inline-flex min-h-[36px] items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  function getPageNumbers(): (number | "ellipsis")[] {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <button
        disabled={isFirst}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          baseButtonClass,
          isFirst
            ? "cursor-not-allowed border-border bg-card text-muted-foreground opacity-50"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        Previous
      </button>

      {getPageNumbers().map((item, idx) => {
        if (item === "ellipsis") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex min-h-[36px] items-center justify-center px-2 text-sm text-muted-foreground"
            >
              ...
            </span>
          );
        }

        const isCurrent = item === page;
        return (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              baseButtonClass,
              isCurrent
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {item}
          </button>
        );
      })}

      <button
        disabled={isLast}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          baseButtonClass,
          isLast
            ? "cursor-not-allowed border-border bg-card text-muted-foreground opacity-50"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        Next
      </button>
    </nav>
  );
}
