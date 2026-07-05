import { describe, expect, it } from "vitest";

import { isActiveShopifySubscriptionStatus } from "@/lib/commerce/core/billing/tenant-subscription-projection";

describe("isActiveShopifySubscriptionStatus", () => {
  it("accepts ACTIVE status", () => {
    expect(isActiveShopifySubscriptionStatus("ACTIVE")).toBe(true);
    expect(isActiveShopifySubscriptionStatus("active")).toBe(true);
  });

  it("rejects pending and cancelled statuses", () => {
    expect(isActiveShopifySubscriptionStatus("PENDING")).toBe(false);
    expect(isActiveShopifySubscriptionStatus("CANCELLED")).toBe(false);
    expect(isActiveShopifySubscriptionStatus(null)).toBe(false);
  });
});
