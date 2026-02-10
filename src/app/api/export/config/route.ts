export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  automationRules,
  botGroups,
  workflows,
  workspaces,
} from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const workspace = db
    .select({
      name: workspaces.name,
      timezone: workspaces.timezone,
      securityPolicy: workspaces.securityPolicy,
      retentionDays: workspaces.retentionDays,
    })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .get();

  const groups = db
    .select()
    .from(botGroups)
    .where(eq(botGroups.workspaceId, ctx.workspaceId))
    .all();

  const rules = db
    .select()
    .from(automationRules)
    .where(eq(automationRules.workspaceId, ctx.workspaceId))
    .all();

  const wfs = db
    .select()
    .from(workflows)
    .where(eq(workflows.workspaceId, ctx.workspaceId))
    .all();

  const config = {
    workspace: workspace
      ? {
          ...workspace,
          securityPolicy: workspace.securityPolicy
            ? JSON.parse(workspace.securityPolicy)
            : null,
        }
      : null,
    botGroups: groups,
    automationRules: rules.map((r) => ({
      ...r,
      conditions: JSON.parse(r.conditions || "[]"),
      actions: JSON.parse(r.actions || "[]"),
    })),
    workflows: wfs.map((w) => ({
      ...w,
      definition: JSON.parse(w.definition || "{}"),
    })),
  };

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "config.export",
    metadata: {},
  });

  return NextResponse.json({ config });
}
