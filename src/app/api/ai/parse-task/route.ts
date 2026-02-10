import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";
import { naturalLanguageTaskSchema } from "@/lib/validators";
import { ZodError } from "zod";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

const parsedTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().nullable(),
  tags: z.array(z.string()),
});

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const { text } = naturalLanguageTaskSchema.parse(body);

    const model = getModel(ctx.workspaceId);

    const { object } = await generateObject({
      model,
      schema: parsedTaskSchema,
      prompt: `Parse the following natural language into a structured task.

Input: "${text}"

Today's date is ${new Date().toISOString().slice(0, 10)}.

Extract:
- title: A clear, concise task title
- description: Any additional details or context
- priority: low, medium, high, or urgent (infer from language like "ASAP", "urgent", "whenever", etc.)
- dueDate: ISO date string if mentioned (e.g. "Friday" → next Friday's date, "tomorrow" → tomorrow), or null
- tags: Any categories/labels that apply`,
    });

    return NextResponse.json({ parsed: object });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to parse task");
  }
}
