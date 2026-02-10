import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { dispatchToChannels } from "@/lib/server/channel-dispatcher";

type Db = BetterSQLite3Database<typeof schema>;

export interface RuleCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "in";
  value: unknown;
}

export interface RuleAction {
  type: "update_status" | "assign_bot" | "add_tag" | "notify" | "create_subtask" | "escalate" | "send_to_channel";
  params: Record<string, unknown>;
}

/**
 * Evaluate a set of conditions against a payload.
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  payload: Record<string, unknown>,
): boolean {
  for (const cond of conditions) {
    const actual = payload[cond.field];
    switch (cond.operator) {
      case "eq":
        if (actual !== cond.value) return false;
        break;
      case "neq":
        if (actual === cond.value) return false;
        break;
      case "gt":
        if (typeof actual !== "number" || actual <= (cond.value as number)) return false;
        break;
      case "lt":
        if (typeof actual !== "number" || actual >= (cond.value as number)) return false;
        break;
      case "contains":
        if (typeof actual !== "string" || !actual.includes(cond.value as string)) return false;
        break;
      case "in":
        if (!Array.isArray(cond.value) || !cond.value.includes(actual)) return false;
        break;
    }
  }
  return true;
}

/**
 * Execute a single action.
 */
export function executeAction(
  db: Db,
  action: RuleAction,
  context: { taskId?: string; botId?: string; workspaceId: string },
): { executed: boolean; detail?: string } {
  const now = Date.now();
  switch (action.type) {
    case "update_status": {
      if (!context.taskId) return { executed: false, detail: "no taskId" };
      const status = action.params.status as string;
      db.update(schema.tasks)
        .set({ status, updatedAt: now })
        .where(eq(schema.tasks.id, context.taskId))
        .run();
      return { executed: true, detail: `status → ${status}` };
    }
    case "add_tag": {
      if (!context.taskId) return { executed: false, detail: "no taskId" };
      const tag = action.params.tag as string;
      const task = db
        .select({ tags: schema.tasks.tags })
        .from(schema.tasks)
        .where(eq(schema.tasks.id, context.taskId))
        .get();
      if (!task) return { executed: false, detail: "task not found" };
      const tags: string[] = JSON.parse(task.tags);
      if (!tags.includes(tag)) {
        tags.push(tag);
        db.update(schema.tasks)
          .set({ tags: JSON.stringify(tags), updatedAt: now })
          .where(eq(schema.tasks.id, context.taskId))
          .run();
      }
      return { executed: true, detail: `added tag '${tag}'` };
    }
    case "notify": {
      const message = action.params.message as string;
      const userId = action.params.userId as string | undefined;
      if (userId) {
        db.insert(schema.notifications)
          .values({
            userId,
            type: "automation",
            title: "Automation Rule Triggered",
            body: message ?? "An automation rule was triggered",
            createdAt: now,
          })
          .run();
      }
      // M5: Also dispatch to configured channels
      dispatchToChannels(db, context.workspaceId, {
        event: "automation.notify",
        severity: "info",
        title: "Automation Rule Triggered",
        body: message ?? "An automation rule was triggered",
        metadata: { taskId: context.taskId, botId: context.botId },
      }).catch(() => {});
      return { executed: true, detail: "notification sent" };
    }
    case "create_subtask": {
      if (!context.taskId) return { executed: false, detail: "no taskId" };
      db.insert(schema.subtasks)
        .values({
          taskId: context.taskId,
          title: (action.params.title as string) ?? "Auto-generated subtask",
          createdAt: now,
        })
        .run();
      return { executed: true, detail: "subtask created" };
    }
    case "escalate": {
      const escalateMsg = (action.params.message as string) ?? "Automated escalation triggered";
      db.insert(schema.alerts)
        .values({
          workspaceId: context.workspaceId,
          type: "escalation",
          severity: "warning",
          message: escalateMsg,
          metadata: JSON.stringify({ taskId: context.taskId, botId: context.botId }),
          createdAt: now,
        })
        .run();
      // M5: Also dispatch to channels
      dispatchToChannels(db, context.workspaceId, {
        event: "automation.escalation",
        severity: "warning",
        title: "Escalation Triggered",
        body: escalateMsg,
        metadata: { taskId: context.taskId, botId: context.botId },
      }).catch(() => {});
      return { executed: true, detail: "escalation alert created" };
    }
    case "send_to_channel": {
      const channelMsg = (action.params.message as string) ?? "Channel notification from rule";
      const channelSeverity = (action.params.severity as "info" | "warning" | "critical") ?? "info";
      dispatchToChannels(db, context.workspaceId, {
        event: (action.params.event as string) ?? "automation.channel",
        severity: channelSeverity,
        title: (action.params.title as string) ?? "Rule Action",
        body: channelMsg,
        metadata: { taskId: context.taskId, botId: context.botId },
      }).catch(() => {});
      return { executed: true, detail: "dispatched to channels" };
    }
    default:
      return { executed: false, detail: `unknown action type: ${action.type}` };
  }
}

/**
 * Evaluate all active automation rules for a given trigger and payload.
 * Returns the list of rules that matched and the actions executed.
 */
export function evaluateRules(
  db: Db,
  trigger: string,
  payload: Record<string, unknown>,
  context: { taskId?: string; botId?: string; workspaceId: string },
): { matched: number; actionsExecuted: number; results: Array<{ ruleName: string; actions: string[] }> } {
  const rules = db
    .select()
    .from(schema.automationRules)
    .where(
      and(
        eq(schema.automationRules.workspaceId, context.workspaceId),
        eq(schema.automationRules.trigger, trigger),
        eq(schema.automationRules.active, 1),
      ),
    )
    .all();

  let matched = 0;
  let actionsExecuted = 0;
  const results: Array<{ ruleName: string; actions: string[] }> = [];

  for (const rule of rules) {
    const conditions: RuleCondition[] = JSON.parse(rule.conditions);
    if (!evaluateConditions(conditions, payload)) continue;

    matched++;
    const actions: RuleAction[] = JSON.parse(rule.actions);
    const actionResults: string[] = [];

    for (const action of actions) {
      const result = executeAction(db, action, context);
      if (result.executed) actionsExecuted++;
      actionResults.push(`${action.type}: ${result.detail}`);
    }

    results.push({ ruleName: rule.name, actions: actionResults });
  }

  return { matched, actionsExecuted, results };
}
