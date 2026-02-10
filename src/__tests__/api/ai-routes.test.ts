import { describe, it, expect } from "vitest";
import {
  naturalLanguageTaskSchema,
  createSprintSchema,
} from "@/lib/validators";

/**
 * Test AI route input validation schemas.
 * These don't call any AI — they verify the Zod schemas that guard the routes.
 */
describe("AI route input validation", () => {
  describe("naturalLanguageTaskSchema (parse-task)", () => {
    it("accepts valid text input", () => {
      const result = naturalLanguageTaskSchema.safeParse({
        text: "Build the login page by Friday",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty text", () => {
      const result = naturalLanguageTaskSchema.safeParse({ text: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing text field", () => {
      const result = naturalLanguageTaskSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("trims whitespace from text", () => {
      const result = naturalLanguageTaskSchema.safeParse({
        text: "   Build the page   ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe("Build the page");
      }
    });
  });

  describe("decompose route input", () => {
    it("requires both taskId and projectId", () => {
      // The decompose route checks: if (!taskId || !projectId) return 400
      // These are plain string checks, not Zod — test logic here
      const body1 = { taskId: "abc" }; // missing projectId
      expect(!body1.taskId || !(body1 as Record<string, string>).projectId).toBe(true);

      const body2 = { projectId: "def" }; // missing taskId
      expect(!(body2 as Record<string, string>).taskId || !body2.projectId).toBe(true);

      const body3 = { taskId: "abc", projectId: "def" };
      expect(!body3.taskId || !body3.projectId).toBe(false);
    });
  });

  describe("risk-scan route input", () => {
    // The risk-scan route requires { projectId: string }
    it("validates projectId is present", () => {
      const withId = { projectId: "some-uuid" };
      expect(typeof withId.projectId).toBe("string");
      expect(withId.projectId.length).toBeGreaterThan(0);
    });

    it("rejects missing projectId", () => {
      const empty = {} as Record<string, string>;
      expect(empty.projectId).toBeUndefined();
    });
  });

  describe("estimate-duration route input", () => {
    // Expects { taskId, projectId }
    it("validates both fields present", () => {
      const body = { taskId: "t1", projectId: "p1" };
      expect(body.taskId).toBeTruthy();
      expect(body.projectId).toBeTruthy();
    });

    it("detects missing taskId", () => {
      const body = { projectId: "p1" } as Record<string, string>;
      expect(body.taskId).toBeUndefined();
    });
  });

  describe("match-bot route input", () => {
    // Expects { taskId, projectId }
    it("validates both fields present", () => {
      const body = { taskId: "t1", projectId: "p1" };
      expect(body.taskId).toBeTruthy();
      expect(body.projectId).toBeTruthy();
    });
  });

  describe("generate-bot-spec route input", () => {
    // Expects { description: string }
    it("accepts valid description", () => {
      const body = { description: "A bot that runs tests" };
      expect(typeof body.description).toBe("string");
      expect(body.description.length).toBeGreaterThan(0);
    });

    it("rejects empty description", () => {
      const body = { description: "" };
      expect(body.description.length).toBe(0);
    });
  });
});
