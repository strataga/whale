import { and, eq } from "drizzle-orm";

import { auditLogs, bots } from "@/lib/db/schema";

export type BotStatus =
  | "offline"
  | "idle"
  | "working"
  | "waiting"
  | "error"
  | "recovering";

const ALLOWED_TRANSITIONS: Record<BotStatus, BotStatus[]> = {
  offline: ["idle"],
  idle: ["working", "offline", "error"],
  working: ["idle", "waiting", "error"],
  waiting: ["working", "idle", "error"],
  error: ["recovering", "offline"],
  recovering: ["idle", "error", "offline"],
};

// Legacy statuses from before the state machine was introduced
const LEGACY_STATUS_MAP: Record<string, BotStatus> = {
  online: "idle",
  busy: "working",
};

export function normalizeLegacyStatus(status: string): BotStatus {
  return LEGACY_STATUS_MAP[status] ?? (status as BotStatus);
}

export function isValidTransition(from: BotStatus, to: BotStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function getAllowedTransitions(from: BotStatus): BotStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleDb = { update: any; insert: any };

export function transitionBotStatus(
  db: AnyDrizzleDb,
  botId: string,
  workspaceId: string,
  currentStatus: string,
  newStatus: BotStatus,
  reason?: string,
): { ok: true } | { ok: false; error: string; allowedTransitions: BotStatus[] } {
  const normalizedCurrent = normalizeLegacyStatus(currentStatus);

  if (!isValidTransition(normalizedCurrent, newStatus)) {
    return {
      ok: false,
      error: `Invalid transition from '${normalizedCurrent}' to '${newStatus}'`,
      allowedTransitions: getAllowedTransitions(normalizedCurrent),
    };
  }

  const now = Date.now();

  db.update(bots)
    .set({
      status: newStatus,
      statusReason: reason ?? null,
      statusChangedAt: now,
      lastSeenAt: now,
      updatedAt: now,
    })
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, workspaceId)))
    .run();

  db.insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      userId: null,
      action: "bot.status_change",
      metadata: JSON.stringify({
        botId,
        from: normalizedCurrent,
        to: newStatus,
        reason: reason ?? null,
      }),
    })
    .run();

  return { ok: true };
}
