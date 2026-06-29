import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  decryptPlatformToken,
  encryptPlatformToken,
  generateTokenEncryptionKey
} from "@/lib/commerce/core/crypto/token-crypto";

describe("token-crypto", () => {
  beforeEach(() => {
    vi.stubEnv("COMMERCE_TOKEN_ENCRYPTION_KEY", generateTokenEncryptionKey());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips access token encryption", () => {
    const token = "shpat_test_access_token_value";
    const encrypted = encryptPlatformToken(token);
    expect(encrypted).not.toEqual(Buffer.from(token));
    expect(decryptPlatformToken(encrypted)).toBe(token);
  });

  it("produces distinct ciphertext for the same plaintext", () => {
    const token = "shpat_test_access_token_value";
    const a = encryptPlatformToken(token);
    const b = encryptPlatformToken(token);
    expect(a.equals(b)).toBe(false);
    expect(decryptPlatformToken(a)).toBe(token);
    expect(decryptPlatformToken(b)).toBe(token);
  });

  it("throws when encryption key is missing", () => {
    vi.unstubAllEnvs();
    expect(() => encryptPlatformToken("token")).toThrow("COMMERCE_TOKEN_ENCRYPTION_KEY");
  });
});
