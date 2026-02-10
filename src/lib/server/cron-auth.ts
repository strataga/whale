/**
 * #11 Cron route authentication.
 * Verifies `Authorization: Bearer $CRON_SECRET` header.
 * Supports either user auth OR cron secret for flexibility.
 */

import { getAuthContext } from "@/lib/server/auth-context";

const CRON_SECRET = process.env.CRON_SECRET;

export function verifyCronSecret(req: Request): boolean {
  if (!CRON_SECRET) return false;
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token === CRON_SECRET;
}

/**
 * Returns true if request is authorized (either valid user session OR valid cron secret).
 */
export async function authorizeCronRequest(req: Request): Promise<boolean> {
  // Check cron secret first (faster, no DB lookup)
  if (verifyCronSecret(req)) return true;

  // Fall back to user auth
  const ctx = await getAuthContext();
  return ctx !== null;
}
