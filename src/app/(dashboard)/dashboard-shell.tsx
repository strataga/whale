"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardShell({
  children,
  userRole,
}: {
  children: React.ReactNode;
  userRole?: string | null;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    // Close the mobile sidebar when navigating.
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        userRole={userRole}
      />

      <div className="lg:pl-72">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        <main id="main" className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
