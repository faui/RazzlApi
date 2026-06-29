import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.COMMERCE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("COMMERCE_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("COMMERCE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }

  return key;
}

/** Encrypt a platform access token for storage in `access_token_encrypted`. */
export function encryptPlatformToken(plaintext: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

/** Decrypt a stored platform access token. */
export function decryptPlatformToken(blob: Buffer): string {
  if (blob.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Encrypted token blob is too short");
  }

  const key = getEncryptionKey();
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = blob.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Generate a base64 encryption key for local `.env.local` setup. */
export function generateTokenEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}
