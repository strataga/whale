import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";
  const projectId = url.searchParams.get("projectId");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions = [eq(projects.workspaceId, ctx.workspaceId)];

  if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }
  if (status) {
    conditions.push(eq(tasks.status, status));
  }
  if (from) {
    conditions.push(gte(tasks.createdAt, parseInt(from, 10)));
  }
  if (to) {
    conditions.push(lte(tasks.createdAt, parseInt(to, 10)));
  }

  const rows = db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      projectName: projects.name,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      estimatedMinutes: tasks.estimatedMinutes,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(...conditions))
    .all();

  if (format === "csv") {
    const headers = [
      "id",
      "projectId",
      "projectName",
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "estimatedMinutes",
      "createdAt",
      "updatedAt",
    ];

    const csvRows = [headers.join(",")];
    for (const row of rows) {
      const values = headers.map((h) => {
        const val = row[h as keyof typeof row];
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(values.join(","));
    }

    return new Response(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="tasks-export-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ tasks: rows });
}
