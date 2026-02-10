export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { dashboardWidgets } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createWidgetSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ widgetId: string }> },
) {
  const { widgetId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const widget = db
    .select()
    .from(dashboardWidgets)
    .where(
      and(
        eq(dashboardWidgets.id, widgetId),
        eq(dashboardWidgets.userId, ctx.userId),
      ),
    )
    .get();

  if (!widget) return jsonError(404, "Widget not found");

  try {
    const body = await req.json();
    const data = createWidgetSchema.partial().parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.widgetType !== undefined) updates.widgetType = data.widgetType;
    if (data.config !== undefined) updates.config = JSON.stringify(data.config);
    if (data.position !== undefined) updates.position = data.position;

    db.update(dashboardWidgets)
      .set(updates)
      .where(eq(dashboardWidgets.id, widgetId))
      .run();

    const updated = db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.id, widgetId))
      .get();

    return NextResponse.json({
      widget: updated
        ? { ...updated, config: JSON.parse(updated.config || "{}") }
        : null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update widget");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ widgetId: string }> },
) {
  const { widgetId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const widget = db
    .select()
    .from(dashboardWidgets)
    .where(
      and(
        eq(dashboardWidgets.id, widgetId),
        eq(dashboardWidgets.userId, ctx.userId),
      ),
    )
    .get();

  if (!widget) return jsonError(404, "Widget not found");

  db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, widgetId)).run();

  return NextResponse.json({ success: true });
}
