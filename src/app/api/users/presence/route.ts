import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allUsers = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      lastActiveAt: users.lastActiveAt,
    })
    .from(users)
    .where(eq(users.workspaceId, auth.workspaceId))
    .all();

  const now = Date.now();
  const result = allUsers.map((u) => ({
    ...u,
    online: u.lastActiveAt ? now - u.lastActiveAt < ONLINE_THRESHOLD_MS : false,
  }));

  return NextResponse.json({ users: result });
}
