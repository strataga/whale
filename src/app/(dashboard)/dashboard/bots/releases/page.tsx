"use client";

import Link from "next/link";

import { ReleaseForm } from "@/components/bots/release-form";
import { useCRPC } from "@/lib/convex/crpc";

function formatDateTime(ts?: number | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReleasesPage() {
  const crpc = useCRPC();
  const releasesQuery = crpc.botReleaseNotes.list.useQuery({});
  const meQuery = crpc.users.me.useQuery({});

  if (releasesQuery.isPending || meQuery.isPending) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const isAdmin = meQuery.data?.role === "admin";
  const releases = releasesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/dashboard/bots"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            &larr; Bots
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Release Notes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage bot release notes and version history.
          </p>
        </div>
      </div>

      {isAdmin ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">
            Create release note
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish a new release version for bots in this workspace.
          </p>
          <div className="mt-5">
            <ReleaseForm />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">All releases</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Published release notes, newest first.
        </p>

        {releases.length ? (
          <div className="mt-5 space-y-3">
            {releases.map((release) => (
              <div
                key={release._id}
                className="rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground">
                        v{release.version}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {release.title}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {release.body}
                    </div>
                    {release.releaseUrl ? (
                      <a
                        href={release.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        View release &rarr;
                      </a>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(release._creationTime) ?? "\u2014"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border bg-background p-6 text-sm text-muted-foreground">
            No release notes yet.
          </div>
        )}
      </section>
    </div>
  );
}
