import { describe, expect, it } from "vitest";

import { getProductWorkflowStatus } from "@/app/shopify/product-status-select";

describe("Shopify product workflow status", () => {
  it("requires a copilot connection before product-page setup help", () => {
    expect(
      getProductWorkflowStatus({ productPk: null, storefrontCtaEnabled: false })
    ).toBe("unmapped");
  });

  it("keeps connected and customer-visible states distinct", () => {
    expect(
      getProductWorkflowStatus({ productPk: 42, storefrontCtaEnabled: false })
    ).toBe("mapped");
    expect(
      getProductWorkflowStatus({ productPk: 42, storefrontCtaEnabled: true })
    ).toBe("cta_on");
  });

  it("does not report setup help live for inconsistent unmapped data", () => {
    expect(
      getProductWorkflowStatus({ productPk: null, storefrontCtaEnabled: true })
    ).toBe("unmapped");
  });
});
