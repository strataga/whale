export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { getAuthContext } from "@/lib/server/auth-context";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { fanOutSchema } from "@/lib/validators";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify task exists
  const task = db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, taskId))
    .get();

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = fanOutSchema.parse(body);
    const now = Date.now();

    const groupId = crypto.randomUUID();
    db.insert(schema.fanOutGroups)
      .values({
        id: groupId,
        taskId,
        expectedCount: data.botIds.length,
        completedCount: 0,
        status: "running",
        createdAt: now,
      })
      .run();

    const botTaskIds: Array<{ botId: string; botTaskId: string }> = [];

    for (const botId of data.botIds) {
      const botTaskId = crypto.randomUUID();
      db.insert(schema.botTasks)
        .values({
          id: botTaskId,
          botId,
          taskId,
          status: "pending",
          fanOutGroupId: groupId,
          structuredSpec: data.spec ? JSON.stringify(data.spec) : null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      botTaskIds.push({ botId, botTaskId });
    }

    return NextResponse.json(
      {
        fanOutGroupId: groupId,
        taskId,
        expectedCount: data.botIds.length,
        botTasks: botTaskIds,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create fan-out" }, { status: 500 });
  }
}
