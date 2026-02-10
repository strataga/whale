export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const { ruleId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const rule = db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.id, ruleId),
        eq(automationRules.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!rule) return jsonError(404, "Automation rule not found");

  try {
    const body = await req.json();
    const data = createAutomationRuleSchema.partial().parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.trigger !== undefined) updates.trigger = data.trigger;
    if (data.conditions !== undefined) updates.conditions = JSON.stringify(data.conditions);
    if (data.actions !== undefined) updates.actions = JSON.stringify(data.actions);

    db.update(automationRules)
      .set(updates)
      .where(eq(automationRules.id, ruleId))
      .run();

    const updated = db
      .select()
      .from(automationRules)
      .where(eq(automationRules.id, ruleId))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "automation_rule.update",
      metadata: { ruleId },
    });

    return NextResponse.json({
      rule: updated
        ? {
            ...updated,
            conditions: JSON.parse(updated.conditions || "[]"),
            actions: JSON.parse(updated.actions || "[]"),
          }
        : null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update automation rule");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const { ruleId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const rule = db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.id, ruleId),
        eq(automationRules.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!rule) return jsonError(404, "Automation rule not found");

  db.delete(automationRules).where(eq(automationRules.id, ruleId)).run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "automation_rule.delete",
    metadata: { ruleId },
  });

  return NextResponse.json({ success: true });
}
