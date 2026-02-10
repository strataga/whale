import { NextResponse } from "next/server";
import { and, eq, like, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { bots, milestones, projects, tasks } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const type = url.searchParams.get("type") ?? "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);

  if (!q || q.length < 1) {
    return jsonError(400, "Query parameter 'q' is required");
  }

  const pattern = `%${q}%`;
  const results: Array<{ type: string; id: string; title: string; description?: string; extra?: string }> = [];

  if (type === "all" || type === "tasks") {
    const taskResults = db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, ctx.workspaceId),
          sql`(${tasks.title} LIKE ${pattern} OR ${tasks.description} LIKE ${pattern})`,
        ),
      )
      .limit(limit)
      .all();

    for (const t of taskResults) {
      results.push({ type: "task", id: t.id, title: t.title, description: t.description, extra: t.status });
    }
  }

  if (type === "all" || type === "projects") {
    const projResults = db
      .select({ id: projects.id, name: projects.name, description: projects.description, status: projects.status })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, ctx.workspaceId),
          sql`(${projects.name} LIKE ${pattern} OR ${projects.description} LIKE ${pattern})`,
        ),
      )
      .limit(limit)
      .all();

    for (const p of projResults) {
      results.push({ type: "project", id: p.id, title: p.name, description: p.description, extra: p.status });
    }
  }

  if (type === "all" || type === "milestones") {
    const msResults = db
      .select({ id: milestones.id, name: milestones.name })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(eq(projects.workspaceId, ctx.workspaceId), like(milestones.name, pattern)))
      .limit(limit)
      .all();

    for (const m of msResults) {
      results.push({ type: "milestone", id: m.id, title: m.name });
    }
  }

  if (type === "all" || type === "bots") {
    const botResults = db
      .select({ id: bots.id, name: bots.name, status: bots.status })
      .from(bots)
      .where(and(eq(bots.workspaceId, ctx.workspaceId), like(bots.name, pattern)))
      .limit(limit)
      .all();

    for (const b of botResults) {
      results.push({ type: "bot", id: b.id, title: b.name, extra: b.status });
    }
  }

  return NextResponse.json({ results: results.slice(0, limit) });
}
