import { eq, and, sql, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

/**
 * Find tasks whose dependencies are all resolved (status = 'done')
 * and that haven't been assigned to bots yet.
 */
export function findReadyTasks(
  db: Db,
  workspaceId: string,
): Array<{ id: string; title: string; projectId: string | null; priority: string }> {
  // Get all tasks in the workspace that are in 'todo' status
  const todoTasks = db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      projectId: schema.tasks.projectId,
      priority: schema.tasks.priority,
    })
    .from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.projects.workspaceId, workspaceId),
        eq(schema.tasks.status, "todo"),
      ),
    )
    .all();

  const readyTasks: typeof todoTasks = [];

  for (const task of todoTasks) {
    // Check if this task has unresolved dependencies
    const deps = db
      .select({ dependsOnTaskId: schema.taskDependencies.dependsOnTaskId })
      .from(schema.taskDependencies)
      .where(eq(schema.taskDependencies.taskId, task.id))
      .all();

    if (deps.length === 0) {
      readyTasks.push(task);
      continue;
    }

    // Check if all dependencies are done
    const depIds = deps.map((d) => d.dependsOnTaskId);
    const doneDeps = db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(
        and(
          inArray(schema.tasks.id, depIds),
          eq(schema.tasks.status, "done"),
        ),
      )
      .all();

    if (doneDeps.length === depIds.length) {
      readyTasks.push(task);
    }
  }

  // Check which tasks already have active bot assignments
  const withActiveBotTasks = readyTasks.filter((task) => {
    const activeBotTask = db
      .select({ id: schema.botTasks.id })
      .from(schema.botTasks)
      .where(
        and(
          eq(schema.botTasks.taskId, task.id),
          inArray(schema.botTasks.status, ["pending", "running"]),
        ),
      )
      .get();
    return !activeBotTask;
  });

  // Sort by priority (urgent > high > medium > low)
  const priorityOrder: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return withActiveBotTasks.sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
  );
}

/**
 * Find available bots (idle or with capacity for concurrent tasks).
 */
export function findAvailableBots(
  db: Db,
  workspaceId: string,
): Array<{ id: string; name: string; capabilities: string; maxConcurrentTasks: number; activeTasks: number }> {
  const bots = db
    .select()
    .from(schema.bots)
    .where(
      and(
        eq(schema.bots.workspaceId, workspaceId),
        inArray(schema.bots.status, ["idle", "working"]),
      ),
    )
    .all();

  return bots
    .map((bot) => {
      const activeTasks = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.botTasks)
        .where(
          and(
            eq(schema.botTasks.botId, bot.id),
            inArray(schema.botTasks.status, ["pending", "running"]),
          ),
        )
        .get();
      return {
        id: bot.id,
        name: bot.name,
        capabilities: bot.capabilities,
        maxConcurrentTasks: bot.maxConcurrentTasks,
        activeTasks: activeTasks?.count ?? 0,
      };
    })
    .filter((bot) => bot.activeTasks < bot.maxConcurrentTasks);
}

/**
 * Auto-assign ready tasks to available bots (simple round-robin).
 */
export function scheduleReadyTasks(
  db: Db,
  workspaceId: string,
): { assigned: Array<{ taskId: string; botId: string; botTaskId: string }> } {
  const readyTasks = findReadyTasks(db, workspaceId);
  const availableBots = findAvailableBots(db, workspaceId);
  const assigned: Array<{ taskId: string; botId: string; botTaskId: string }> = [];

  if (availableBots.length === 0 || readyTasks.length === 0) {
    return { assigned };
  }

  let botIndex = 0;
  const now = Date.now();

  for (const task of readyTasks) {
    if (botIndex >= availableBots.length) break;

    const bot = availableBots[botIndex];
    const botTaskId = crypto.randomUUID();

    db.insert(schema.botTasks)
      .values({
        id: botTaskId,
        botId: bot.id,
        taskId: task.id,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.update(schema.tasks)
      .set({ status: "in_progress", updatedAt: now })
      .where(eq(schema.tasks.id, task.id))
      .run();

    assigned.push({ taskId: task.id, botId: bot.id, botTaskId });

    // Move to next bot (or stay if bot has more capacity)
    bot.activeTasks++;
    if (bot.activeTasks >= bot.maxConcurrentTasks) {
      botIndex++;
    }
  }

  return { assigned };
}
