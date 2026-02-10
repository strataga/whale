import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { updateThemeSchema } from "@/lib/validators";
import { getAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  const user = db
    .select({ themePreference: users.themePreference })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .get();

  return NextResponse.json({ theme: user?.themePreference ?? "dark" });
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError(401, "Unauthorized");

  try {
    const body = await req.json();
    const { theme } = updateThemeSchema.parse(body);

    db.update(users)
      .set({ themePreference: theme, updatedAt: Date.now() })
      .where(eq(users.id, ctx.userId))
      .run();

    return NextResponse.json({ theme });
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(400, "Invalid request body", err.issues);
    }
    return jsonError(500, "Failed to update theme");
  }
}
