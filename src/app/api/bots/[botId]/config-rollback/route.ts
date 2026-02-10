import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import { botConfigVersions, bots } from "@/lib/db/schema";
import { configRollbackSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { botId } = await params;
  const bot = db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const body = await request.json();
    const data = configRollbackSchema.parse(body);
    const snapshot = db
      .select()
      .from(botConfigVersions)
      .where(
        and(
          eq(botConfigVersions.botId, botId),
          eq(botConfigVersions.version, data.version)
        )
      )
      .get();
    if (!snapshot)
      return NextResponse.json(
        { error: `Config version ${data.version} not found` },
        { status: 404 }
      );
    const config = JSON.parse(snapshot.configSnapshot);
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (config.capabilities !== undefined)
      updates.capabilities = typeof config.capabilities === "string"
        ? config.capabilities
        : JSON.stringify(config.capabilities);
    if (config.maxConcurrentTasks !== undefined)
      updates.maxConcurrentTasks = config.maxConcurrentTasks;
    if (config.sandboxPolicy !== undefined)
      updates.sandboxPolicy = typeof config.sandboxPolicy === "string"
        ? config.sandboxPolicy
        : JSON.stringify(config.sandboxPolicy);
    if (config.allowedProjects !== undefined)
      updates.allowedProjects = typeof config.allowedProjects === "string"
        ? config.allowedProjects
        : JSON.stringify(config.allowedProjects);
    if (config.allowedTags !== undefined)
      updates.allowedTags = typeof config.allowedTags === "string"
        ? config.allowedTags
        : JSON.stringify(config.allowedTags);
    if (config.environment !== undefined)
      updates.environment = config.environment;
    if (config.labels !== undefined)
      updates.labels = typeof config.labels === "string"
        ? config.labels
        : JSON.stringify(config.labels);
    if (config.autoUpdate !== undefined)
      updates.autoUpdate = config.autoUpdate;
    db.update(bots).set(updates).where(eq(bots.id, botId)).run();
    return NextResponse.json({ rolledBackToVersion: data.version });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
