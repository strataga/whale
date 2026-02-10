"use client";

import * as React from "react";
import { Monitor, Smartphone, Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/convex/auth-client";

interface Session {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastActiveAt: number;
  revokedAt: number | null;
  createdAt: number;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function DeviceIcon({ info }: { info: string | null }) {
  const isMobile =
    info && /mobile|iphone|android|ipad/i.test(info);
  return isMobile ? (
    <Smartphone className="h-4 w-4 text-muted-foreground" />
  ) : (
    <Monitor className="h-4 w-4 text-muted-foreground" />
  );
}

export function SessionsList() {
  const { toast } = useToast();

  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await authClient.listSessions();
        const list = (data as any)?.data ?? data ?? [];
        setSessions(
          Array.isArray(list)
            ? list.map((s: any) => ({
                id: s.id ?? s._id,
                deviceInfo: s.deviceInfo ?? s.userAgent ?? null,
                ipAddress: s.ipAddress ?? null,
                lastActiveAt: s.lastActiveAt ?? s.updatedAt ?? s.createdAt ?? Date.now(),
                revokedAt: s.revokedAt ?? null,
                createdAt: s.createdAt ?? s._creationTime ?? Date.now(),
              }))
            : [],
        );
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleRevoke(id: string) {
    try {
      await authClient.revokeSession({ id } as any);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, revokedAt: Date.now() } : s,
        ),
      );
      toast("Session revoked.", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to revoke session.", "error");
    }
  }

  async function handleRevokeAll() {
    try {
      await authClient.revokeSessions();
      setSessions((prev) =>
        prev.map((s) => ({ ...s, revokedAt: s.revokedAt ?? Date.now() })),
      );
      toast("All other sessions revoked.", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to revoke sessions.", "error");
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const activeSessions = sessions.filter((s) => !s.revokedAt);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Sessions</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your active sessions across devices.
          </p>
        </div>
        {activeSessions.length > 1 && (
          <button
            type="button"
            onClick={handleRevokeAll}
            className="text-xs font-medium text-rose-400 hover:text-rose-300"
          >
            Revoke All Others
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No sessions found.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <DeviceIcon info={session.deviceInfo} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {session.deviceInfo || "Unknown device"}
                  </span>
                  {session.revokedAt && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Revoked
                    </span>
                  )}
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  {session.ipAddress && <span>{session.ipAddress}</span>}
                  <span>Last active {timeAgo(session.lastActiveAt)}</span>
                </div>
              </div>
              {!session.revokedAt && (
                <button
                  type="button"
                  onClick={() => handleRevoke(session.id)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400"
                  aria-label="Revoke session"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
