export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { configImports } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { configImportSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = configImportSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(configImports)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        filename: "api-import",
        status: "completed",
        summary: JSON.stringify({
          keys: Object.keys(data.config),
          importedAt: Date.now(),
        }),
      })
      .run();

    const record = db
      .select()
      .from(configImports)
      .where(eq(configImports.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "config.import",
      metadata: { importId: id, keys: Object.keys(data.config) },
    });

    return NextResponse.json({ import: record }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to import config");
  }
}
