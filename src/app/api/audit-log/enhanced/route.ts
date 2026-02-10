export const runtime = "nodejs";

import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { raw };
  }
}

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const { searchParams } = new URL(req.url);

  const entityType = searchParams.get("entityType")?.trim() || null;
  const actionPrefix = searchParams.get("actionPrefix")?.trim() || null;
  const dateFrom = searchParams.get("dateFrom")
    ? Number(searchParams.get("dateFrom"))
    : null;
  const dateTo = searchParams.get("dateTo")
    ? Number(searchParams.get("dateTo"))
    : null;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 50, 1),
    200,
  );
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const conditions = [eq(auditLogs.workspaceId, ctx.workspaceId)];

  if (entityType) {
    conditions.push(like(auditLogs.action, `${entityType}.%`));
  }

  if (actionPrefix) {
    conditions.push(like(auditLogs.action, `${actionPrefix}%`));
  }

  if (dateFrom && Number.isFinite(dateFrom)) {
    conditions.push(gte(auditLogs.createdAt, dateFrom));
  }

  if (dateTo && Number.isFinite(dateTo)) {
    conditions.push(lte(auditLogs.createdAt, dateTo));
  }

  const where = and(...conditions);

  const totalRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLogs)
    .where(where)
    .get();

  const total = totalRow?.count ?? 0;

  const rows = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      before: auditLogs.before,
      after: auditLogs.after,
      createdAt: auditLogs.createdAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return NextResponse.json({
    entries: rows.map((row) => ({
      id: row.id,
      action: row.action,
      metadata: safeJsonParse(row.metadata ?? "{}"),
      before: row.before ? safeJsonParse(row.before) : null,
      after: row.after ? safeJsonParse(row.after) : null,
      createdAt: row.createdAt,
      user: row.userId
        ? { id: row.userId, name: row.userName, email: row.userEmail }
        : null,
    })),
    total,
    limit,
    offset,
  });
}
