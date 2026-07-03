import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commerce/core/connections/adapter-context", () => ({
  requireLinkedShopConnection: vi.fn()
}));

vi.mock("@/lib/commerce/core/mapping/mapping-repo", () => ({
  findMappingByExternalProductId: vi.fn()
}));

vi.mock("@/lib/commerce/core/cta/cta-config-repo", () => ({
  getStorefrontCtaConfig: vi.fn(),
  getOrCreateStorefrontCtaConfig: vi.fn()
}));

import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import {
  getOrCreateStorefrontCtaConfig,
  getStorefrontCtaConfig
} from "@/lib/commerce/core/cta/cta-config-repo";
import { resolveStorefrontCta } from "@/lib/commerce/core/cta/cta-resolver-service";
import { findMappingByExternalProductId } from "@/lib/commerce/core/mapping/mapping-repo";

const connection = {
  commerce_platform_connection_pk: 7,
  tenant_fk: 3,
  platform_type: "shopify",
  install_status: "connected"
};

const baseMapping = {
  product_fk: 42,
  mapping_status: "mapped",
  storefront_cta_enabled: true,
  product_status_snapshot: "active",
  launch_url_snapshot: "https://chat.razzl.com?razzl_code_product=ABC&launchsource=shopify",
  razzl_code_snapshot: "ABC",
  cta_label_override: null,
  cta_open_mode_override: null
};

const baseConfig = {
  cta_label_default: "Setup help",
  cta_open_mode: "new_tab",
  cta_style_mode: "inherit_theme",
  show_powered_by_razzl: true
};

describe("resolveStorefrontCta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireLinkedShopConnection).mockResolvedValue({
      connection: connection as never,
      status: {} as never
    });
    vi.mocked(findMappingByExternalProductId).mockResolvedValue(baseMapping as never);
    vi.mocked(getStorefrontCtaConfig).mockResolvedValue(baseConfig as never);
  });

  it("returns visible launch URL when mapping and CTA preconditions pass", async () => {
    const result = await resolveStorefrontCta("demo.myshopify.com", "123");

    expect(result).toEqual({
      visible: true,
      label: "Setup help",
      launchUrl: baseMapping.launch_url_snapshot,
      openMode: "new_tab",
      styleMode: "inherit_theme",
      showPoweredByRazzl: true
    });
  });

  it("fail closed when shop is not linked", async () => {
    vi.mocked(requireLinkedShopConnection).mockRejectedValue(new Error("not linked"));

    await expect(resolveStorefrontCta("demo.myshopify.com", "123")).resolves.toEqual({
      visible: false
    });
  });

  it("fail closed when CTA is disabled on mapping", async () => {
    vi.mocked(findMappingByExternalProductId).mockResolvedValue({
      ...baseMapping,
      storefront_cta_enabled: false
    } as never);

    await expect(resolveStorefrontCta("demo.myshopify.com", "123")).resolves.toEqual({
      visible: false
    });
  });

  it("fail closed when copilot is not published", async () => {
    vi.mocked(findMappingByExternalProductId).mockResolvedValue({
      ...baseMapping,
      product_status_snapshot: "draft"
    } as never);

    await expect(resolveStorefrontCta("demo.myshopify.com", "123")).resolves.toEqual({
      visible: false
    });
  });

  it("uses mapping label override when set", async () => {
    vi.mocked(findMappingByExternalProductId).mockResolvedValue({
      ...baseMapping,
      cta_label_override: "Need help?"
    } as never);

    const result = await resolveStorefrontCta("demo.myshopify.com", "123");
    expect(result.label).toBe("Need help?");
  });

  it("creates default CTA config when none exists", async () => {
    vi.mocked(getStorefrontCtaConfig).mockResolvedValue(null);
    vi.mocked(getOrCreateStorefrontCtaConfig).mockResolvedValue(baseConfig as never);

    const result = await resolveStorefrontCta("demo.myshopify.com", "123");
    expect(getOrCreateStorefrontCtaConfig).toHaveBeenCalledWith(7, "shopify");
    expect(result.visible).toBe(true);
  });
});
