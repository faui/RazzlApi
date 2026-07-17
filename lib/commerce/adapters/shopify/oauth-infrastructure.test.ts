import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateTokenEncryptionKey } from "@/lib/commerce/core/crypto/token-crypto";

vi.mock("@/lib/commerce/core/db/query", () => ({
  pingCommerceDb: vi.fn()
}));

import { pingCommerceDb } from "@/lib/commerce/core/db/query";
import { getShopifyOAuthInfrastructureStatus } from "@/lib/commerce/adapters/shopify/oauth-infrastructure";

describe("getShopifyOAuthInfrastructureStatus", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_API_KEY", "test-api-key");
    vi.stubEnv("SHOPIFY_API_SECRET", "test-api-secret");
    vi.stubEnv("RAZZL_PUBLIC_ORIGIN", "https://api.example.com");
    vi.stubEnv("COMMERCE_TOKEN_ENCRYPTION_KEY", generateTokenEncryptionKey());
    vi.mocked(pingCommerceDb).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns ok when config, encryption, and DB are ready", async () => {
    const status = await getShopifyOAuthInfrastructureStatus();
    expect(status.ok).toBe(true);
    expect(status.errors).toEqual([]);
  });

  it("reports missing encryption key", async () => {
    vi.stubEnv("COMMERCE_TOKEN_ENCRYPTION_KEY", "");
    const status = await getShopifyOAuthInfrastructureStatus();
    expect(status.ok).toBe(false);
    expect(status.checks.tokenEncryption).toBe(false);
    expect(status.errors.some((error) => error.includes("COMMERCE_TOKEN_ENCRYPTION_KEY"))).toBe(true);
  });

  it("reports database ping failure", async () => {
    vi.mocked(pingCommerceDb).mockResolvedValue(false);
    const status = await getShopifyOAuthInfrastructureStatus();
    expect(status.ok).toBe(false);
    expect(status.checks.database).toBe(false);
    expect(status.errors).toContain("Commerce database ping failed");
  });
});
