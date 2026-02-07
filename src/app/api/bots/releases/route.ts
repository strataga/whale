import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { botReleaseNotes } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { createReleaseNoteSchema } from "@/lib/validators";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/**
 * GET /api/bots/releases — user-authenticated
 * List all release notes for the workspace.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const releases = db
    .select()
    .from(botReleaseNotes)
    .where(eq(botReleaseNotes.workspaceId, ctx.workspaceId))
    .orderBy(desc(botReleaseNotes.createdAt))
    .all();

  return NextResponse.json({ releases });
}

/**
 * POST /api/bots/releases — user-authenticated, admin-only
 * Create a new release note.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createReleaseNoteSchema.parse(body);

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(botReleaseNotes)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        version: data.version,
        title: data.title,
        body: data.body,
        releaseUrl: data.releaseUrl ?? null,
        createdAt: now,
      })
      .run();

    const release = db
      .select()
      .from(botReleaseNotes)
      .where(eq(botReleaseNotes.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "bot_release.create",
      metadata: { releaseId: id, version: data.version },
    });

    return NextResponse.json({ release }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}
