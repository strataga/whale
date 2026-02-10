"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  ClipboardList,
  Coins,
  FolderKanban,
  Globe,
  Handshake,
  History,
  LayoutDashboard,
  Network,
  ScrollText,
  Server,
  Settings,
  ShoppingCart,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";

import { useCRPC } from "@/lib/convex/crpc";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  accent?: boolean;
  items: NavItem[];
};

export function Sidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const crpc = useCRPC();
  const meQuery = crpc.users.me.useQuery({});
  const isAdmin = meQuery.data?.role === "admin";

  const sections = React.useMemo(() => {
    const result: NavSection[] = [
      {
        title: "Overview",
        items: [
          { href: "/dashboard", label: "Mission Control", icon: LayoutDashboard },
        ],
      },
      {
        title: "Agents & Economy",
        accent: true,
        items: [
          { href: "/dashboard/agents", label: "Agents", icon: Network },
          { href: "/dashboard/economy", label: "Economy", icon: Coins },
          { href: "/dashboard/commerce", label: "Commerce", icon: ShoppingCart },
          ...(isAdmin
            ? [{ href: "/dashboard/negotiations", label: "Negotiations", icon: Handshake }]
            : []),
        ],
      },
      {
        title: "Projects",
        items: [
          { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
          { href: "/dashboard/bots", label: "Bots", icon: Bot },
          { href: "/dashboard/templates", label: "Templates", icon: ClipboardList },
          { href: "/dashboard/retrospective", label: "Retrospective", icon: History },
        ],
      },
      {
        title: "Operations",
        items: [
          { href: "/dashboard/reports", label: "Reporting", icon: BarChart3 },
          { href: "/dashboard/team", label: "Team", icon: UserCheck },
          { href: "/dashboard/webhooks", label: "Webhooks", icon: Globe },
          { href: "/dashboard/automation-rules", label: "Automation", icon: Zap },
        ],
      },
    ];

    if (isAdmin) {
      result.push({
        title: "Admin",
        items: [
          { href: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
          { href: "/dashboard/users", label: "Users", icon: Users },
          { href: "/dashboard/admin/system", label: "System", icon: Server },
          { href: "/dashboard/audit-log", label: "Audit Log", icon: ScrollText },
        ],
      });
    }

    result.push({
      title: "",
      items: [
        { href: "/dashboard/settings", label: "Settings", icon: Settings },
      ],
    });

    return result;
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
              <div className="text-[10px] text-muted-foreground">Agent Hub</div>
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
          {sections.map((section, sectionIdx) => (
            <div key={section.title || `section-${sectionIdx}`}>
              {/* Section divider (not before the first section) */}
              {sectionIdx > 0 && section.title && (
                <div className="mx-1 my-3 h-px bg-border" />
              )}

              {/* Section header */}
              {section.title && (
                <div
                  className={cn(
                    "mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider",
                    section.accent
                      ? "text-cyan-400/70"
                      : "text-muted-foreground/60",
                  )}
                >
                  {section.title}
                </div>
              )}

              <ul className="space-y-0.5">
                {section.items.map((item) => {
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
                          "flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
            </div>
          ))}
        </nav>

        <div className="mt-auto px-4 pb-4 pt-4 text-xs text-muted-foreground">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="font-medium text-foreground">Agent Hub</div>
            <div className="mt-1 leading-relaxed">
              Discover agents, negotiate tasks, and settle payments across protocols.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
