import { generateObject } from 'ai';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getModel, replanSchema } from '@/lib/ai';
import { db } from '@/lib/db';
import { milestones, projects, tasks } from '@/lib/db/schema';
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

  const milestoneRows = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId));

  const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

  const milestoneIdSet = new Set(milestoneRows.map((m) => m.id));
  const existingMaxPosition = taskRows.reduce(
    (max, t) => Math.max(max, typeof t.position === 'number' ? t.position : 0),
    0,
  );

  try {
    const { object: replan } = await generateObject({
      model: getModel(ctx.workspaceId),
      schema: replanSchema,
      system:
        'You are a project replanning assistant. Review the current project state and suggest: task updates (reprioritize, change status), new tasks to add, tasks to remove (if obsolete). Focus on keeping the project moving forward efficiently.',
      prompt: JSON.stringify(
        {
          project: {
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
          },
          milestones: milestoneRows.map((m) => ({
            id: m.id,
            name: m.name,
            dueDate: m.dueDate,
            position: m.position,
          })),
          tasks: taskRows.map((t) => ({
            id: t.id,
            milestoneId: t.milestoneId,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            position: t.position,
          })),
        },
        null,
        2,
      ),
    });

    const now = Date.now();

    await db.transaction(async (tx) => {
      for (const update of replan.updates) {
        const changes = update.changes;
        const set: Record<string, unknown> = {};

        if (changes.status !== undefined) set.status = changes.status;
        if (changes.priority !== undefined) set.priority = changes.priority;
        if (changes.title !== undefined) set.title = changes.title;
        if (changes.description !== undefined) set.description = changes.description;

        if (Object.keys(set).length === 0) continue;

        set.updatedAt = now;

        await tx
          .update(tasks)
          .set(set)
          .where(and(eq(tasks.id, update.taskId), eq(tasks.projectId, projectId)));
      }

      if (replan.removals.length > 0) {
        for (const taskId of replan.removals) {
          await tx
            .delete(tasks)
            .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));
        }
      }

      for (let i = 0; i < replan.newTasks.length; i += 1) {
        const newTask = replan.newTasks[i];
        const milestoneId =
          newTask.milestoneId && milestoneIdSet.has(newTask.milestoneId)
            ? newTask.milestoneId
            : null;

        await tx.insert(tasks).values({
          id: crypto.randomUUID(),
          projectId,
          milestoneId,
          title: newTask.title,
          description: newTask.description,
          status: 'todo',
          priority: newTask.priority,
          assigneeId: null,
          dueDate: null,
          tags: '[]',
          position: existingMaxPosition + i + 1,
        });
      }
    });

    return NextResponse.json({
      updates: replan.updates,
      newTasks: replan.newTasks,
      removals: replan.removals,
      reasoning: replan.reasoning,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'AI replan failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
