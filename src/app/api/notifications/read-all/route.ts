import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  db.update(notifications)
    .set({ readAt: Date.now() })
    .where(
      and(
        eq(notifications.userId, ctx.userId),
        isNull(notifications.readAt),
      ),
    )
    .run();

  return NextResponse.json({ readAll: true });
}
