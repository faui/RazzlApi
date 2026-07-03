import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commerce/core/connections/adapter-context", () => ({
  requireLinkedShopConnection: vi.fn()
}));

vi.mock("@/lib/commerce/core/mapping/mapping-repo", () => ({
  findMappingByExternalProductId: vi.fn()
}));

vi.mock("@/lib/commerce/core/analytics/launch-event-repo", () => ({
  insertLaunchEvent: vi.fn(async () => 901),
  getLaunchAnalyticsTotals: vi.fn(async () => ({
    totalClicks: 12,
    clicksLast7Days: 4,
    clicksLast30Days: 10
  })),
  getLaunchAnalyticsByProduct: vi.fn(async () => [
    {
      externalProductId: "123",
      title: "Widget",
      clickCount: 5,
      lastClickAt: "2026-07-01T12:00:00.000Z"
    }
  ])
}));

import { insertLaunchEvent } from "@/lib/commerce/core/analytics/launch-event-repo";
import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import {
  CommerceLaunchTrackingError,
  getLaunchAnalyticsSummary,
  recordLaunchEvent
} from "@/lib/commerce/core/analytics/launch-tracking-service";
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
  razzl_code_snapshot: "ABC"
};

describe("recordLaunchEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireLinkedShopConnection).mockResolvedValue({
      connection: connection as never,
      status: {} as never
    });
    vi.mocked(findMappingByExternalProductId).mockResolvedValue(baseMapping as never);
  });

  it("inserts launch event when mapping preconditions pass", async () => {
    const result = await recordLaunchEvent({
      shop: "demo.myshopify.com",
      externalProductId: "123"
    });

    expect(result.eventId).toBe(901);
    expect(insertLaunchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_fk: 3,
        commerce_platform_connection_fk: 7,
        external_product_id: "123",
        product_fk: 42,
        razzl_code: "ABC",
        source: "shopify_product_page_cta"
      })
    );
  });

  it("rejects when mapping is not trackable", async () => {
    vi.mocked(findMappingByExternalProductId).mockResolvedValue({
      ...baseMapping,
      storefront_cta_enabled: false
    } as never);

    await expect(
      recordLaunchEvent({ shop: "demo.myshopify.com", externalProductId: "123" })
    ).rejects.toBeInstanceOf(CommerceLaunchTrackingError);
  });
});

describe("getLaunchAnalyticsSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireLinkedShopConnection).mockResolvedValue({
      connection: connection as never,
      status: {} as never
    });
  });

  it("returns totals and per-product rows", async () => {
    const summary = await getLaunchAnalyticsSummary("demo.myshopify.com");

    expect(summary.totalClicks).toBe(12);
    expect(summary.clicksLast7Days).toBe(4);
    expect(summary.products).toHaveLength(1);
    expect(summary.products[0]?.externalProductId).toBe("123");
  });

  it("rejects when tenant is not linked", async () => {
    vi.mocked(requireLinkedShopConnection).mockResolvedValue({
      connection: { ...connection, tenant_fk: null },
      status: {} as never
    });

    await expect(getLaunchAnalyticsSummary("demo.myshopify.com")).rejects.toMatchObject({
      code: "NOT_LINKED"
    });
  });
});
