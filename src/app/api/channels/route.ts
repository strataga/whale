export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
import { createChannelSchema } from "@/lib/validators";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/** List all channels for the workspace. */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rows = db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.workspaceId, ctx.workspaceId))
    .all();

  return NextResponse.json({
    channels: rows.map((ch) => ({
      ...ch,
      config: JSON.parse(ch.config),
      events: JSON.parse(ch.events),
      active: ch.active === 1,
    })),
  });
}

/** Create a new channel (admin only). */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createChannelSchema.parse(body);

    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(schema.channels)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        type: data.type,
        name: data.name,
        config: JSON.stringify(data.config),
        events: JSON.stringify(data.events),
        minSeverity: data.minSeverity,
        active: data.active ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const channel = db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, id))
      .get();

    logAudit({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: "channel.create",
      metadata: { channelId: id, type: data.type },
    });

    return NextResponse.json(
      {
        channel: channel
          ? {
              ...channel,
              config: JSON.parse(channel.config),
              events: JSON.parse(channel.events),
              active: channel.active === 1,
            }
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create channel");
  }
}
