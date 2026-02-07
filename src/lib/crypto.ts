import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_KEY_HEX_RE = /^[0-9a-f]{64}$/i;
const IV_HEX_LENGTH = 24; // 12 bytes
const AUTH_TAG_HEX_LENGTH = 32; // 16 bytes

function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) return null;
  if (!ENCRYPTION_KEY_HEX_RE.test(keyHex)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }

  return Buffer.from(keyHex, "hex");
}

export function encryptionEnabled(): boolean {
  try {
    return Boolean(getEncryptionKey());
  } catch {
    return false;
  }
}

function isHex(value: string): boolean {
  return /^[0-9a-f]+$/i.test(value);
}

/**
 * Returns true if the value looks like our "iv:ciphertext:authTag" format (hex-encoded).
 * This is used to support migrating from plaintext -> encrypted values safely.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;

  const parts = value.split(":");
  if (parts.length !== 3) return false;

  const [ivHex, ciphertextHex, authTagHex] = parts;

  if (ivHex.length !== IV_HEX_LENGTH) return false;
  if (authTagHex.length !== AUTH_TAG_HEX_LENGTH) return false;
  if (!ciphertextHex) return false;

  if (ivHex.length % 2 !== 0 || ciphertextHex.length % 2 !== 0 || authTagHex.length % 2 !== 0) return false;
  if (!isHex(ivHex) || !isHex(ciphertextHex) || !isHex(authTagHex)) return false;

  return true;
}

/**
 * AES-256-GCM encryption using ENCRYPTION_KEY (32 bytes, hex-encoded).
 * If ENCRYPTION_KEY is not set (or invalid), this is a passthrough.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${authTag.toString("hex")}`;
}

/**
 * AES-256-GCM decryption using ENCRYPTION_KEY (32 bytes, hex-encoded).
 * If ENCRYPTION_KEY is not set (or invalid), this is a passthrough.
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  if (!key) return encrypted;

  if (!isEncrypted(encrypted)) return encrypted;

  const [ivHex, ciphertextHex, authTagHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
