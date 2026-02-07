import "server-only";

const DEFAULT_ALLOWLIST_ENV = "WHALE_IP_ALLOWLIST";
const FALLBACK_ALLOWLIST_ENV = "IP_ALLOWLIST";

export type IpAllowlistCheck = { ok: true } | { ok: false; error: string };

export function checkIpAllowlist(
  req: Request,
  allowlistOverride?: string | null,
): IpAllowlistCheck {
  const envAllowlist =
    process.env[DEFAULT_ALLOWLIST_ENV] ?? process.env[FALLBACK_ALLOWLIST_ENV];
  const override = allowlistOverride?.trim();
  const allowlistRaw = [envAllowlist, override].filter(Boolean).join(",");
  if (!allowlistRaw) return { ok: true };

  const ip = getRequestIp(req);
  if (!ip) {
    return { ok: false, error: "IP allowlist enabled but request IP could not be determined" };
  }

  const allowlist = allowlistRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!allowlist.length) return { ok: true };

  const allowed = allowlist.some((entry) => isIpAllowed(ip, entry));
  if (!allowed) {
    return { ok: false, error: `IP ${ip} is not allowlisted` };
  }

  return { ok: true };
}

function getRequestIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return normalizeIp(realIp.trim());

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return normalizeIp(cfIp.trim());

  return null;
}

function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
}

function isIpAllowed(ip: string, entry: string): boolean {
  if (!entry) return false;

  if (entry.includes("/")) {
    const [base, prefixRaw] = entry.split("/");
    const prefix = Number(prefixRaw);
    if (!Number.isFinite(prefix)) return false;

    const ipInt = ipv4ToInt(normalizeIp(ip));
    const baseInt = ipv4ToInt(normalizeIp(base));
    if (ipInt === null || baseInt === null) return false;

    if (prefix < 0 || prefix > 32) return false;

    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  }

  return normalizeIp(ip) === normalizeIp(entry);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) {
    return null;
  }
  return (
    ((nums[0] << 24) >>> 0) +
    (nums[1] << 16) +
    (nums[2] << 8) +
    nums[3]
  );
}
