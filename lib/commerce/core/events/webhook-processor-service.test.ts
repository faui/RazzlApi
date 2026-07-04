import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import webhookFixture from "@/lib/commerce/adapters/shopify/__fixtures__/webhook-product-update.json";
import { normalizeShopifyProduct } from "@/lib/commerce/adapters/shopify/normalize";

vi.mock("@/lib/commerce/config/shopify-env", () => ({
  getShopifyEnvConfig: vi.fn(() => ({
    apiKey: "test-key",
    apiSecret: "shpss_test_secret",
    scopes: ["read_products"],
    apiVersion: "2024-10",
    publicOrigin: "https://api-dev.razzl.com",
    oauthCallbackPath: "/api/commerce/shopify/auth/callback"
  }))
}));

vi.mock("@/lib/commerce/core/connections/platform-connection-repo", () => ({
  findConnectionByStoreDomain: vi.fn(),
  markShopUninstalled: vi.fn(async () => undefined)
}));

vi.mock("@/lib/commerce/core/events/platform-event-repo", () => ({
  insertPlatformEvent: vi.fn(async () => 9001),
  updatePlatformEventStatus: vi.fn(async () => undefined),
  DuplicatePlatformEventError: class DuplicatePlatformEventError extends Error {
    constructor(public idempotencyKey: string) {
      super(`Duplicate platform event: ${idempotencyKey}`);
    }
  }
}));

vi.mock("@/lib/commerce/core/sync/sync-service", () => ({
  applyWebhookProductEvent: vi.fn(async () => undefined)
}));

import { findConnectionByStoreDomain } from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  DuplicatePlatformEventError,
  insertPlatformEvent
} from "@/lib/commerce/core/events/platform-event-repo";
import { applyWebhookProductEvent } from "@/lib/commerce/core/sync/sync-service";
import {
  processShopifyWebhook,
  WebhookVerificationError
} from "@/lib/commerce/core/events/webhook-processor-service";

const connectionRow = {
  commerce_platform_connection_pk: 12,
  tenant_fk: 3,
  platform_type: "shopify" as const,
  external_store_id: "999",
  store_domain: "demo.myshopify.com",
  store_display_name: "Demo",
  install_status: "connected" as const,
  auth_type: "oauth" as const,
  access_token_encrypted: Buffer.from("x"),
  refresh_token_encrypted: null,
  scopes_json: ["read_products"],
  acquisition_source: "direct" as const,
  billing_source: "none" as const,
  platform_billing_status: "not_required" as const,
  installed_at: null,
  connected_at: null,
  uninstalled_at: null,
  last_synced_at: null,
  raw_platform_payload_json: null,
  created_on: new Date(),
  updated_on: new Date()
};

function sign(body: string, secret = "shpss_test_secret"): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

describe("processShopifyWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findConnectionByStoreDomain).mockResolvedValue(connectionRow);
  });

  it("rejects invalid HMAC with WebhookVerificationError", async () => {
    const rawBody = JSON.stringify(webhookFixture);

    await expect(
      processShopifyWebhook({
        shopDomain: "demo.myshopify.com",
        topic: "products/update",
        rawBody,
        signatureHeader: sign("tampered")
      })
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("processes products/update and applies catalog change", async () => {
    const rawBody = JSON.stringify(webhookFixture);

    const result = await processShopifyWebhook({
      shopDomain: "demo.myshopify.com",
      topic: "products/update",
      rawBody,
      signatureHeader: sign(rawBody)
    });

    expect(result.duplicate).toBe(false);
    expect(result.processingStatus).toBe("processed");
    expect(insertPlatformEvent).toHaveBeenCalled();
    expect(applyWebhookProductEvent).toHaveBeenCalledWith(
      12,
      expect.objectContaining({ eventType: "products/update" })
    );
  });

  it("returns duplicate=true when idempotency key already exists", async () => {
    const rawBody = JSON.stringify(webhookFixture);
    vi.mocked(insertPlatformEvent).mockRejectedValueOnce(
      new DuplicatePlatformEventError("shopify:products/update:632910392:2026-06-28T09:15:00-04:00")
    );

    const result = await processShopifyWebhook({
      shopDomain: "demo.myshopify.com",
      topic: "products/update",
      rawBody,
      signatureHeader: sign(rawBody)
    });

    expect(result.duplicate).toBe(true);
    expect(applyWebhookProductEvent).not.toHaveBeenCalled();
  });

  it("acknowledges compliance webhooks without product side effects", async () => {
    const rawBody = JSON.stringify({ shop_id: 123, shop_domain: "demo.myshopify.com" });

    const result = await processShopifyWebhook({
      shopDomain: "demo.myshopify.com",
      topic: "customers/data_request",
      rawBody,
      signatureHeader: sign(rawBody)
    });

    expect(result.processingStatus).toBe("processed");
    expect(applyWebhookProductEvent).not.toHaveBeenCalled();
  });
});

describe("applyWebhookProductEvent integration shape", () => {
  it("uses normalized product payload from fixture", () => {
    const normalized = normalizeShopifyProduct(webhookFixture);
    expect(normalized.externalProductId).toBe("632910392");
    expect(normalized.title).toBe("IPod Nano - 8GB");
  });
});
