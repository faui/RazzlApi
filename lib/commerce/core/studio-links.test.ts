import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  buildStudioCreateCopilotPath,
  buildStudioCreateCopilotUrl,
  buildStudioDashboardUrl
} from "@/lib/commerce/core/studio-links";

describe("studio-links", () => {
  const originalOrigin = process.env.RAZZL_STUDIO_PUBLIC_ORIGIN;

  beforeEach(() => {
    process.env.RAZZL_STUDIO_PUBLIC_ORIGIN = "https://studio.example.com";
  });

  afterEach(() => {
    if (originalOrigin === undefined) {
      delete process.env.RAZZL_STUDIO_PUBLIC_ORIGIN;
    } else {
      process.env.RAZZL_STUDIO_PUBLIC_ORIGIN = originalOrigin;
    }
  });

  it("buildStudioCreateCopilotPath opens upload dialog", () => {
    expect(buildStudioCreateCopilotPath()).toBe("/app/dashboard?create_copilot=1");
  });

  it("buildStudioCreateCopilotPath preserves Shopify product context", () => {
    expect(
      buildStudioCreateCopilotPath({ shop: "demo.myshopify.com", externalProductId: "12345" })
    ).toBe("/app/dashboard?create_copilot=1&shopify_product=12345&shopify_shop=demo.myshopify.com");
  });

  it("buildStudioCreateCopilotUrl uses configured origin", () => {
    expect(buildStudioCreateCopilotUrl()).toBe("https://studio.example.com/app/dashboard?create_copilot=1");
  });

  it("buildStudioDashboardUrl uses configured origin", () => {
    expect(buildStudioDashboardUrl()).toBe("https://studio.example.com/app/dashboard");
  });
});
