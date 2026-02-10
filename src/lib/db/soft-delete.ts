import { isNull, isNotNull, sql } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

/**
 * Helper to add soft-delete filter to queries.
 * Use: `.where(and(yourConditions, withSoftDelete(schema.table.deletedAt)))`
 */
export function withSoftDelete(deletedAtColumn: SQLWrapper): SQLWrapper {
  return isNull(deletedAtColumn);
}

/**
 * Helper for admin queries that include soft-deleted records.
 * Use when you need to see everything, including deleted items.
 */
export function includeSoftDeleted(): SQLWrapper {
  return sql`1 = 1`;
}

/**
 * Helper to find only soft-deleted records (for purge operations).
 */
export function onlySoftDeleted(deletedAtColumn: SQLWrapper): SQLWrapper {
  return isNotNull(deletedAtColumn);
}
