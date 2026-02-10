import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const logs = db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.workspaceId, ctx.workspaceId),
        gte(auditLogs.createdAt, thirtyDaysAgo),
      ),
    )
    .all();

  // Build 7x24 grid: grid[dayOfWeek][hour] = count
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const log of logs) {
    const date = new Date(log.createdAt);
    const dayOfWeek = date.getUTCDay(); // 0=Sun, 6=Sat
    const hour = date.getUTCHours();
    grid[dayOfWeek]![hour]!++;
  }

  return NextResponse.json({ grid, totalEvents: logs.length });
}
