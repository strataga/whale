/**
 * M5 1.5: Channel dispatcher — core dispatch to all channel types.
 *
 * Queries active channels matching event + severity, formats per-type payloads,
 * creates delivery records, and retries with exponential backoff.
 */
import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createHmac } from "node:crypto";
import * as schema from "@/lib/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

const SEVERITY_LEVELS: Record<string, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export interface ChannelMessage {
  event: string;
  severity?: "info" | "warning" | "critical";
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/**
 * Match an event string against a glob pattern.
 * Supports `*` as a single-segment wildcard and `**` or bare `*` as match-all.
 */
export function matchEventGlob(event: string, pattern: string): boolean {
  if (pattern === "*" || pattern === "**") return true;
  // Convert glob to regex: task.* → task\.[^.]+
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "@@GLOBSTAR@@")
    .replace(/\*/g, "[^.]+")
    .replace(/@@GLOBSTAR@@/g, ".*");
  return new RegExp(`^${regexStr}$`).test(event);
}

/**
 * Format a Slack Block Kit payload.
 */
function formatSlack(msg: ChannelMessage): string {
  return JSON.stringify({
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: msg.title },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: msg.body },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `*Event:* \`${msg.event}\` | *Severity:* ${msg.severity ?? "info"}` },
        ],
      },
    ],
  });
}

/**
 * Format a Discord embed payload.
 */
function formatDiscord(msg: ChannelMessage): string {
  const colorMap: Record<string, number> = {
    info: 0x3498db,
    warning: 0xf39c12,
    critical: 0xe74c3c,
  };
  return JSON.stringify({
    embeds: [
      {
        title: msg.title,
        description: msg.body,
        color: colorMap[msg.severity ?? "info"] ?? 0x3498db,
        footer: { text: `Event: ${msg.event}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/**
 * Format an HMAC-signed webhook payload.
 */
function formatWebhook(msg: ChannelMessage, secret: string): { body: string; signature: string } {
  const body = JSON.stringify({
    event: msg.event,
    severity: msg.severity ?? "info",
    title: msg.title,
    body: msg.body,
    metadata: msg.metadata ?? {},
    timestamp: Date.now(),
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return { body, signature };
}

interface DeliveryAttemptResult {
  success: boolean;
  status?: number;
  error?: string;
}

/**
 * Attempt delivery to a single channel with retries.
 */
async function deliverToChannel(
  channelType: string,
  config: Record<string, unknown>,
  msg: ChannelMessage,
): Promise<DeliveryAttemptResult> {
  const url = config.url as string | undefined;

  switch (channelType) {
    case "slack_webhook": {
      if (!url) return { success: false, error: "No URL configured" };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: formatSlack(msg),
        signal: AbortSignal.timeout(10_000),
      });
      return { success: res.ok, status: res.status, error: res.ok ? undefined : `HTTP ${res.status}` };
    }
    case "discord_webhook": {
      if (!url) return { success: false, error: "No URL configured" };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: formatDiscord(msg),
        signal: AbortSignal.timeout(10_000),
      });
      return { success: res.ok, status: res.status, error: res.ok ? undefined : `HTTP ${res.status}` };
    }
    case "webhook": {
      if (!url) return { success: false, error: "No URL configured" };
      const secret = (config.secret as string) ?? "";
      const { body, signature } = formatWebhook(msg, secret);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      return { success: res.ok, status: res.status, error: res.ok ? undefined : `HTTP ${res.status}` };
    }
    case "in_app":
    case "email":
      // These are handled by creating DB records; no HTTP delivery
      return { success: true };
    default:
      return { success: false, error: `Unknown channel type: ${channelType}` };
  }
}

/**
 * Dispatch a message to all matching active channels in a workspace.
 */
export async function dispatchToChannels(
  db: Db,
  workspaceId: string,
  msg: ChannelMessage,
): Promise<{ dispatched: number; succeeded: number; failed: number }> {
  const severity = msg.severity ?? "info";
  const severityLevel = SEVERITY_LEVELS[severity] ?? 0;

  const activeChannels = db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.workspaceId, workspaceId),
        eq(schema.channels.active, 1),
      ),
    )
    .all();

  let dispatched = 0;
  let succeeded = 0;
  let failed = 0;

  for (const channel of activeChannels) {
    // Check severity threshold
    const minLevel = SEVERITY_LEVELS[channel.minSeverity] ?? 0;
    if (severityLevel < minLevel) continue;

    // Check event glob match
    const eventPatterns: string[] = JSON.parse(channel.events);
    const matches = eventPatterns.some((p) => matchEventGlob(msg.event, p));
    if (!matches) continue;

    dispatched++;
    const now = Date.now();
    const config: Record<string, unknown> = JSON.parse(channel.config);

    // Handle in_app and email via DB records
    if (channel.type === "in_app") {
      const targetUserId = config.userId as string | undefined;
      if (targetUserId) {
        db.insert(schema.notifications)
          .values({
            userId: targetUserId,
            type: msg.event,
            title: msg.title,
            body: msg.body,
            createdAt: now,
          })
          .run();
      }
      db.insert(schema.channelDeliveries)
        .values({
          channelId: channel.id,
          event: msg.event,
          payload: JSON.stringify(msg),
          status: "delivered",
          attempts: 1,
          lastAttemptAt: now,
          createdAt: now,
        })
        .run();
      succeeded++;
      continue;
    }

    if (channel.type === "email") {
      const targetUserId = config.userId as string | undefined;
      if (targetUserId) {
        db.insert(schema.emailQueue)
          .values({
            userId: targetUserId,
            subject: msg.title,
            body: msg.body,
            createdAt: now,
          })
          .run();
      }
      db.insert(schema.channelDeliveries)
        .values({
          channelId: channel.id,
          event: msg.event,
          payload: JSON.stringify(msg),
          status: "delivered",
          attempts: 1,
          lastAttemptAt: now,
          createdAt: now,
        })
        .run();
      succeeded++;
      continue;
    }

    // HTTP-based channels: attempt with retry
    const deliveryId = crypto.randomUUID();
    const BACKOFF_MS = [1000, 4000, 16000];
    let lastResult: DeliveryAttemptResult = { success: false, error: "No attempt made" };

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
      }
      try {
        lastResult = await deliverToChannel(channel.type, config, msg);
        if (lastResult.success) break;
      } catch (err) {
        lastResult = { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
    }

    const finalAttempts = lastResult.success ? 1 : 3;
    db.insert(schema.channelDeliveries)
      .values({
        id: deliveryId,
        channelId: channel.id,
        event: msg.event,
        payload: JSON.stringify(msg),
        status: lastResult.success ? "delivered" : "failed",
        attempts: finalAttempts,
        lastAttemptAt: Date.now(),
        responseStatus: lastResult.status ?? null,
        errorMessage: lastResult.error ?? null,
        createdAt: now,
      })
      .run();

    if (lastResult.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { dispatched, succeeded, failed };
}
