/**
 * Checkout session state machine.
 * open -> authorized -> captured -> settled
 * authorized -> refunded
 * captured -> refunded
 */

import { eq } from "drizzle-orm";

import { checkoutSessions, orders } from "@/lib/db/schema";
import type { AnyDb } from "@/types";

const VALID_TRANSITIONS: Record<string, string[]> = {
  authorize: ["open"],
  capture: ["authorized"],
  settle: ["captured"],
  refund: ["authorized", "captured"],
};

const ACTION_TO_STATUS: Record<string, string> = {
  authorize: "authorized",
  capture: "captured",
  settle: "settled",
  refund: "refunded",
};

export function processCheckout(
  db: AnyDb,
  sessionId: string,
  action: "authorize" | "capture" | "settle" | "refund",
): { ok: boolean; error?: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;

  const session = d
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.id, sessionId))
    .get();

  if (!session) {
    return { ok: false, error: "Checkout session not found" };
  }

  // Check expiry for open sessions
  if (session.status === "open" && session.expiresAt && session.expiresAt < Date.now()) {
    d.update(checkoutSessions)
      .set({ status: "expired", updatedAt: Date.now() })
      .where(eq(checkoutSessions.id, sessionId))
      .run();
    return { ok: false, error: "Checkout session has expired" };
  }

  const validFromStates = VALID_TRANSITIONS[action];
  if (!validFromStates || !validFromStates.includes(session.status)) {
    return {
      ok: false,
      error: `Cannot ${action} session in status '${session.status}'`,
    };
  }

  const newStatus = ACTION_TO_STATUS[action];
  d.update(checkoutSessions)
    .set({ status: newStatus, updatedAt: Date.now() })
    .where(eq(checkoutSessions.id, sessionId))
    .run();

  // On settlement, also update any linked order
  if (action === "settle") {
    d.update(orders)
      .set({ status: "fulfilled", updatedAt: Date.now() })
      .where(eq(orders.checkoutSessionId, sessionId))
      .run();
  }

  return { ok: true };
}
