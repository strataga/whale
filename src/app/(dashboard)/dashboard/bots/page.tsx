import { and, desc, eq, sql } from "drizzle-orm";

import { BotCard } from "@/components/bots/bot-card";
import { PairingTokenModal } from "@/components/bots/pairing-token-modal";
import { Pagination } from "@/components/ui/pagination";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";
import { checkRole, requireAuthContext } from "@/lib/server/auth-context";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 12;

export default async function BotsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const ctx = await requireAuthContext();
  const isAdmin = !checkRole(ctx, "admin");
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(params.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  db.update(bots)
    .set({ status: "offline", updatedAt: sql`(strftime('%s','now') * 1000)` })
    .where(
      and(
        eq(bots.workspaceId, ctx.workspaceId),
        eq(bots.status, "online"),
        sql`${bots.lastSeenAt} < (strftime('%s','now') * 1000 - 5 * 60 * 1000)`,
      ),
    )
    .run();

  const totalResult = db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .get();

  const total = totalResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const rows = db
    .select({
      id: bots.id,
      name: bots.name,
      host: bots.host,
      status: bots.status,
      capabilities: bots.capabilities,
      lastSeenAt: bots.lastSeenAt,
    })
    .from(bots)
    .where(eq(bots.workspaceId, ctx.workspaceId))
    .orderBy(desc(bots.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bots</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            OpenClaw bots connected to this workspace.
          </p>
        </div>

        {isAdmin ? <PairingTokenModal /> : null}
      </div>

      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <h3 className="text-sm font-semibold">No bots connected</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Pair an OpenClaw bot to start delegating tasks from Whale.
          </p>
          {isAdmin ? (
            <div className="mt-5 flex justify-center">
              <PairingTokenModal />
            </div>
          ) : null}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/dashboard/bots"
      />
    </div>
  );
}
