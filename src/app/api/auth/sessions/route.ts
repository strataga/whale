import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const sessions = db
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, ctx.userId))
    .orderBy(desc(userSessions.lastActiveAt))
    .all();

  return NextResponse.json({ sessions });
}
