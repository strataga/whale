import { vi, describe, it, expect, beforeEach } from "vitest";

type AuditRow = {
  id: string;
  workspaceId: string;
  userId: string | null;
  action: string;
  metadata: string;
};

// Mock the db module before importing audit
vi.mock("@/lib/db", () => {
  const rows: AuditRow[] = [];
  return {
    db: {
      insert: () => ({
        values: (val: AuditRow) => {
          rows.push(val);
          return { run: () => {} };
        },
      }),
      _rows: rows,
    },
  };
});

// Mock the schema import (auditLogs table reference)
vi.mock("@/lib/db/schema", () => ({
  auditLogs: "auditLogs",
}));

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";

function getRows(): AuditRow[] {
  return (db as unknown as { _rows: AuditRow[] })._rows;
}

describe("logAudit", () => {
  beforeEach(() => {
    getRows().length = 0;
  });

  it("inserts a row with correct fields", () => {
    logAudit({
      workspaceId: "ws-123",
      userId: "user-456",
      action: "project.created",
      metadata: { projectId: "proj-789" },
    });

    const rows = getRows();
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.workspaceId).toBe("ws-123");
    expect(row.userId).toBe("user-456");
    expect(row.action).toBe("project.created");
    expect(JSON.parse(row.metadata)).toEqual({ projectId: "proj-789" });
    expect(row.id).toBeDefined();
    expect(typeof row.id).toBe("string");
    expect(row.id.length).toBeGreaterThan(0);
  });

  it("generates a UUID for the id field", () => {
    logAudit({
      workspaceId: "ws-1",
      userId: "u-1",
      action: "test",
    });

    const rows = getRows();
    const id = rows[0].id;
    // UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("default metadata is empty object", () => {
    logAudit({
      workspaceId: "ws-1",
      userId: "u-1",
      action: "test.action",
    });

    const rows = getRows();
    expect(JSON.parse(rows[0].metadata)).toEqual({});
  });

  it("userId can be null", () => {
    logAudit({
      workspaceId: "ws-1",
      userId: null,
      action: "system.action",
    });

    const rows = getRows();
    expect(rows[0].userId).toBeNull();
  });

  it("userId defaults to null when omitted", () => {
    logAudit({
      workspaceId: "ws-1",
      action: "system.action",
    });

    const rows = getRows();
    expect(rows[0].userId).toBeNull();
  });

  it("serializes complex metadata to JSON", () => {
    const metadata = {
      nested: { deep: true },
      list: [1, 2, 3],
      str: "value",
    };

    logAudit({
      workspaceId: "ws-1",
      userId: "u-1",
      action: "complex",
      metadata,
    });

    const rows = getRows();
    expect(JSON.parse(rows[0].metadata)).toEqual(metadata);
  });

  it("generates unique ids for multiple calls", () => {
    logAudit({ workspaceId: "ws-1", action: "a" });
    logAudit({ workspaceId: "ws-1", action: "b" });

    const rows = getRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});
