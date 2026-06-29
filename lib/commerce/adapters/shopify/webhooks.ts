import { createHmac, timingSafeEqual } from "crypto";

import type { NormalizedCommerceEvent } from "@/lib/commerce/adapters/types";
import { normalizeShopifyProduct, type ShopifyRestProduct } from "@/lib/commerce/adapters/shopify/normalize";

/** Verify Shopify webhook HMAC-SHA256 signature (X-Shopify-Hmac-Sha256). */
export function verifyShopifyWebhookSignature(
  rawBody: string | Buffer,
  secret: string,
  signatureHeader: string
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const computed = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expected = Buffer.from(computed, "base64");
  const received = Buffer.from(signatureHeader, "base64");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

const PRODUCT_WEBHOOK_TOPICS = new Set([
  "products/create",
  "products/update",
  "products/delete"
]);

function buildIdempotencyKey(topic: string, payload: ShopifyRestProduct): string {
  const productId = String(payload.id);
  const updatedAt =
    typeof payload === "object" &&
    payload !== null &&
    "updated_at" in payload &&
    typeof (payload as { updated_at?: unknown }).updated_at === "string"
      ? (payload as { updated_at: string }).updated_at
      : "unknown";

  return `shopify:${topic}:${productId}:${updatedAt}`;
}

/** Map a Shopify webhook topic + JSON body to a normalized commerce event. */
export function normalizeShopifyWebhook(
  topic: string,
  rawBody: string
): NormalizedCommerceEvent {
  const payload = JSON.parse(rawBody) as ShopifyRestProduct;
  const externalProductId = String(payload.id);

  if (PRODUCT_WEBHOOK_TOPICS.has(topic)) {
    return {
      eventType: topic,
      externalEventId: externalProductId,
      idempotencyKey: buildIdempotencyKey(topic, payload),
      externalProductId,
      payload: topic === "products/delete" ? payload : normalizeShopifyProduct(payload)
    };
  }

  if (topic === "app/uninstalled") {
    return {
      eventType: topic,
      externalEventId: null,
      idempotencyKey: `shopify:${topic}:${rawBody.length}`,
      payload
    };
  }

  return {
    eventType: topic,
    externalEventId: null,
    idempotencyKey: `shopify:${topic}:${rawBody.length}`,
    payload
  };
}
