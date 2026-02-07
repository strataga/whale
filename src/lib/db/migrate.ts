import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync } from "node:fs";
import path from "node:path";

const databasePath = process.env.DATABASE_URL ?? "./whale.db";
const migrationsFolder = path.join(process.cwd(), "drizzle");

if (!existsSync(migrationsFolder)) {
  console.log(
    `No migrations folder found at ${migrationsFolder}. Did you run drizzle-kit generate/push?`,
  );
  process.exit(0);
}

const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

console.log("Running migrations...");
migrate(db, { migrationsFolder });
console.log("Migrations complete.");

sqlite.close();
