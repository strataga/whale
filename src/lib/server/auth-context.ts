import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type UserRole = "admin" | "member" | "viewer";

export type AuthContext = {
  userId: string;
  workspaceId: string;
  role: UserRole;
  name?: string | null;
  email?: string | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) return null;

  const row = db
    .select({
      workspaceId: users.workspaceId,
      role: users.role,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!row) return null;

  return {
    userId,
    workspaceId: row.workspaceId,
    role: (row.role as UserRole) ?? "member",
    name: row.name,
    email: row.email,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error("UNAUTHORIZED");
  }
  return ctx;
}

const ROLE_LEVEL: Record<UserRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
};

/**
 * Check if the user has the minimum required role.
 * Returns a JSON response if denied, or null if allowed.
 */
export function checkRole(
  ctx: AuthContext,
  minRole: UserRole,
): { error: string; status: number } | null {
  if (ROLE_LEVEL[ctx.role] < ROLE_LEVEL[minRole]) {
    return { error: "Forbidden: insufficient permissions", status: 403 };
  }
  return null;
}
