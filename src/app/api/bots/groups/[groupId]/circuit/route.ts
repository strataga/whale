export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const group = db
    .select()
    .from(schema.botGroups)
    .where(
      and(
        eq(schema.botGroups.id, groupId),
        eq(schema.botGroups.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!group) {
    return NextResponse.json({ error: "Bot group not found" }, { status: 404 });
  }

  return NextResponse.json({
    groupId: group.id,
    name: group.name,
    circuitState: group.circuitState,
    lastTrippedAt: group.lastTrippedAt,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const group = db
    .select()
    .from(schema.botGroups)
    .where(
      and(
        eq(schema.botGroups.id, groupId),
        eq(schema.botGroups.workspaceId, ctx.workspaceId),
      ),
    )
    .get();

  if (!group) {
    return NextResponse.json({ error: "Bot group not found" }, { status: 404 });
  }

  const body = await req.json();
  const { circuitState } = body;

  const validStates = ["closed", "open", "half-open"];
  if (!circuitState || !validStates.includes(circuitState)) {
    return NextResponse.json(
      { error: "circuitState must be one of: closed, open, half-open" },
      { status: 400 },
    );
  }

  const now = Date.now();
  const updates: Record<string, unknown> = {
    circuitState,
    updatedAt: now,
  };

  if (circuitState === "open") {
    updates.lastTrippedAt = now;
  }

  db.update(schema.botGroups)
    .set(updates)
    .where(eq(schema.botGroups.id, groupId))
    .run();

  return NextResponse.json({
    groupId,
    circuitState,
    lastTrippedAt: circuitState === "open" ? now : group.lastTrippedAt,
  });
}
