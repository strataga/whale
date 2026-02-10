import { sql } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

/**
 * Cursor-based pagination using createdAt + id as the compound cursor.
 * Returns items sorted by createdAt desc (newest first) by default.
 *
 * Usage:
 *   const result = cursorPaginate(db, schema.notifications, {
 *     where: eq(schema.notifications.userId, userId),
 *     cursor,
 *     limit: 20,
 *   });
 */
export interface CursorPaginationOptions {
  /** Optional WHERE clause to apply */
  where?: SQLWrapper;
  /** Cursor string in the format "createdAt:id" (from previous result's nextCursor) */
  cursor?: string | null;
  /** Number of items to return (default 20, max 100) */
  limit?: number;
  /** Sort direction: "desc" (newest first, default) or "asc" (oldest first) */
  direction?: "asc" | "desc";
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Parse a cursor string into its components.
 */
export function parseCursor(cursor: string): { createdAt: number; id: string } | null {
  const parts = cursor.split(":");
  if (parts.length < 2) return null;
  const createdAt = Number(parts[0]);
  const id = parts.slice(1).join(":");
  if (isNaN(createdAt)) return null;
  return { createdAt, id };
}

/**
 * Encode a cursor from item fields.
 */
export function encodeCursor(createdAt: number, id: string): string {
  return `${createdAt}:${id}`;
}

/**
 * Generic cursor-based pagination helper.
 * Works with any Drizzle table that has `id` (text) and `createdAt` (integer) columns.
 *
 * Note: This returns a builder config — the caller applies it to their query.
 */
export function buildCursorCondition(
  createdAtColumn: SQLWrapper,
  idColumn: SQLWrapper,
  cursor: string | null | undefined,
  direction: "asc" | "desc" = "desc",
): SQLWrapper | undefined {
  if (!cursor) return undefined;

  const parsed = parseCursor(cursor);
  if (!parsed) return undefined;

  if (direction === "desc") {
    // For descending: get items BEFORE the cursor (older)
    return sql`(${createdAtColumn} < ${parsed.createdAt} OR (${createdAtColumn} = ${parsed.createdAt} AND ${idColumn} < ${parsed.id}))`;
  }
  // For ascending: get items AFTER the cursor (newer)
  return sql`(${createdAtColumn} > ${parsed.createdAt} OR (${createdAtColumn} = ${parsed.createdAt} AND ${idColumn} > ${parsed.id}))`;
}

/**
 * Wrap query results with cursor pagination metadata.
 */
export function wrapWithCursor<T extends { id: string; createdAt: number }>(
  items: T[],
  limit: number,
): CursorPaginationResult<T> {
  const hasMore = items.length > limit;
  const trimmed = hasMore ? items.slice(0, limit) : items;
  const last = trimmed[trimmed.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

  return {
    items: trimmed,
    nextCursor,
    hasMore,
  };
}
