import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { connectors } from "@/lib/db/schema";
import { updateConnectorSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const connector = db
    .select()
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.workspaceId, ctx.workspaceId)))
    .get();

  if (!connector) return jsonError(404, "Connector not found");

  return NextResponse.json({ connector });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const existing = db
    .select({ id: connectors.id })
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.workspaceId, ctx.workspaceId)))
    .get();

  if (!existing) return jsonError(404, "Connector not found");

  try {
    const body = await req.json();
    const data = updateConnectorSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.config !== undefined) updates.config = JSON.stringify(data.config);
    if (data.status !== undefined) updates.status = data.status;

    db.update(connectors).set(updates).where(eq(connectors.id, id)).run();

    const connector = db.select().from(connectors).where(eq(connectors.id, id)).get();

    return NextResponse.json({ connector });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update connector");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const existing = db
    .select({ id: connectors.id })
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.workspaceId, ctx.workspaceId)))
    .get();

  if (!existing) return jsonError(404, "Connector not found");

  db.delete(connectors).where(eq(connectors.id, id)).run();

  return NextResponse.json({ deleted: true });
}
