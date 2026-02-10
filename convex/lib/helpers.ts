/**
 * Shared helpers for Convex functions.
 * Workspace isolation, soft-delete filtering, pagination.
 */

import type { GenericDatabaseReader, GenericDatabaseWriter } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

type Db = GenericDatabaseReader<DataModel>;
type DbWriter = GenericDatabaseWriter<DataModel>;

/**
 * Filter results to only include documents belonging to the given workspace.
 * Use this in queries that don't have an index on workspaceId.
 */
export function filterByWorkspace<T extends { workspaceId: string }>(
  docs: T[],
  workspaceId: string,
): T[] {
  return docs.filter((d) => d.workspaceId === workspaceId);
}

/**
 * Filter out soft-deleted documents (those with a deletionTime set).
 * Convex Ents handles this automatically for .deletion("soft") tables,
 * but this is useful for manual queries.
 */
export function filterActive<T extends { deletionTime?: number | null }>(
  docs: T[],
): T[] {
  return docs.filter((d) => !d.deletionTime);
}

/**
 * Standard pagination helper for list queries.
 * Returns items with cursor-based pagination.
 */
export function paginateResults<T>(
  items: T[],
  opts: { limit?: number; offset?: number },
): { items: T[]; total: number; hasMore: boolean } {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const sliced = items.slice(offset, offset + limit);
  return {
    items: sliced,
    total: items.length,
    hasMore: offset + limit < items.length,
  };
}

/**
 * Get the current timestamp in milliseconds.
 * Centralizes timestamp generation for consistency.
 */
export function now(): number {
  return Date.now();
}
