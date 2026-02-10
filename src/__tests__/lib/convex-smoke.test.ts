// @vitest-environment edge-runtime
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";

const modules = import.meta.glob("../../../convex/**/*.ts");

describe("convex-test smoke test", () => {
  it("creates a test instance with schema", async () => {
    const t = convexTest(schema, modules);
    expect(t).toBeDefined();
  });

  it("inserts and reads a workspace via direct DB access", async () => {
    const t = convexTest(schema, modules);

    const wsId = await t.run(async (ctx) => {
      return ctx.db.insert("workspaces", {
        name: "Smoke Test Workspace",
        updatedAt: Date.now(),
      });
    });

    expect(wsId).toBeDefined();

    const ws = await t.run(async (ctx) => {
      return ctx.db.get(wsId);
    });

    expect(ws).toBeDefined();
    expect(ws!.name).toBe("Smoke Test Workspace");
  });
});
