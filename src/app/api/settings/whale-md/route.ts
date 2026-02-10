import { NextResponse } from "next/server";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { updateWhaleMdSchema } from "@/lib/validators";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = db
    .select({
      whaleMdContent: schema.workspaces.whaleMdContent,
      whaleMdUpdatedAt: schema.workspaces.whaleMdUpdatedAt,
    })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, ctx.workspaceId))
    .get();

  return NextResponse.json({
    content: ws?.whaleMdContent ?? null,
    updatedAt: ws?.whaleMdUpdatedAt ?? null,
  });
}

export async function PUT(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });

  const body = await req.json();
  const parsed = updateWhaleMdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = Date.now();
  db.update(schema.workspaces)
    .set({ whaleMdContent: parsed.data.content, whaleMdUpdatedAt: now, updatedAt: now })
    .where(eq(schema.workspaces.id, ctx.workspaceId))
    .run();

  return NextResponse.json({ ok: true, updatedAt: now });
}
