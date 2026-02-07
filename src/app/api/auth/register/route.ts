import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users, workspaces } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Rate limit by IP (via x-forwarded-for or fallback)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`auth:${ip}`, { limit: 5, windowMs: 60_000 });
  if (rl) {
    return NextResponse.json({ success: false, error: rl.error }, { status: rl.status });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;

  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    return NextResponse.json(
      { success: false, error: "Email already registered" },
      { status: 409 },
    );
  }

  const passwordHash = await hash(password, 12);

  const firstUser = db
    .select({ id: users.id, workspaceId: users.workspaceId })
    .from(users)
    .limit(1)
    .get();

  let workspaceId: string;
  let role: "admin" | "member" = "member";

  if (!firstUser) {
    workspaceId = crypto.randomUUID();
    role = "admin";

    db.insert(workspaces)
      .values({
        id: workspaceId,
        name: "My Workspace",
      })
      .run();
  } else {
    workspaceId = firstUser.workspaceId;
  }

  const userId = crypto.randomUUID();

  db.insert(users)
    .values({
      id: userId,
      workspaceId,
      email,
      passwordHash,
      name,
      role,
    })
    .run();

  return NextResponse.json({
    success: true,
    user: { id: userId, email, name, role },
  });
}

