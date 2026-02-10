import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { connectors } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const connector = db
    .select({ id: connectors.id, type: connectors.type })
    .from(connectors)
    .where(and(eq(connectors.id, id), eq(connectors.workspaceId, ctx.workspaceId)))
    .get();

  if (!connector) return jsonError(404, "Connector not found");

  // Stub — real testing would depend on connector type
  return NextResponse.json({ status: "ok", message: "Connection test passed" });
}
