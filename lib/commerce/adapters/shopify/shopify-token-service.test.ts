import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commerce/adapters/shopify/oauth", () => ({
  refreshShopifyOfflineAccessToken: vi.fn()
}));

vi.mock("@/lib/commerce/core/connections/platform-connection-repo", () => ({
  markConnectionInstallError: vi.fn(),
  refreshShopifyConnectionTokensLocked: vi.fn()
}));

vi.mock("@/lib/commerce/core/crypto/token-crypto", () => ({
  decryptPlatformToken: vi.fn((blob: Buffer) => blob.toString()),
  encryptPlatformToken: vi.fn((value: string) => Buffer.from(value))
}));

import { refreshShopifyOfflineAccessToken } from "@/lib/commerce/adapters/shopify/oauth";
import {
  markConnectionInstallError,
  refreshShopifyConnectionTokensLocked
} from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  deriveTokenStatus,
  hasValidExpiringTokenPair,
  resolveShopifyConnection,
  ShopifyTokenError
} from "@/lib/commerce/adapters/shopify/shopify-token-service";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";

const baseConnection = {
  commerce_platform_connection_pk: 1,
  platform_type: "shopify",
  external_store_id: "12345",
  store_domain: "demo.myshopify.com",
  install_status: "installed",
  access_token_encrypted: Buffer.from("access"),
  refresh_token_encrypted: Buffer.from("encrypted-refresh"),
  scopes_json: ["read_products"],
  raw_platform_payload_json: {
    token: {
      accessExpiresAt: Date.now() - 1000,
      refreshExpiresAt: Date.now() + 7_776_000_000
    },
    shop: { id: "12345" }
  }
} as CommercePlatformConnectionRow;

describe("deriveTokenStatus", () => {
  it("returns ok for a fresh expiring token pair", () => {
    const connection = {
      ...baseConnection,
      raw_platform_payload_json: {
        token: {
          accessExpiresAt: Date.now() + 3600_000,
          refreshExpiresAt: Date.now() + 7_776_000_000
        }
      }
    } as CommercePlatformConnectionRow;

    expect(deriveTokenStatus(connection)).toBe("ok");
  });

  it("returns reauth_required when refresh token metadata is expired", () => {
    const connection = {
      ...baseConnection,
      raw_platform_payload_json: {
        token: {
          accessExpiresAt: Date.now() + 3600_000,
          refreshExpiresAt: Date.now() - 1000
        }
      }
    } as CommercePlatformConnectionRow;

    expect(deriveTokenStatus(connection)).toBe("reauth_required");
  });
});

describe("hasValidExpiringTokenPair", () => {
  it("requires encrypted tokens and expiry metadata", () => {
    expect(hasValidExpiringTokenPair(baseConnection)).toBe(true);
    expect(
      hasValidExpiringTokenPair({
        ...baseConnection,
        refresh_token_encrypted: null
      } as CommercePlatformConnectionRow)
    ).toBe(false);
  });
});

describe("resolveShopifyConnection", () => {
  let lockedConnection: CommercePlatformConnectionRow = baseConnection;

  beforeEach(() => {
    lockedConnection = baseConnection;
    vi.mocked(refreshShopifyOfflineAccessToken).mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      scopes: ["read_products"],
      accessTokenExpiresAt: Date.now() + 3600_000,
      refreshTokenExpiresAt: Date.now() + 7_776_000_000,
      scopeHeader: "read_products"
    });
    vi.mocked(refreshShopifyConnectionTokensLocked).mockImplementation(async (input) => {
      const locked = lockedConnection;
      if (input.isAccessTokenFresh(locked)) {
        return locked;
      }

      const refreshed = await input.performRefresh(locked);
      return {
        ...locked,
        access_token_encrypted: refreshed.accessTokenEncrypted,
        refresh_token_encrypted: refreshed.refreshTokenEncrypted,
        raw_platform_payload_json: refreshed.rawPlatformPayload
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns context without refresh when access token is still fresh", async () => {
    const freshConnection = {
      ...baseConnection,
      raw_platform_payload_json: {
        token: {
          accessExpiresAt: Date.now() + 3600_000,
          refreshExpiresAt: Date.now() + 7_776_000_000
        }
      }
    } as CommercePlatformConnectionRow;

    lockedConnection = freshConnection;
    const result = await resolveShopifyConnection(freshConnection);
    expect(result.context.accessToken).toBe("access");
    expect(refreshShopifyConnectionTokensLocked).not.toHaveBeenCalled();
  });

  it("refreshes under lock when access token is stale", async () => {
    const result = await resolveShopifyConnection(baseConnection);

    expect(refreshShopifyConnectionTokensLocked).toHaveBeenCalled();
    expect(refreshShopifyOfflineAccessToken).toHaveBeenCalledWith(
      "demo.myshopify.com",
      "encrypted-refresh"
    );
    expect(result.context.accessToken).toBe("new-access");
  });

  it("throws TOKEN_REAUTH_REQUIRED when refresh token is missing", async () => {
    await expect(
      resolveShopifyConnection({
        ...baseConnection,
        refresh_token_encrypted: null,
        raw_platform_payload_json: {}
      } as CommercePlatformConnectionRow)
    ).rejects.toMatchObject({
      code: "TOKEN_REAUTH_REQUIRED"
    });
  });

  it("marks install error when refresh fails permanently", async () => {
    vi.mocked(refreshShopifyConnectionTokensLocked).mockRejectedValue(
      new ShopifyTokenError("TOKEN_REAUTH_REQUIRED", "inactive refresh token")
    );

    await expect(resolveShopifyConnection(baseConnection)).rejects.toMatchObject({
      code: "TOKEN_REAUTH_REQUIRED"
    });
    expect(markConnectionInstallError).toHaveBeenCalledWith(1);
  });
});
