import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  db.update(userSessions)
    .set({ revokedAt: Date.now() })
    .where(eq(userSessions.userId, ctx.userId))
    .run();

  return NextResponse.json({ revokedAll: true });
}
