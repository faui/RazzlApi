import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import subscriptionFixture from "@/lib/commerce/adapters/shopify/__fixtures__/webhook-app-subscription-update.json";

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
  insertPlatformEvent: vi.fn(async () => 9100),
  updatePlatformEventStatus: vi.fn(async () => undefined),
  DuplicatePlatformEventError: class DuplicatePlatformEventError extends Error {
    constructor(public idempotencyKey: string) {
      super(`Duplicate platform event: ${idempotencyKey}`);
    }
  }
}));

vi.mock("@/lib/commerce/core/db/query", () => ({
  commerceQuery: vi.fn(async () => undefined)
}));

vi.mock("@/lib/commerce/core/billing/billing-account-repo", () => ({
  findBillingAccountByConnectionId: vi.fn(async () => ({
    commerce_billing_account_pk: 1,
    tenant_fk: 3,
    billing_plan_external_id: "monthly_starter",
    platform_billing_subscription_id: null,
    platform_billing_charge_id: null,
    platform_billing_status: "pending"
  })),
  updateBillingAccount: vi.fn(async () => undefined)
}));

vi.mock("@/lib/commerce/core/billing/subscription-tier-catalog", () => ({
  resolveTierFromShopifyPlanName: vi.fn(async () => ({
    subscriptionTierPk: 32,
    tierCode: "monthly_starter",
    tierName: "Razzl - Starter Plan",
    tierFamilyCode: "starter",
    recurringPriceAmount: 12,
    currency: "USD",
    billingInterval: "month",
    billingIntervalCount: 1,
    displaySortOrder: 10,
    tierLimitMaxProducts: 3,
    tierLimitMaxChatsessionMonthly: 30
  }))
}));

vi.mock("@/lib/commerce/core/billing/tenant-subscription-projection", () => ({
  isActiveShopifySubscriptionStatus: (status: string | null | undefined) =>
    status != null && (status === "ACTIVE" || status === "active"),
  projectTenantSubscriptionFromShopify: vi.fn(async () => undefined)
}));

import { findConnectionByStoreDomain } from "@/lib/commerce/core/connections/platform-connection-repo";
import { updateBillingAccount } from "@/lib/commerce/core/billing/billing-account-repo";
import { projectTenantSubscriptionFromShopify } from "@/lib/commerce/core/billing/tenant-subscription-projection";
import { processShopifyWebhook } from "@/lib/commerce/core/events/webhook-processor-service";

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
  acquisition_source: "shopify_app_store" as const,
  billing_source: "shopify_billing" as const,
  platform_billing_status: "pending" as const,
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

describe("app_subscriptions/update webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findConnectionByStoreDomain).mockResolvedValue(connectionRow);
  });

  it("updates billing account and projects tenant subscription", async () => {
    const rawBody = JSON.stringify(subscriptionFixture);

    const result = await processShopifyWebhook({
      shopDomain: "demo.myshopify.com",
      topic: "app_subscriptions/update",
      rawBody,
      signatureHeader: sign(rawBody)
    });

    expect(result.processingStatus).toBe("processed");
    expect(updateBillingAccount).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        platform_billing_status: "active",
        platform_billing_subscription_id: "gid://shopify/AppSubscription/1029267004"
      })
    );
    expect(projectTenantSubscriptionFromShopify).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantPk: 3,
        tierPk: 32,
        shopifySubscriptionStatus: "ACTIVE"
      })
    );
  });
});
