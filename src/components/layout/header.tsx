"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu } from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { authClient } from "@/lib/convex/auth-client";
import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

function pageTitleFromPathname(pathname: string) {
  if (pathname === "/dashboard") return "Mission Control";
  if (pathname.startsWith("/dashboard/agents")) return "Agents";
  if (pathname.startsWith("/dashboard/economy")) return "Economy";
  if (pathname.startsWith("/dashboard/commerce")) return "Commerce";
  if (pathname.startsWith("/dashboard/negotiations")) return "Negotiations";
  if (pathname.startsWith("/dashboard/projects")) return "Projects";
  if (pathname.startsWith("/dashboard/bots")) return "Bots";
  if (pathname.startsWith("/dashboard/reports")) return "Reporting";
  if (pathname.startsWith("/dashboard/team")) return "Team";
  if (pathname.startsWith("/dashboard/webhooks")) return "Webhooks";
  if (pathname.startsWith("/dashboard/automation-rules")) return "Automation";
  if (pathname.startsWith("/dashboard/alerts")) return "Alerts";
  if (pathname.startsWith("/dashboard/users")) return "Users";
  if (pathname.startsWith("/dashboard/admin")) return "Admin";
  if (pathname.startsWith("/dashboard/audit-log")) return "Audit Log";
  if (pathname.startsWith("/dashboard/retrospective")) return "Retrospective";
  if (pathname.startsWith("/dashboard/templates")) return "Templates";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  return "Whale";
}

function initialsFromName(name?: string | null, email?: string | null) {
  const basis = (name ?? "").trim() || (email ?? "").trim();
  if (!basis) return "?";

  const parts = basis.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitleFromPathname(pathname);

  const crpc = useCRPC();
  const meQuery = crpc.users.me.useQuery({});
  const user = meQuery.data;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocPointerDown(event: MouseEvent) {
      if (!menuRef.current) return;
      const target = event.target as Node | null;
      if (target && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("whale:shortcut", { detail: "focus-search" }))}
            className="hidden min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
            aria-label="Search"
          >
            <span className="text-xs">Search...</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{"\u2318"}K</kbd>
          </button>

          <Link
            href="/dashboard/projects/new"
            className="hidden min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
          >
            New project
          </Link>

          <NotificationBell />

          <ThemeToggle />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-xs font-semibold",
                  meQuery.isPending && "opacity-60",
                )}
                aria-hidden="true"
              >
                {initialsFromName(user?.name, user?.email)}
              </div>
              <span className="hidden max-w-[14ch] truncate sm:inline">
                {user?.name ?? user?.email ?? "Account"}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
              >
                <div className="px-4 py-3">
                  <div className="text-sm font-semibold text-foreground">
                    {user?.name ?? "Signed in"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {user?.email ?? ""}
                  </div>
                </div>
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={async () => {
                      await authClient.signOut();
                      router.push("/");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
