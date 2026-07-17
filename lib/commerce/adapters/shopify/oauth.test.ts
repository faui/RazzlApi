import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildShopifyAuthorizeUrl,
  prepareShopifyOAuthSession,
  verifyShopifyOAuthHmac
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

  it("prepareShopifyOAuthSession returns state and shop authorize URL", () => {
    const session = prepareShopifyOAuthSession("demo.myshopify.com");
    expect(session.state).toMatch(/^[a-f0-9]{32}$/);
    expect(session.authorizeUrl).toContain("https://demo.myshopify.com/admin/oauth/authorize");
    expect(session.authorizeUrl).toContain(`state=${session.state}`);
  });
});
