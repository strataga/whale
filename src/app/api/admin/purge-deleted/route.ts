import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

/**
 * POST /api/admin/purge-deleted
 * Permanently removes soft-deleted records older than the given threshold.
 * Admin-only. Query param: ?olderThanDays=30 (default 30).
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });

  const url = new URL(req.url);
  const olderThanDays = Math.max(1, Number(url.searchParams.get("olderThanDays") ?? 30));
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  // Purge in dependency order: tasks first (FK refs), then milestones, projects, bots, users, workspaces
  const tables = [
    { table: schema.tasks, name: "tasks" },
    { table: schema.milestones, name: "milestones" },
    { table: schema.bots, name: "bots" },
    { table: schema.projects, name: "projects" },
    { table: schema.users, name: "users" },
    { table: schema.workspaces, name: "workspaces" },
  ] as const;

  const results: Record<string, number> = {};

  for (const { table, name } of tables) {
    const deleted = db
      .delete(table)
      .where(
        sql`${table.deletedAt} IS NOT NULL AND ${table.deletedAt} < ${cutoff}`,
      )
      .run();
    results[name] = deleted.changes;
  }

  return NextResponse.json({ purged: results, olderThanDays, cutoffTimestamp: cutoff });
}
