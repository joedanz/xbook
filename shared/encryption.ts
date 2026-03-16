// ABOUTME: AES-256-GCM encryption/decryption for sensitive data at rest.
// ABOUTME: Encrypts if ENCRYPTION_KEY is set; passthrough otherwise (local mode).

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) return null;
  if (hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded envelope: iv (12B) + authTag (16B) + ciphertext.
 * If ENCRYPTION_KEY is not set, returns the plaintext unchanged (local mode).
 */
export function encryptIfAvailable(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Envelope: iv + authTag + ciphertext
  const envelope = Buffer.concat([iv, authTag, encrypted]);
  return envelope.toString("base64");
}

/**
 * Decrypt a base64-encoded AES-256-GCM envelope.
 * If ENCRYPTION_KEY is not set, returns the input unchanged (local mode).
 * If decryption fails (e.g. pre-encryption plaintext), returns the input unchanged
 * to support graceful migration from unencrypted to encrypted storage.
 */
export function decryptIfAvailable(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;

  try {
    const envelope = Buffer.from(ciphertext, "base64");
    // Minimum length: IV (12) + AuthTag (16) + at least 1 byte of data
    if (envelope.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      // Too short to be encrypted — return as-is (plaintext fallback)
      return ciphertext;
    }

    const iv = envelope.subarray(0, IV_LENGTH);
    const authTag = envelope.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = envelope.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // Decryption failed — wrong key or corrupted data.
    // The length check above handles "never was encrypted" (too short).
    // If we reach here, the data looked like a valid envelope but auth tag failed.
    console.warn("Decryption failed for a value that appeared to be encrypted. Possible key mismatch.");
    return ciphertext;
  }
}
