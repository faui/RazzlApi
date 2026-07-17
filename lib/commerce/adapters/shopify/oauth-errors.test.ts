import { describe, expect, it } from "vitest";

import { CommerceAdapterError } from "@/lib/commerce/adapters/types";
import { mapOAuthCallbackFailure } from "@/lib/commerce/adapters/shopify/oauth-errors";
import { ShopifyTokenError } from "@/lib/commerce/adapters/shopify/shopify-token-service";

describe("mapOAuthCallbackFailure", () => {
  it("maps ShopifyTokenError codes to structured responses", () => {
    const mapped = mapOAuthCallbackFailure(
      new ShopifyTokenError("TOKEN_REAUTH_REQUIRED", "Reconnect store", false)
    );

    expect(mapped.status).toBe(502);
    expect(mapped.body.code).toBe("TOKEN_REAUTH_REQUIRED");
  });

  it("maps CommerceAdapterError codes to structured responses", () => {
    const mapped = mapOAuthCallbackFailure(
      new CommerceAdapterError(
        "TOKEN_EXCHANGE_FAILED",
        "Shopify token exchange failed (400): invalid_grant",
        false
      )
    );

    expect(mapped.status).toBe(502);
    expect(mapped.body).toEqual({
      ok: false,
      error: "Shopify token exchange failed (400): invalid_grant",
      code: "TOKEN_EXCHANGE_FAILED",
      retryable: false
    });
  });

  it("maps generic errors to OAUTH_CALLBACK_FAILED", () => {
    const mapped = mapOAuthCallbackFailure(new Error("COMMERCE_TOKEN_ENCRYPTION_KEY is not configured"));

    expect(mapped.status).toBe(500);
    expect(mapped.body.code).toBe("OAUTH_CALLBACK_FAILED");
    expect(mapped.body.error).toContain("COMMERCE_TOKEN_ENCRYPTION_KEY");
  });
});
