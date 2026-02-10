import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { bulkTasksSchema } from "@/lib/validators";
import { getAuthContext, checkRole } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const roleCheck = checkRole(ctx, "member");
  if (roleCheck) return jsonError(roleCheck.status, roleCheck.error);

  try {
    const body = await req.json();
    const data = bulkTasksSchema.parse(body);

    let processed = 0;
    const errors: { taskId: string; error: string }[] = [];

    for (const taskId of data.taskIds) {
      try {
        const task = db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).get();
        if (!task) {
          errors.push({ taskId, error: "Task not found" });
          continue;
        }

        switch (data.operation) {
          case "status":
            db.update(tasks)
              .set({ status: data.value ?? "todo", updatedAt: Date.now() })
              .where(eq(tasks.id, taskId))
              .run();
            break;
          case "priority":
            db.update(tasks)
              .set({ priority: data.value ?? "medium", updatedAt: Date.now() })
              .where(eq(tasks.id, taskId))
              .run();
            break;
          case "delete":
            db.delete(tasks).where(eq(tasks.id, taskId)).run();
            break;
          default:
            errors.push({ taskId, error: `Unsupported operation: ${data.operation}` });
            continue;
        }

        processed++;
      } catch {
        errors.push({ taskId, error: "Failed to process task" });
      }
    }

    return NextResponse.json({ processed, errors });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Bulk operation failed");
  }
}
