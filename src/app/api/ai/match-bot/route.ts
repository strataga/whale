import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const matchResultSchema = z.object({
  rankings: z.array(
    z.object({
      botId: z.string(),
      score: z.number().min(0).max(100),
      reasoning: z.string(),
    }),
  ),
  recommendation: z.string(),
});

/**
 * #6 AI Bot-Task Matching — scores and ranks bots for a given task description.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const body = await req.json();
  const { taskDescription, requiredCapabilities } = body as {
    taskDescription?: string;
    requiredCapabilities?: string[];
  };

  if (!taskDescription) {
    return jsonError(400, "taskDescription is required");
  }

  const availableBots = db
    .select({
      id: bots.id,
      name: bots.name,
      capabilities: bots.capabilities,
      environment: bots.environment,
      status: bots.status,
    })
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .all()
    .filter((b) => b.status !== "offline");

  if (availableBots.length === 0) {
    return NextResponse.json({ rankings: [], recommendation: "No bots available" });
  }

  try {
    const model = getModel(ctx.workspaceId);

    const botSummaries = availableBots.map((b) => ({
      id: b.id,
      name: b.name,
      capabilities: JSON.parse(b.capabilities),
      environment: b.environment,
      status: b.status,
    }));

    const { object } = await generateObject({
      model,
      schema: matchResultSchema,
      prompt: `You are a bot-task matching engine. Given a task description and available bots, score each bot 0-100 on how well-suited it is for the task.

Task Description: ${taskDescription}
${requiredCapabilities?.length ? `Required Capabilities: ${requiredCapabilities.join(", ")}` : ""}

Available Bots:
${JSON.stringify(botSummaries, null, 2)}

Score each bot based on capability match, current status (idle > working), and environment fit. Return rankings sorted by score descending.`,
    });

    return NextResponse.json(object);
  } catch {
    return jsonError(500, "AI bot matching failed. Check AI provider configuration.");
  }
}
