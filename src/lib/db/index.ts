import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const databasePath = process.env.DATABASE_URL ?? "./whale.db";

type GlobalForDb = typeof globalThis & {
  __whaleSqlite?: InstanceType<typeof Database>;
  __whaleDb?: unknown;
};

const globalForDb = globalThis as GlobalForDb;

const sqlite = globalForDb.__whaleSqlite ?? new Database(databasePath);

// #20 WAL mode + PRAGMA optimizations for read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("cache_size = -20000");
sqlite.pragma("foreign_keys = ON");

// #19 Database indexes for hot query paths
const indexStatements = [
  "CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(projectId, status)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigneeId)",
  "CREATE INDEX IF NOT EXISTS idx_bot_tasks_bot_status ON botTasks(botId, status)",
  "CREATE INDEX IF NOT EXISTS idx_bot_tasks_task ON botTasks(taskId)",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON auditLogs(workspaceId, createdAt)",
  "CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(userId, readAt)",
  "CREATE INDEX IF NOT EXISTS idx_bot_logs_bot_created ON botLogs(botId, createdAt)",
  "CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspaceId)",
  "CREATE INDEX IF NOT EXISTS idx_bots_workspace_status ON bots(workspaceId, status)",
  "CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(projectId)",
  "CREATE INDEX IF NOT EXISTS idx_sprint_tasks_sprint ON sprintTasks(sprintId)",
  "CREATE INDEX IF NOT EXISTS idx_sprint_tasks_task ON sprintTasks(taskId)",
  "CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspaceId)",
  "CREATE INDEX IF NOT EXISTS idx_automation_rules_workspace_trigger ON automationRules(workspaceId, trigger)",
];
for (const stmt of indexStatements) {
  sqlite.prepare(stmt).run();
}

const drizzleDb = drizzle(sqlite, { schema });

export const db = (globalForDb.__whaleDb as typeof drizzleDb | undefined) ?? drizzleDb;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__whaleSqlite = sqlite;
  globalForDb.__whaleDb = db;
}

