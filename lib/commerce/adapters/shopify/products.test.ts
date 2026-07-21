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
    vi.unstubAllEnvs();
  });

  it("normalizes products and parses next page cursor", async () => {
    vi.stubEnv("SHOPIFY_API_VERSION", "");
    const fetchMock = vi.fn(async () => ({
        ok: true,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "link"
              ? '<https://demo.myshopify.com/admin/api/2026-07/products.json?page_info=abc123&limit=50>; rel="next"'
              : null
        },
        json: async () => ({ products: [productFixture] })
      }));
    vi.stubGlobal("fetch", fetchMock);

    const page = await fetchShopifyProductsPage(context, { pageSize: 50 });

    expect(page.products).toHaveLength(1);
    expect(page.products[0]?.externalProductId).toBe("632910392");
    expect(page.nextPageCursor).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://demo.myshopify.com/admin/api/2026-07/products.json?limit=50",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Shopify-Access-Token": "shpat_test" })
      })
    );
  });

  it("honors a configured Shopify API version", async () => {
    vi.stubEnv("SHOPIFY_API_VERSION", "2026-04");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      json: async () => ({ products: [] })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchShopifyProductsPage(context, { pageSize: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://demo.myshopify.com/admin/api/2026-04/products.json?limit=10",
      expect.any(Object)
    );
  });
});

describe("fetchShopifyProductById", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
