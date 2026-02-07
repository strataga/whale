import { and, count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { bots, botLogs } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthContext } from "@/lib/server/auth-context";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { createBotLogSchema, botLogLevelSchema } from "@/lib/validators";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

/**
 * POST /api/bots/[botId]/logs — bot-authenticated
 * Create a new log entry for this bot.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return jsonError(401, "Unauthorized");
  if (botCtx.botId !== botId) {
    return jsonError(403, "Forbidden: cannot create logs for another bot");
  }

  const rl = checkRateLimit(`bot:logs:${botId}`, {
    limit: 100,
    windowMs: 60_000,
  });
  if (rl) {
    return NextResponse.json(
      { error: rl.error },
      { status: rl.status, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const data = createBotLogSchema.parse(body);

    const logId = crypto.randomUUID();
    const now = Date.now();

    db.insert(botLogs)
      .values({
        id: logId,
        botId: botCtx.botId,
        workspaceId: botCtx.workspaceId,
        level: data.level,
        message: data.message,
        metadata: JSON.stringify(data.metadata ?? {}),
        botTaskId: data.botTaskId ?? null,
        createdAt: now,
      })
      .run();

    return NextResponse.json({ ok: true, logId }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(400, "Invalid JSON body");
  }
}

/**
 * GET /api/bots/[botId]/logs — user-authenticated
 * List log entries for a bot with optional level filter and pagination.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  // Verify bot exists in workspace
  const bot = db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, ctx.workspaceId)))
    .get();

  if (!bot) return jsonError(404, "Bot not found");

  const url = new URL(req.url);
  const levelParam = url.searchParams.get("level");
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  // Validate level filter if provided
  let levelFilter: string | undefined;
  if (levelParam) {
    const parsed = botLogLevelSchema.safeParse(levelParam);
    if (!parsed.success) {
      return jsonError(400, "Invalid level filter", parsed.error.issues);
    }
    levelFilter = parsed.data;
  }

  // Parse and clamp pagination
  let limit = limitParam ? parseInt(limitParam, 10) : 50;
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;

  let offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  if (isNaN(offset) || offset < 0) offset = 0;

  // Build where conditions
  const conditions = [eq(botLogs.botId, botId)];
  if (levelFilter) {
    conditions.push(eq(botLogs.level, levelFilter));
  }

  const whereClause = and(...conditions);

  // Get total count
  const totalResult = db
    .select({ count: count() })
    .from(botLogs)
    .where(whereClause)
    .get();
  const total = totalResult?.count ?? 0;

  // Get paginated logs
  const logs = db
    .select()
    .from(botLogs)
    .where(whereClause)
    .orderBy(desc(botLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return NextResponse.json({ logs, total });
}
