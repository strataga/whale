import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getModel, generatePlanSchema } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAuthContext } from '@/lib/server/auth-context';

export const runtime = 'nodejs';

const inputSchema = z.object({
  goal: z.string().min(1),
  context: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(`ai:${ctx.userId}`, { limit: 10, windowMs: 60_000 });
  if (rl) {
    return NextResponse.json({ error: rl.error }, { status: rl.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { goal, context } = parsed.data;

  try {
    const { object: plan } = await generateObject({
      model: getModel(ctx.workspaceId),
      schema: generatePlanSchema,
      system:
        'You are a project planning assistant for Whale. Given a user goal, generate a comprehensive project plan with milestones and tasks. Be specific and actionable. Break down the work into concrete, achievable tasks organized under clear milestones.',
      prompt: [
        `Goal:\n${goal}`,
        context ? `Context:\n${context}` : null,
        'Return a plan that matches the required JSON schema.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    });

    // Return the plan WITHOUT persisting — the UI shows a review step,
    // then persists via POST /api/projects + milestones + tasks on "Accept".
    return NextResponse.json({
      scope: plan.scope,
      milestones: plan.milestones,
      risks: plan.risks,
      successCriteria: plan.successCriteria,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'AI generation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
