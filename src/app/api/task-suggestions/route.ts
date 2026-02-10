import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { taskSuggestions, bots } from "@/lib/db/schema";
import { updateTaskSuggestionSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Get all bots in workspace, then get pending suggestions for those bots
  const workspaceBots = db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .all();
  const botIds = workspaceBots.map((b) => b.id);
  if (botIds.length === 0) return NextResponse.json([]);
  const suggestions = db
    .select()
    .from(taskSuggestions)
    .where(eq(taskSuggestions.status, "pending"))
    .all()
    .filter((s) => botIds.includes(s.botId));
  return NextResponse.json(suggestions);
}

export async function PATCH(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id || typeof id !== "string")
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    const data = updateTaskSuggestionSchema.parse(rest);
    // Verify suggestion belongs to a bot in this workspace
    const suggestion = db
      .select()
      .from(taskSuggestions)
      .where(eq(taskSuggestions.id, id))
      .get();
    if (!suggestion)
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    const bot = db
      .select()
      .from(bots)
      .where(and(eq(bots.id, suggestion.botId), eq(bots.workspaceId, ctx.workspaceId)))
      .get();
    if (!bot)
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    db.update(taskSuggestions)
      .set({ status: data.status, updatedAt: Date.now() })
      .where(eq(taskSuggestions.id, id))
      .run();
    return NextResponse.json({ updated: true, id, status: data.status });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
