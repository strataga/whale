import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { savedViews } from "@/lib/db/schema";
import { updateSavedViewSchema } from "@/lib/validators";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ viewId: string }> },
) {
  const { viewId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const existing = db
    .select()
    .from(savedViews)
    .where(and(eq(savedViews.id, viewId), eq(savedViews.userId, ctx.userId)))
    .get();

  if (!existing) return jsonError(404, "View not found");

  try {
    const body = await req.json();
    const data = updateSavedViewSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.filters !== undefined) updates.filters = JSON.stringify(data.filters);
    if (data.isShared !== undefined) updates.isShared = data.isShared ? 1 : 0;

    db.update(savedViews).set(updates).where(eq(savedViews.id, viewId)).run();

    const view = db.select().from(savedViews).where(eq(savedViews.id, viewId)).get();

    return NextResponse.json({ view });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update view");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ viewId: string }> },
) {
  const { viewId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const existing = db
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(and(eq(savedViews.id, viewId), eq(savedViews.userId, ctx.userId)))
    .get();

  if (!existing) return jsonError(404, "View not found");

  db.delete(savedViews).where(eq(savedViews.id, viewId)).run();

  return NextResponse.json({ deleted: true });
}
