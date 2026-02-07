import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ErrorBoundary } from "@/components/ui/error-boundary";

import DashboardShell from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardShell userRole={session.user.role}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DashboardShell>
  );
}
