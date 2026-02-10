import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { botSecrets } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { createBotSecretSchema } from "@/lib/validators";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secrets = db
    .select({
      id: botSecrets.id,
      name: botSecrets.name,
      createdAt: botSecrets.createdAt,
    })
    .from(botSecrets)
    .where(
      and(eq(botSecrets.botId, botId), eq(botSecrets.workspaceId, auth.workspaceId)),
    )
    .all();

  return NextResponse.json({ secrets });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, value } = createBotSecretSchema.parse(body);
    const encryptedValue = encrypt(value);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(botSecrets)
      .values({
        id,
        botId,
        workspaceId: auth.workspaceId,
        name,
        encryptedValue,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    logAudit({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: "bot_secret.create",
      metadata: { botId, secretName: name },
    });

    return NextResponse.json({ id, name }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 },
      );
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
