import { and, desc, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const now = Date.now();
  const staleBefore = now - 5 * 60 * 1000;

  db.update(bots)
    .set({ status: "offline", updatedAt: now })
    .where(
      and(
        eq(bots.workspaceId, ctx.workspaceId),
        eq(bots.status, "online"),
        lt(bots.lastSeenAt, staleBefore),
      ),
    )
    .run();

  const rows = db
    .select({
      id: bots.id,
      workspaceId: bots.workspaceId,
      name: bots.name,
      host: bots.host,
      status: bots.status,
      capabilities: bots.capabilities,
      lastSeenAt: bots.lastSeenAt,
      createdAt: bots.createdAt,
      updatedAt: bots.updatedAt,
    })
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .orderBy(desc(bots.updatedAt))
    .all();

  return NextResponse.json({ bots: rows });
}
