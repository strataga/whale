import { NextResponse } from "next/server";
import { getBotAuthContext } from "@/lib/server/bot-auth";
import { db } from "@/lib/db";
import { eq, and, isNull, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

export async function GET(req: Request) {
  const botCtx = await getBotAuthContext(req);
  if (!botCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get bot's team IDs
  const teamIds = db
    .select({ teamId: schema.teamMembers.teamId })
    .from(schema.teamMembers)
    .where(
      and(
        eq(schema.teamMembers.botId, botCtx.botId),
        isNull(schema.teamMembers.removedAt),
      ),
    )
    .all()
    .map((r) => r.teamId);

  if (teamIds.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  // Find all bot members in those teams
  const teamBotIds = db
    .select({ botId: schema.teamMembers.botId })
    .from(schema.teamMembers)
    .where(
      and(
        inArray(schema.teamMembers.teamId, teamIds),
        eq(schema.teamMembers.memberType, "bot"),
        isNull(schema.teamMembers.removedAt),
      ),
    )
    .all()
    .map((r) => r.botId)
    .filter((id): id is string => id !== null);

  if (teamBotIds.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  // Find pending bot tasks for team bots
  const tasks = db
    .select({
      botTaskId: schema.botTasks.id,
      botId: schema.botTasks.botId,
      taskId: schema.botTasks.taskId,
      status: schema.botTasks.status,
      title: schema.tasks.title,
      priority: schema.tasks.priority,
    })
    .from(schema.botTasks)
    .innerJoin(schema.tasks, eq(schema.botTasks.taskId, schema.tasks.id))
    .where(
      and(
        inArray(schema.botTasks.botId, teamBotIds),
        eq(schema.botTasks.status, "pending"),
      ),
    )
    .limit(50)
    .all();

  return NextResponse.json({ tasks });
}
