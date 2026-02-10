/**
 * M5: Notification channel wrapper.
 *
 * Backward-compatible wrapper that:
 * 1. Dispatches via M5 channel-dispatcher to all configured channels
 * 2. Falls back to legacy Slack/Discord webhook URLs on the workspace
 *
 * Existing callers continue to use `notifyChannel(workspaceId, message)`.
 */
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as singletonDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { decrypt, isEncrypted } from "@/lib/crypto";
import { dispatchToChannels } from "@/lib/server/channel-dispatcher";

type Db = BetterSQLite3Database<typeof schema>;

/**
 * Send a notification to all configured channels + legacy webhook URLs.
 * Fire-and-forget. Accepts optional DI db for testability.
 */
export function notifyChannel(
  workspaceId: string,
  message: string,
  injectedDb?: Db,
) {
  const db = injectedDb ?? (singletonDb as unknown as Db);

  // M5: Dispatch to all configured channels (async, fire-and-forget)
  dispatchToChannels(db, workspaceId, {
    event: "notification",
    severity: "info",
    title: "Notification",
    body: message,
  }).catch(() => {});

  // Legacy: also send directly to workspace Slack/Discord URLs
  const ws = db
    .select({
      slackWebhookUrl: schema.workspaces.slackWebhookUrl,
      discordWebhookUrl: schema.workspaces.discordWebhookUrl,
    })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .get();

  if (!ws) return;

  if (ws.slackWebhookUrl) {
    const url = isEncrypted(ws.slackWebhookUrl)
      ? decrypt(ws.slackWebhookUrl)
      : ws.slackWebhookUrl;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  }

  if (ws.discordWebhookUrl) {
    const url = isEncrypted(ws.discordWebhookUrl)
      ? decrypt(ws.discordWebhookUrl)
      : ws.discordWebhookUrl;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  }
}
