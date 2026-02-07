import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { checkRole, getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
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

  const requestedPage = parsePositiveInt(searchParams.get("page"), 1);
  const requestedLimit = parsePositiveInt(searchParams.get("limit"), 50);
  const limit = Math.min(Math.max(requestedLimit, 1), 200);

  const action = searchParams.get("action")?.trim() || null;

  const where = action
    ? and(eq(auditLogs.workspaceId, ctx.workspaceId), eq(auditLogs.action, action))
    : eq(auditLogs.workspaceId, ctx.workspaceId);

  const totalRow = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLogs)
    .where(where)
    .get();

  const total = totalRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * limit;

  const rows = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
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
      createdAt: row.createdAt,
      user: row.userId
        ? {
            id: row.userId,
            name: row.userName,
            email: row.userEmail,
          }
        : null,
    })),
    total,
    page,
    totalPages,
  });
}

