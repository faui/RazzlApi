import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commerce/core/db/query", () => ({
  commerceQuery: vi.fn()
}));

vi.mock("@/lib/commerce/core/connections/adapter-context", () => ({
  requireLinkedShopConnection: vi.fn()
}));

vi.mock("@/lib/commerce/core/mapping/mapping-repo", () => ({
  updateMappingProduct: vi.fn()
}));

vi.mock("@/lib/commerce/core/mapping/mapping-service", () => ({
  buildEditCopilotUrl: vi.fn((productPk: number) => `https://studio.razzl.com/app/products/${productPk}/edit`),
  buildLaunchUrl: vi.fn(
    (_base: string, code: string) =>
      `https://chat.razzl.com?razzl_code_product=${code}&launchsource=shopify`
  ),
  getChatKitBaseUrl: vi.fn(async () => "https://chat.razzl.com"),
  CommerceMappingError: class CommerceMappingError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
    }
  }
}));

import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import { commerceQuery } from "@/lib/commerce/core/db/query";
import { updateMappingProduct } from "@/lib/commerce/core/mapping/mapping-repo";
import { refreshProductMappingSnapshots } from "@/lib/commerce/core/mapping/status-sync";

describe("refreshProductMappingSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireLinkedShopConnection).mockResolvedValue({
      connection: {
        commerce_platform_connection_pk: 7,
        tenant_fk: 3
      },
      status: {} as never
    });
  });

  it("returns empty results when no mapped products exist", async () => {
    vi.mocked(commerceQuery).mockResolvedValueOnce([]);

    const result = await refreshProductMappingSnapshots("demo.myshopify.com");
    expect(result).toEqual({ refreshed: 0, results: [] });
    expect(updateMappingProduct).not.toHaveBeenCalled();
  });

  it("refreshes snapshots from live product rows", async () => {
    vi.mocked(commerceQuery)
      .mockResolvedValueOnce([{ external_product_id: "123", product_fk: 42 }])
      .mockResolvedValueOnce([
        {
          productPk: 42,
          modelName: "Widget",
          modelNumber: "W-1",
          thumbnailUrl: null,
          razzlCode: "WIDGET1",
          statusCode: "active"
        }
      ]);

    const result = await refreshProductMappingSnapshots("demo.myshopify.com", "123");

    expect(result.refreshed).toBe(1);
    expect(result.results[0]).toMatchObject({
      externalProductId: "123",
      productPk: 42,
      mappingStatus: "mapped",
      productStatus: "active"
    });
    expect(updateMappingProduct).toHaveBeenCalledWith(
      7,
      "123",
      42,
      expect.objectContaining({
        razzlCode: "WIDGET1",
        productStatus: "active",
        mappingStatus: "mapped"
      })
    );
  });

  it("marks mapping error when tenant product is missing", async () => {
    vi.mocked(commerceQuery)
      .mockResolvedValueOnce([{ external_product_id: "999", product_fk: 88 }])
      .mockResolvedValueOnce([]);

    const result = await refreshProductMappingSnapshots("demo.myshopify.com");

    expect(result.results[0]).toMatchObject({
      mappingStatus: "error",
      productStatus: null
    });
    expect(updateMappingProduct).toHaveBeenCalledWith(
      7,
      "999",
      88,
      expect.objectContaining({ mappingStatus: "error" })
    );
  });
});
