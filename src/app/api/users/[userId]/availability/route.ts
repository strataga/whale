export const runtime = "nodejs";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { userAvailability, users } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { setAvailabilitySchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const user = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.workspaceId, ctx.workspaceId)))
    .get();

  if (!user) return jsonError(404, "User not found");

  const entries = db
    .select()
    .from(userAvailability)
    .where(eq(userAvailability.userId, userId))
    .all();

  return NextResponse.json({ availability: entries });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  // Users can only set their own availability unless admin
  if (ctx.userId !== userId) {
    return jsonError(403, "Cannot set availability for another user");
  }

  try {
    const body = await req.json();
    const data = setAvailabilitySchema.parse(body);

    // Upsert: replace existing entry for the same date
    const existing = db
      .select()
      .from(userAvailability)
      .where(
        and(
          eq(userAvailability.userId, userId),
          eq(userAvailability.date, data.date),
        ),
      )
      .get();

    if (existing) {
      db.update(userAvailability)
        .set({
          hoursAvailable: data.hoursAvailable,
          note: data.note ?? null,
        })
        .where(eq(userAvailability.id, existing.id))
        .run();

      const updated = db
        .select()
        .from(userAvailability)
        .where(eq(userAvailability.id, existing.id))
        .get();

      return NextResponse.json({ availability: updated });
    }

    const id = crypto.randomUUID();

    db.insert(userAvailability)
      .values({
        id,
        userId,
        date: data.date,
        hoursAvailable: data.hoursAvailable,
        note: data.note ?? null,
      })
      .run();

    const entry = db
      .select()
      .from(userAvailability)
      .where(eq(userAvailability.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "user_availability.set",
      metadata: { targetUserId: userId, date: data.date },
    });

    return NextResponse.json({ availability: entry }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to set availability");
  }
}
