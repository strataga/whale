export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Invite form placeholder */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="flex gap-3">
            <div className="h-11 flex-1 animate-pulse rounded-lg bg-muted" />
            <div className="h-11 w-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>

      {/* User list */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-44 animate-pulse rounded bg-muted" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
                <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
