import { beforeEach, describe, expect, it, vi } from "vitest";

import productFixture from "@/lib/commerce/adapters/shopify/__fixtures__/product-single.json";
import { normalizeShopifyProduct } from "@/lib/commerce/adapters/shopify/normalize";

vi.mock("@/lib/commerce/core/connections/adapter-context", () => ({
  requireLinkedShopConnection: vi.fn(),
  getAdapterForConnection: vi.fn(),
  CommerceSyncError: class CommerceSyncError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
    }
  }
}));

vi.mock("@/lib/commerce/core/products/external-product-repo", () => ({
  upsertExternalProduct: vi.fn(async () => ({ productPk: 99, created: true })),
  upsertExternalVariants: vi.fn(async () => 2),
  markExternalProductsAbsentSince: vi.fn(async () => 0)
}));

vi.mock("@/lib/commerce/core/mapping/mapping-repo", () => ({
  ensureMappingForExternalProduct: vi.fn(async () => undefined)
}));

vi.mock("@/lib/commerce/core/sync/sync-run-repo", () => ({
  createSyncRun: vi.fn(async () => 501),
  completeSyncRun: vi.fn(async () => undefined),
  touchConnectionLastSynced: vi.fn(async () => undefined),
  getLatestSyncRun: vi.fn(async () => null)
}));

vi.mock("@/lib/commerce/core/billing/billing-service", () => ({
  assertCommerceFeatureEntitlement: vi.fn(async () => undefined)
}));

import {
  getAdapterForConnection,
  requireLinkedShopConnection
} from "@/lib/commerce/core/connections/adapter-context";
import { upsertExternalProduct } from "@/lib/commerce/core/products/external-product-repo";
import { completeSyncRun, createSyncRun } from "@/lib/commerce/core/sync/sync-run-repo";
import { runProductSync } from "@/lib/commerce/core/sync/sync-service";

describe("runProductSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists paginated products and completes sync run", async () => {
    const normalized = normalizeShopifyProduct(productFixture);
    vi.mocked(requireLinkedShopConnection).mockResolvedValue({
      connection: {
        commerce_platform_connection_pk: 7,
        tenant_fk: 3,
        platform_type: "shopify",
        external_store_id: "123",
        store_domain: "demo.myshopify.com",
        store_display_name: "Demo",
        install_status: "connected",
        auth_type: "oauth",
        access_token_encrypted: Buffer.from("x"),
        refresh_token_encrypted: null,
        scopes_json: ["read_products"],
        acquisition_source: "direct",
        billing_source: "none",
        platform_billing_status: "not_required",
        installed_at: null,
        connected_at: null,
        uninstalled_at: null,
        last_synced_at: null,
        raw_platform_payload_json: null,
        created_on: new Date(),
        updated_on: new Date()
      },
      status: {
        connectionId: 7,
        storeDomain: "demo.myshopify.com",
        storeDisplayName: "Demo",
        installStatus: "connected",
        tenantLinked: true,
        tenantPk: 3,
        tenantName: null,
        connectedAt: null,
        installedAt: null
      },
      context: {
        connectionId: 7,
        tenantId: 3,
        externalStoreId: "123",
        storeDomain: "demo.myshopify.com",
        accessToken: "token",
        scopes: ["read_products"]
      }
    });

    vi.mocked(getAdapterForConnection).mockReturnValue({
      platformType: "shopify",
      fetchProducts: vi.fn(async () => ({
        products: [normalized],
        nextPageCursor: null
      }))
    } as never);

    const result = await runProductSync("demo.myshopify.com", "manual");

    expect(createSyncRun).toHaveBeenCalledWith(7, "shopify", "manual");
    expect(upsertExternalProduct).toHaveBeenCalled();
    expect(completeSyncRun).toHaveBeenCalledWith(
      501,
      "succeeded",
      expect.objectContaining({ productsSeen: 1, productsCreated: 1, variantsSeen: 2 })
    );
    expect(result.status).toBe("succeeded");
  });
});
