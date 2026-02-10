import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

export async function POST() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  db.update(users)
    .set({ lastActiveAt: Date.now() })
    .where(eq(users.id, auth.userId))
    .run();

  return NextResponse.json({ ok: true });
}
