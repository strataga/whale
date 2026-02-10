/**
 * Agent reputation scoring based on task outcomes.
 * Scores range from 0-100, starting at 50.
 */

import { eq, sql } from "drizzle-orm";

import { agents, botTasks } from "@/lib/db/schema";
import type { AnyDb } from "@/types";

/**
 * Recalculate reputation for an agent based on their task history.
 * Returns the new reputation score (0-100).
 */
export function recalculateReputation(db: AnyDb, agentId: string): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const agent = d
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .get();

  if (!agent) return 50;

  // If agent has a linked bot, compute from botTasks
  if (agent.botId) {
    const stats = d
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        completed: sql<number>`sum(case when ${botTasks.status} = 'completed' then 1 else 0 end)`.mapWith(Number),
        failed: sql<number>`sum(case when ${botTasks.status} = 'failed' then 1 else 0 end)`.mapWith(Number),
        avgDuration: sql<number>`avg(case when ${botTasks.completedAt} is not null then ${botTasks.completedAt} - ${botTasks.startedAt} else null end)`.mapWith(Number),
      })
      .from(botTasks)
      .where(eq(botTasks.botId, agent.botId))
      .get();

    if (!stats || stats.total === 0) return 50;

    const completionRate = (stats.completed ?? 0) / stats.total;
    // Score is weighted: 70% completion rate, 30% speed bonus
    // Speed bonus: faster average duration = higher score
    const baseScore = completionRate * 70;
    const avgMs = stats.avgDuration ?? 0;
    // Speed bonus: cap at 30 points. Under 5 minutes = full bonus; over 1 hour = 0
    const speedBonus = avgMs > 0 ? Math.max(0, 30 * (1 - Math.min(avgMs / 3_600_000, 1))) : 15;

    const score = Math.round(Math.min(100, Math.max(0, baseScore + speedBonus)));

    // Persist the computed reputation
    d.update(agents)
      .set({ reputation: score, updatedAt: Date.now() })
      .where(eq(agents.id, agentId))
      .run();

    return score;
  }

  // For external agents without bot linkage, keep existing reputation
  return agent.reputation ?? 50;
}

/**
 * Record a task outcome for reputation tracking.
 * Incremental update without full recalculation.
 */
export function recordTaskOutcome(
  db: AnyDb,
  agentId: string,
  outcome: "completed" | "failed",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _durationMs?: number,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const agent = d
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .get();

  if (!agent) return;

  const currentRep = agent.reputation ?? 50;
  // Simple exponential moving average adjustment
  const delta = outcome === "completed" ? 2 : -5;
  const newRep = Math.min(100, Math.max(0, currentRep + delta));

  d.update(agents)
    .set({ reputation: newRep, updatedAt: Date.now() })
    .where(eq(agents.id, agentId))
    .run();
}
