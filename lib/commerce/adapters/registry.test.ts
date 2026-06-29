import { describe, expect, it } from "vitest";

import { getAdapter } from "@/lib/commerce/adapters/registry";
import { shopifyAdapter } from "@/lib/commerce/adapters/shopify";
import { CommerceAdapterError } from "@/lib/commerce/adapters/types";

describe("getAdapter", () => {
  it("returns the Shopify adapter for shopify platform type", () => {
    expect(getAdapter("shopify")).toBe(shopifyAdapter);
    expect(getAdapter("shopify").platformType).toBe("shopify");
  });

  it("throws for unsupported platform types", () => {
    expect(() => getAdapter("woocommerce")).toThrow("Unsupported platform: woocommerce");
  });
});

describe("shopifyAdapter skeleton", () => {
  it("throws NOT_IMPLEMENTED for API-backed methods", async () => {
    const context = {
      connectionId: 1,
      tenantId: null,
      externalStoreId: "123",
      storeDomain: "demo.myshopify.com",
      accessToken: "token",
      scopes: ["read_products"]
    };

    await expect(shopifyAdapter.validateConnection({ context })).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED"
    } satisfies Partial<CommerceAdapterError>);

    await expect(
      shopifyAdapter.fetchProducts({ context })
    ).rejects.toBeInstanceOf(CommerceAdapterError);
  });

  it("returns theme app block CTA instructions", async () => {
    const instructions = await shopifyAdapter.getStorefrontCtaPlacementInstructions({
      context: {
        connectionId: 1,
        tenantId: 1,
        externalStoreId: "123",
        storeDomain: "demo.myshopify.com",
        accessToken: "token",
        scopes: []
      }
    });

    expect(instructions.placementType).toBe("theme_app_block");
    expect(instructions.steps.length).toBeGreaterThan(0);
    expect(instructions.deepLinkUrl).toContain("demo.myshopify.com/admin/themes");
  });
});
