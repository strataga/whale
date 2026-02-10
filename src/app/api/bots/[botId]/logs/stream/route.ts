import { eq, desc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { botLogs } from "@/lib/db/schema";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

/**
 * SSE endpoint for live bot log streaming (#38).
 * Like `kubectl logs -f` — streams new log entries as they arrive.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const auth = await getAuthContext();
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const levelFilter = url.searchParams.get("level");

  const encoder = new TextEncoder();
  let lastSeenCreatedAt = Date.now();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          let logs = db
            .select()
            .from(botLogs)
            .where(and(eq(botLogs.botId, botId), eq(botLogs.workspaceId, auth.workspaceId)))
            .orderBy(desc(botLogs.createdAt))
            .limit(50)
            .all()
            .filter((l) => l.createdAt > lastSeenCreatedAt);

          if (levelFilter) {
            logs = logs.filter((l) => l.level === levelFilter);
          }

          // Send oldest first
          logs.reverse();

          for (const log of logs) {
            const data = JSON.stringify({
              id: log.id,
              level: log.level,
              message: log.message,
              metadata: log.metadata,
              botTaskId: log.botTaskId,
              createdAt: log.createdAt,
            });
            controller.enqueue(encoder.encode(`event: log\ndata: ${data}\n\n`));
            if (log.createdAt > lastSeenCreatedAt) {
              lastSeenCreatedAt = log.createdAt;
            }
          }

          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(interval);
          closed = true;
          controller.close();
        }
      }, 2000);
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
