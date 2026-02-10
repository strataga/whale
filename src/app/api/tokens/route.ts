import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createApiTokenSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
export const runtime = "nodejs";
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tokens = db.select({ id: apiTokens.id, name: apiTokens.name, tokenPrefix: apiTokens.tokenPrefix, scopes: apiTokens.scopes, expiresAt: apiTokens.expiresAt, lastUsedAt: apiTokens.lastUsedAt, createdAt: apiTokens.createdAt }).from(apiTokens).where(eq(apiTokens.workspaceId, auth.workspaceId)).all();
  return NextResponse.json({ tokens: tokens.map((t) => ({ ...t, scopes: JSON.parse(t.scopes) })) });
}
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = createApiTokenSchema.parse(body);
    const rawToken = randomBytes(32).toString("hex");
    const prefix = rawToken.slice(0, 8);
    const hash = createHash("sha256").update(rawToken).digest("hex");
    const id = crypto.randomUUID();
    const expiresAt = data.expiresInDays ? Date.now() + data.expiresInDays * 86400000 : null;
    db.insert(apiTokens).values({ id, workspaceId: auth.workspaceId, userId: auth.userId, name: data.name, tokenPrefix: prefix, tokenHash: hash, scopes: JSON.stringify(data.scopes ?? []), expiresAt, createdAt: Date.now() }).run();
    logAudit({ workspaceId: auth.workspaceId, userId: auth.userId, action: "api_token.create", metadata: { tokenId: id, name: data.name } });
    return NextResponse.json({ id, token: rawToken, prefix, expiresAt }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
