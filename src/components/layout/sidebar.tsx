"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  FolderKanban,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const baseNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/bots", label: "Bots", icon: Bot },
  { href: "/dashboard/reports", label: "Reporting", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open,
  setOpen,
  userRole,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  userRole?: string | null;
}) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin";

  const navItems = React.useMemo(() => {
    const items: NavItem[] = [];
    const usersItem: NavItem = {
      href: "/dashboard/users",
      label: "Users",
      icon: Users,
    };
    const auditLogItem: NavItem = {
      href: "/dashboard/audit-log",
      label: "Audit Log",
      icon: ScrollText,
    };

    // Insert Users + Audit Log between Bots and Settings (admin only).
    for (const item of baseNavItems) {
      if (item.href === "/dashboard/settings" && isAdmin) {
        items.push(usersItem);
        items.push(auditLogItem);
      }
      items.push(item);
    }

    return items;
  }, [isAdmin]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card/95 backdrop-blur transition-transform supports-[backdrop-filter]:bg-card/80",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
        aria-label="Sidebar"
        // When closed on mobile, prevent keyboard navigation into invisible sidebar.
        // On lg+ the sidebar is always visible so this has no effect (CSS overrides translate).
        aria-hidden={!open ? true : undefined}
        tabIndex={!open ? -1 : undefined}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background text-lg">
              🐳
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">Whale</div>
              <div className="text-xs text-muted-foreground">Planner</div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href + "/"));

              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto px-4 pb-4 pt-6 text-xs text-muted-foreground">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="font-medium text-foreground">Tip</div>
            <div className="mt-1 leading-relaxed">
              Try creating a project with an outcome, constraints, and a deadline.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
