import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { statSync } from "node:fs";

import { db } from "@/lib/db";

export const runtime = "nodejs";

const startTime = Date.now();

export function GET() {
  try {
    // #26 Enhanced health check: DB query, file size, table count, uptime, memory
    const dbCheck = db.all(sql`SELECT 1 as ok`);
    if (!dbCheck?.length) throw new Error("DB query failed");

    const tableCount = db.all(
      sql`SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    ) as Array<{ cnt: number }>;

    const dbPath = process.env.DATABASE_URL ?? "./whale.db";
    let dbSizeBytes = 0;
    try {
      dbSizeBytes = statSync(dbPath).size;
    } catch {
      // File might not exist in some configurations
    }

    const mem = process.memoryUsage();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: {
        connected: true,
        sizeBytes: dbSizeBytes,
        sizeMb: Math.round((dbSizeBytes / 1024 / 1024) * 100) / 100,
        tableCount: tableCount[0]?.cnt ?? 0,
      },
      memory: {
        rssBytes: mem.rss,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      },
    });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
