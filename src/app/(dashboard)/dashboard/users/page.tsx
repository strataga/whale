import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { UsersAdmin } from "@/components/users/users-admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { checkRole, requireAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

export default async function UsersPage() {
  const ctx = await requireAuthContext();
  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) redirect("/dashboard");

  const rows = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.workspaceId, ctx.workspaceId))
    .orderBy(desc(users.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates and manage workspace roles.
        </p>
      </div>

      <UsersAdmin currentUserId={ctx.userId} users={rows} />
    </div>
  );
}

