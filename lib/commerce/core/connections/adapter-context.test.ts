import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/commerce/core/connections/platform-connection-repo", () => ({
  findConnectionByStoreDomain: vi.fn(),
  getConnectionStatusByStoreDomain: vi.fn()
}));

vi.mock("@/lib/commerce/adapters/shopify/shopify-token-service", () => ({
  resolveShopifyConnection: vi.fn(),
  ShopifyTokenError: class ShopifyTokenError extends Error {}
}));

import { resolveShopifyConnection } from "@/lib/commerce/adapters/shopify/shopify-token-service";
import {
  findConnectionByStoreDomain,
  getConnectionStatusByStoreDomain
} from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  CommerceSyncError,
  requirePersistedLinkedShopConnection
} from "@/lib/commerce/core/connections/adapter-context";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";

const connection = {
  commerce_platform_connection_pk: 7,
  tenant_fk: 42,
  platform_type: "shopify",
  external_store_id: "gid://shopify/Shop/7",
  store_domain: "demo.myshopify.com",
  store_display_name: "Demo",
  install_status: "connected",
  auth_type: "oauth",
  access_token_encrypted: null,
  refresh_token_encrypted: null,
  scopes_json: ["read_products"],
  acquisition_source: "shopify_app_store",
  billing_source: "none",
  platform_billing_status: "not_required",
  installed_at: null,
  connected_at: null,
  uninstalled_at: null,
  last_synced_at: null,
  raw_platform_payload_json: null,
  created_on: "2026-07-21T00:00:00Z",
  updated_on: "2026-07-21T00:00:00Z"
} satisfies CommercePlatformConnectionRow;

const status = {
  connectionId: 7,
  storeDomain: "demo.myshopify.com",
  storeDisplayName: "Demo",
  installStatus: "connected" as const,
  tenantLinked: true,
  tenantPk: 42,
  tenantName: "Demo tenant",
  connectedAt: null,
  installedAt: null
};

describe("requirePersistedLinkedShopConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findConnectionByStoreDomain).mockResolvedValue(connection);
    vi.mocked(getConnectionStatusByStoreDomain).mockResolvedValue(status);
  });

  it("loads a linked local connection without resolving Shopify tokens", async () => {
    await expect(requirePersistedLinkedShopConnection("demo.myshopify.com")).resolves.toEqual({
      connection,
      status
    });
    expect(resolveShopifyConnection).not.toHaveBeenCalled();
  });

  it("still requires a tenant link", async () => {
    vi.mocked(findConnectionByStoreDomain).mockResolvedValue({ ...connection, tenant_fk: null });

    await expect(requirePersistedLinkedShopConnection("demo.myshopify.com")).rejects.toMatchObject({
      name: "CommerceSyncError",
      code: "TENANT_NOT_LINKED"
    } satisfies Partial<CommerceSyncError>);
  });
});
