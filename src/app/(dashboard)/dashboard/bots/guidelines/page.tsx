"use client";

import Link from "next/link";

import { GuidelinesForm } from "@/components/bots/guidelines-form";
import { useCRPC } from "@/lib/convex/crpc";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export default function BotGuidelinesPage() {
  const crpc = useCRPC();
  const guidelinesQuery = crpc.botGuidelines.list.useQuery({});
  const meQuery = crpc.users.me.useQuery({});

  if (guidelinesQuery.isPending || meQuery.isPending) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const isAdmin = meQuery.data?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Bot Guidelines
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You do not have permission to manage bot guidelines.
          </p>
        </div>
      </div>
    );
  }

  const guidelines = guidelinesQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Bot Guidelines
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define guidelines that bots must acknowledge before receiving tasks.
          </p>
        </div>
        <Link
          href="/dashboard/bots"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to Bots
        </Link>
      </div>

      {/* Create form */}
      {isAdmin ? (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold tracking-tight">
            Create Guideline
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            New bots will need to acknowledge all guidelines before they can
            receive tasks.
          </p>
          <div className="mt-4">
            <GuidelinesForm />
          </div>
        </div>
      ) : null}

      {/* Guidelines list */}
      {guidelines.length ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight">
            Existing Guidelines ({guidelines.length})
          </h3>
          <div className="grid gap-4">
            {guidelines.map((g) => (
              <div
                key={g._id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-foreground">
                      {g.title}
                    </h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {truncate(g.content, 300)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
                    v{g.version}
                  </span>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  Created {formatDate(g._creationTime)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <h3 className="text-sm font-semibold">No guidelines yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first guideline above. Bots will need to acknowledge
            guidelines before they can receive tasks.
          </p>
        </div>
      )}
    </div>
  );
}
