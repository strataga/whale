export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { automationRules } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { createAutomationRuleSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rules = db
    .select()
    .from(automationRules)
    .where(eq(automationRules.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({
    rules: rules.map((r) => ({
      ...r,
      conditions: JSON.parse(r.conditions || "[]"),
      actions: JSON.parse(r.actions || "[]"),
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createAutomationRuleSchema.parse(body);

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(automationRules)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        name: data.name,
        trigger: data.trigger,
        conditions: JSON.stringify(data.conditions ?? []),
        actions: JSON.stringify(data.actions),
        active: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rule = db
      .select()
      .from(automationRules)
      .where(eq(automationRules.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "automation_rule.create",
      metadata: { ruleId: id },
    });

    return NextResponse.json(
      {
        rule: rule
          ? {
              ...rule,
              conditions: JSON.parse(rule.conditions || "[]"),
              actions: JSON.parse(rule.actions || "[]"),
            }
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create automation rule");
  }
}
