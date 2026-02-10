import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { bots, costBudgets, projects } from "@/lib/db/schema";
import { createCostBudgetSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  // Get IDs of bots and projects in this workspace
  const workspaceBots = db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .all();

  const workspaceProjects = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.workspaceId, ctx.workspaceId))
    .all();

  const entityIds = [
    ...workspaceBots.map((b) => b.id),
    ...workspaceProjects.map((p) => p.id),
  ];

  if (entityIds.length === 0) {
    return NextResponse.json({ budgets: [] });
  }

  const budgets = db
    .select()
    .from(costBudgets)
    .orderBy(desc(costBudgets.createdAt))
    .all()
    .filter((b) => entityIds.includes(b.entityId));

  return NextResponse.json({ budgets });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createCostBudgetSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(costBudgets)
      .values({
        id,
        entityType: data.entityType,
        entityId: data.entityId,
        monthlyLimitCents: data.monthlyLimitCents,
        alertThresholdPercent: data.alertThresholdPercent ?? 80,
      })
      .run();

    const budget = db.select().from(costBudgets).where(eq(costBudgets.id, id)).get();

    return NextResponse.json({ budget }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create cost budget");
  }
}
