import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export function logAudit(params: {
  workspaceId: string;
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  db.insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      userId: params.userId ?? null,
      action: params.action,
      metadata: JSON.stringify(params.metadata ?? {}),
    })
    .run();
}
