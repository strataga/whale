import { eq, and } from "drizzle-orm";

import { serviceAgreements } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { select: any; insert: any; update: any; delete: any };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SLAValidationResult {
  valid: boolean;
  agreement?: typeof serviceAgreements.$inferSelect;
}

interface SLABreachResult {
  breached: boolean;
  details?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate whether a valid SLA / service agreement exists for a given agent
 * and skill combination. If skillId is provided, checks for a skill-specific
 * agreement first, then falls back to an agent-level agreement (skillId = null).
 */
export function validateSLA(
  db: AnyDb,
  agentId: string,
  skillId: string,
): SLAValidationResult {
  // Try skill-specific agreement first
  const skillAgreement = db
    .select()
    .from(serviceAgreements)
    .where(
      and(
        eq(serviceAgreements.agentId, agentId),
        eq(serviceAgreements.skillId, skillId),
      ),
    )
    .get();

  if (skillAgreement) {
    return { valid: true, agreement: skillAgreement };
  }

  // Fall back to agent-level agreement (no specific skillId)
  const agentAgreements = db
    .select()
    .from(serviceAgreements)
    .where(eq(serviceAgreements.agentId, agentId))
    .all();

  // Find one without a skillId (agent-wide agreement)
  const agentWide = agentAgreements.find(
    (a: typeof serviceAgreements.$inferSelect) => !a.skillId,
  );

  if (agentWide) {
    return { valid: true, agreement: agentWide };
  }

  // No agreement found
  return { valid: false };
}

/**
 * Check whether an agent has breached its SLA based on response time
 * and task duration metrics. Checks against ALL active service agreements
 * for the agent.
 */
export function checkSLABreach(
  db: AnyDb,
  agentId: string,
  responseTimeMs: number,
  taskDurationMs: number,
): SLABreachResult {
  const agreements = db
    .select()
    .from(serviceAgreements)
    .where(eq(serviceAgreements.agentId, agentId))
    .all();

  if (agreements.length === 0) {
    return { breached: false };
  }

  const breaches: string[] = [];

  for (const agreement of agreements) {
    const slaLabel = agreement.skillId
      ? `SLA(skill=${agreement.skillId})`
      : `SLA(agent-wide)`;

    if (
      agreement.maxResponseMs != null &&
      responseTimeMs > agreement.maxResponseMs
    ) {
      breaches.push(
        `${slaLabel}: response time ${responseTimeMs}ms exceeds max ${agreement.maxResponseMs}ms`,
      );
    }

    if (
      agreement.maxDurationMs != null &&
      taskDurationMs > agreement.maxDurationMs
    ) {
      breaches.push(
        `${slaLabel}: task duration ${taskDurationMs}ms exceeds max ${agreement.maxDurationMs}ms`,
      );
    }
  }

  if (breaches.length > 0) {
    return { breached: true, details: breaches.join("; ") };
  }

  return { breached: false };
}
