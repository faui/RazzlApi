import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildShopifyAuthorizeUrl,
  createSignedOAuthState,
  exchangeShopifyAuthCode,
  fetchShopifyShopIdentity,
  prepareShopifyOAuthSession,
  verifyShopifyOAuthHmac,
  verifySignedOAuthState
} from "@/lib/commerce/adapters/shopify/oauth";

const TEST_ENV = {
  SHOPIFY_API_KEY: "test-api-key",
  SHOPIFY_API_SECRET: "test-api-secret",
  SHOPIFY_SCOPES: "read_products",
  RAZZL_PUBLIC_ORIGIN: "https://api.example.com"
};

describe("verifyShopifyOAuthHmac", () => {
  const secret = "test-api-secret";

  function signParams(params: Record<string, string>): Record<string, string> {
    const message = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const hmac = createHmac("sha256", secret).update(message).digest("hex");
    return { ...params, hmac };
  }

  it("returns true for a valid OAuth callback HMAC", () => {
    const params = signParams({
      code: "0907a61cae914bee2803b5fc94562789beab0a3858b4f1f0d10856f70ea288f",
      shop: "test-shop.myshopify.com",
      state: "abc123",
      timestamp: "1336361773"
    });

    expect(verifyShopifyOAuthHmac(params, secret)).toBe(true);
  });

  it("returns false when HMAC is tampered", () => {
    const params = signParams({
      code: "0907a61cae914bee2803b5fc94562789beab0a3858b4f1f0d10856f70ea288f",
      shop: "test-shop.myshopify.com",
      state: "abc123",
      timestamp: "1336361773"
    });

    expect(verifyShopifyOAuthHmac({ ...params, code: "tampered" }, secret)).toBe(false);
  });

  it("returns false when hmac param is missing", () => {
    expect(
      verifyShopifyOAuthHmac({ shop: "test-shop.myshopify.com", code: "x" }, secret)
    ).toBe(false);
  });
});

describe("buildShopifyAuthorizeUrl", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_API_KEY", TEST_ENV.SHOPIFY_API_KEY);
    vi.stubEnv("SHOPIFY_API_SECRET", TEST_ENV.SHOPIFY_API_SECRET);
    vi.stubEnv("SHOPIFY_SCOPES", TEST_ENV.SHOPIFY_SCOPES);
    vi.stubEnv("RAZZL_PUBLIC_ORIGIN", TEST_ENV.RAZZL_PUBLIC_ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds authorize URL with required query params", () => {
    const url = new URL(buildShopifyAuthorizeUrl("demo.myshopify.com", "state-token"));
    expect(url.origin).toBe("https://demo.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-api-key");
    expect(url.searchParams.get("scope")).toBe("read_products");
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/api/commerce/shopify/auth/callback"
    );
  });

  it("prepareShopifyOAuthSession returns signed state and shop authorize URL", () => {
    const session = prepareShopifyOAuthSession("demo.myshopify.com", "host-token");
    expect(session.state).toContain(".");
    expect(session.authorizeUrl).toContain("https://demo.myshopify.com/admin/oauth/authorize");
    expect(session.authorizeUrl).toContain(`state=${encodeURIComponent(session.state)}`);

    const verified = verifySignedOAuthState(session.state, "demo.myshopify.com");
    expect(verified?.shop).toBe("demo.myshopify.com");
    expect(verified?.host).toBe("host-token");
  });

  it("verifySignedOAuthState rejects tampered or expired state", () => {
    const state = createSignedOAuthState("demo.myshopify.com");
    expect(verifySignedOAuthState(state, "demo.myshopify.com")).not.toBeNull();
    expect(verifySignedOAuthState(`${state}x`, "demo.myshopify.com")).toBeNull();
    expect(verifySignedOAuthState(state, "other.myshopify.com")).toBeNull();
  });
});

describe("exchangeShopifyAuthCode", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_API_KEY", TEST_ENV.SHOPIFY_API_KEY);
    vi.stubEnv("SHOPIFY_API_SECRET", TEST_ENV.SHOPIFY_API_SECRET);
    vi.stubEnv("SHOPIFY_SCOPES", TEST_ENV.SHOPIFY_SCOPES);
    vi.stubEnv("RAZZL_PUBLIC_ORIGIN", TEST_ENV.RAZZL_PUBLIC_ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("exchanges code using form-urlencoded body and GraphQL shop lookup", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "shpat_test",
            scope: "read_products",
            expires_in: 3600,
            refresh_token: "shprt_test",
            refresh_token_expires_in: 7776000
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              shop: {
                id: "gid://shopify/Shop/12345",
                name: "Demo Shop",
                myshopifyDomain: "demo.myshopify.com"
              }
            }
          })
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeShopifyAuthCode({
      shopDomain: "demo.myshopify.com",
      authCode: "auth-code"
    });

    expect(result.accessToken).toBe("shpat_test");
    expect(result.refreshToken).toBe("shprt_test");
    expect(result.externalStoreId).toBe("12345");
    expect(result.scopes).toEqual(["read_products"]);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe("https://demo.myshopify.com/admin/oauth/access_token");
    expect(tokenInit.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded"
    });
    expect(String(tokenInit.body)).toContain("client_id=test-api-key");
    expect(String(tokenInit.body)).toContain("code=auth-code");
    expect(String(tokenInit.body)).toContain("expiring=1");
  });

  it("surfaces Shopify token exchange error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Authorization code was already redeemed."
          })
      })
    );

    await expect(
      exchangeShopifyAuthCode({ shopDomain: "demo.myshopify.com", authCode: "used-code" })
    ).rejects.toMatchObject({
      code: "TOKEN_EXCHANGE_FAILED",
      message: expect.stringContaining("invalid_grant")
    });
  });
});

describe("fetchShopifyShopIdentity", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_API_KEY", TEST_ENV.SHOPIFY_API_KEY);
    vi.stubEnv("SHOPIFY_API_SECRET", TEST_ENV.SHOPIFY_API_SECRET);
    vi.stubEnv("RAZZL_PUBLIC_ORIGIN", TEST_ENV.RAZZL_PUBLIC_ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("throws SHOP_FETCH_FAILED when GraphQL returns errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({ errors: [{ message: "Access denied for shop field." }] })
      })
    );

    await expect(fetchShopifyShopIdentity("demo.myshopify.com", "token")).rejects.toMatchObject({
      code: "SHOP_FETCH_FAILED",
      message: expect.stringContaining("Access denied")
    });
  });

  it("parses externalStoreId from shop GID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              shop: {
                id: "gid://shopify/Shop/67890",
                name: "Demo Shop",
                myshopifyDomain: "demo.myshopify.com"
              }
            }
          })
      })
    );

    await expect(fetchShopifyShopIdentity("demo.myshopify.com", "token")).resolves.toMatchObject({
      externalStoreId: "67890",
      storeDomain: "demo.myshopify.com",
      storeDisplayName: "Demo Shop"
    });
  });
});
