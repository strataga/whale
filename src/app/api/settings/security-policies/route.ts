export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { updateSecurityPolicySchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const workspace = db
    .select({ securityPolicy: workspaces.securityPolicy })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .get();

  const policy = workspace?.securityPolicy
    ? JSON.parse(workspace.securityPolicy)
    : {};

  return NextResponse.json({ policy });
}

export async function PUT(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = updateSecurityPolicySchema.parse(body);

    db.update(workspaces)
      .set({
        securityPolicy: JSON.stringify(data),
        updatedAt: Date.now(),
      })
      .where(eq(workspaces.id, ctx.workspaceId))
      .run();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "security_policy.update",
      metadata: data,
    });

    return NextResponse.json({ policy: data });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update security policy");
  }
}
