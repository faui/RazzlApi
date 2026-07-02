import { afterEach, describe, expect, it, vi } from "vitest";

import productFixture from "@/lib/commerce/adapters/shopify/__fixtures__/product-single.json";
import {
  fetchShopifyProductById,
  fetchShopifyProductsPage
} from "@/lib/commerce/adapters/shopify/products";
import type { CommerceAdapterContext } from "@/lib/commerce/adapters/types";

const context: CommerceAdapterContext = {
  connectionId: 1,
  tenantId: 10,
  externalStoreId: "123",
  storeDomain: "demo.myshopify.com",
  accessToken: "shpat_test",
  scopes: ["read_products"]
};

describe("fetchShopifyProductsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes products and parses next page cursor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "link"
              ? '<https://demo.myshopify.com/admin/api/2024-10/products.json?page_info=abc123&limit=50>; rel="next"'
              : null
        },
        json: async () => ({ products: [productFixture] })
      }))
    );

    const page = await fetchShopifyProductsPage(context, { pageSize: 50 });

    expect(page.products).toHaveLength(1);
    expect(page.products[0]?.externalProductId).toBe("632910392");
    expect(page.nextPageCursor).toBe("abc123");
  });
});

describe("fetchShopifyProductById", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when Shopify responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => "Not Found"
      }))
    );

    const product = await fetchShopifyProductById(context, "missing");
    expect(product).toBeNull();
  });
});
