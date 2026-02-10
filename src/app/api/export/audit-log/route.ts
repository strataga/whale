import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const from = url.searchParams.get("from") ? Number(url.searchParams.get("from")) : undefined;
  const to = url.searchParams.get("to") ? Number(url.searchParams.get("to")) : undefined;

  const conditions = [eq(auditLogs.workspaceId, ctx.workspaceId)];
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to));

  const logs = db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .all();

  if (format === "csv") {
    const headers = "id,workspaceId,userId,action,metadata,before,after,createdAt\n";
    const rows = logs
      .map((log) =>
        [
          log.id,
          log.workspaceId,
          log.userId ?? "",
          log.action,
          `"${(log.metadata ?? "").replace(/"/g, '""')}"`,
          `"${(log.before ?? "").replace(/"/g, '""')}"`,
          `"${(log.after ?? "").replace(/"/g, '""')}"`,
          log.createdAt,
        ].join(","),
      )
      .join("\n");

    return new Response(headers + rows, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=audit-log.csv",
      },
    });
  }

  return NextResponse.json({ logs });
}
