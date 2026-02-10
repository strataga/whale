/**
 * Dumps the current SQLite schema to a timestamped SQL file.
 * Usage: pnpm db:snapshot
 */
import Database from "better-sqlite3";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const databasePath = process.env.DATABASE_URL ?? "./whale.db";
const snapshotDir = path.join(process.cwd(), "drizzle", "snapshots");

if (!existsSync(databasePath)) {
  console.error(`Database not found at ${databasePath}`);
  process.exit(1);
}

if (!existsSync(snapshotDir)) {
  mkdirSync(snapshotDir, { recursive: true });
}

const sqlite = new Database(databasePath, { readonly: true });

// Extract all CREATE TABLE and CREATE INDEX statements
const tables = sqlite
  .prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name",
  )
  .all() as Array<{ sql: string }>;

const indexes = sqlite
  .prepare(
    "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name",
  )
  .all() as Array<{ sql: string }>;

const triggers = sqlite
  .prepare(
    "SELECT sql FROM sqlite_master WHERE type='trigger' AND sql IS NOT NULL ORDER BY name",
  )
  .all() as Array<{ sql: string }>;

sqlite.close();

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const filename = `schema-${timestamp}.sql`;
const filepath = path.join(snapshotDir, filename);

const lines: string[] = [
  `-- Whale database schema snapshot`,
  `-- Generated: ${new Date().toISOString()}`,
  `-- Tables: ${tables.length}, Indexes: ${indexes.length}, Triggers: ${triggers.length}`,
  "",
  "PRAGMA foreign_keys = ON;",
  "",
  "-- Tables",
  ...tables.map((t) => `${t.sql};`),
  "",
  "-- Indexes",
  ...indexes.map((i) => `${i.sql};`),
];

if (triggers.length > 0) {
  lines.push("", "-- Triggers", ...triggers.map((t) => `${t.sql};`));
}

lines.push("");

writeFileSync(filepath, lines.join("\n"), "utf-8");
console.log(`Schema snapshot saved to ${filepath}`);
console.log(`  Tables: ${tables.length}`);
console.log(`  Indexes: ${indexes.length}`);
console.log(`  Triggers: ${triggers.length}`);
