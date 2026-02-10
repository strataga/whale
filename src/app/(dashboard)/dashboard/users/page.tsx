"use client";

import { useRouter } from "next/navigation";

import { UsersAdmin } from "@/components/users/users-admin";
import { useCRPC } from "@/lib/convex/crpc";

export default function UsersPage() {
  const crpc = useCRPC();
  const router = useRouter();
  const meQuery = crpc.users.me.useQuery({});
  const usersQuery = crpc.users.list.useQuery({});

  const isPending = meQuery.isPending || usersQuery.isPending;

  if (isPending) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const me = meQuery.data;

  // Redirect non-admins
  if (me && me.role !== "admin") {
    router.push("/dashboard");
    return null;
  }

  const rows = (usersQuery.data ?? []).map((u) => ({
    id: u._id,
    name: u.name ?? null,
    email: u.email,
    role: u.role,
    createdAt: u._creationTime,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates and manage workspace roles.
        </p>
      </div>

      <UsersAdmin currentUserId={me?._id ?? ""} users={rows} />
    </div>
  );
}
