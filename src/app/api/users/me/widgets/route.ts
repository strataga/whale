export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { dashboardWidgets } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createWidgetSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const widgets = db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.userId, ctx.userId))
    .all();

  return NextResponse.json({
    widgets: widgets.map((w) => ({
      ...w,
      config: JSON.parse(w.config || "{}"),
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  try {
    const body = await req.json();
    const data = createWidgetSchema.parse(body);

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(dashboardWidgets)
      .values({
        id,
        userId: ctx.userId,
        widgetType: data.widgetType,
        config: JSON.stringify(data.config ?? {}),
        position: data.position ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const widget = db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.id, id))
      .get();

    return NextResponse.json(
      {
        widget: widget
          ? { ...widget, config: JSON.parse(widget.config || "{}") }
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create widget");
  }
}
