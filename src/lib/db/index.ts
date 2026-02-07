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
sqlite.pragma("foreign_keys = ON");

const drizzleDb = drizzle(sqlite, { schema });

export const db = (globalForDb.__whaleDb as typeof drizzleDb | undefined) ?? drizzleDb;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__whaleSqlite = sqlite;
  globalForDb.__whaleDb = db;
}

