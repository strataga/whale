"use client";

import * as React from "react";
import { Bell } from "lucide-react";

import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

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

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const crpc = useCRPC();
  const notificationsQuery = crpc.notifications.list.useQuery({ limit: 10 });
  const unreadCountQuery = crpc.notifications.unreadCount.useQuery({});
  const markReadMutation = crpc.notifications.markRead.useMutation();
  const markAllReadMutation = crpc.notifications.markAllRead.useMutation();

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = unreadCountQuery.data ?? 0;

  React.useEffect(() => {
    function onDocPointerDown(event: MouseEvent) {
      if (!ref.current) return;
      const target = event.target as Node | null;
      if (target && !ref.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, []);

  async function markAllRead() {
    await markAllReadMutation.mutateAsync({});
  }

  async function handleClick(notif: (typeof notifications)[number]) {
    if (!notif.readAt) {
      await markReadMutation.mutateAsync({ id: notif._id });
    }
    if (notif.link) {
      window.location.assign(notif.link);
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((notif) => (
                <li key={notif._id}>
                  <button
                    type="button"
                    onClick={() => handleClick(notif)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted",
                      !notif.readAt && "bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {!notif.readAt && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      )}
                      <span className="truncate text-sm font-medium text-foreground">
                        {notif.title}
                      </span>
                    </div>
                    {notif.body && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {notif.body}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(notif._creationTime)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
