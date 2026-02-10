import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { db } from "@/lib/db";
import { taskSuggestions } from "@/lib/db/schema";
import { createTaskSuggestionSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const botCtx = await getBotAuthContext(request);
  if (!botCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  if (botCtx.botId !== botId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const data = createTaskSuggestionSchema.parse(body);
    const id = crypto.randomUUID();
    const now = Date.now();
    db.insert(taskSuggestions)
      .values({
        id,
        botId,
        suggestedTitle: data.suggestedTitle,
        suggestedDescription: data.suggestedDescription ?? "",
        reasoning: data.reasoning ?? "",
        botTaskId: data.botTaskId ?? null,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return NextResponse.json({ id, suggestedTitle: data.suggestedTitle }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
