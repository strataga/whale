import { generateObject } from 'ai';
import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dailyPlanSchema, getModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { projects, tasks } from '@/lib/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAuthContext } from '@/lib/server/auth-context';

export const runtime = 'nodejs';

const inputSchema = z.object({
  projectId: z.string().uuid(),
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

  const { projectId } = parsed.data;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const activeTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), ne(tasks.status, 'done')));

  if (activeTasks.length === 0) {
    return NextResponse.json({
      projectId: project.id,
      mustDo: [],
      niceToDo: [],
      finishThis: [],
    });
  }

  const tasksById = new Map(activeTasks.map((t) => [t.id, t]));

  try {
    const { object: dailyPlan } = await generateObject({
      model: getModel(ctx.workspaceId),
      schema: dailyPlanSchema,
      system:
        'You are a daily planning assistant. Given active tasks with priorities and due dates, select the optimal daily plan: 3 must-do tasks (highest impact), 2 nice-to-do tasks, and 1 finish-this task (something partially started). Explain your reasoning.',
      prompt: [
        `Today: ${new Date().toISOString().slice(0, 10)}`,
        'Active tasks (status != done):',
        JSON.stringify(
          activeTasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            milestoneId: t.milestoneId,
          })),
          null,
          2,
        ),
        'Pick task IDs from the list above. Do not invent task IDs.',
      ].join('\n\n'),
    });

    // Flatten { task, reasoning } into PlanItem shape the client expects:
    // { id, title, status, priority }
    const flatten = (items: Array<{ taskId: string; reasoning: string }>) =>
      items
        .map(({ taskId }) => {
          const task = tasksById.get(taskId);
          if (!task) return null;
          return {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({
      projectId: project.id,
      mustDo: flatten(dailyPlan.mustDo),
      niceToDo: flatten(dailyPlan.niceToDo),
      finishThis: flatten(dailyPlan.finishThis),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'AI generation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
