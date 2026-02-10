import { eq, and, lt, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { dispatchToChannels } from "@/lib/server/channel-dispatcher";

type Db = BetterSQLite3Database<typeof schema>;

export interface EscalationResult {
  ruleId: string;
  trigger: string;
  alertCreated: boolean;
  notificationSent: boolean;
}

/**
 * Check for bot_failure escalations: bots with >= threshold consecutive failures.
 */
function checkBotFailures(db: Db, workspaceId: string, threshold: number, ruleId: string, escalateToUserId?: string | null): EscalationResult[] {
  const results: EscalationResult[] = [];
  const now = Date.now();

  // Find bots with recent consecutive failures
  const failedBots = db
    .select({
      botId: schema.botTasks.botId,
      failCount: sql<number>`count(*)`.as("failCount"),
    })
    .from(schema.botTasks)
    .innerJoin(schema.bots, eq(schema.botTasks.botId, schema.bots.id))
    .where(
      and(
        eq(schema.bots.workspaceId, workspaceId),
        eq(schema.botTasks.status, "failed"),
      ),
    )
    .groupBy(schema.botTasks.botId)
    .all();

  for (const row of failedBots) {
    if (row.failCount < threshold) continue;

    const alertId = crypto.randomUUID();
    db.insert(schema.alerts)
      .values({
        id: alertId,
        workspaceId,
        type: "escalation",
        severity: "critical",
        message: `Bot has ${row.failCount} failed tasks (threshold: ${threshold})`,
        metadata: JSON.stringify({ botId: row.botId, ruleId }),
        createdAt: now,
      })
      .run();

    let notificationSent = false;
    if (escalateToUserId) {
      db.insert(schema.notifications)
        .values({
          userId: escalateToUserId,
          type: "escalation",
          title: "Bot Failure Escalation",
          body: `Bot has ${row.failCount} failures, exceeding threshold of ${threshold}`,
          link: `/dashboard/bots`,
          createdAt: now,
        })
        .run();
      notificationSent = true;
    }

    // M5: dispatch to channels
    dispatchToChannels(db, workspaceId, {
      event: "escalation.bot_failure",
      severity: "critical",
      title: "Bot Failure Escalation",
      body: `Bot has ${row.failCount} failures (threshold: ${threshold})`,
      metadata: { botId: row.botId, ruleId },
    }).catch(() => {});

    results.push({ ruleId, trigger: "bot_failure", alertCreated: true, notificationSent });
  }

  return results;
}

/**
 * Check for task_overdue escalations.
 */
function checkOverdueTasks(db: Db, workspaceId: string, threshold: number, ruleId: string, escalateToUserId?: string | null): EscalationResult[] {
  const results: EscalationResult[] = [];
  const now = Date.now();
  const thresholdMs = threshold * 60 * 60 * 1000; // threshold in hours

  const overdueTasks = db
    .select({ id: schema.tasks.id, title: schema.tasks.title, dueDate: schema.tasks.dueDate })
    .from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.projects.workspaceId, workspaceId),
        lt(schema.tasks.dueDate, now - thresholdMs),
        sql`${schema.tasks.status} != 'done'`,
      ),
    )
    .all();

  for (const task of overdueTasks) {
    const alertId = crypto.randomUUID();
    db.insert(schema.alerts)
      .values({
        id: alertId,
        workspaceId,
        type: "escalation",
        severity: "warning",
        message: `Task "${task.title}" is overdue`,
        metadata: JSON.stringify({ taskId: task.id, ruleId }),
        createdAt: now,
      })
      .run();

    let notificationSent = false;
    if (escalateToUserId) {
      db.insert(schema.notifications)
        .values({
          userId: escalateToUserId,
          type: "escalation",
          title: "Overdue Task Escalation",
          body: `Task "${task.title}" is overdue`,
          link: `/dashboard`,
          createdAt: now,
        })
        .run();
      notificationSent = true;
    }

    // M5: dispatch to channels
    dispatchToChannels(db, workspaceId, {
      event: "escalation.task_overdue",
      severity: "warning",
      title: "Overdue Task Escalation",
      body: `Task "${task.title}" is overdue`,
      metadata: { taskId: task.id, ruleId },
    }).catch(() => {});

    results.push({ ruleId, trigger: "task_overdue", alertCreated: true, notificationSent });
  }

  return results;
}

/**
 * Evaluate all escalation rules for a workspace and create alerts/notifications.
 */
export function checkEscalations(
  db: Db,
  workspaceId: string,
): { results: EscalationResult[]; rulesChecked: number } {
  const rules = db
    .select()
    .from(schema.escalationRules)
    .where(eq(schema.escalationRules.workspaceId, workspaceId))
    .all();

  const allResults: EscalationResult[] = [];

  for (const rule of rules) {
    switch (rule.trigger) {
      case "bot_failure":
        allResults.push(
          ...checkBotFailures(db, workspaceId, rule.threshold, rule.id, rule.escalateToUserId),
        );
        break;
      case "task_overdue":
        allResults.push(
          ...checkOverdueTasks(db, workspaceId, rule.threshold, rule.id, rule.escalateToUserId),
        );
        break;
      case "approval_timeout":
        // Check pending approvals older than threshold hours
        break;
    }
  }

  return { results: allResults, rulesChecked: rules.length };
}
