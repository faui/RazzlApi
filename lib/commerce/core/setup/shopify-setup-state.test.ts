import { describe, expect, it } from "vitest";

import {
  deriveSetupSteps,
  isSetupComplete,
  isSubscriptionStepComplete
} from "@/app/shopify/shopify-setup-state";

describe("Shopify setup state", () => {
  it("enforces link, subscribe, sync in strict order", () => {
    const unlinked = deriveSetupSteps({
      tenantLinked: false,
      billingStatus: null,
      productCount: 12
    });
    expect(unlinked.map((step) => [step.id, step.complete, step.current])).toEqual([
      ["link", false, true],
      ["subscribe", false, false],
      ["sync", false, false]
    ]);

    const subscribed = deriveSetupSteps({
      tenantLinked: true,
      billingStatus: { billingSource: "shopify_billing", platformBillingStatus: "active" },
      productCount: 0
    });
    expect(subscribed.map((step) => [step.id, step.complete, step.current])).toEqual([
      ["link", true, false],
      ["subscribe", true, false],
      ["sync", false, true]
    ]);
  });

  it("accepts a Stripe lane only when the tenant has entitlement", () => {
    expect(
      isSubscriptionStepComplete(true, {
        billingSource: "stripe",
        platformBillingStatus: "not_required",
        hasEntitlement: false
      })
    ).toBe(false);
    expect(
      isSubscriptionStepComplete(true, {
        billingSource: "stripe",
        platformBillingStatus: "not_required",
        hasEntitlement: true
      })
    ).toBe(true);
  });

  it("completes setup only after at least one product is visible", () => {
    const steps = deriveSetupSteps({
      tenantLinked: true,
      billingStatus: { billingSource: "shopify_billing", platformBillingStatus: "active" },
      productCount: 1
    });
    expect(isSetupComplete(steps)).toBe(true);
  });
});
