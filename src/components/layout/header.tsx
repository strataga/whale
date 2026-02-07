"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { cn } from "@/lib/utils";

function pageTitleFromPathname(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/dashboard/projects")) return "Projects";
  if (pathname.startsWith("/dashboard/bots")) return "Bots";
  if (pathname.startsWith("/dashboard/reports")) return "Reporting";
  if (pathname.startsWith("/dashboard/users")) return "Users";
  if (pathname.startsWith("/dashboard/audit-log")) return "Audit Log";
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
  const title = pageTitleFromPathname(pathname);

  const { data: session, status } = useSession();
  const user = session?.user;

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
          <Link
            href="/dashboard/projects/new"
            className="hidden min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
          >
            New project
          </Link>

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
                  status !== "authenticated" && "opacity-60",
                )}
                aria-hidden="true"
              >
                {initialsFromName(
                  (user as { name?: string | null } | undefined)?.name,
                  (user as { email?: string | null } | undefined)?.email,
                )}
              </div>
              <span className="hidden max-w-[14ch] truncate sm:inline">
                {(user as { name?: string | null } | undefined)?.name ??
                  (user as { email?: string | null } | undefined)?.email ??
                  "Account"}
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
                    {(user as { name?: string | null } | undefined)?.name ??
                      "Signed in"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {(user as { email?: string | null } | undefined)?.email ??
                      ""}
                  </div>
                </div>
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
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
