import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";

// RFC 4648 Base32 alphabet: A-Z, 2-7
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decode a Base32-encoded string (RFC 4648) into a Buffer.
 * Ignores padding ('=') and is case-insensitive.
 */
export function base32Decode(encoded: string): Buffer {
  const stripped = encoded.replace(/=+$/, "").toUpperCase();
  if (stripped.length === 0) return Buffer.alloc(0);

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < stripped.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(stripped[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${stripped[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(output);
}

/**
 * Encode a Buffer into a Base32 string (RFC 4648, no padding).
 */
export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let result = "";

  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return cryptoTimingSafeEqual(bufA, bufB);
}

/**
 * Generate a TOTP code for a given secret and time.
 * RFC 6238 / RFC 4226 implementation using HMAC-SHA1.
 *
 * @param secret - The shared secret as a hex-encoded string (matching the DB storage format)
 * @param time - Unix timestamp in seconds (defaults to current time)
 * @param step - Time step in seconds (defaults to 30)
 * @returns 6-digit TOTP code
 */
export function generateTOTP(secret: string, time?: number, step?: number): string {
  const t = Math.floor((time ?? Date.now() / 1000) / (step ?? 30));

  // Convert counter to 8-byte big-endian buffer
  const buffer = Buffer.alloc(8);
  let tmp = t;
  for (let i = 7; i >= 0; i--) {
    buffer[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }

  // Decode the hex-encoded secret to raw bytes for HMAC key
  const decodedSecret = Buffer.from(secret, "hex");

  // HMAC-SHA1
  const hmac = createHmac("sha1", decodedSecret);
  hmac.update(buffer);
  const hash = hmac.digest();

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

/**
 * Verify a TOTP code, allowing a configurable time step window (default +/-1).
 *
 * @param secret - The shared secret as a hex-encoded string
 * @param code - The 6-digit TOTP code to verify
 * @param window - Number of time steps to check in each direction (default 1)
 * @returns true if the code is valid within the window
 */
export function verifyTOTP(secret: string, code: string, window?: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const step = 30;
  const windowSize = window ?? 1;

  for (let i = -windowSize; i <= windowSize; i++) {
    const expected = generateTOTP(secret, now + i * step, step);
    if (timingSafeStringEqual(code, expected)) return true;
  }

  return false;
}
