import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

// Statuses that should auto-transition to offline when stale
const ACTIVE_STATUSES = ["idle", "working", "waiting", "online", "busy"];

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const now = Date.now();
  const staleBefore = now - 5 * 60 * 1000;

  // Mark stale active bots as offline
  db.update(bots)
    .set({ status: "offline", statusReason: "Stale: no heartbeat", statusChangedAt: now, updatedAt: now })
    .where(
      and(
        eq(bots.workspaceId, ctx.workspaceId),
        inArray(bots.status, ACTIVE_STATUSES),
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
      statusReason: bots.statusReason,
      capabilities: bots.capabilities,
      lastSeenAt: bots.lastSeenAt,
      version: bots.version,
      onboardedAt: bots.onboardedAt,
      createdAt: bots.createdAt,
      updatedAt: bots.updatedAt,
    })
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .orderBy(desc(bots.updatedAt))
    .all();

  return NextResponse.json({ bots: rows });
}
