import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bots, botTasks, projects, tasks } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const bot = db
    .select({
      id: bots.id,
      workspaceId: bots.workspaceId,
      name: bots.name,
      host: bots.host,
      status: bots.status,
      capabilities: bots.capabilities,
      lastSeenAt: bots.lastSeenAt,
      createdAt: bots.createdAt,
      updatedAt: bots.updatedAt,
    })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const recent = db
    .select({
      id: botTasks.id,
      botId: botTasks.botId,
      taskId: botTasks.taskId,
      status: botTasks.status,
      outputSummary: botTasks.outputSummary,
      artifactLinks: botTasks.artifactLinks,
      startedAt: botTasks.startedAt,
      completedAt: botTasks.completedAt,
      createdAt: botTasks.createdAt,
      updatedAt: botTasks.updatedAt,
      taskTitle: tasks.title,
      projectId: tasks.projectId,
    })
    .from(botTasks)
    .innerJoin(tasks, eq(botTasks.taskId, tasks.id))
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(botTasks.botId, bot.id), eq(projects.workspaceId, ctx.workspaceId)))
    .orderBy(desc(botTasks.updatedAt))
    .limit(50)
    .all();

  return NextResponse.json({ bot, botTasks: recent });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "admin");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const raw = randomBytes(64).toString("hex");
  const tokenPrefix = raw.slice(0, 8);
  const tokenHash = await hash(raw, 10);

  db.update(bots)
    .set({ tokenPrefix, tokenHash, status: "offline", updatedAt: Date.now() })
    .where(and(eq(bots.id, bot.id), eq(bots.workspaceId, ctx.workspaceId)))
    .run();

  logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    action: "bot.revoke",
    metadata: { botId },
  });

  return NextResponse.json({ ok: true });
}

