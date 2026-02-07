import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

export const runtime = "nodejs";

export function GET() {
  try {
    // Verify database connectivity with a lightweight query
    db.select({ id: workspaces.id }).from(workspaces).limit(1).get();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
