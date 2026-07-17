import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exchangeShopifySessionToken,
  refreshShopifyOfflineAccessToken
} from "@/lib/commerce/adapters/shopify/oauth";

const TEST_ENV = {
  SHOPIFY_API_KEY: "test-api-key",
  SHOPIFY_API_SECRET: "test-api-secret",
  RAZZL_PUBLIC_ORIGIN: "https://api.example.com"
};

describe("refreshShopifyOfflineAccessToken", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_API_KEY", TEST_ENV.SHOPIFY_API_KEY);
    vi.stubEnv("SHOPIFY_API_SECRET", TEST_ENV.SHOPIFY_API_SECRET);
    vi.stubEnv("RAZZL_PUBLIC_ORIGIN", TEST_ENV.RAZZL_PUBLIC_ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("retries transient refresh failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "upstream unavailable"
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: "shpat_new",
            refresh_token: "shprt_new",
            expires_in: 3600,
            refresh_token_expires_in: 7776000,
            scope: "read_products"
          })
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshShopifyOfflineAccessToken("demo.myshopify.com", "shprt_old");
    expect(result.accessToken).toBe("shpat_new");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps inactive refresh tokens to TOKEN_REAUTH_REQUIRED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            error: "invalid_request",
            error_description: "This request requires an active refresh_token"
          })
      })
    );

    await expect(refreshShopifyOfflineAccessToken("demo.myshopify.com", "shprt_old")).rejects.toMatchObject({
      code: "TOKEN_REAUTH_REQUIRED"
    });
  });
});

describe("exchangeShopifySessionToken", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_API_KEY", TEST_ENV.SHOPIFY_API_KEY);
    vi.stubEnv("SHOPIFY_API_SECRET", TEST_ENV.SHOPIFY_API_SECRET);
    vi.stubEnv("RAZZL_PUBLIC_ORIGIN", TEST_ENV.RAZZL_PUBLIC_ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requests expiring offline token exchange grant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          access_token: "shpat_session",
          refresh_token: "shprt_session",
          expires_in: 3600,
          refresh_token_expires_in: 7776000,
          scope: "read_products"
        })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeShopifySessionToken("demo.myshopify.com", "session-jwt");
    expect(result.refreshToken).toBe("shprt_session");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange");
    expect(String(init.body)).toContain("expiring=1");
  });
});
