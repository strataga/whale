import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function DELETE(req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  db.delete(apiTokens).where(and(eq(apiTokens.id, tokenId), eq(apiTokens.workspaceId, auth.workspaceId))).run();
  logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "api_token.delete", metadata: { tokenId } });
  return NextResponse.json({ ok: true });
}
