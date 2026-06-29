import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import productFixture from "@/lib/commerce/adapters/shopify/__fixtures__/product-single.json";
import { normalizeShopifyProduct } from "@/lib/commerce/adapters/shopify/normalize";

describe("normalizeShopifyProduct", () => {
  it("maps Shopify REST product to NormalizedCommerceProduct", () => {
    const normalized = normalizeShopifyProduct(productFixture);

    expect(normalized).toMatchObject({
      externalProductId: "632910392",
      externalHandle: "ipod-nano",
      title: "IPod Nano - 8GB",
      vendorOrBrand: "Apple",
      productType: "Cult Products",
      status: "active",
      primaryImageUrl: "https://cdn.shopify.com/s/files/1/0000/0001/products/ipod-nano.png",
      tags: ["Emotive", "Flash Memory", "MP3", "Music"]
    });

    expect(normalized.variants).toHaveLength(2);
    expect(normalized.variants[0]).toMatchObject({
      externalVariantId: "808950810",
      externalProductId: "632910392",
      title: "Pink / 8GB",
      sku: "IPOD2008PINK",
      barcode: "1234_pink",
      optionValues: { Color: "Pink", Capacity: "8GB" }
    });
    expect(normalized.variants[1]).toMatchObject({
      externalVariantId: "808950811",
      optionValues: { Color: "Red", Capacity: "16GB" }
    });

    expect(normalized.rawPayload).toBe(productFixture);
  });

  it("handles missing optional fields", () => {
    const normalized = normalizeShopifyProduct({
      id: 1,
      title: "Minimal",
      variants: []
    });

    expect(normalized).toMatchObject({
      externalProductId: "1",
      externalHandle: null,
      vendorOrBrand: null,
      productType: null,
      status: "unknown",
      primaryImageUrl: null,
      tags: [],
      variants: []
    });
  });
});

describe("normalizeShopifyWebhook signature helpers", () => {
  it("computes expected HMAC for fixture body", () => {
    const secret = "test-webhook-secret";
    const body = JSON.stringify({ shop_id: 12345 });
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
