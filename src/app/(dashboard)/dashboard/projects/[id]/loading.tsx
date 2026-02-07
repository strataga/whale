export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Project header */}
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-6 w-20 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-11 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-11 w-28 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Task filters placeholder */}
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted" />

      {/* Task stats */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-14 animate-pulse rounded bg-muted" />
            <div className="h-3 w-8 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="h-20 animate-pulse rounded-2xl border border-border bg-background" />
          <div className="h-20 animate-pulse rounded-2xl border border-border bg-background" />
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-3 w-44 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-11 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="mt-5 space-y-3">
                {Array.from({ length: 2 }).map((__, j) => (
                  <div
                    key={j}
                    className="h-20 animate-pulse rounded-xl border border-border bg-background"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Backlog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded-lg bg-muted" />
            <div className="h-3 w-40 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-11 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
