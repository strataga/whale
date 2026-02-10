import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

/**
 * SSE endpoint for live updates (#37).
 * Polls audit log for new entries and streams them as Server-Sent Events.
 */
export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let lastSeenId: string | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const query = lastSeenId
            ? db
                .select()
                .from(auditLogs)
                .where(eq(auditLogs.workspaceId, auth.workspaceId))
                .orderBy(desc(auditLogs.createdAt))
                .limit(20)
                .all()
                .filter((log) => log.id !== lastSeenId)
            : db
                .select()
                .from(auditLogs)
                .where(eq(auditLogs.workspaceId, auth.workspaceId))
                .orderBy(desc(auditLogs.createdAt))
                .limit(1)
                .all();

          for (const log of query) {
            const data = JSON.stringify({
              id: log.id,
              action: log.action,
              metadata: log.metadata,
              createdAt: log.createdAt,
            });
            controller.enqueue(encoder.encode(`event: audit\ndata: ${data}\n\n`));
            lastSeenId = log.id;
          }

          // Keepalive
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // DB might be closed during shutdown
          clearInterval(interval);
          closed = true;
          controller.close();
        }
      }, 3000);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
