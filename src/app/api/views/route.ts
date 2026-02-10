import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { savedViews } from "@/lib/db/schema";
import { createSavedViewSchema } from "@/lib/validators";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const views = db
    .select()
    .from(savedViews)
    .where(eq(savedViews.userId, ctx.userId))
    .orderBy(desc(savedViews.createdAt))
    .all();

  return NextResponse.json({ views });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  try {
    const body = await req.json();
    const data = createSavedViewSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(savedViews)
      .values({
        id,
        userId: ctx.userId,
        name: data.name,
        entityType: data.entityType ?? "tasks",
        filters: JSON.stringify(data.filters),
        isShared: data.isShared ? 1 : 0,
      })
      .run();

    const view = db.select().from(savedViews).where(eq(savedViews.id, id)).get();

    return NextResponse.json({ view }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create view");
  }
}
