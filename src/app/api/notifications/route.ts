import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rows = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, ctx.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
    .all();

  return NextResponse.json({ notifications: rows });
}
