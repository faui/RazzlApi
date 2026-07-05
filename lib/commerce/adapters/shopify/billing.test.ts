import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommerceAdapterContext } from "@/lib/commerce/adapters/types";
import {
  createShopifyAppSubscription,
  mapShopifyStatusToPlatformStatus
} from "@/lib/commerce/adapters/shopify/billing";
import type { CommerceSubscriptionTier } from "@/lib/commerce/core/billing/subscription-tier-catalog";

vi.mock("@/lib/commerce/adapters/shopify/graphql-client", () => ({
  shopifyAdminGraphql: vi.fn()
}));

import { shopifyAdminGraphql } from "@/lib/commerce/adapters/shopify/graphql-client";

const context: CommerceAdapterContext = {
  connectionId: 1,
  tenantId: 10,
  externalStoreId: "123",
  storeDomain: "demo.myshopify.com",
  accessToken: "shpat_test",
  scopes: ["read_products"]
};

const tier: CommerceSubscriptionTier = {
  subscriptionTierPk: 32,
  tierCode: "monthly_starter",
  tierFamilyCode: "starter",
  tierName: "Razzl - Starter Plan",
  recurringPriceAmount: 12,
  currency: "USD",
  billingInterval: "month",
  billingIntervalCount: 1,
  displaySortOrder: 10,
  tierLimitMaxProducts: 3,
  tierLimitMaxChatsessionMonthly: 30
};

describe("mapShopifyStatusToPlatformStatus", () => {
  it("maps ACTIVE to active", () => {
    expect(mapShopifyStatusToPlatformStatus("ACTIVE")).toBe("active");
  });

  it("maps CANCELLED to cancelled", () => {
    expect(mapShopifyStatusToPlatformStatus("CANCELLED")).toBe("cancelled");
  });
});

describe("createShopifyAppSubscription", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns confirmationUrl and charge id from GraphQL", async () => {
    vi.mocked(shopifyAdminGraphql).mockResolvedValue({
      appSubscriptionCreate: {
        userErrors: [],
        confirmationUrl: "https://demo.myshopify.com/admin/charges/confirm",
        appSubscription: {
          id: "gid://shopify/AppSubscription/1",
          status: "PENDING"
        }
      }
    });

    const session = await createShopifyAppSubscription(context, tier, {
      context,
      planExternalId: tier.tierCode,
      returnUrl: "https://api-dev.razzl.com/shopify?shop=demo.myshopify.com",
      test: true
    });

    expect(session.confirmationUrl).toContain("confirm");
    expect(session.chargeId).toBe("gid://shopify/AppSubscription/1");
  });
});
