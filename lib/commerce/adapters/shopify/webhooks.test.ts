import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import webhookFixture from "@/lib/commerce/adapters/shopify/__fixtures__/webhook-product-update.json";
import {
  normalizeShopifyWebhook,
  verifyShopifyWebhookSignature
} from "@/lib/commerce/adapters/shopify/webhooks";

describe("verifyShopifyWebhookSignature", () => {
  const secret = "shpss_test_secret";
  const body = JSON.stringify({ shop_id: 12345, shop_domain: "demo.myshopify.com" });

  function sign(payload: string | Buffer): string {
    return createHmac("sha256", secret).update(payload).digest("base64");
  }

  it("returns true for a valid signature", () => {
    expect(verifyShopifyWebhookSignature(body, secret, sign(body))).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    expect(verifyShopifyWebhookSignature(body, secret, sign("tampered"))).toBe(false);
  });

  it("returns false for an empty signature header", () => {
    expect(verifyShopifyWebhookSignature(body, secret, "")).toBe(false);
  });
});

describe("normalizeShopifyWebhook", () => {
  const rawBody = JSON.stringify(webhookFixture);

  it("normalizes products/update webhook with normalized product payload", () => {
    const event = normalizeShopifyWebhook("products/update", rawBody);

    expect(event).toMatchObject({
      eventType: "products/update",
      externalEventId: "632910392",
      externalProductId: "632910392",
      idempotencyKey: "shopify:products/update:632910392:2026-06-28T09:15:00-04:00"
    });

    const payload = event.payload as {
      externalProductId: string;
      title: string;
      variants: Array<{ sku: string | null }>;
    };
    expect(payload.externalProductId).toBe("632910392");
    expect(payload.title).toBe("IPod Nano - 8GB");
    expect(payload.variants[0]?.sku).toBe("IPOD2008PINK");
  });

  it("passes through raw payload for products/delete", () => {
    const event = normalizeShopifyWebhook("products/delete", rawBody);
    expect(event.eventType).toBe("products/delete");
    expect(event.payload).toEqual(webhookFixture);
  });
});
