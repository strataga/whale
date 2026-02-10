import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";
import { updateBotConcurrencySchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { maxConcurrentTasks } = updateBotConcurrencySchema.parse(body);

    db.update(bots)
      .set({ maxConcurrentTasks, updatedAt: Date.now() })
      .where(eq(bots.id, botId))
      .run();

    logAudit({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      action: "bot.update_concurrency",
      metadata: { botId, maxConcurrentTasks },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
