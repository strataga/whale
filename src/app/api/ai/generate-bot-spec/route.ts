import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";

import { getModel } from "@/lib/ai";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const botSpecSchema = z.object({
  title: z.string(),
  description: z.string(),
  steps: z.array(
    z.object({
      order: z.number(),
      action: z.string(),
      expectedOutput: z.string().optional(),
    }),
  ),
  requiredCapabilities: z.array(z.string()),
  estimatedMinutes: z.number().optional(),
  successCriteria: z.string(),
  errorHandling: z.string(),
});

/**
 * #27 Natural Language Bot Instructions — converts plain English to structured bot task spec.
 */
export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  const body = await req.json();
  const { instruction, context } = body as {
    instruction?: string;
    context?: string;
  };

  if (!instruction) {
    return jsonError(400, "instruction is required");
  }

  try {
    const model = getModel(ctx.workspaceId);

    const { object } = await generateObject({
      model,
      schema: botSpecSchema,
      prompt: `You are a bot task specification generator. Convert the following natural language instruction into a structured task specification that an automated bot can execute.

User Instruction: ${instruction}
${context ? `Additional Context: ${context}` : ""}

Generate:
- A clear title and description
- Ordered steps the bot should follow
- Required capabilities (e.g., "code-review", "test-runner", "deploy")
- Estimated time in minutes
- Success criteria for verification
- Error handling guidance`,
    });

    return NextResponse.json({ spec: object });
  } catch {
    return jsonError(500, "AI spec generation failed. Check AI provider configuration.");
  }
}
