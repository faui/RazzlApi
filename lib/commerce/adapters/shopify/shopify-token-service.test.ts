import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commerce/adapters/shopify/oauth", () => ({
  refreshShopifyOfflineAccessToken: vi.fn()
}));

vi.mock("@/lib/commerce/core/connections/platform-connection-repo", () => ({
  findConnectionByPlatformStore: vi.fn(),
  updateShopifyOAuthTokens: vi.fn()
}));

vi.mock("@/lib/commerce/core/crypto/token-crypto", () => ({
  decryptPlatformToken: vi.fn(() => "refresh-token"),
  encryptPlatformToken: vi.fn((value: string) => Buffer.from(value))
}));

import { refreshShopifyOfflineAccessToken } from "@/lib/commerce/adapters/shopify/oauth";
import {
  findConnectionByPlatformStore,
  updateShopifyOAuthTokens
} from "@/lib/commerce/core/connections/platform-connection-repo";
import { ensureFreshShopifyConnection } from "@/lib/commerce/adapters/shopify/shopify-token-service";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";

const baseConnection = {
  commerce_platform_connection_pk: 1,
  platform_type: "shopify",
  external_store_id: "12345",
  store_domain: "demo.myshopify.com",
  refresh_token_encrypted: Buffer.from("encrypted-refresh"),
  raw_platform_payload_json: {
    token: { accessExpiresAt: Date.now() - 1000 },
    shop: { id: "12345" }
  }
} as CommercePlatformConnectionRow;

describe("ensureFreshShopifyConnection", () => {
  beforeEach(() => {
    vi.mocked(refreshShopifyOfflineAccessToken).mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      scopes: ["read_products"],
      accessTokenExpiresAt: Date.now() + 3600_000,
      refreshTokenExpiresAt: Date.now() + 7_776_000_000,
      scopeHeader: "read_products"
    });
    vi.mocked(findConnectionByPlatformStore).mockResolvedValue({
      ...baseConnection,
      raw_platform_payload_json: {
        token: { accessExpiresAt: Date.now() + 3600_000 },
        shop: { id: "12345" }
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the same connection when the access token is still fresh", async () => {
    const freshConnection = {
      ...baseConnection,
      raw_platform_payload_json: {
        token: { accessExpiresAt: Date.now() + 3600_000 }
      }
    } as CommercePlatformConnectionRow;

    const result = await ensureFreshShopifyConnection(freshConnection);
    expect(result).toBe(freshConnection);
    expect(refreshShopifyOfflineAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes and persists tokens when the access token is expired", async () => {
    const result = await ensureFreshShopifyConnection(baseConnection);

    expect(refreshShopifyOfflineAccessToken).toHaveBeenCalledWith(
      "demo.myshopify.com",
      "refresh-token"
    );
    expect(updateShopifyOAuthTokens).toHaveBeenCalled();
    expect(result.raw_platform_payload_json).toEqual({
      token: { accessExpiresAt: expect.any(Number) },
      shop: { id: "12345" }
    });
  });
});
