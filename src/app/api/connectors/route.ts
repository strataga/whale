import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { connectors } from "@/lib/db/schema";
import { createConnectorSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const rows = db
    .select()
    .from(connectors)
    .where(eq(connectors.workspaceId, ctx.workspaceId))
    .orderBy(desc(connectors.createdAt))
    .all();

  return NextResponse.json({ connectors: rows });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = createConnectorSchema.parse(body);

    const id = crypto.randomUUID();

    db.insert(connectors)
      .values({
        id,
        workspaceId: ctx.workspaceId,
        type: data.type,
        name: data.name,
        config: JSON.stringify(data.config),
      })
      .run();

    const connector = db.select().from(connectors).where(eq(connectors.id, id)).get();

    return NextResponse.json({ connector }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to create connector");
  }
}
